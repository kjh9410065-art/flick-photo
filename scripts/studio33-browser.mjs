import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new','--remote-debugging-pipe','--no-first-run','--disable-background-networking','--user-data-dir='+await mkdtemp(join(tmpdir(),'flick-photo-qa-'))],
  {stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});
const pending=new Map(), errors=[];
let seq=0, buffer='', sessionId;
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data',chunk=>{
  buffer+=chunk;
  let i;
  while((i=buffer.indexOf('\0'))!==-1){
    const m=JSON.parse(buffer.slice(0,i)); buffer=buffer.slice(i+1);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
  }
});
function call(method,params={}){
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},30000);
    pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});
    chrome.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');
  });
}
async function evaluate(fn,...args){
  const r=await call('Runtime.evaluate',{expression:'('+fn+')('+args.map(x=>JSON.stringify(x)).join(',')+')',awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
function captureBlobs(){
  window.qaBlobs=new Map();
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const url=create(blob);window.qaBlobs.set(url,blob);return url;};
  URL.revokeObjectURL=url=>{window.qaBlobs.delete(url);revoke(url);};
}
async function ready(selector){
  for(let i=0;i<100;i++){
    if(await evaluate(s=>Boolean(document.querySelector(s)),selector))return;
    await new Promise(r=>setTimeout(r,50));
  }
  throw Error('Missing '+selector+' '+JSON.stringify(await evaluate(()=>[location.href,document.querySelector('#status')?.textContent,document.querySelector('#notice')?.textContent,document.querySelector('#tool-title')?.textContent]))+' '+errors.join(','));
}
try {
  const {targetId}=await call('Target.createTarget',{url:'about:blank'});
  ({sessionId}=await call('Target.attachToTarget',{targetId,flatten:true}));
  await call('Runtime.enable');
  await call('Page.navigate',{url:process.env.FLICK_TEST_URL || 'http://127.0.0.1:4173'});
  await ready('#try-demo');
  for(let i=0;i<100&&!(await evaluate(()=>document.readyState==='complete'));i++)await new Promise(r=>setTimeout(r,50));
  for(const width of [280,320,360,390,430,640,768,820,1024,1280,1920]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:width<640?480:900,deviceScaleFactor:1,mobile:false});
    const overflow=await evaluate(()=>[document.documentElement.scrollWidth,innerWidth,...[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right])]); assert.ok(overflow[0]<=overflow[1],JSON.stringify(overflow));
  }
  await evaluate(captureBlobs);
  await evaluate(async()=>{const b=document.querySelector('#try-demo');for(let i=0;i<200&&!b.onclick;i++)await new Promise(r=>setTimeout(r,25));if(!b.onclick)throw Error('App did not initialize');await b.onclick();});
  await ready('#format');
  const result=await evaluate(async()=>{
    const q=s=>document.querySelector(s);
    const change=(s,v,event='change')=>{q(s).value=v;q(s).dispatchEvent(new Event(event,{bubbles:true}));};
    const click=s=>q(s).click();
    const tool=s=>click('.tool-button[data-tool="'+s+'"]');
    tool('compress');
    change('#format','image/jpeg');
    change('#compression-mode','target');
    change('#target-size',500,'input');
    change('#target-unit',1048576);
    if(Number(q('#target-size').value)!==500/1024)throw Error('KB to MB changed bytes');
    change('#target-size',1.5,'input');
    tool('convert');tool('compress');
    if(q('#target-unit').value!=='1048576'||Number(q('#target-size').value)!==1.5)throw Error('tool switch lost target');
    change('#format','image/png');change('#format','image/jpeg');
    if(q('#target-unit').value!=='1048576'||Number(q('#target-size').value)!==1.5)throw Error('format switch lost target');
    click('#process');
    for(let i=0;i<200&&q('#download').hidden;i++)await new Promise(r=>setTimeout(r,25));
    const blob=window.qaBlobs.get(q('#download').href);
    const bitmap=await createImageBitmap(blob);
    const result={mime:blob.type,bytes:blob.size,width:bitmap.width,height:bitmap.height,status:q('#result-stats').textContent};
    bitmap.close();
    return result;
  });
  assert.equal(result.mime,'image/jpeg');
  assert.ok(result.bytes<=1572864);
  assert.match(result.status,/달성/);
  assert.ok(result.width>0&&result.height>0);
  for(const width of [280,320,360,390,430,640,768,820,1024,1280,1920]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:width<640?480:900,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'studio '+width);
  }
  const storage = await evaluate(async()=>{
    const {draftOperation,saveDraft,readDraft,deleteDraft}=await import('/drafts.js');
    const draft={version:1,items:[{file:new File(['original'],'photo.jpg',{type:'image/jpeg'})}]};
    await saveDraft(draft);
    let failed=false;
    try {await draftOperation('readwrite',store=>{
      store.put({version:999},'draft');
      throw new DOMException('Injected storage limit','QuotaExceededError');
    });}catch(e){failed=e.name==='QuotaExceededError';}
    const kept=await readDraft();
    await deleteDraft();
    return [failed,kept.version,await kept.items[0].file.text(),(await readDraft())===undefined];
  });
  assert.deepEqual(storage,[true,1,'original',true]);
  const webp = await evaluate(async()=>{
    const q=s=>document.querySelector(s);
    const update=(s,v,type='change')=>{q(s).value=v;q(s).dispatchEvent(new Event(type,{bubbles:true}));};
    update('#format','image/webp');
    update('#target-unit',1024);
    update('#target-size',100,'input');
    async function output(){
      q('#process').click();
      for(let i=0;i<300&&q('#download').hidden;i++)await new Promise(r=>setTimeout(r,25));
      const blob=window.qaBlobs.get(q('#download').href);
      const image=await createImageBitmap(blob);
      const value=[blob.type,blob.size,image.width,image.height,q('#result-stats').textContent];
      image.close();
      return value;
    }
    const attainable=await output();
    update('#target-size',1/1024,'input');
    const impossible=await output();
    return {attainable,impossible};
  });
  assert.equal(webp.attainable[0],'image/webp');
  assert.ok(webp.attainable[1]<=102400);
  assert.match(webp.attainable[4],/· 달성/);
  assert.ok(webp.impossible[1]>1);
  assert.deepEqual(webp.impossible.slice(2,4),[result.width,result.height]);
  assert.match(webp.impossible[4],/미달성/);
  const downloadDir=await mkdtemp(join(tmpdir(),'flick-photo-download-'));
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const edited=await evaluate(async()=>{
    const q=s=>document.querySelector(s);
    const wait=async fn=>{for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('UI timeout');};
    const tool=name=>q('.tool-button[data-tool="'+name+'"]').click();
    const button=text=>{const b=[...document.querySelectorAll('#tool-settings button')].find(x=>x.textContent.includes(text));if(!b)throw Error('Missing '+text);b.click();};
    const input=(s,v,event='input')=>{const el=q(s);el.value=v;el.dispatchEvent(new Event(event,{bubbles:true}));if(event==='input')el.dispatchEvent(new Event('change',{bubbles:true}));};
    const fixture=async(type,name)=>{
      const c=document.createElement('canvas');c.width=96;c.height=64;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#ef5630';ctx.fillRect(12,10,40,42);
      ctx.fillStyle='#37a0e6';ctx.fillRect(46,18,42,36);
      return new File([await new Promise(r=>c.toBlob(r,type,.9))],name,{type});
    };
    const paste=(files,target=document.body)=>{
      const transfer=new DataTransfer();for(const file of files)transfer.items.add(file);
      target.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));
    };
    const output=async(download=false)=>{
      q('#process').click();
      await wait(()=>!q('#download').hidden&&!q('#process').disabled);
      const link=q('#download'), blob=window.qaBlobs.get(link.href);
      const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
      const image=await createImageBitmap(blob), c=document.createElement('canvas');c.width=image.width;c.height=image.height;
      const ctx=c.getContext('2d');ctx.drawImage(image,0,0);image.close();
      const pixels=ctx.getImageData(0,0,c.width,c.height).data;
      let transparent=0;for(let i=3;i<pixels.length;i+=4)if(!pixels[i])transparent++;
      if(download)link.click();
      return {name:link.download,mime:blob.type,w:c.width,h:c.height,transparent,bytes:await hash(await blob.arrayBuffer()),pixels:await hash(pixels)};
    };
    window.studioQa={q,wait,tool,button,input,fixture,paste,output};
    confirm=()=>true;
    q('#remove-selected').click();
    const files=await Promise.all(['jpeg','png','webp'].map(x=>fixture('image/'+x,'fixture-'+x+'.'+(x==='jpeg'?'jpg':x))));
    paste(files);
    await wait(()=>q('#image-count').textContent==='3');
    paste([new File(['bad'],'bad.png',{type:'image/png'})]);
    await wait(()=>q('#notice-text').textContent.includes('bad.png'));
    if(q('#image-count').textContent!=='3')throw Error('Corrupt paste entered workspace');
    q('#process').click();paste([files[0]]);
    await wait(()=>!q('#process').disabled);
    if(q('#image-count').textContent!=='3')throw Error('Paste entered during processing');
    const result=[];
    for(let i=0;i<3;i++){
      document.querySelectorAll('.thumb button[aria-pressed]')[i].click();
      tool('adjust');input('#adjust-brightness',[22,-15,35][i]);
      tool('filters');document.querySelectorAll('button[data-filter]')[i+1].click();
      tool('crop');input('#crop-ratio',1,'change');button('자르기 적용');
      tool('rotate');button('시계 방향 90');button('좌우 반전');button('상하 반전');
      tool('text');button('텍스트 추가');input('#text-content','QA '+i);
      if(i===1){
        paste([files[0]],q('#text-content'));
        if(q('#image-count').textContent!=='3')throw Error('Text paste imported an image');
        tool('watermark');
        const transfer=new DataTransfer();transfer.items.add(await fixture('image/png','logo.png'));
        q('#logo-file').files=transfer.files;q('#logo-file').dispatchEvent(new Event('change'));
        await wait(()=>Boolean(q('#logo-width')));
      }
      tool('detail');input('#sharpness',21);input('#global-blur',1);
      q('#undo').click();
      result.push(await output());
    }
    document.querySelectorAll('.thumb button[aria-pressed]')[1].click();
    tool('resize');q('.saved-presets').open=true;
    await wait(()=>Boolean(q('#saved-preset')));
    prompt=()=> 'QA output preset';button('현재 설정 저장');
    await wait(()=>q('#saved-preset').options.length===2);
    q('#draft-panel').open=true;await wait(()=>!q('#draft-save').disabled);
    q('#draft-save').click();
    await wait(()=>q('#draft-message').textContent.includes('이미지 3장')&&!q('#draft-save').disabled);
    sessionStorage.setItem('studioQaOutput',output.toString());
    return result;
  });
  await call('Page.reload',{ignoreCache:true});
  await ready('#draft-panel');
  await evaluate(captureBlobs);
  await evaluate(async()=>{
    await new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true});});
    const open=document.querySelector('[data-open-studio]');
    for(let i=0;i<200&&!open.onclick;i++)await new Promise(r=>setTimeout(r,25));
    if(!open.onclick)throw Error('App did not initialize after reload');
    open.click();
    document.querySelector('#draft-panel').open=true;
  });
  const restored=await evaluate(async(outputSource)=>{
    const q=s=>document.querySelector(s),wait=async fn=>{for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('restore UI timeout');};
    const output=new Function('q','wait','return ('+outputSource+')')(q,wait);
    confirm=()=>true;
    await wait(()=>q('#draft-message').textContent.includes('이미지 3장')&&!q('#draft-load').disabled);
    q('#draft-load').click();
    await wait(()=>q('#image-count').textContent==='3'&&!q('#redo').disabled);
    const out=[];
    for(let i=0;i<3;i++){
      document.querySelectorAll('.thumb button[aria-pressed]')[i].click();
      if(q('#redo').disabled||q('#undo').disabled)throw Error('Restored history missing');
      out.push(await output(true));
      q('#redo').click();
      if((await output()).pixels===out[i].pixels)throw Error('Redo did not affect output');
      q('#undo').click();
      if((await output()).pixels!==out[i].pixels)throw Error('Undo did not restore output');
    }
    const {readDraft,saveDraft}=await import('/drafts.js');
    const previous=await readDraft();
    const invalid=structuredClone(previous);
    invalid.assets[0].blob=new Blob(['broken'],{type:'image/png'});
    await saveDraft(invalid);
    q('#draft-panel').open=true;
    q('#draft-load').click();
    await wait(()=>q('#draft-message').textContent.includes('작업 저장소를 사용할 수 없습니다'));
    document.querySelectorAll('.thumb button[aria-pressed]')[1].click();
    if((await output()).pixels!==out[1].pixels)throw Error('Corrupt restore damaged the open workspace');
    await saveDraft(previous);
    q('#draft-delete').click();
    await wait(()=>q('#draft-message').textContent.includes('저장된 작업이 없습니다'));
    const tool=name=>q('.tool-button[data-tool="'+name+'"]').click();
    const button=text=>{const node=[...document.querySelectorAll('#tool-settings button')].find(b=>b.textContent.includes(text));if(!node)throw Error('Missing '+text);node.click();};
    const input=(s,v,event='input')=>{const node=q(s);node.value=v;node.dispatchEvent(new Event(event,{bubbles:true}));if(event==='input')node.dispatchEvent(new Event('change',{bubbles:true}));};
    document.querySelectorAll('.thumb button[aria-pressed]')[1].click();
    tool('resize');q('.saved-presets').open=true;
    await wait(()=>Boolean(q('#saved-preset')));
    if(q('#saved-preset').options[1]?.textContent!=='QA output preset')throw Error('Preset did not survive reload');
    q('#saved-preset').selectedIndex=1;button('선택 프리셋 적용');
    if((await output()).pixels!==out[1].pixels)throw Error('Preset damaged the edit');
    q('.saved-presets').open=true;await wait(()=>Boolean(q('#saved-preset')));
    q('#saved-preset').selectedIndex=1;prompt=()=> 'Renamed QA';button('선택 프리셋 이름 변경');
    await wait(()=>q('#saved-preset').options[1]?.textContent==='Renamed QA');
    q('#saved-preset').selectedIndex=1;button('선택 프리셋 삭제');
    await wait(()=>q('#saved-preset').options.length===1);
    prompt=()=> 'Clear QA';button('현재 설정 저장');
    await wait(()=>q('#saved-preset').options.length===2);
    q('#draft-clear').click();
    const {draftOperation}=await import('/drafts.js');
    for(let i=0;i<100;i++){
      if(!await draftOperation('readonly',s=>s.get('presets')))break;
      if(i===99)throw Error('Clear failed');
      await new Promise(r=>setTimeout(r,20));
    }
    await wait(()=>!q('#draft-clear').disabled);
    tool('regions');button('모자이크 영역 추가');
    const mosaic=await output();
    if(mosaic.pixels===out[1].pixels)throw Error('Mosaic did not affect pixels');
    button('흐림 영역 추가');
    if((await output()).pixels===mosaic.pixels)throw Error('Regional blur did not affect pixels');
    tool('frame');input('#frame-padding',6);input('#frame-border',2);q('#frame-circle').click();
    const frame=await output();
    if(frame.w!==80||frame.h!==80||!frame.transparent)throw Error('Circular frame output mismatch');
    q('#batch-process').click();
    await wait(()=>q('#status').textContent.includes('성공 3장'));
    q('#make-zip').click();
    await wait(()=>!q('#zip-download').hidden);
    q('#zip-download').click();
    tool('collage');input('#collage-width',80);input('#collage-height',64);input('#collage-gap',4);
    button('3장 합치기');
    await wait(()=>q('#image-count').textContent==='4'&&!q('#process').disabled);
    const horizontal=await output();
    if(horizontal.w!==248||horizontal.h!==64)throw Error('Horizontal collage dimensions '+JSON.stringify(horizontal));
    const checks=document.querySelectorAll('.thumb-select');checks[3].click();
    tool('collage');input('#collage-direction','vertical','change');button('3장 합치기');
    await wait(()=>q('#image-count').textContent==='5'&&!q('#process').disabled);
    const vertical=await output();
    if(vertical.w!==80||vertical.h!==200)throw Error('Vertical collage dimensions '+JSON.stringify(vertical));
    const blob=window.qaBlobs.get(q('#download').href);
    const data=new DataTransfer();
    for(let i=0;i<16;i++)data.items.add(new File([blob],'limit-'+i+'.png',{type:'image/png'}));
    document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
    await wait(()=>q('#image-count').textContent==='20');
    if(!q('#notice-text').textContent.includes('20'))throw Error('Missing clipboard limit notice');
    q('#reset').click();
    if((await output()).pixels!==vertical.pixels)throw Error('Reset changed the collage original');
    tool('resize');
    input('#resize-mode','percent','change');button('50%');
    const resized=await output();
    if(resized.w!==40||resized.h!==100)throw Error('Resize output mismatch');
    tool('regions');
    return out;
  }, await evaluate(()=>window.studioQa?.output?.toString()||sessionStorage.getItem('studioQaOutput')));
  assert.deepEqual(restored,edited);
  const {readFile}=await import('node:fs/promises');
  const {createHash}=await import('node:crypto');
  for(const image of restored){
    let bytes;
    for(let i=0;i<100&&!bytes;i++){try{bytes=await readFile(join(downloadDir,image.name));}catch{await new Promise(r=>setTimeout(r,30));}}
    assert.ok(bytes,image.name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),image.bytes);
    assert.deepEqual([image.w,image.h],[64,64]);
    assert.equal(image.transparent>0,image.mime!=='image/jpeg');
  }
  let zipBytes;
  for(let i=0;i<100&&!zipBytes;i++){try{zipBytes=await readFile(join(downloadDir,'FLiCK-Photo.zip'));}catch{await new Promise(r=>setTimeout(r,30));}}
  assert.ok(zipBytes,'ZIP download');
  const {crc32}=await import('node:zlib');
  let offset=0, entries=0;
  while(zipBytes.readUInt32LE(offset)===0x04034b50){
    const bytes=zipBytes.readUInt32LE(offset+18);
    const start=offset+30+zipBytes.readUInt16LE(offset+26)+zipBytes.readUInt16LE(offset+28);
    assert.equal(crc32(zipBytes.subarray(start,start+bytes)),zipBytes.readUInt32LE(offset+14));
    offset=start+bytes;entries++;
  }
  assert.equal(entries,3);
  assert.equal(zipBytes.readUInt32LE(offset),0x02014b50);
  console.log(JSON.stringify({restored,zipEntries:entries}));

  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const touch=await evaluate(async()=>{
    document.querySelector('#close-panel').click();
    document.querySelector('#draft-panel').open=false;
    document.querySelector('#dismiss-notice').click();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const canvas=document.querySelector('#image-frame');
    canvas.scrollIntoView({block:'center'});
    const r=canvas.getBoundingClientRect();
    const point={x:Math.round(r.left+r.width*.2),y:Math.round(r.top+r.height*.2),endX:Math.round(r.left+r.width*.65),endY:Math.round(r.top+r.height*.65)};
    if(!canvas.contains(document.elementFromPoint(point.x,point.y)))throw Error('Touch canvas obscured: '+document.elementFromPoint(point.x,point.y)?.outerHTML.slice(0,120)+' '+JSON.stringify(point));
    return point;
  });
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touch.x,y:touch.y}]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.endX,y:touch.endY}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await evaluate(()=>Boolean(document.querySelector('[data-object-kind="region"]'))),true,'touch region');
  await call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'landscapePrimary',angle:90}});
  assert.equal(await evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'landscape overflow');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(webp));
  console.log(JSON.stringify(result));
} finally {chrome.kill();}

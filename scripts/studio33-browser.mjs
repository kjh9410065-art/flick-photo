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
    const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},10000);
    pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});
    chrome.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');
  });
}
async function evaluate(fn,...args){
  const r=await call('Runtime.evaluate',{expression:'('+fn+')('+args.map(x=>JSON.stringify(x)).join(',')+')',awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function ready(selector){
  for(let i=0;i<100;i++){
    if(await evaluate(s=>Boolean(document.querySelector(s)),selector))return;
    await new Promise(r=>setTimeout(r,50));
  }
  throw Error('Missing '+selector);
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
  await evaluate(()=>document.querySelector('#try-demo').click());
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
    const blob=await fetch(q('#download').href).then(r=>r.blob());
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
      const blob=await fetch(q('#download').href).then(r=>r.blob());
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
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(webp));
  console.log(JSON.stringify(result));
} finally {chrome.kill();}

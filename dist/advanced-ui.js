import {FILTERS,ADJUSTMENTS,clamp} from './effects.js?v=editor-3';
import {defaults,clone,frameDefaults,outputDimensions,layerBox,renderImage,composeImages,outputName} from './engine.js?v=3.3';
import {addAsset,assetInfo,pruneAssets} from './assets.js?v=3.3';

export function setupAdvanced(api){
  const {el,field,checkbox,selectField,action,hint,active,change,notice}=api;
  let selectedLayer=null,selectedRegion=null,drag=null,thumbVersion=0,thumbCache=null;
  const collage={direction:'horizontal',cellWidth:640,cellHeight:640,gap:12,background:'#ffffff',fit:'contain'};
  const frame=document.getElementById('image-frame'),overlay=el('div',undefined,'edit-overlays');overlay.id='edit-overlays';frame.append(overlay);
  const logoInput=el('input');logoInput.type='file';logoInput.accept='image/jpeg,image/png,image/webp';logoInput.hidden=true;logoInput.id='logo-file';document.body.append(logoInput);
  const settings=()=>active()?.settings;
  const dims=()=>outputDimensions(active());
  const layer=()=>settings()?.layers?.find(l=>l.id===selectedLayer);
  const region=()=>settings()?.regions?.find(r=>r.id===selectedRegion);
  function ensure(){const s=settings();if(!s)return;s.adjust={...ADJUSTMENTS,...s.adjust};s.frame={...frameDefaults(),...s.frame};s.layers??=[];s.regions??=[];if(!s.layers.some(l=>l.id===selectedLayer))selectedLayer=s.layers[0]?.id||null;if(!s.regions.some(r=>r.id===selectedRegion))selectedRegion=s.regions[0]?.id||null;}
  function controlRange(label,key,value,min,max,step,set,reset=0){
    const wrap=el('div',undefined,'adjust-control'),l=el('label',label,'field'),out=el('output',`${value}`),input=el('input');input.id=key;input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;l.htmlFor=key;out.id=`${key}-value`;l.append(out);let before=null;
    input.oninput=()=>{if(!before)before=clone(settings());set(Number(input.value),settings());out.value=String(Number(input.value));api.discard(active());api.schedulePreview();api.updateStats();draw();};
    input.onchange=()=>{if(before)api.historyPush(active(),before);before=null;api.refresh();};
    const b=action('↺',()=>change(s=>set(reset,s)),'reset-value');b.setAttribute('aria-label',`${label} 초기화`);wrap.append(l,input,b);return wrap;
  }
  function colorControl(label,id,value,set){const row=el('div',undefined,'color-control'),labelEl=el('label',label,'field'),picker=el('input'),text=el('input');picker.type='color';picker.id=id;picker.value=/^#[0-9a-f]{6}$/i.test(value)?value:'#ffffff';picker.setAttribute('aria-label',`${label} 색상 선택`);text.type='text';text.value=picker.value;text.maxLength=7;text.setAttribute('aria-label',`${label} HEX`);let before=null;
    const update=v=>{if(!/^#[0-9a-f]{6}$/i.test(v))return;if(!before)before=clone(settings());set(v,settings());picker.value=text.value=v;api.discard(active());api.schedulePreview();api.updateStats();};picker.oninput=()=>update(picker.value);text.oninput=()=>update(text.value);const finish=()=>{if(before)api.historyPush(active(),before);before=null;};picker.onchange=text.onchange=finish;labelEl.htmlFor=id;row.append(labelEl,picker,text);return row;}
  const row=(...children)=>{const r=el('div',undefined,'field-row');r.append(...children);return r;};
  function setLayer(fn){change(s=>{const l=s.layers.find(l=>l.id===selectedLayer);if(l)fn(l);});}
  function setRegion(fn){change(s=>{const r=s.regions.find(r=>r.id===selectedRegion);if(r)fn(r);});}
  function addText(watermark=false){if(settings().layers.length>=20){notice('텍스트·로고 레이어는 이미지당 최대 20개까지 추가할 수 있습니다.');return;}selectedLayer=crypto.randomUUID();let d;try{d=dims();}catch(e){notice(e.message);return;}change(s=>s.layers.push({id:selectedLayer,type:'text',text:watermark?'© FLiCK Photo':'새 텍스트',font:'Malgun Gothic',fontSize:Math.max(18,Math.min(96,Math.round(d.w*.06))),weight:700,color:'#ffffff',opacity:watermark?65:100,x:.5,y:watermark?.88:.5,rotation:0,watermark}));}
  logoInput.onchange=async()=>{const file=logoInput.files?.[0];logoInput.value='';if(!file||api.isBusy())return;if(settings().layers.length>=20){notice('레이어는 최대 20개까지 추가할 수 있습니다.');return;}try{const a=await api.runTask(()=>addAsset(file),'로고 이미지를 읽는 중입니다…');if(!a)return;const d=dims();selectedLayer=crypto.randomUUID();change(s=>s.layers.push({id:selectedLayer,type:'image',assetId:a.id,name:a.name,w:.25,h:.25*d.w/d.h*a.h/a.w,x:.5,y:.85,opacity:80,rotation:0,watermark:true}));}catch(e){notice(e.message);}};
  function layerList(p,watermarkOnly=false){const list=el('div',undefined,'layer-list');for(const l of settings().layers.filter(l=>!watermarkOnly||l.watermark)){const b=action(`${l.type==='image'?'▧':'T'} ${l.type==='text'?(l.text||'빈 텍스트').slice(0,25):l.name}`,()=>{selectedLayer=l.id;api.refresh();},`layer-choice${selectedLayer===l.id?' active':''}`);b.setAttribute('aria-pressed',String(selectedLayer===l.id));list.append(b);}p.append(list);}
  function layerFields(p){const l=layer();if(!l){p.append(hint('텍스트 또는 로고를 추가한 뒤 레이어를 선택하세요.'));return;}
    if(l.type==='text'){
      const label=el('label','텍스트 내용','field'),area=el('textarea');area.id='text-content';area.rows=3;area.maxLength=500;area.value=l.text;let before=null;area.oninput=()=>{if(!before)before=clone(settings());l.text=area.value;api.discard(active());api.schedulePreview();draw();api.updateStats();};area.onchange=area.onblur=()=>{if(before)api.historyPush(active(),before);before=null;};label.append(area);p.append(label,selectField('글꼴','text-font',[['Malgun Gothic','맑은 고딕 / 한국어'],['Arial','Arial · 산세리프'],['Georgia','Georgia · 세리프'],['Courier New','Courier New · 고정폭'],['sans-serif','시스템 기본']],l.font,v=>setLayer(l=>l.font=v)),row(field('글자 크기 (px)','text-size',l.fontSize,v=>setLayer(l=>l.fontSize=Math.max(6,Math.min(2000,v))),{min:6,max:2000}),selectField('굵기','text-weight',[[400,'보통'],[700,'굵게']],l.weight,v=>setLayer(l=>l.weight=Number(v)))),colorControl('글자색','text-color',l.color,(v,s)=>{const target=s.layers.find(t=>t.id===selectedLayer);if(target)target.color=v;}));
    }else{p.append(el('div',l.name||'삽입한 로고','tool-info'),field('로고 너비 (%)','logo-width',Math.round(l.w*100),v=>setLayer(l=>{const a=assetInfo(l.assetId),d=dims();l.w=clamp(v/100,.01,2);l.h=l.w*d.w/d.h*a.h/a.w;}),{min:1,max:200}));}
    p.append(controlRange('투명도 (%)','layer-opacity',l.opacity,0,100,1,(v,s)=>{const t=s.layers.find(t=>t.id===selectedLayer);if(t)t.opacity=v;},100),field('회전 (°)','layer-rotation',l.rotation,v=>setLayer(l=>l.rotation=v),{min:-180,max:180}),row(field('가로 위치 (%)','layer-x',Math.round(l.x*100),v=>setLayer(l=>l.x=clamp(v/100,0,1)),{min:0,max:100}),field('세로 위치 (%)','layer-y',Math.round(l.y*100),v=>setLayer(l=>l.y=clamp(v/100,0,1)),{min:0,max:100})),checkbox('이 레이어를 일괄 워터마크에 포함','layer-watermark',!!l.watermark,v=>setLayer(l=>l.watermark=v)),action('선택 레이어 삭제',()=>{const id=selectedLayer;change(s=>s.layers=s.layers.filter(l=>l.id!==id));selectedLayer=null;api.refresh();}),hint('캔버스에서 드래그해 이동합니다. 모서리 핸들로 크기를, 위쪽 핸들로 회전을 조절할 수 있습니다. 방향키는 1px, Shift+방향키는 10px 이동합니다.'));
  }
  function watermarkBatch(){const from=active(),layers=from.settings.layers.filter(l=>l.watermark);if(!layers.length){notice('일괄 적용할 텍스트 또는 로고 워터마크를 먼저 추가하세요.');return;}try{const source=outputDimensions(from);for(const target of api.selected()){if(target===from)continue;const d=outputDimensions(target),before=clone(target.settings);const copies=layers.map(l=>{const copy=clone(l);copy.id=crypto.randomUUID();if(copy.type==='text')copy.fontSize=Math.max(6,Math.min(2000,copy.fontSize*d.w/source.w));else{const a=assetInfo(copy.assetId);copy.h=copy.w*d.w/d.h*a.h/a.w;}return copy;});if(target.settings.layers.filter(l=>!l.watermark).length+copies.length>20)throw Error('한 이미지의 레이어가 20개를 넘습니다. 레이어를 줄여 주세요.');target.settings.layers=[...target.settings.layers.filter(l=>!l.watermark),...copies];api.historyPush(target,before);api.discard(target);}api.refresh();api.status('선택 이미지에 워터마크를 적용했습니다. 위치와 크기는 각 출력 크기에 맞춥니다. 선택 처리 후 다운로드하세요.');}catch(e){notice(e.message);}}
  const presets = {
    photo:[2400,2400,'image/jpeg'],blog:[1600,1600,'image/webp'],shop:[1600,1600,'image/jpeg'],
    profile:[800,800,'image/png'],youtube:[1280,720,'image/jpeg'],instagram:[1080,1080,'image/jpeg'],
    portrait:[1080,1350,'image/jpeg'],vertical:[1080,1920,'image/jpeg']
  };
  function socialPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    const [width,height,mime] = preset;
    // A preset bounds the output without changing the existing crop.
    const current = outputDimensions(active());
    const scale = Math.min(1,width/current.contentW,height/current.contentH);
    change(s => Object.assign(s,{resize:true,resizeMode:'pixels',
      width:Math.max(1,Math.round(current.contentW*scale)),height:Math.max(1,Math.round(current.contentH*scale)),
      lock:true,mime:api.outputMime(mime),targetBytes:0}));
  }

  async function filterThumbs(host){const item=active(),token=++thumbVersion,base=clone(item.settings);base.filter='none';base.filterIntensity=0;base.layers=[];base.regions=[];base.frame=frameDefaults();const key=item.id+JSON.stringify(base);
    if(thumbCache?.key===key){for(const img of host.querySelectorAll('img'))img.src=thumbCache.urls[img.dataset.filter];return;}
    try{const r=await renderImage({...item,settings:base},{preview:true,maxEdge:220});if(token!==thumbVersion)return;const source=URL.createObjectURL(r.blob),smallW=Math.max(1,Math.round(r.w*Math.min(1,220/Math.max(r.w,r.h)))),smallH=Math.max(1,Math.round(r.h*Math.min(1,220/Math.max(r.w,r.h)))),urls={};
      for(const [id] of FILTERS){const s=defaults(smallW,smallH);s.filter=id;s.filterIntensity=100;s.mime='image/png';const out=await renderImage({url:source,w:smallW,h:smallH,settings:s},{preview:true,maxEdge:220});urls[id]=URL.createObjectURL(out.blob);if(token===thumbVersion){const target=[...host.querySelectorAll('img')].find(im=>im.dataset.filter===id);if(target)target.src=urls[id];}}
      URL.revokeObjectURL(source);if(token!==thumbVersion){Object.values(urls).forEach(URL.revokeObjectURL);return;}if(thumbCache)Object.values(thumbCache.urls).forEach(URL.revokeObjectURL);thumbCache={key,urls};
    }catch(e){if(token===thumbVersion){const note=el('p',`썸네일을 만들 수 없습니다. ${e.message}`,'small muted');host.after(note);}}
  }
  function render(tool,p){ensure();const s=settings();if(!s)return;
    if (tool==='resize') {
      p.prepend(selectField('용도별 출력 규격','social-preset',[
        ['custom','사용자 직접 설정'],['photo','일반 사진 편집'],['blog','블로그 이미지'],['shop','쇼핑몰 상품 사진'],
        ['profile','정사각형 프로필'],['youtube','유튜브 썸네일'],['instagram','인스타그램 정사각형'],
        ['portrait','인스타그램 세로 이미지'],['vertical','세로형 영상 썸네일']
      ],'custom',socialPreset),hint('맞춤은 크기와 출력 형식만 바꾸며 비율과 기존 자르기를 유지합니다. 화면을 채우려면 자르기 도구에서 직접 영역을 지정하세요. 확대해도 원본 화질은 개선되지 않습니다.'));
    }
    if(tool==='rotate')p.append(action(`${s.flipX?'✓ ':''}↔ 좌우 반전`,()=>change(s=>s.flipX=!s.flipX)),action(`${s.flipY?'✓ ':''}↕ 상하 반전`,()=>change(s=>s.flipY=!s.flipY)));
    if(tool==='adjust'){
      p.append(hint('원본을 바꾸지 않는 색상 보정입니다. 변경 내용을 즉시 미리 보여드립니다.'));
      for(const [key,label,min,max,step] of [['brightness','밝기',-100,100,1],['contrast','대비',-100,100,1],['saturation','채도',-100,100,1],['exposure','노출 (EV)',-3,3,.1],['temperature','색온도',-100,100,1],['hue','색조 (°)',-180,180,1]])p.append(controlRange(label,`adjust-${key}`,s.adjust[key],min,max,step,(v,s)=>s.adjust[key]=v));
      p.append(action('색상 보정 모두 초기화',()=>change(s=>s.adjust={...ADJUSTMENTS})),hint('색온도: 음수는 차갑게, 양수는 따뜻하게. 색조는 전체 색상환을 회전합니다.'));
    }
    if(tool==='filters'){
      p.append(hint('현재 사진에서 실제로 렌더링한 필터 미리보기입니다.'));const grid=el('div',undefined,'filter-grid');for(const [id,title] of FILTERS){const b=action('',()=>change(s=>s.filter=id),`filter-choice${s.filter===id?' active':''}`);b.dataset.filter=id;b.setAttribute('aria-label',`${title} 필터`);b.setAttribute('aria-pressed',String(s.filter===id));const im=el('img');im.alt='';im.dataset.filter=id;im.width=100;im.height=70;b.append(im,el('span',title));grid.append(b);}p.append(grid,controlRange('필터 강도 (%)','filter-strength',s.filterIntensity,0,100,1,(v,s)=>s.filterIntensity=v,100),action('필터 제거',()=>change(s=>{s.filter='none';s.filterIntensity=100;})));filterThumbs(grid);
    }
    if(tool==='detail'){p.append(hint('선명도와 흐림을 함께 사용할 수 있습니다. 흐림 → 색상·필터 → 선명도 순서로 처리합니다.'),controlRange('선명도','sharpness',s.sharpness,0,100,1,(v,s)=>s.sharpness=v),controlRange('흐림 반경 (px)','global-blur',s.blur,0,30,.5,(v,s)=>s.blur=v),action('선명도·흐림 초기화',()=>change(s=>{s.sharpness=0;s.blur=0;})));}
    if(tool==='text'||tool==='watermark'){
      if(tool==='text')p.append(action('＋ 텍스트 추가',()=>addText(false),'button primary full'));else p.append(action('＋ 텍스트 워터마크',()=>addText(true)),action('＋ 로고 이미지 삽입',()=>logoInput.click(),'button primary full'),hint('PNG·JPG·WebP / 로고당 10 MB·600만 화소, 로고 메모리 합계 40 MB. 투명 PNG를 권장합니다.'));
      layerList(p,tool==='watermark');layerFields(p);if(tool==='watermark')p.append(el('div',undefined,'settings-divider'),action('선택 이미지에 워터마크 일괄 적용',watermarkBatch,'button primary full'),hint('선택한 다른 이미지의 기존 워터마크는 교체합니다. 일반 텍스트 레이어는 유지됩니다. 적용 후 ‘선택 처리’를 누르세요.'));
    }
    if(tool==='frame'){
      p.append(checkbox('투명 배경 유지','frame-transparent',s.frame.background==='transparent',v=>change(s=>s.frame.background=v?'transparent':'#ffffff')));if(s.frame.background!=='transparent')p.append(colorControl('배경색','frame-background',s.frame.background,(v,s)=>s.frame.background=v));
      p.append(field('이미지 여백 (px)','frame-padding',s.frame.padding,v=>change(s=>s.frame.padding=v),{min:0,max:2000}),field('테두리 두께 (px)','frame-border',s.frame.border,v=>change(s=>s.frame.border=v),{min:0,max:2000}),colorControl('테두리색','frame-border-color',s.frame.borderColor,(v,s)=>s.frame.borderColor=v),field('둥근 모서리 반경 (px)','frame-radius',s.frame.radius,v=>change(s=>s.frame.radius=v),{min:0,max:2000}),checkbox('원형 자르기 (중앙 정사각형)','frame-circle',s.frame.circle,v=>change(s=>s.frame.circle=v)),hint('원형은 이미지 중앙을 정사각형으로 잘라 원으로 표시합니다. PNG·WebP에서는 바깥 투명 영역을 유지하며, JPG는 흰색으로 합성합니다. 여백·테두리만큼 최종 크기가 늘어납니다.'),action('테두리·배경 초기화',()=>change(s=>s.frame=frameDefaults())));
    }
    if(tool==='regions'){
      p.append(hint('특정 영역만 모자이크하거나 흐리게 만듭니다. 캔버스의 빈 곳을 드래그해 새 영역을 만들 수도 있어요.'),action('＋ 모자이크 영역 추가',()=>addRegion('mosaic'),'button primary full'),action('＋ 흐림 영역 추가',()=>addRegion('blur')));
      const list=el('div',undefined,'layer-list');for(const [n,r] of s.regions.entries())list.append(action(`${n+1}. ${r.kind==='mosaic'?'모자이크':'영역 흐림'}`,()=>{selectedRegion=r.id;api.refresh();},`layer-choice${r.id===selectedRegion?' active':''}`));p.append(list);const r=region();
      if(r){p.append(selectField('처리 방식','region-kind',[['mosaic','모자이크'],['blur','영역 흐림']],r.kind,v=>setRegion(r=>r.kind=v)),selectField('영역 모양','region-shape',[['rect','사각형'],['circle','원형']],r.shape,v=>setRegion(r=>r.shape=v)),controlRange(r.kind==='mosaic'?'블록 크기 (px)':'흐림 반경 (px)','region-strength',r.strength,2,80,1,(v,s)=>{const t=s.regions.find(t=>t.id===selectedRegion);if(t)t.strength=v;},16));
        for(const pair of [[['X (%)','x'],['Y (%)','y']],[['가로 (%)','w'],['세로 (%)','h']]])p.append(row(...pair.map(([label,key])=>field(label,`region-${key}`,Math.round(r[key]*100),v=>setRegion(r=>{r[key]=clamp(v/100,key==='w'||key==='h'?.005:0,1);r.w=Math.min(r.w,1-r.x);r.h=Math.min(r.h,1-r.y);}),{min:key==='x'||key==='y'?0:1,max:100}))));p.append(action('선택 영역 삭제',()=>{const id=selectedRegion;change(s=>s.regions=s.regions.filter(r=>r.id!==id));selectedRegion=null;api.refresh();}),hint('원형은 선택 상자 안의 최대 정원으로 적용됩니다. 여러 영역은 추가한 순서대로 적용됩니다.'));
      }
    }
    if(tool==='collage'){
      p.append(hint('선택한 이미지의 현재 편집 결과를 새 PNG 한 장으로 합칩니다. 원본 항목은 그대로 보존되며, 만들어진 콜라주도 계속 편집할 수 있습니다.'),selectField('배치 방향','collage-direction',[['horizontal','가로 콜라주'],['vertical','세로 콜라주']],collage.direction,v=>collage.direction=v),row(field('셀 가로 (px)','collage-width',collage.cellWidth,v=>collage.cellWidth=v,{min:32,max:4000}),field('셀 세로 (px)','collage-height',collage.cellHeight,v=>collage.cellHeight=v,{min:32,max:4000})),field('이미지 사이 간격 (px)','collage-gap',collage.gap,v=>collage.gap=v,{min:0,max:500}),selectField('셀 채우기','collage-fit',[['contain','이미지 전체 맞춤'],['cover','셀을 가득 채우기 (중앙 자르기)']],collage.fit,v=>collage.fit=v));
      const bg=el('label','콜라주 배경색','field'),input=el('input');input.type='color';input.id='collage-background';input.value=collage.background;input.oninput=()=>collage.background=input.value;bg.append(input);p.append(bg,action(`선택한 ${api.selected().length}장 합치기`,async()=>{if(api.items.length>=20){notice('새 콜라주를 추가하려면 이미지 수를 19장 이하로 줄여 주세요.');return;}try{const file=await api.runTask(()=>composeImages(api.selected(),collage),'콜라주를 순서대로 만드는 중입니다…');if(file)await api.addCollage(file);}catch(e){notice(e.message);}},'button primary full'),hint('최대 1600만 화소, 각 변 12000px. 셀 크기를 줄이면 메모리 사용량이 줄어듭니다.'));
    }
    if(tool==='batch'||tool==='export'){
      if(tool==='export')p.append(api.formatControl(),api.qualityControl(),api.formatNote());
      p.append(field(tool==='batch'?'일괄 파일명 접두어':'파일명 (확장자 제외)','rename-prefix',s.rename||'',v=>change(s=>s.rename=v),{type:'text'}),hint(`출력 파일명: ${outputName(active(),api.items.indexOf(active()))}`));
      if(tool==='batch')p.append(action('파일명 접두어를 선택 이미지에 적용',()=>{const prefix=settings().rename;for(const target of api.selected()){if(target===active())continue;const before=clone(target.settings);target.settings.rename=prefix;api.historyPush(target,before);api.discard(target);}api.refresh();api.status('일괄 파일명을 설정했습니다. 순번과 실제 출력 형식의 확장자가 붙습니다.');}),hint('예: 여행사진-01.webp. 접두어를 비우면 원본 이름 기반으로 저장합니다.'));
      p.append(hint('고급 효과는 1600만 화소까지, 기본 편집은 4천만 화소까지 지원합니다. 완료 결과는 합계 120 MB까지 메모리에 보관합니다.'));
    }
    if(tool==='history')p.append(el('div',`실행 취소 ${active().history.length}개 · 다시 실행 ${active().future.length}개`,'tool-info'),action('↶ 실행 취소',()=>api.undo(false)),action('↷ 다시 실행',()=>api.undo(true)),hint('이미지별 최근 50개 편집 상태를 보관합니다. 색상·필터·텍스트·워터마크·영역·배경 설정도 함께 복원합니다. Ctrl/⌘+Z · Ctrl/⌘+Shift+Z'));
    if(tool==='restore')p.append(hint('현재 이미지의 모든 편집 효과·레이어·영역·출력 설정을 원래대로 되돌립니다. 원본 파일 자체는 변경되지 않습니다.'),action('현재 이미지 원본 복원',api.reset,'button primary full'),hint('복원 직후 실행 취소로 이전 편집 상태를 되돌릴 수 있습니다.'));
    draw();
  }
  function addRegion(kind){if(settings().regions.length>=20){notice('영역은 이미지당 최대 20개까지 추가할 수 있습니다.');return;}selectedRegion=crypto.randomUUID();change(s=>s.regions.push({id:selectedRegion,x:.2,y:.2,w:.4,h:.35,shape:'rect',kind,strength:kind==='mosaic'?20:12}));}
  function effectiveRegion(r,d){let x=r.x*d.w,y=r.y*d.h,w=r.w*d.w,h=r.h*d.h;if(r.shape==='circle'){const side=Math.min(w,h);x+=(w-side)/2;y+=(h-side)/2;w=h=side;}return {x,y,w,h};}
  function draw(){overlay.replaceChildren();const i=active(),tool=api.tool();frame.classList.toggle('object-editing',['text','watermark','regions'].includes(tool));if(!i||!['text','watermark','regions'].includes(tool)){overlay.hidden=true;return;}overlay.hidden=false;let d;try{d=outputDimensions(i);}catch{return;}ensure();
    const records=tool==='regions'?i.settings.regions:i.settings.layers;
    for(const r of records){if(tool==='watermark'&&!r.watermark)continue;const box=tool==='regions'?effectiveRegion(r,d):layerBox(r,d.w,d.h),isSelected=tool==='regions'?r.id===selectedRegion:r.id===selectedLayer,element=el('div',undefined,`selection-overlay${isSelected?' selected':''}${tool==='regions'&&r.shape==='circle'?' circular':''}`);element.dataset.objectId=r.id;element.dataset.objectKind=tool==='regions'?'region':'layer';const x=tool==='regions'?box.x:box.x-box.w/2,y=tool==='regions'?box.y:box.y-box.h/2;element.style.left=`${x/d.w*100}%`;element.style.top=`${y/d.h*100}%`;element.style.width=`${box.w/d.w*100}%`;element.style.height=`${box.h/d.h*100}%`;if(tool!=='regions')element.style.transform=`rotate(${r.rotation||0}deg)`;
      const label=el('span',tool==='regions'?(r.kind==='mosaic'?'모자이크':'흐림'):r.type==='text'?'텍스트':'로고','overlay-label');element.append(label);
      if(isSelected){for(const handle of ['nw','ne','sw','se']){const b=el('button');b.dataset.editHandle=handle;b.setAttribute('aria-label',`${tool==='regions'?'영역':'레이어'} ${handle} 크기 조절`);b.onkeydown=e=>handleKey(e,r,tool,d,handle);element.append(b);}if(tool!=='regions'){const b=el('button','↻','rotation-handle');b.dataset.editHandle='rotate';b.setAttribute('aria-label','레이어 회전 핸들');element.append(b);}}
      overlay.append(element);
    }
  }
  function point(e){const rect=frame.getBoundingClientRect();return {x:clamp((e.clientX-rect.left)/rect.width,0,1),y:clamp((e.clientY-rect.top)/rect.height,0,1)};}
  frame.addEventListener('pointerdown',e=>{const tool=api.tool();if(!['text','watermark','regions'].includes(tool)||api.isBusy())return;const hit=e.target.closest('[data-object-id]');if(!hit&&tool!=='regions')return;const p=point(e),before=clone(settings());let id=hit?.dataset.objectId;
    if(!id){if(settings().regions.length>=20)return;id=crypto.randomUUID();settings().regions.push({id,x:p.x,y:p.y,w:.005,h:.005,shape:'rect',kind:'mosaic',strength:20});selectedRegion=id;}else if(tool==='regions')selectedRegion=id;else selectedLayer=id;
    const obj=tool==='regions'?region():layer();if(!obj)return;if(tool==='regions'&&obj.shape==='circle'){const d=dims(),b=effectiveRegion(obj,d);Object.assign(obj,{x:b.x/d.w,y:b.y/d.h,w:b.w/d.w,h:b.h/d.h});}drag={owner:active().id,before,start:p,object:clone(obj),id,kind:tool==='regions'?'region':'layer',mode:hit?(e.target.closest('[data-edit-handle]')?.dataset.editHandle||'move'):'new'};frame.setPointerCapture(e.pointerId);e.preventDefault();if(api.mobile())api.panel(false);draw();
  });
  frame.addEventListener('pointermove',e=>{if(!drag||active()?.id!==drag.owner)return;const p=point(e),g=drag,obj=g.kind==='region'?region():layer(),d=dims();if(!obj)return;const dx=p.x-g.start.x,dy=p.y-g.start.y;
    if(g.mode==='move'){obj.x=clamp(g.object.x+dx,0,g.kind==='region'?Math.max(0,1-g.object.w):1);obj.y=clamp(g.object.y+dy,0,g.kind==='region'?Math.max(0,1-g.object.h):1);}
    else if(g.kind==='region'){const o=g.object,anchor=g.mode==='new'?g.start:{x:g.mode.includes('w')?o.x+o.w:o.x,y:g.mode.includes('n')?o.y+o.h:o.y};obj.x=Math.min(p.x,anchor.x);obj.y=Math.min(p.y,anchor.y);obj.w=Math.max(.001,Math.abs(p.x-anchor.x));obj.h=Math.max(.001,Math.abs(p.y-anchor.y));if(obj.shape==='circle'){const side=Math.min(obj.w*d.w,obj.h*d.h);obj.w=Math.max(.001,side/d.w);obj.h=Math.max(.001,side/d.h);obj.x=p.x<anchor.x?anchor.x-obj.w:anchor.x;obj.y=p.y<anchor.y?anchor.y-obj.h:anchor.y;}}
    else if(g.mode==='rotate'){const now=Math.atan2((p.y-obj.y)*d.h,(p.x-obj.x)*d.w),start=Math.atan2((g.start.y-g.object.y)*d.h,(g.start.x-g.object.x)*d.w);obj.rotation=Math.round(g.object.rotation+(now-start)*180/Math.PI);}
    else{const distance=(p)=>Math.hypot((p.x-g.object.x)*d.w,(p.y-g.object.y)*d.h),ratio=clamp(distance(p)/Math.max(1,distance(g.start)),.1,5);if(obj.type==='text')obj.fontSize=Math.round(clamp(g.object.fontSize*ratio,6,2000));else{obj.w=clamp(g.object.w*ratio,.01,2);obj.h=clamp(g.object.h*ratio,.01,2);}}
    api.discard(active());api.schedulePreview();api.updateStats();draw();
  });
  const finish=()=>{if(!drag)return;if(active()?.id===drag.owner){api.historyPush(active(),drag.before);api.discard(active());drag=null;api.refresh();api.status('캔버스에서 편집한 위치·크기를 적용했습니다.');}else drag=null;};frame.addEventListener('pointerup',finish);frame.addEventListener('pointercancel',finish);
  function handleKey(e,obj,tool,d,handle){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?10:1,dx=(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)/d.w,dy=(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)/d.h;change(s=>{const r=(tool==='regions'?s.regions:s.layers).find(r=>r.id===obj.id);if(!r)return;if(tool==='regions'){r.w=clamp(r.w+dx,.001,1-r.x);r.h=clamp(r.h+dy,.001,1-r.y);}else{r.x=clamp(r.x+dx,0,1);r.y=clamp(r.y+dy,0,1);}});const target=[...overlay.querySelectorAll('[data-edit-handle]')].find(b=>b.dataset.editHandle===handle);target?.focus();}
  function clean(){pruneAssets(api.items);if(!api.items.length&&thumbCache){Object.values(thumbCache.urls).forEach(URL.revokeObjectURL);thumbCache=null;thumbVersion++;}}
  return {render,draw,clean,watermarkBatch};
}

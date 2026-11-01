// Every preview/export uses this exact, ordered browser-local pipeline.
import {ADJUSTMENTS,clamp,correctCanvas,sharpenCanvas,boxBlur} from './effects.js?v=editor-3';
import {assetInfo} from './assets.js?v=editor-3';
export const MAX_PIXELS=40_000_000, ADVANCED_PIXELS=16_000_000;
export const clone=value=>JSON.parse(JSON.stringify(value));
export const frameDefaults=()=>({background:'transparent',padding:0,border:0,borderColor:'#ffffff',radius:0,circle:false});
export const defaults=(w,h)=>({mime:'image/jpeg',quality:82,resize:false,resizeMode:'pixels',width:w,height:h,percent:100,lock:true,crop:null,rotation:0,flipX:false,flipY:false,adjust:{...ADJUSTMENTS},filter:'none',filterIntensity:100,sharpness:0,blur:0,frame:frameDefaults(),layers:[],regions:[],rename:''});
export function hasAdvanced(s){const f={...frameDefaults(),...s.frame};return Object.values(s.adjust||{}).some(Boolean)||(s.filter&&s.filter!=='none'&&s.filterIntensity!==0)||s.sharpness||s.blur||s.layers?.length||s.regions?.length||f.padding||f.border||f.radius||f.circle||f.background!=='transparent';}
export function outputDimensions(item,s=item.settings){
  const c=s.crop||{x:0,y:0,w:item.w,h:item.h};
  if(![c.x,c.y,c.w,c.h].every(Number.isInteger)||c.x<0||c.y<0||c.w<1||c.h<1||c.x+c.w>item.w||c.y+c.h>item.h)throw Error('자르기 영역은 원본 이미지 안의 정수 좌표여야 합니다.');
  const rw=s.rotation%180?c.h:c.w,rh=s.rotation%180?c.w:c.h;let contentW=rw,contentH=rh;
  if(s.resize){if(s.resizeMode==='percent'){if(!Number.isFinite(s.percent)||s.percent<1||s.percent>400)throw Error('크기 비율은 1~400%로 입력해 주세요.');contentW=Math.max(1,Math.round(rw*s.percent/100));contentH=Math.max(1,Math.round(rh*s.percent/100));}else{if(![s.width,s.height].every(n=>Number.isInteger(n)&&n>=1&&n<=12000))throw Error('가로·세로에 1~12000 사이 정수를 입력해 주세요.');if(s.lock){const k=Math.min(s.width/rw,s.height/rh);contentW=Math.max(1,Math.round(rw*k));contentH=Math.max(1,Math.round(rh*k));}else{contentW=s.width;contentH=s.height;}}}
  const f={...frameDefaults(),...s.frame};if(![f.padding,f.border,f.radius].every(n=>Number.isFinite(n)&&n>=0&&n<=2000))throw Error('여백·테두리·모서리 값은 0~2000px로 입력하세요.');
  const boxW=f.circle?Math.min(contentW,contentH):contentW,boxH=f.circle?Math.min(contentW,contentH):contentH,padding=Math.round(f.padding),border=Math.round(f.border),w=boxW+2*(padding+border),h=boxH+2*(padding+border);
  if(contentW>12000||contentH>12000||contentW*contentH>MAX_PIXELS||w>12000||h>12000||w*h>MAX_PIXELS)throw Error('출력은 각 변 12000px, 전체 4천만 화소까지 가능합니다. 크기를 줄여 주세요.');
  if(hasAdvanced(s)&&(w*h>ADVANCED_PIXELS||contentW*contentH>ADVANCED_PIXELS))throw Error('고급 편집은 메모리 보호를 위해 1600만 화소까지 지원합니다. 먼저 출력 크기를 줄여 주세요.');
  return {w,h,contentW,contentH,boxW,boxH,padding,border,rw,rh,c};
}
export function loadImage(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('이미지를 읽을 수 없습니다. 손상된 파일인지 확인하세요.'));im.src=url;});}
function surface(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
function context(c){const x=c.getContext('2d',{willReadFrequently:true});if(!x)throw Error('이미지 캔버스를 만들지 못했습니다.');return x;}
function release(c){c.width=c.height=1;}
const color=(value,fallback='#ffffff')=>/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
function roundedPath(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function shapePath(ctx,region,x,y,w,h){if(region.shape==='ellipse'||region.shape==='circle'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);}else{ctx.beginPath();ctx.rect(x,y,w,h);}}
export function layerBox(layer,w,h){
  if(layer.type==='image')return {x:layer.x*w,y:layer.y*h,w:Math.max(1,layer.w*w),h:Math.max(1,layer.h*h)};
  const c=surface(1,1),ctx=context(c),size=clamp(Number(layer.fontSize)||48,6,2000);ctx.font=`${layer.weight===700?700:400} ${size}px ${fontFamily(layer.font)}`;const lines=String(layer.text||' ').split('\n').slice(0,8),width=Math.max(12,...lines.map(t=>ctx.measureText(t).width))+8;return {x:layer.x*w,y:layer.y*h,w:width,h:lines.length*size*1.25+8};
}
export function fontFamily(font){return font==='sans-serif'?'sans-serif':['Arial','Georgia','Courier New','Malgun Gothic'].includes(font)?`"${font}"`:'sans-serif';}
async function regionsOn(canvas,regions,scale){
  const ctx=context(canvas);
  for(const r of regions||[]){const x=Math.round(clamp(r.x,0,1)*canvas.width),y=Math.round(clamp(r.y,0,1)*canvas.height),w=Math.max(1,Math.min(canvas.width-x,Math.round(clamp(r.w,0.001,1)*canvas.width))),h=Math.max(1,Math.min(canvas.height-y,Math.round(clamp(r.h,0.001,1)*canvas.height)));if(x>=canvas.width||y>=canvas.height)continue;
    let bx=x,by=y,bw=w,bh=h;if(r.shape==='circle'){const side=Math.min(w,h);bx=x+(w-side)/2;by=y+(h-side)/2;bw=bh=side;}ctx.save();shapePath(ctx,r,bx,by,bw,bh);ctx.clip();
    if(r.kind==='mosaic'){const block=Math.max(2,Math.round((r.strength||16)*scale)),small=surface(Math.max(1,Math.ceil(w/block)),Math.max(1,Math.ceil(h/block)));context(small).drawImage(canvas,x,y,w,h,0,0,small.width,small.height);ctx.imageSmoothingEnabled=false;ctx.clearRect(x,y,w,h);ctx.drawImage(small,0,0,small.width,small.height,x,y,w,h);release(small);}
    else{const radius=Math.max(.5,(r.strength||12)*scale),pad=Math.ceil(radius*3),sx=Math.max(0,x-pad),sy=Math.max(0,y-pad),sw=Math.min(canvas.width-sx,w+pad*2),sh=Math.min(canvas.height-sy,h+pad*2),part=surface(sw,sh);context(part).drawImage(canvas,sx,sy,sw,sh,0,0,sw,sh);boxBlur(part,radius);ctx.clearRect(x,y,w,h);ctx.drawImage(part,sx,sy);release(part);}ctx.restore();
  }
}
async function layersOn(canvas,layers,dims,scale){const ctx=context(canvas);for(const layer of layers||[]){ctx.save();ctx.globalAlpha=clamp((layer.opacity??100)/100,0,1);ctx.translate(layer.x*canvas.width,layer.y*canvas.height);ctx.rotate((layer.rotation||0)*Math.PI/180);
  if(layer.type==='image'){const a=assetInfo(layer.assetId),im=await loadImage(a.url);const w=layer.w*canvas.width,h=layer.h*canvas.height;ctx.drawImage(im,-w/2,-h/2,w,h);}
  else{const fontSize=clamp(Number(layer.fontSize)||48,6,2000)*scale;ctx.font=`${layer.weight===700?700:400} ${fontSize}px ${fontFamily(layer.font)}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color(layer.color);const lines=String(layer.text||'').slice(0,500).split('\n').slice(0,8);for(let n=0;n<lines.length;n++)ctx.fillText(lines[n],0,(n-(lines.length-1)/2)*fontSize*1.25);}
  ctx.restore();}}
export async function renderCanvas(item,{preview=false,maxEdge=1400}={}){
  const s=clone(item.settings),dims=outputDimensions(item,s),scale=preview?Math.min(1,maxEdge/Math.max(dims.w,dims.h)):1,im=await loadImage(item.url),base=surface(dims.contentW*scale,dims.contentH*scale),ctx=context(base);let output=base;
  try{ctx.imageSmoothingQuality='high';ctx.save();ctx.translate(base.width/2,base.height/2);ctx.scale(base.width/dims.rw,base.height/dims.rh);ctx.scale(s.flipX?-1:1,s.flipY?-1:1);ctx.rotate(s.rotation*Math.PI/180);const c=dims.c;ctx.drawImage(im,c.x,c.y,c.w,c.h,-c.w/2,-c.h/2,c.w,c.h);ctx.restore();
    if(s.blur)boxBlur(base,Math.max(1,s.blur*scale));correctCanvas(base,s);sharpenCanvas(base,s.sharpness);
    const f={...frameDefaults(),...s.frame},needsFrame=f.padding||f.border||f.radius||f.circle||f.background!=='transparent';
    if(needsFrame){output=surface(dims.w*scale,dims.h*scale);const oc=context(output);if(f.background!=='transparent'){oc.fillStyle=color(f.background);oc.fillRect(0,0,output.width,output.height);}const inset=(dims.padding+dims.border)*scale,bw=dims.boxW*scale,bh=dims.boxH*scale,radius=f.circle?bw/2:f.radius*scale;oc.save();if(f.circle){oc.beginPath();oc.ellipse(inset+bw/2,inset+bh/2,bw/2,bh/2,0,0,Math.PI*2);}else roundedPath(oc,inset,inset,bw,bh,radius);oc.clip();oc.drawImage(base,(dims.contentW-dims.boxW)*scale/2,(dims.contentH-dims.boxH)*scale/2,bw,bh,inset,inset,bw,bh);oc.restore();if(dims.border){oc.lineWidth=dims.border*scale;oc.strokeStyle=color(f.borderColor);const p=(dims.padding+dims.border/2)*scale;if(f.circle){oc.beginPath();oc.ellipse(output.width/2,output.height/2,(bw+dims.border*scale)/2,(bh+dims.border*scale)/2,0,0,Math.PI*2);}else roundedPath(oc,p,p,bw+dims.border*scale,bh+dims.border*scale,radius+dims.border*scale/2);oc.stroke();}release(base);}
    await regionsOn(output,s.regions,scale);await layersOn(output,s.layers,dims,scale);return {canvas:output,w:dims.w,h:dims.h,scale};
  }catch(e){release(base);if(output!==base)release(output);throw e;}
}
export async function renderImage(item,options={}){const s=item.settings,r=await renderCanvas(item,options);let canvas=r.canvas;try{if(s.mime==='image/jpeg'){const flat=surface(canvas.width,canvas.height),ctx=context(flat);ctx.fillStyle='#fff';ctx.fillRect(0,0,flat.width,flat.height);ctx.drawImage(canvas,0,0);release(canvas);canvas=flat;}const blob=await new Promise(resolve=>canvas.toBlob(resolve,s.mime,s.quality/100));if(!blob)throw Error('이미지 생성에 실패했습니다. 크기나 사진 수를 줄여 주세요.');if(blob.type!==s.mime)throw Error('이 브라우저는 해당 출력 형식을 지원하지 않습니다. JPG 또는 PNG를 선택하세요.');return {blob,w:r.w,h:r.h};}finally{release(canvas);}}
export async function supportedFormats(){const canvas=surface(1,1),result=[];for(const mime of ['image/jpeg','image/png','image/webp']){const blob=await new Promise(r=>canvas.toBlob(r,mime,.8));if(blob?.type===mime)result.push(mime);}release(canvas);return result;}
export function outputName(item,index){const ext=item.settings.mime.split('/')[1].replace('jpeg','jpg'),custom=String(item.settings.rename||'').trim(),base=(custom||item.file.name.replace(/\.[^.]+$/,'')).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,100)||'image';return `${base}${custom?`-${String(index+1).padStart(2,'0')}`:`-flick-${index+1}`}.${ext}`;}
export async function composeImages(items,{direction='horizontal',cellWidth=640,cellHeight=640,gap=12,background='#ffffff',fit='contain'}={}){
  if(items.length<2)throw Error('합칠 이미지를 2장 이상 선택하세요.');if(![cellWidth,cellHeight].every(n=>Number.isInteger(n)&&n>=32&&n<=4000)||!Number.isInteger(gap)||gap<0||gap>500)throw Error('셀 크기는 32~4000px, 간격은 0~500px로 입력하세요.');
  const w=direction==='horizontal'?cellWidth*items.length+gap*(items.length-1):cellWidth,h=direction==='vertical'?cellHeight*items.length+gap*(items.length-1):cellHeight;if(w>12000||h>12000||w*h>ADVANCED_PIXELS)throw Error('콜라주는 각 변 12000px, 전체 1600만 화소 이하로 만들어 주세요.');
  const canvas=surface(w,h),ctx=context(canvas);if(background!=='transparent'){ctx.fillStyle=color(background);ctx.fillRect(0,0,w,h);}try{for(let n=0;n<items.length;n++){const r=await renderCanvas(items[n],{preview:true,maxEdge:Math.max(cellWidth,cellHeight)*2});try{const im=r.canvas,x=direction==='horizontal'?n*(cellWidth+gap):0,y=direction==='vertical'?n*(cellHeight+gap):0,k=(fit==='cover'?Math.max:Math.min)(cellWidth/im.width,cellHeight/im.height),dw=im.width*k,dh=im.height*k;ctx.save();ctx.beginPath();ctx.rect(x,y,cellWidth,cellHeight);ctx.clip();ctx.drawImage(im,x+(cellWidth-dw)/2,y+(cellHeight-dh)/2,dw,dh);ctx.restore();}finally{release(r.canvas);}}const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('콜라주 파일 생성에 실패했습니다.');return new File([blob],`FLiCK-collage-${direction}.png`,{type:'image/png'});}finally{release(canvas);}}

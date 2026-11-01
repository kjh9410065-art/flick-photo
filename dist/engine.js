// Browser-local image pipeline. No network calls, external codecs or uploads.
export const MAX_PIXELS = 40_000_000;
export const clone = value => JSON.parse(JSON.stringify(value));
export const defaults = (w,h) => ({mime:'image/jpeg',quality:82,resize:false,resizeMode:'pixels',width:w,height:h,percent:100,lock:true,crop:null,rotation:0,flipX:false,flipY:false});
export function outputDimensions(item, s = item.settings) {
  const c=s.crop||{x:0,y:0,w:item.w,h:item.h};
  if (![c.x,c.y,c.w,c.h].every(Number.isInteger)||c.x<0||c.y<0||c.w<1||c.h<1||c.x+c.w>item.w||c.y+c.h>item.h) throw Error('자르기 영역은 원본 이미지 안의 정수 좌표여야 합니다.');
  const rw=s.rotation%180?c.h:c.w, rh=s.rotation%180?c.w:c.h;
  let w=rw,h=rh;
  if(s.resize){
    if(s.resizeMode==='percent'){
      if(!Number.isFinite(s.percent)||s.percent<1||s.percent>400)throw Error('크기 비율은 1~400%로 입력해 주세요.');
      w=Math.max(1,Math.round(rw*s.percent/100));h=Math.max(1,Math.round(rh*s.percent/100));
    }else{
      if(![s.width,s.height].every(n=>Number.isInteger(n)&&n>=1&&n<=12000))throw Error('가로·세로에 1~12000 사이 정수를 입력해 주세요.');
      if(s.lock){const scale=Math.min(s.width/rw,s.height/rh);w=Math.max(1,Math.round(rw*scale));h=Math.max(1,Math.round(rh*scale));}else{w=s.width;h=s.height;}
    }
  }
  if(w>12000||h>12000||w*h>MAX_PIXELS)throw Error('출력은 각 변 12000px, 전체 4천만 화소까지 가능합니다. 크기를 줄여 주세요.');
  return {w,h,rw,rh,c};
}
export function loadImage(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('이미지를 읽을 수 없습니다. 손상된 파일인지 확인하세요.'));im.src=url;});}
export async function renderImage(item, {preview=false}={}){
  const s=item.settings, dims=outputDimensions(item), im=await loadImage(item.url);
  const scale=preview?Math.min(1,1400/Math.max(dims.w,dims.h)):1;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(dims.w*scale));canvas.height=Math.max(1,Math.round(dims.h*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('브라우저에서 이미지 캔버스를 만들지 못했습니다.');
  if(s.mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.imageSmoothingQuality='high';ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(canvas.width/dims.rw,canvas.height/dims.rh);ctx.scale(s.flipX?-1:1,s.flipY?-1:1);ctx.rotate(s.rotation*Math.PI/180);
  const c=dims.c;ctx.drawImage(im,c.x,c.y,c.w,c.h,-c.w/2,-c.h/2,c.w,c.h);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,s.mime,s.quality/100));canvas.width=canvas.height=1;
  if(!blob)throw Error('이미지 생성에 실패했습니다. 출력 크기나 사진 수를 줄여 주세요.');
  if(blob.type!==s.mime)throw Error('이 브라우저는 해당 출력 형식을 지원하지 않습니다. JPG 또는 PNG를 선택하세요.');
  return {blob,w:dims.w,h:dims.h};
}

// Shared deterministic colour math for thumbnails, previews and saved files.
export const FILTERS=[['none','원본'],['mono','흑백'],['sepia','세피아'],['vintage','빈티지'],['warm','따뜻하게'],['cool','차갑게'],['cinema','시네마틱'],['contrast','고대비']];
export const ADJUSTMENTS={brightness:0,contrast:0,saturation:0,exposure:0,temperature:0,hue:0};
export const clamp=(n,a=0,b=255)=>Math.max(a,Math.min(b,n));
export function pixelTransform(settings={}){
  const a={...ADJUSTMENTS,...settings.adjust}, exposure=2**a.exposure, contrast=2**(a.contrast/50), saturation=1+a.saturation/100;
  const angle=a.hue*Math.PI/180, co=Math.cos(angle), si=Math.sin(angle), mix=clamp((settings.filterIntensity??100)/100,0,1), filter=settings.filter||'none';
  return (r,g,b)=>{
    r=(r*exposure-128)*contrast+128+a.brightness*2.55+a.temperature*.32;
    g=(g*exposure-128)*contrast+128+a.brightness*2.55;
    b=(b*exposure-128)*contrast+128+a.brightness*2.55-a.temperature*.32;
    const y=.2126*r+.7152*g+.0722*b;r=y+(r-y)*saturation;g=y+(g-y)*saturation;b=y+(b-y)*saturation;
    if(a.hue){const rr=r,gg=g,bb=b;r=(.213+.787*co-.213*si)*rr+(.715-.715*co-.715*si)*gg+(.072-.072*co+.928*si)*bb;g=(.213-.213*co+.143*si)*rr+(.715+.285*co+.140*si)*gg+(.072-.072*co-.283*si)*bb;b=(.213-.213*co-.787*si)*rr+(.715-.715*co+.715*si)*gg+(.072+.928*co+.072*si)*bb;}
    let fr=r,fg=g,fb=b;const gray=.2126*r+.7152*g+.0722*b;
    if(filter==='mono')fr=fg=fb=gray;
    if(filter==='sepia'){fr=.393*r+.769*g+.189*b;fg=.349*r+.686*g+.168*b;fb=.272*r+.534*g+.131*b;}
    if(filter==='vintage'){fr=(gray+(r-gray)*.72)*.86+25;fg=(gray+(g-gray)*.72)*.86+17;fb=(gray+(b-gray)*.72)*.82+12;}
    if(filter==='warm'){fr=r+23;fg=g+6;fb=b-19;}
    if(filter==='cool'){fr=r-16;fg=g+3;fb=b+23;}
    if(filter==='cinema'){const shadow=1-clamp(gray)/255;fr=(r-128)*1.15+128+16*(1-shadow)-13*shadow;fg=(g-128)*1.1+128+7*shadow;fb=(b-128)*1.08+128+20*shadow-12*(1-shadow);}
    if(filter==='contrast'){fr=(r-128)*1.6+128;fg=(g-128)*1.6+128;fb=(b-128)*1.6+128;}
    return [clamp(r+(fr-r)*mix),clamp(g+(fg-g)*mix),clamp(b+(fb-b)*mix)];
  };
}
export function correctCanvas(canvas,settings){
  if(!Object.values(settings.adjust||{}).some(Boolean)&&(!settings.filter||settings.filter==='none'||settings.filterIntensity===0))return;
  const ctx=canvas.getContext('2d',{willReadFrequently:true}), transform=pixelTransform(settings);
  // Row tiles bound transient pixel buffers, even for large photos.
  for(let y=0;y<canvas.height;y+=128){const h=Math.min(128,canvas.height-y),im=ctx.getImageData(0,y,canvas.width,h),p=im.data;for(let n=0;n<p.length;n+=4){if(!p[n+3])continue;[p[n],p[n+1],p[n+2]]=transform(p[n],p[n+1],p[n+2]);}ctx.putImageData(im,0,y);}
}
export function sharpenCanvas(canvas,amount){
  if(!amount)return;const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height,k=amount/100;
  // Keep an unchanged source so adjacent tiles never feed back into one another.
  const source=document.createElement('canvas');source.width=w;source.height=h;source.getContext('2d').drawImage(canvas,0,0);
  const sc=source.getContext('2d',{willReadFrequently:true});
  for(let y=0;y<h;y+=128){const top=Math.max(0,y-1),bottom=Math.min(h,y+129),im=sc.getImageData(0,top,w,bottom-top),src=im.data,out=new Uint8ClampedArray(src),first=y-top,last=Math.min(y+128,h)-top;
    for(let yy=first;yy<last;yy++)for(let x=0;x<w;x++){const p=(yy*w+x)*4;if(!src[p+3])continue;for(let c=0;c<3;c++){let avg=0,count=0;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=clamp(x+dx,0,w-1),ny=clamp(yy+dy,0,bottom-top-1),q=(ny*w+nx)*4;if(src[q+3]){avg+=src[q+c];count++;}}out[p+c]=clamp(src[p+c]+k*(src[p+c]-(count?avg/count:src[p+c]))*2);}}
    im.data.set(out);ctx.putImageData(im,0,top,0,first,w,last-first);
  }source.width=source.height=1;
}
export function boxBlur(canvas,radius){
  radius=Math.max(1,Math.round(radius));const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height,im=ctx.getImageData(0,0,w,h),src=im.data,tmp=new Uint8ClampedArray(src.length),out=new Uint8ClampedArray(src.length);
  // Premultiply before blurring to avoid dark fringes around transparent edges.
  for(let n=0;n<src.length;n+=4){const a=src[n+3]/255;src[n]*=a;src[n+1]*=a;src[n+2]*=a;}
  for(let y=0;y<h;y++)for(let c=0;c<4;c++){let sum=0;for(let x=-radius;x<=radius;x++)sum+=src[(y*w+clamp(x,0,w-1))*4+c];for(let x=0;x<w;x++){tmp[(y*w+x)*4+c]=sum/(radius*2+1);sum+=src[(y*w+clamp(x+radius+1,0,w-1))*4+c]-src[(y*w+clamp(x-radius,0,w-1))*4+c];}}
  for(let x=0;x<w;x++)for(let c=0;c<4;c++){let sum=0;for(let y=-radius;y<=radius;y++)sum+=tmp[(clamp(y,0,h-1)*w+x)*4+c];for(let y=0;y<h;y++){out[(y*w+x)*4+c]=sum/(radius*2+1);sum+=tmp[(clamp(y+radius+1,0,h-1)*w+x)*4+c]-tmp[(clamp(y-radius,0,h-1)*w+x)*4+c];}}
  for(let n=0;n<out.length;n+=4){const a=out[n+3]/255;if(a){out[n]/=a;out[n+1]/=a;out[n+2]/=a;}}im.data.set(out);ctx.putImageData(im,0,0);
}

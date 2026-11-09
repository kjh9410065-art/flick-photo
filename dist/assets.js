const assets=new Map();
export function assetInfo(id){const value=assets.get(id);if(!value)throw Error('로고 이미지를 찾을 수 없습니다. 다시 추가해 주세요.');return value;}
export async function addAsset(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('로고는 JPG·PNG·WebP만 지원합니다. 투명 PNG를 권장합니다.');
  if(file.size>10*1048576)throw Error('로고는 파일당 10 MB 이하로 선택하세요.');
  if([...assets.values()].reduce((s,a)=>s+a.bytes,0)+file.size>40*1048576)throw Error('로고 메모리 한도 40 MB를 넘었습니다. 불필요한 로고와 편집 이력을 원본 복원 후 제거하거나 새 탭에서 작업하세요.');
  const blob=new Blob([await file.arrayBuffer()],{type:file.type});
  const url=URL.createObjectURL(blob);
  try{const im=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('로고 이미지를 읽을 수 없습니다.'));i.src=url;});if(im.naturalWidth*im.naturalHeight>6_000_000)throw Error('로고는 600만 화소 이하로 줄여 주세요.');const id=crypto.randomUUID();const result={id,url,blob,w:im.naturalWidth,h:im.naturalHeight,name:file.name,bytes:file.size};assets.set(id,result);return result;}catch(e){URL.revokeObjectURL(url);throw e;}
}
export function pruneAssets(items){const used=new Set();for(const i of items)for(const s of [i.settings,...i.history,...i.future])for(const l of s.layers||[])if(l.assetId)used.add(l.assetId);for(const [id,a] of assets)if(!used.has(id)){URL.revokeObjectURL(a.url);assets.delete(id);}}

// Restore original IDs so saved layers and their history still resolve.
export function draftAssets(items) {
  const ids = new Set(items.flatMap(item => [item.settings, ...item.history, ...item.future]
    .flatMap(settings => (settings.layers || []).map(layer => layer.assetId).filter(Boolean))));
  return [...ids].map(id => {
    const {blob, w, h, name, bytes} = assetInfo(id);
    return {id, blob, w, h, name, bytes};
  });
}
export function restoreAssets(records) {
  for (const record of records) {
    const previous = assets.get(record.id);
    if (previous) URL.revokeObjectURL(previous.url);
    assets.set(record.id, {...record, url: URL.createObjectURL(record.blob)});
  }
}

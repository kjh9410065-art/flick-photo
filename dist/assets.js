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
export async function restoreAssets(records, items) {
  const required = new Set(items.flatMap(item => [item.settings, ...item.history, ...item.future]
    .flatMap(settings => (settings.layers || []).filter(layer => layer.type === 'image').map(layer => layer.assetId))));
  const staged = new Map();
  try {
    for (const record of records) {
      if (!required.has(record.id) || staged.has(record.id)) continue;
      const url = URL.createObjectURL(record.blob);
      staged.set(record.id, {...record, url});
      const bitmap = await createImageBitmap(record.blob);
      try {
        if (bitmap.width !== record.w || bitmap.height !== record.h) throw Error('저장된 로고 크기가 올바르지 않습니다.');
      } finally {
        bitmap.close();
      }
    }
    if (staged.size !== required.size) throw Error('저장된 작업의 로고가 누락되었습니다.');
  } catch (error) {
    for (const asset of staged.values()) URL.revokeObjectURL(asset.url);
    throw error;
  }
  for (const [id, asset] of staged) {
    const previous = assets.get(id);
    if (previous) URL.revokeObjectURL(previous.url);
    assets.set(id, asset);
  }
}

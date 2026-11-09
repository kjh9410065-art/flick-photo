// Encode the same rendered pixels at several qualities. Only measured blobs count.
export async function findTarget(encode, target, progress = () => {}, deadline = Date.now() + 6000) {
  let smallest, best;
  async function measure(quality) {
    progress(quality);
    const blob = await encode(quality);
    const result = {blob, quality};
    if (!smallest || blob.size < smallest.blob.size) smallest = result;
    if (blob.size <= target && (!best || quality > best.quality)) best = result;
    return blob.size <= target;
  }
  if (!await measure(100)) {
    let low = 1, high = 99;
    await measure(low);
    for (let attempt = 0; attempt < 7 && low <= high && Date.now() < deadline; attempt++) {
      const middle = Math.floor((low + high) / 2);
      if (await measure(middle)) low = middle + 1;
      else high = middle - 1;
    }
  }
  return {...(best || smallest), target, met: Boolean(best)};
}

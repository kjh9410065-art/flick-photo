#!/usr/bin/env node
// Read-only public Google/Naver preflight: HTTP 200, canonical and robots.
const base = 'https://photo.tcflick.com';
const endpoints = ['/', '/robots.txt', '/sitemap.xml', '/guides/convert/'];
const timeoutMs = 10000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPublic(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(base + path, {
      signal: controller.signal,
      headers: {'User-Agent': 'TCFLiCK-Photo-Indexability-Preflight/1.0'},
      redirect: 'follow',
    });
    const body = (await r.text()).slice(0, 500000);
    return {status:r.status, url:r.url, body};
  } finally {
    clearTimeout(timeout);
  }
}

async function inspect() {
  const outcomes = [];
  let ready = true;
  for (const path of endpoints) {
    try {
      const result = await fetchPublic(path);
      let valid = result.status === 200 && result.url.startsWith(base);
      if (path === '/') {
        valid = valid &&
          result.body.includes('플릭포토(FLiCK Photo)') &&
          result.body.includes('<link rel="canonical" href="https://photo.tcflick.com/">') &&
          !/<meta[^>]+content="[^"]*noindex/i.test(result.body);
      }
      if (path === '/robots.txt') {
        valid = valid &&
          result.body.includes('Allow: /') &&
          result.body.includes('Sitemap: https://photo.tcflick.com/sitemap.xml') &&
          !result.body.includes('Disallow: /');
      }
      if (path === '/sitemap.xml') {
        valid = valid &&
          result.body.includes('<loc>https://photo.tcflick.com/</loc>') &&
          (result.body.match(/<url>/g)||[]).length === 13;
      }
      if (path === '/guides/convert/') {
        valid = valid && result.body.includes('플릭포토(FLiCK Photo)') &&
          result.body.includes('<link rel="canonical" href="https://photo.tcflick.com/guides/convert/">');
      }
      outcomes.push({path, status:result.status, finalUrl:result.url, valid});
      if (!valid) ready = false;
    } catch (error) {
      ready = false;
      outcomes.push({path, valid:false, error: String(error?.cause?.code||error?.message||error).slice(0, 150)});
    }
  }
  console.log(JSON.stringify({host:base, checked:new Date().toISOString(), ready, outcomes}));
  return ready;
}

// Allow for Cloudflare Pages deployment propagation after GitHub push.
let ok = false;
for (let i=0; i<3; i++) {
  if (i>0) await delay(15000);
  if (await inspect()) {ok=true; break;}
}
if (!ok) {
  console.error('Public SEO readiness NOT confirmed. Do not claim indexing or deployed Korean metadata.');
  process.exitCode=1;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base = new URL('../dist/', import.meta.url);
const read = path => readFileSync(new URL(path, base), 'utf8');
const guides = [
  'guides/convert/', 'guides/compress/', 'guides/resize/',
  'guides/crop/', 'guides/batch/', 'guides/color/',
  'guides/text/', 'guides/regions/', 'guides/frame/',
  'guides/collage/', 'privacy/', 'terms/'
];

test('homepage exposes Korean brand as real visible content and metadata', () => {
  const s = read('index.html');
  assert.match(s, /<html lang="ko">/);
  assert.match(s, /<title>플릭포토\(FLiCK Photo\) \| 무료 온라인 이미지 편집·압축·변환<\/title>/);
  assert.match(s, /<meta name="description" content="플릭포토\(FLiCK Photo\)/);
  assert.match(s, /<meta property="og:title" content="플릭포토/);
  assert.match(s, /<meta property="og:locale" content="ko_KR">/);
  assert.match(s, /<link rel="canonical" href="https:\/\/photo\.tcflick\.com\/">/);
  assert.match(s, /<div class="eyebrow">[^<]*<span class="live-dot"><\/span> 플릭포토/);
  assert.match(s, /<p class="hero-description">무료 온라인 사진 편집기 플릭포토/);
  assert.doesNotMatch(s, /<meta[^>]+(?:noindex|nofollow)/i);
});

test('SEO does not alter editing buttons, scripts or original security policy', () => {
  const s = read('index.html');
  for (const fragment of [
    'id="studio"', 'data-upload', 'data-open-studio',
    'id="tool-directory"', '/app.js?v=3.3',
    'id="preview-image"', 'id="top-export"'
  ]) assert.ok(s.includes(fragment), fragment);
  const headers = read('_headers');
  assert.match(headers, /connect-src 'none'/);
  assert.match(headers, /script-src 'self'/);
  assert.doesNotMatch(s, /googletagmanager|adsbygoogle\.js/);
});

test('all guide and policy pages have Korean titles, matching self-canonicals and description', () => {
  for (const route of guides) {
    const url = 'https://photo.tcflick.com/' + route;
    const s = read(route + 'index.html');
    assert.match(s, /<html lang="ko">/, route);
    assert.match(s, /<title>[^<]+플릭포토\(FLiCK Photo\)<\/title>/, route);
    assert.ok(s.includes('<link rel="canonical" href="' + url + '">'), route);
    assert.match(s, /<meta name="description" content="[^"]+플릭포토 무료 이미지 편집기">/, route);
    assert.match(s, /<meta property="og:title" content="[^"]+플릭포토/, route);
    assert.match(s, /<span class="eyebrow">플릭포토/, route);
    assert.doesNotMatch(s, /noindex/i, route);
  }
});

test('robots explicitly permits crawlers and 13 canonical URLs are discoverable', () => {
  const robots = read('robots.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.doesNotMatch(robots, /Disallow: \//);
  assert.match(robots, /Sitemap: https:\/\/photo\.tcflick\.com\/sitemap\.xml/);
  const xml = read('sitemap.xml');
  const urls = ['https://photo.tcflick.com/', ...guides.map(p=>'https://photo.tcflick.com/' + p)];
  for (const u of urls) assert.ok(xml.includes('<loc>' + u + '</loc><lastmod>2026-11-10</lastmod>'), u);
  assert.equal((xml.match(/<url>/g)||[]).length, 13);
  assert.equal((xml.match(/<lastmod>/g)||[]).length, 13);
});

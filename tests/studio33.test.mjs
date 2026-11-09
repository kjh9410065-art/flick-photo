import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/engine.js';
import {findTarget} from '../dist/compression.js';

test('default output settings preserve each input format independently', () => {
  const formats = ['image/jpeg', 'image/png', 'image/webp'];
  const settings = formats.map(mime => defaults(480, 320, mime));
  assert.deepEqual(settings.map(item => item.mime), formats);
  settings[1].mime = 'image/jpeg';
  assert.equal(defaults(480, 320, formats[1]).mime, 'image/png');
});

test('target search reports measured bytes and bounds encoding attempts', async () => {
  let attempts = 0;
  const result = await findTarget(async quality => {
    attempts++;
    return new Blob([new Uint8Array(quality * 1024)]);
  }, 50 * 1024);
  assert.equal(result.met, true);
  assert.equal(result.quality, 50);
  assert.equal(result.blob.size, 50 * 1024);
  assert.ok(attempts <= 9);
});

test('impossible target returns smallest tested blob and a failure flag', async () => {
  const result = await findTarget(async quality => new Blob([new Uint8Array(1024 + quality)]), 100);
  assert.equal(result.met, false);
  assert.equal(result.quality, 1);
  assert.equal(result.blob.size, 1025);
});

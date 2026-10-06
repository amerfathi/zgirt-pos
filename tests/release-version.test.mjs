import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_VERSION, APP_BUILD_NUMBER } from '../src/config/appVersion.js';

test('web desktop and Android release versions match the package lock', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const gradle = await readFile('android/app/build.gradle', 'utf8');
  assert.equal(pkg.version, APP_VERSION);
  assert.equal(lock.version, APP_VERSION);
  assert.equal(lock.packages[''].version, APP_VERSION);
  assert.equal(gradle.match(/versionName "([^"]+)"/)[1], APP_VERSION);
  assert.equal(Number(gradle.match(/versionCode[^\n]+: (\d+)/)[1]), APP_BUILD_NUMBER);
});

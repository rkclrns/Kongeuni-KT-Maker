const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { check } = require('../android-preflight.cjs');

function sdk(t, parts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktmaker-sdk-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (parts.includes('platform')) { fs.mkdirSync(path.join(root, 'platforms', 'android-35'), { recursive: true }); fs.writeFileSync(path.join(root, 'platforms', 'android-35', 'android.jar'), ''); }
  if (parts.includes('tools')) fs.mkdirSync(path.join(root, 'build-tools', '35.0.0'), { recursive: true });
  if (parts.includes('licenses')) fs.mkdirSync(path.join(root, 'licenses'));
  return root;
}

test('passes when JDK and SDK packages are present', t => {
  const root = sdk(t, ['platform', 'tools', 'licenses']);
  assert.deepEqual(check({ env: { ANDROID_HOME: root }, findJava: () => 'C:\\jdk21' }), { sdk: root, javaHome: 'C:\\jdk21' });
});

test('lists every missing piece in one message', t => {
  const root = sdk(t, []);
  assert.throws(() => check({ env: { ANDROID_HOME: root }, findJava: () => { throw new Error('JDK 21을 찾지 못했습니다.'); } }), error => {
    for (const text of ['JDK 21', 'Platform 35', '35.0.0', '라이선스', 'iOS 테마']) assert.ok(error.message.includes(text), text);
    return true;
  });
});

test('reports a missing SDK folder', () => {
  assert.throws(() => check({ env: { ANDROID_HOME: path.join(os.tmpdir(), 'no-such-sdk-ktmaker') }, findJava: () => 'x' }), /SDK 폴더가 없습니다/);
});

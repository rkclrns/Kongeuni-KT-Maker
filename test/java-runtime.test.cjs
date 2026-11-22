const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { selectJava } = require('../java-runtime.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktmaker-java-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const make = (folder, version, compiler = true) => {
    const home = path.join(root, folder);
    fs.mkdirSync(path.join(home, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(home, 'release'), `JAVA_VERSION="${version}"\n`);
    fs.writeFileSync(path.join(home, 'bin', 'java.exe'), '');
    if (compiler) fs.writeFileSync(path.join(home, 'bin', 'javac.exe'), '');
    return home;
  };
  const env = { ProgramFiles: path.join(root, 'Program Files') };
  return { root, make, env, home: path.join(root, 'user') };
}

test('finds an Oracle JDK 21 without JAVA_HOME', t => {
  const f = fixture(t);
  const installed = f.make('Program Files/Java/jdk-21.0.13.1', '21.0.13.1');
  assert.equal(selectJava({ ...f, readRegistry: () => [] }), installed);
});

test('fresh registry setting overrides inherited Java 25', t => {
  const f = fixture(t);
  f.env.JAVA_HOME = f.make('old-jdk', '25.0.1');
  const installed = f.make('new-jdk', '21.0.13.1');
  assert.equal(selectJava({ ...f, readRegistry: () => [installed] }), installed);
});

test('rejects a Java 21 runtime without the compiler', t => {
  const f = fixture(t);
  f.env.JAVA_HOME = f.make('runtime-only', '21.0.1', false);
  assert.throws(() => selectJava({ ...f, readRegistry: () => [] }), /JDK 21/);
});

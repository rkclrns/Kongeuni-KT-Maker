const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function editor(buildApk, onAlert) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      disabled: false, value: '#FFDEDE', src: '', attributes: {}, handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; }
    });
    return nodes.get(selector);
  };
  const context = {
    document: {
      querySelector: node, querySelectorAll: () => [],
      documentElement: { style: { setProperty() {} } }
    },
    window: { studio: { buildApk } },
    alert(message) { onAlert(message, node('#build-apk')); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer.js'), 'utf8'), context);
  return { button: node('#build-apk'), click: node('#build-apk').handlers.click };
}

for (const outcome of ['success', 'failure', 'cancel']) {
  test(`build button leaves busy state before ${outcome} notification`, async () => {
    let finish;
    const pending = new Promise((resolve, reject) => { finish = { resolve, reject }; });
    let alerts = 0, calls = 0;
    const view = editor(() => { calls++; return pending; }, (message, button) => {
      alerts++;
      assert.equal(button.disabled, false);
      assert.equal(button.textContent, 'APK �����');
      assert.equal(button.attributes['aria-busy'], undefined);
      assert.match(message, outcome === 'success' ? /test.apk/ : /test failure/);
    });
    const running = view.click();
    assert.equal(view.button.disabled, true);
    assert.equal(view.button.attributes['aria-busy'], 'true');
    await view.click();
    assert.equal(calls, 1);
    if (outcome === 'failure') finish.reject(new Error('test failure'));
    else finish.resolve(outcome === 'cancel' ? { canceled: true } : { path: 'test.apk' });
    await running;
    assert.equal(view.button.disabled, false);
    assert.equal(alerts, outcome === 'cancel' ? 0 : 1);
  });
}

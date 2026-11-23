const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { PNG } = require('pngjs');
const { buildKtheme, unNine } = require('../ios-theme.cjs');

const info = { title: "Kongeuni's 테마", author: '콩으니', version: 'Kongeuni 1.2.0', packageId: 'KongeuniThema.NewThema' };

// Reads a ZIP produced by zip-writer.cjs back into { name: Buffer }.
function unzip(buffer) {
  const files = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8), size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const body = buffer.subarray(offset + 30 + nameLength + extra, offset + 30 + nameLength + extra + size);
    files[name] = method === 8 ? zlib.inflateRawSync(body) : body;
    offset += 30 + nameLength + extra + size;
  }
  return files;
}

test('builds a complete .ktheme from the default template', () => {
  const result = buildKtheme({ color: '#123456', editor: { info, colors: {}, images: {} } });
  const files = unzip(result.buffer);
  const css = files['KakaoTalkTheme.css'].toString('utf8');
  assert.match(css, /-kakaotalk-theme-name: 'Kongeuni\\'s 테마';/);
  assert.match(css, /-kakaotalk-theme-version: '1\.2\.0';/);
  assert.match(css, /-kakaotalk-theme-id: 'KongeuniThema\.NewThema';/);
  assert.match(css, /MainViewStyle-Primary\s*\{\s*background-color: #123456;/);
  // Every image referenced by the CSS exists in @2x and @3x.
  for (const [, name] of css.matchAll(/'([A-Za-z0-9]+)\.png'/g)) {
    assert.ok(files[`Images/${name}@3x.png`], `${name}@3x`);
    assert.ok(files[`Images/${name}@2x.png`], `${name}@2x`);
  }
  assert.ok(files['Images/commonIcoTheme.png']);
  const bg = PNG.sync.read(files['Images/mainBgImage@3x.png']);
  assert.deepEqual([bg.width, bg.height], [1125, 2250]);
  const bubble = PNG.sync.read(files['Images/chatroomBubbleSend01@3x.png']);
  assert.deepEqual([bubble.width, bubble.height], [122, 112], 'nine-patch frame removed');
});

test('uses edited colors (ARGB to RGB + alpha) and edited images', () => {
  const png = new PNG({ width: 300, height: 300 });
  png.data.fill(255);
  const dataUrl = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
  const result = buildKtheme({ editor: {
    info, profileCount: 2,
    colors: { theme_body_cell_pressed_color: '#80FF0000', theme_chatroom_bubble_me_color: '#00FF00' },
    images: { 'theme_profile_02_image.png': dataUrl }
  } });
  assert.match(result.css, /-ios-selected-background-color: #FF0000;\s*-ios-selected-background-alpha: 0\.5;/);
  assert.match(result.css, /MessageCellStyle-Send[\s\S]*?-ios-text-color: #00FF00;/);
  assert.match(result.css, /-ios-profile-images: 'profileImg01\.png', 'profileImg02\.png';/);
  const profile = PNG.sync.read(unzip(result.buffer)['Images/profileImg02@3x.png']);
  assert.deepEqual([profile.width, profile.height, profile.data[3]], [360, 360, 255]);
});

test('reads nine-patch stretch and padding markers', () => {
  const png = new PNG({ width: 12, height: 10 });
  const dot = (x, y) => { const i = (y * 12 + x) * 4; png.data[i + 3] = 255; };
  for (let x = 4; x < 6; x++) dot(x, 0);
  for (let y = 3; y < 5; y++) dot(0, y);
  for (let x = 2; x < 9; x++) dot(x, 9);
  for (let y = 2; y < 7; y++) dot(11, y);
  const nine = unNine(png);
  assert.deepEqual([nine.image.width, nine.image.height], [10, 8]);
  assert.deepEqual(nine.stretchX, { start: 3, end: 5 });
  assert.deepEqual(nine.stretchY, { start: 2, end: 4 });
  assert.deepEqual(nine.padX, { start: 1, end: 8 });
  assert.deepEqual(nine.padY, { start: 1, end: 6 });
});

test('rejects missing theme information before writing anything', () => {
  assert.throws(() => buildKtheme({ editor: { info: { ...info, title: ' ' } } }), /테마 이름/);
  assert.throws(() => buildKtheme({ editor: { info: { ...info, packageId: 'bad id' } } }), /앱 식별자/);
});

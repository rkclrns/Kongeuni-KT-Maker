const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { buildKtheme, iosState, unNine } = require('../ios-theme.cjs');
const { importKtheme, restoreNinePatch, readNinePatchChunk, parseColor } = require('../theme-import.cjs');
const { createZip } = require('../zip-writer.cjs');

const info = { title: '불러오기 테스트', author: '콩으니', version: '1.0.0', packageId: 'KongeuniThema.ImportTest' };

test('a .ktheme built here opens back with the same iPhone values', () => {
  const data = { editor: { info, colors: { theme_title_color: '#123456', theme_body_cell_pressed_color: '#80FF0000' }, images: {} } };
  const built = buildKtheme(data), want = iosState(data);
  const result = importKtheme(built.buffer);
  assert.equal(result.import, 'ktheme');
  assert.equal(result.ios.colors.main_text, want.colors.main_text);
  assert.equal(result.ios.colors.main_cell_pressed, want.colors.main_cell_pressed);
  assert.deepEqual(result.ios.bubbles, want.bubbles);
  assert.equal(result.info.title, info.title);
  assert.equal(result.info.packageId, info.packageId);
  // Rebuilding from the imported iPhone state gives the same theme CSS.
  assert.equal(buildKtheme({ editor: { info }, ios: result.ios }).css, built.css);
});

test('a .ktheme with other file names is read through its CSS references', () => {
  const png = new PNG({ width: 30, height: 30 }); png.data.fill(255);
  const css = `ManifestStyle { -kakaotalk-theme-name: 'Other'; -kakaotalk-theme-id: 'other.theme'; }
    MainViewStyle-Primary { background-color: #ABCDEF; -ios-background-image: 'bg.png'; -ios-normal-background-color: #112233; -ios-normal-background-alpha: 0.5; }
    MessageCellStyle-Send { -ios-background-image: 'me.png' 5px 6px; -ios-title-edgeinsets: 1px 2px 3px 4px; -ios-text-color: rgb(1,2,3); }`;
  const zip = createZip([{ name: 'KakaoTalkTheme.css', data: Buffer.from(css) }, { name: 'Images/bg@2x.png', data: PNG.sync.write(png) }, { name: 'Images/me@3x.png', data: PNG.sync.write(png) }]);
  const result = importKtheme(zip);
  assert.equal(result.ios.colors.main_bg, '#FFABCDEF');
  assert.equal(result.ios.colors.main_cell, '#80112233');
  assert.equal(result.ios.colors.send_text, '#FF010203');
  assert.deepEqual(result.ios.bubbles.chatroomBubbleSend01, { cap: [5, 6], insets: [1, 2, 3, 4] });
  const bg = PNG.sync.read(Buffer.from(result.ios.images.mainBgImage.split(',')[1], 'base64'));
  assert.deepEqual([bg.width, bg.height], [45, 45], '@2x scaled up to @3x');
});

test('compiled 9-patch (npTc chunk) gets its black frame back', () => {
  const src = new PNG({ width: 10, height: 8 }); src.data.fill(200);
  const base = PNG.sync.write(src);
  // npTc: wasDeserialized, numX, numY, numColors, xOff, yOff, padding L R T B, colorsOff, xDivs, yDivs
  const body = Buffer.alloc(32 + 8 + 8);
  body[1] = 2; body[2] = 2;
  [1, 2, 3, 4].forEach((v, i) => body.writeInt32BE(v, 12 + i * 4));
  body.writeInt32BE(3, 32); body.writeInt32BE(5, 36); body.writeInt32BE(2, 40); body.writeInt32BE(4, 44);
  const chunk = Buffer.concat([Buffer.alloc(4), Buffer.from('npTc'), body, Buffer.alloc(4)]);
  chunk.writeUInt32BE(body.length, 0);
  const png = Buffer.concat([base.subarray(0, 33), chunk, base.subarray(33)]);
  const parsed = readNinePatchChunk(png);
  assert.deepEqual(parsed, { xs: [3, 5], ys: [2, 4], pad: [1, 2, 3, 4] });
  const nine = unNine(PNG.sync.read(restoreNinePatch(png, parsed)));
  assert.deepEqual(nine.stretchX, { start: 3, end: 5 });
  assert.deepEqual(nine.stretchY, { start: 2, end: 4 });
  assert.deepEqual(nine.padX, { start: 1, end: 8 });
  assert.deepEqual(nine.padY, { start: 3, end: 4 });
});

test('CSS colors accept #RGB, #RRGGBB, rgba() and a separate alpha', () => {
  assert.equal(parseColor('#abc'), '#FFAABBCC');
  assert.equal(parseColor('#102030', '0.5'), '#80102030');
  assert.equal(parseColor('rgba(255, 0, 0, 0.25)'), '#40FF0000');
  assert.equal(parseColor('nonsense'), null);
});

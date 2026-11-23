// Opens finished themes back into the editor:
//   .apk    → Android tab (colors, images incl. 9-patch, theme info, icon)
//   .ktheme → iPhone tab (colors, images, bubble caps/insets, theme info)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PNG } = require('pngjs');
const IOS = require('./ios-catalog.js');

const TEMPLATE = path.join(__dirname, 'android-template', 'src', 'main');
const toDataUrl = buffer => 'data:image/png;base64,' + buffer.toString('base64');

/* ---------- ZIP reader ---------- */

function readZip(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw Error('ZIP 파일이 아니거나 손상된 파일입니다.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10), size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    files.set(name, () => {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const body = buffer.subarray(start, start + size);
      return method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
    });
    offset += 46 + nameLength + extra + comment;
  }
  return files;
}

/* ---------- Android binary resources ---------- */

function readStringPool(buf, start) {
  const count = buf.readUInt32LE(start + 8), flags = buf.readUInt32LE(start + 16), stringsStart = buf.readUInt32LE(start + 20);
  const utf8 = (flags & 0x100) !== 0, strings = [];
  for (let i = 0; i < count; i++) {
    let p = start + stringsStart + buf.readUInt32LE(start + 28 + i * 4);
    if (utf8) {
      p += buf[p] & 0x80 ? 2 : 1; // UTF-16 length
      let len = buf[p];
      if (len & 0x80) { len = ((len & 0x7f) << 8) | buf[p + 1]; p += 2; } else p += 1;
      strings.push(buf.toString('utf8', p, p + len));
    } else {
      let len = buf.readUInt16LE(p);
      if (len & 0x8000) { len = ((len & 0x7fff) << 16) | buf.readUInt16LE(p + 2); p += 4; } else p += 2;
      strings.push(buf.toString('utf16le', p, p + len * 2));
    }
  }
  return strings;
}

// Returns [{ id, type, name, density, plain, dataType, data, string }] for every simple value.
function readResources(buf) {
  if (buf.readUInt16LE(0) !== 0x0002) throw Error('resources.arsc를 읽을 수 없습니다.');
  const out = [];
  let globalStrings = [];
  let offset = buf.readUInt16LE(2);
  while (offset < buf.length) {
    const type = buf.readUInt16LE(offset), size = buf.readUInt32LE(offset + 4);
    if (type === 0x0001) globalStrings = readStringPool(buf, offset);
    if (type === 0x0200) {
      const pkgId = buf.readUInt32LE(offset + 8);
      const typeNames = readStringPool(buf, offset + buf.readUInt32LE(offset + 268));
      const keyNames = readStringPool(buf, offset + buf.readUInt32LE(offset + 276));
      let p = offset + buf.readUInt16LE(offset + 2);
      while (p < offset + size) {
        const ctype = buf.readUInt16LE(p), csize = buf.readUInt32LE(p + 4);
        if (ctype === 0x0201) {
          const typeId = buf[p + 8], flags = buf[p + 9], entryCount = buf.readUInt32LE(p + 12), entriesStart = buf.readUInt32LE(p + 16);
          const config = p + 20, configSize = buf.readUInt32LE(config);
          const density = buf.readUInt16LE(config + 14);
          // "plain" = no qualifier other than density/SDK version (skip land, sw600dp, night, locales…).
          let plain = true;
          for (let i = 4; i < Math.min(configSize, 48); i++) if (i !== 14 && i !== 15 && !(i >= 24 && i < 28) && buf[config + i]) { plain = false; break; }
          const indexStart = p + buf.readUInt16LE(p + 2);
          const entries = [];
          if (flags & 0x01) for (let i = 0; i < entryCount; i++) entries.push([buf.readUInt16LE(indexStart + i * 4), buf.readUInt16LE(indexStart + i * 4 + 2) * 4]);
          else if (flags & 0x02) for (let i = 0; i < entryCount; i++) { const o = buf.readUInt16LE(indexStart + i * 2); if (o !== 0xffff) entries.push([i, o * 4]); }
          else for (let i = 0; i < entryCount; i++) { const o = buf.readUInt32LE(indexStart + i * 4); if (o !== 0xffffffff) entries.push([i, o]); }
          for (const [index, rel] of entries) {
            const e = p + entriesStart + rel, eflags = buf.readUInt16LE(e + 2);
            let key, dataType, data;
            if (eflags & 0x08) { key = buf.readUInt16LE(e); dataType = eflags >> 8; data = buf.readUInt32LE(e + 4); }
            else if (eflags & 0x01) continue; // style/attr maps
            else { key = buf.readUInt32LE(e + 4); const v = e + buf.readUInt16LE(e); dataType = buf[v + 3]; data = buf.readUInt32LE(v + 4); }
            out.push({ id: ((pkgId << 24) | (typeId << 16) | index) >>> 0, type: typeNames[typeId - 1], name: keyNames[key], density, plain, dataType, data, string: dataType === 0x03 ? globalStrings[data] : undefined });
          }
        }
        p += csize;
      }
    }
    offset += size;
  }
  return out;
}

// package and versionName from the binary AndroidManifest.xml
function readManifest(buf) {
  const result = {};
  if (!buf || buf.readUInt16LE(0) !== 0x0003) return result;
  let strings = [], p = buf.readUInt16LE(2);
  while (p < buf.length) {
    const type = buf.readUInt16LE(p), size = buf.readUInt32LE(p + 4);
    if (type === 0x0001) strings = readStringPool(buf, p);
    if (type === 0x0102 && strings[buf.readUInt32LE(p + 20)] === 'manifest') {
      const attrStart = p + 16 + buf.readUInt16LE(p + 24), attrSize = buf.readUInt16LE(p + 26), count = buf.readUInt16LE(p + 28);
      for (let i = 0; i < count; i++) {
        const a = attrStart + i * attrSize, name = strings[buf.readUInt32LE(a + 4)], raw = buf.readUInt32LE(a + 8);
        if ((name === 'package' || name === 'versionName') && raw !== 0xffffffff) result[name] = strings[raw];
      }
      break;
    }
    p += size;
  }
  return result;
}

const argbHex = data => '#' + (data >>> 0).toString(16).padStart(8, '0').toUpperCase();
const isColorType = t => t >= 0x1c && t <= 0x1f;

/* ---------- 9-patch ---------- */

// Compiled 9-patch PNGs keep their markers in an "npTc" chunk; rebuild the 1px black frame.
function readNinePatchChunk(png) {
  let p = 8;
  while (p < png.length - 8) {
    const length = png.readUInt32BE(p), type = png.toString('latin1', p + 4, p + 8);
    if (type === 'npTc') {
      const c = p + 8, nx = png[c + 1], ny = png[c + 2];
      const pad = [0, 1, 2, 3].map(i => png.readInt32BE(c + 12 + i * 4)); // left, right, top, bottom
      const xs = [], ys = [];
      for (let i = 0; i < nx; i++) xs.push(png.readInt32BE(c + 32 + i * 4));
      for (let i = 0; i < ny; i++) ys.push(png.readInt32BE(c + 32 + nx * 4 + i * 4));
      return { xs, ys, pad };
    }
    if (type === 'IEND') break;
    p += 12 + length;
  }
  return null;
}

function restoreNinePatch(buffer, chunk) {
  const src = PNG.sync.read(buffer), w = src.width, h = src.height;
  const out = new PNG({ width: w + 2, height: h + 2 });
  PNG.bitblt(src, out, 0, 0, w, h, 1, 1);
  const black = (x, y) => { const i = (y * (w + 2) + x) * 4; out.data[i] = 0; out.data[i + 1] = 0; out.data[i + 2] = 0; out.data[i + 3] = 255; };
  for (let i = 0; i + 1 < chunk.xs.length; i += 2) for (let x = chunk.xs[i]; x < chunk.xs[i + 1]; x++) black(x + 1, 0);
  for (let i = 0; i + 1 < chunk.ys.length; i += 2) for (let y = chunk.ys[i]; y < chunk.ys[i + 1]; y++) black(0, y + 1);
  const [left, right, top, bottom] = chunk.pad.map(n => Math.max(0, n));
  for (let x = left; x < w - right; x++) black(x + 1, h + 1);
  for (let y = top; y < h - bottom; y++) black(w + 1, y + 1);
  return PNG.sync.write(out);
}

/* ---------- APK → Android tab ---------- */

function templateFiles() {
  const names = new Set();
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else names.add(e.name); } };
  walk(path.join(TEMPLATE, 'theme'));
  return names;
}

function templateColorNames() {
  const xml = fs.readFileSync(path.join(TEMPLATE, 'theme', 'values', 'colors.xml'), 'utf8');
  return new Set([...xml.matchAll(/<color name="([^"]+)">/g)].map(m => m[1]));
}

function importApk(buffer) {
  const zip = readZip(buffer);
  if (!zip.has('resources.arsc')) throw Error('카카오톡 테마 APK가 아닙니다. (resources.arsc 없음)');
  const resources = readResources(zip.get('resources.arsc')());
  const byId = new Map(resources.map(r => [r.id, r]));
  const resolve = r => { for (let i = 0; r && r.dataType === 0x01 && i < 8; i++) r = byId.get(r.data); return r; };
  const warnings = [];

  // Colors: plain (unqualified) values only.
  const colorNames = templateColorNames(), colors = {};
  for (const r of resources) {
    if (r.type !== 'color' || !r.plain || r.density || !colorNames.has(r.name)) continue;
    const v = resolve(r);
    if (v && isColorType(v.dataType)) colors[r.name] = argbHex(v.data);
  }
  if (!Object.keys(colors).length) throw Error('이 APK에서 카카오톡 테마 색상을 찾지 못했습니다.');

  // Images: prefer xxhdpi, then the closest density; skip landscape/tablet variants.
  const known = templateFiles(), best = new Map();
  const score = r => (r.plain ? 0 : -10000) - Math.abs((r.density || 160) - 480);
  for (const r of resources) {
    if ((r.type !== 'drawable' && r.type !== 'mipmap') || !r.string?.endsWith('.png') || !zip.has(r.string)) continue;
    const current = best.get(r.name);
    if (!current || score(r) > score(current)) best.set(r.name, r);
  }
  const images = {};
  for (const [name, r] of best) {
    let data = zip.get(r.string)();
    const nine = readNinePatchChunk(data);
    const file = name + (nine ? '.9.png' : '.png');
    if (!known.has(file)) continue;
    if (nine) data = restoreNinePatch(data, nine);
    images[file] = toDataUrl(data);
  }

  const manifest = readManifest(zip.has('AndroidManifest.xml') ? zip.get('AndroidManifest.xml')() : null);
  const title = resources.find(r => r.type === 'string' && r.name === 'theme_title' && r.plain && r.string)?.string
    || resources.find(r => r.type === 'string' && r.name === 'app_name' && r.plain && r.string)?.string;
  const info = {};
  if (title) info.title = title;
  if (manifest.package) info.packageId = manifest.package;
  if (manifest.versionName) info.version = manifest.versionName;
  // Launcher icon (largest PNG); adaptive layers only when they are plain PNGs.
  const icon = (name) => {
    const list = resources.filter(r => r.name === name && r.string?.endsWith('.png') && zip.has(r.string) && r.plain);
    list.sort((a, b) => (b.density || 0) - (a.density || 0));
    return list[0] ? toDataUrl(zip.get(list[0].string)()) : undefined;
  };
  const launcher = icon('ic_launcher');
  if (launcher) info.icon = launcher;
  const fg = icon('studio_adaptive_foreground') || icon('ic_launcher_foreground');
  const bg = icon('studio_adaptive_background') || icon('ic_launcher_background');
  if (fg) info.iconForeground = fg;
  if (bg) info.iconBackground = bg;

  const profileCount = [3, 2, 1].find(n => images[`theme_profile_0${n}_image.png`]) || 1;
  if (!Object.keys(images).length) warnings.push('이미지는 찾지 못해 기본 이미지를 사용합니다.');
  return { import: 'apk', colors, images, info, profileCount, warnings };
}

/* ---------- .ktheme → iPhone tab ---------- */

// [block, property, iPhone color key, alpha property]
const CSS_COLORS = [
  ['TabBarStyle-Main', '-background-sidebar-color', 'tabbar_sidebar'],
  ['HeaderStyle-Main', '-ios-text-color', 'header_text'],
  ['HeaderStyle-Main', '-ios-tab-text-color', 'header_tab_text'],
  ['HeaderStyle-Main', '-ios-tab-highlighted-text-color', 'header_tab_selected'],
  ['MainViewStyle-Primary', 'background-color', 'main_bg'],
  ['MainViewStyle-Primary', '-ios-text-color', 'main_text'],
  ['MainViewStyle-Primary', '-ios-highlighted-text-color', 'main_text_pressed'],
  ['MainViewStyle-Primary', '-ios-description-text-color', 'main_desc'],
  ['MainViewStyle-Primary', '-ios-description-highlighted-text-color', 'main_desc_pressed'],
  ['MainViewStyle-Primary', '-ios-paragraph-text-color', 'main_paragraph'],
  ['MainViewStyle-Primary', '-ios-paragraph-highlighted-text-color', 'main_paragraph_pressed'],
  ['MainViewStyle-Primary', '-ios-normal-background-color', 'main_cell', '-ios-normal-background-alpha'],
  ['MainViewStyle-Primary', '-ios-selected-background-color', 'main_cell_pressed', '-ios-selected-background-alpha'],
  ['MainViewStyle-Secondary', 'background-color', 'secondary_bg'],
  ['SectionTitleStyle-Main', 'border-color', 'section_border', 'border-alpha'],
  ['SectionTitleStyle-Main', '-ios-text-color', 'section_text'],
  ['FeatureStyle-Primary', '-ios-text-color', 'feature_text'],
  ['ButtonStyle-Main', 'background-color', 'button_bg'],
  ['ButtonStyle-Main', '-ios-highlighted-background-color', 'button_pressed'],
  ['ButtonStyle-Main', '-ios-selected-background-color', 'button_selected'],
  ['BackgroundStyle-ChatRoom', 'background-color', 'chat_bg'],
  ['InputBarStyle-Chat', 'background-color', 'input_bg'],
  ['InputBarStyle-Chat', '-ios-send-normal-background-color', 'send_button'],
  ['InputBarStyle-Chat', '-ios-send-normal-foreground-color', 'send_icon'],
  ['InputBarStyle-Chat', '-ios-button-normal-foreground-color', 'menu_icon'],
  ['InputBarStyle-Chat', '-ios-button-text-color', 'input_text'],
  ['InputBarStyle-Chat', '-ios-button-normal-background-color', 'menu_button', '-ios-button-normal-background-alpha'],
  ['MessageCellStyle-Send', '-ios-text-color', 'send_text'],
  ['MessageCellStyle-Send', '-ios-unread-text-color', 'unread'],
  ['MessageCellStyle-Receive', '-ios-text-color', 'receive_text'],
  ['BackgroundStyle-Passcode', 'background-color', 'passcode_bg'],
  ['LabelStyle-PasscodeTitle', '-ios-text-color', 'passcode_title'],
  ['PasscodeStyle', '-ios-keypad-background-color', 'keypad_bg'],
  ['PasscodeStyle', '-ios-keypad-text-normal-color', 'keypad_text'],
  ['BackgroundStyle-MessageNotificationBar', 'background-color', 'noti_bg'],
  ['LabelStyle-MessageNotificationBarName', '-ios-text-color', 'noti_name'],
  ['LabelStyle-MessageNotificationBarMessage', '-ios-text-color', 'noti_message'],
  ['BackgroundStyle-DirectShareBar', 'background-color', 'share_bg'],
  ['LabelStyle-DirectShareBarName', '-ios-text-color', 'share_name'],
  ['LabelStyle-DirectShareBarMessage', '-ios-text-color', 'share_message'],
  ['BottomBannerStyle', 'background-color', 'banner_bg'],
  ['BottomBannerStyle-Light', 'background-color', 'banner_light_bg']
];

function parseCss(text) {
  const blocks = {};
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, name, body] of clean.matchAll(/([A-Za-z][\w-]*)\s*\{([^}]*)\}/g)) {
    const props = blocks[name] ||= {};
    for (const [, key, value] of body.matchAll(/(-?[A-Za-z][\w-]*)\s*:\s*([^;]+);?/g)) props[key.toLowerCase()] = value.trim();
  }
  return blocks;
}

function parseColor(value, alpha) {
  if (!value) return null;
  let r, g, b, a = 1, m;
  if ((m = value.match(/^#([\da-f]{3})$/i))) [r, g, b] = [...m[1]].map(c => parseInt(c + c, 16));
  else if ((m = value.match(/^#([\da-f]{6})$/i))) [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  else if ((m = value.match(/^#([\da-f]{8})$/i))) { [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); a = parseInt(m[1].slice(6), 16) / 255; }
  else if ((m = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i))) { [r, g, b] = [m[1], m[2], m[3]].map(Number); if (m[4] !== undefined) a = Number(m[4]); }
  else return null;
  if (alpha !== undefined && alpha !== null && !Number.isNaN(Number(alpha))) a = Number(alpha);
  const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return ('#' + hex(a * 255) + hex(r) + hex(g) + hex(b)).toUpperCase();
}

// "'file.png' 18px 20px" → { file, cap }
function parseImageValue(value) {
  const m = value?.match(/['"]([^'"]+)['"]\s*(?:(\d+(?:\.\d+)?)(?:px)?\s+(\d+(?:\.\d+)?)(?:px)?)?/);
  return m ? { file: m[1], cap: m[2] !== undefined ? [Math.round(Number(m[2])), Math.round(Number(m[3]))] : null } : null;
}
const parseInsets = value => { const n = value?.match(/\d+(?:\.\d+)?/g)?.map(x => Math.round(Number(x))); return n?.length === 4 ? n : null; };

function importKtheme(buffer) {
  const zip = readZip(buffer);
  const lower = new Map([...zip.keys()].map(name => [name.toLowerCase(), name]));
  const cssName = [...zip.keys()].find(n => /(^|\/)kakaotalktheme\.css$/i.test(n));
  if (!cssName) throw Error('KakaoTalkTheme.css가 없는 파일입니다. 카카오톡 아이폰 테마(.ktheme)가 맞는지 확인해주세요.');
  const base = cssName.includes('/') ? cssName.slice(0, cssName.lastIndexOf('/') + 1) : '';
  const css = parseCss(zip.get(cssName)().toString('utf8'));
  const prop = (block, key) => css[block]?.[key.toLowerCase()];
  const warnings = [];

  const colors = {};
  for (const [block, key, target, alphaKey] of CSS_COLORS) {
    const value = parseColor(prop(block, key), alphaKey ? prop(block, alphaKey) : undefined);
    if (value) colors[target] = value;
  }

  // Loads 'name.png' as a @3x image (scales @2x / @1x up when that is all there is).
  const load = file => {
    const stem = file.replace(/\.png$/i, '');
    for (const [suffix, scale] of [['@3x', 1], ['@2x', 1.5], ['', 3]]) for (const dir of [base + 'Images/', base, 'Images/', '']) {
      const real = lower.get((dir + stem + suffix + '.png').toLowerCase());
      if (!real) continue;
      let png = PNG.sync.read(zip.get(real)());
      if (scale !== 1) png = require('./ios-theme.cjs').resize(png, Math.round(png.width * scale), Math.round(png.height * scale));
      return png;
    }
    return null;
  };
  const images = {}, bubbles = {};
  const take = (target, value) => {
    const ref = parseImageValue(value);
    if (!ref) return null;
    const png = load(ref.file);
    if (!png) { warnings.push(`이미지를 찾지 못했어요: ${ref.file}`); return null; }
    images[target] = toDataUrl(PNG.sync.write(png));
    return ref;
  };

  take('mainBgImage', prop('MainViewStyle-Primary', '-ios-background-image'));
  take('chatroomBgImage', prop('BackgroundStyle-ChatRoom', '-ios-background-image'));
  take('passcodeBgImage', prop('BackgroundStyle-Passcode', '-ios-background-image'));
  take('maintabBgImage', prop('TabBarStyle-Main', '-ios-background-image'));
  take('findBtnAddFriend', prop('ButtonStyle-AddFriend', '-ios-image'));
  const cap = s => s[0].toUpperCase() + s.slice(1);
  for (const tab of ['friends', 'chats', 'now', 'shopping', 'more', 'call', 'piccoma', 'local']) {
    const fallback = tab === 'now' ? 'openchats' : null;
    take(`maintabIco${cap(tab)}`, prop('TabBarStyle-Main', `-ios-${tab}-normal-icon-image`) || (fallback && prop('TabBarStyle-Main', `-ios-${fallback}-normal-icon-image`)));
    take(`maintabIco${cap(tab)}Selected`, prop('TabBarStyle-Main', `-ios-${tab}-selected-icon-image`) || (fallback && prop('TabBarStyle-Main', `-ios-${fallback}-selected-icon-image`)));
  }
  for (const side of ['Send', 'Receive']) {
    const block = `MessageCellStyle-${side}`;
    for (const [n, imageKey, insetKey] of [['01', '-ios-background-image', '-ios-title-edgeinsets'], ['02', '-ios-group-background-image', '-ios-group-title-edgeinsets']]) {
      const name = `chatroomBubble${side}${n}`;
      const ref = take(name, prop(block, imageKey) || (n === '02' ? prop(block, '-ios-background-image') : undefined));
      const insets = parseInsets(prop(block, insetKey) || prop(block, '-ios-title-edgeinsets'));
      if (ref && ref.cap && insets) bubbles[name] = { cap: ref.cap, insets };
      else if (ref) warnings.push(`${name}: 말풍선 늘림 지점이나 글자 여백 정보가 없어 기본값을 사용합니다.`);
    }
  }
  const profiles = [...(prop('DefaultProfileStyle', '-ios-profile-images') || '').matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]).slice(0, 3);
  profiles.forEach((file, i) => take(`profileImg0${i + 1}`, `'${file}'`));
  const ordinals = ['first', 'second', 'third', 'fourth'];
  ordinals.forEach((o, i) => {
    take(`passcodeImgCode0${i + 1}`, prop('PasscodeStyle', `-ios-bullet-${o}-image`));
    take(`passcodeImgCode0${i + 1}Selected`, prop('PasscodeStyle', `-ios-bullet-selected-${o}-image`));
  });
  // The pressed-key circle is an image; read its color from the middle pixel.
  const pressed = parseImageValue(prop('PasscodeStyle', '-ios-keypad-number-highlighted-image'));
  const circle = pressed && load(pressed.file);
  if (circle) {
    const i = (Math.floor(circle.height / 2) * circle.width + Math.floor(circle.width / 2)) * 4, d = circle.data;
    colors.keypad_pressed = parseColor(`rgba(${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3] / 255})`);
  }

  const manifest = css.ManifestStyle || {};
  const unquote = v => v?.replace(/^['"]|['"]$/g, '');
  const info = {};
  if (manifest['-kakaotalk-theme-name']) info.title = unquote(manifest['-kakaotalk-theme-name']);
  if (manifest['-kakaotalk-author-name']) info.author = unquote(manifest['-kakaotalk-author-name']);
  if (manifest['-kakaotalk-theme-version']) info.version = unquote(manifest['-kakaotalk-theme-version']);
  const id = unquote(manifest['-kakaotalk-theme-id']);
  if (id && /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(id)) info.packageId = id;
  const iconName = lower.get((base + 'Images/commonIcoTheme.png').toLowerCase()) || lower.get('images/commonicotheme.png');
  if (iconName) info.icon = toDataUrl(zip.get(iconName)());

  if (!Object.keys(colors).length && !Object.keys(images).length) throw Error('테마 내용(색상·이미지)을 찾지 못했습니다.');
  const known = new Set(IOS.images.map(i => i.name));
  for (const name of Object.keys(images)) if (!known.has(name)) delete images[name];
  return { import: 'ktheme', ios: { colors, images, bubbles, profileCount: Math.max(1, profiles.length) }, info, warnings };
}

function importTheme(file) {
  const buffer = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  if (ext === '.apk') return importApk(buffer);
  if (ext === '.ktheme') return importKtheme(buffer);
  throw Error('지원하지 않는 파일입니다.');
}

module.exports = { importTheme, importApk, importKtheme, readZip, readResources, restoreNinePatch, readNinePatchChunk, parseCss, parseColor };

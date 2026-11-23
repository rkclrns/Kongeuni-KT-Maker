// Builds an iPhone KakaoTalk theme (.ktheme). The iPhone tab keeps its own
// colors and images (project.ios); they start from the Android template, and
// Android xxhdpi resources map almost 1:1 to iOS @3x images.
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { PNG } = require('pngjs');
const { createZip } = require('./zip-writer.cjs');
const IOS = require('./ios-catalog.js');

const TEMPLATE = path.join(__dirname, 'android-template', 'src', 'main');
const XXHDPI = path.join(TEMPLATE, 'theme', 'drawable-xxhdpi');
const DEFAULT_ICON = path.join(TEMPLATE, 'res', 'mipmap-xxxhdpi', 'ic_launcher.png');
const SLOT_FILES = {
  'main-bg': 'theme_background_image.png',
  'chat-bg': 'theme_chatroom_background_image.png',
  'passcode-bg': 'theme_passcode_background_image.png',
  profile: 'theme_profile_01_image.png'
};

/* ---------- colors ---------- */

function templateColors() {
  const xml = fs.readFileSync(path.join(TEMPLATE, 'theme', 'values', 'colors.xml'), 'utf8');
  const colors = {};
  for (const [, key, value] of xml.matchAll(/<color name="([^"]+)">\s*([^<\s]+)\s*<\/color>/g)) colors[key] = value;
  return colors;
}

function projectColors(data) {
  const colors = templateColors();
  const valid = v => typeof v === 'string' && /^#[\da-f]{6}([\da-f]{2})?$/i.test(v);
  if (valid(data.color)) colors.theme_background_color = data.color;
  for (const [key, value] of Object.entries(data.editor?.colors || {})) if (valid(value)) colors[key] = value;
  return colors;
}

// Android uses #AARRGGBB; iOS CSS wants #RRGGBB plus a separate alpha.
function splitColor(value = '#000000') {
  const hex = value.replace('#', '');
  if (hex.length === 8) return { rgb: '#' + hex.slice(2).toUpperCase(), alpha: parseInt(hex.slice(0, 2), 16) / 255, argb: hex };
  return { rgb: '#' + hex.toUpperCase(), alpha: 1, argb: 'FF' + hex };
}
const alphaText = a => (Math.round(a * 100) / 100).toFixed(2).replace(/0$/, '');

/* ---------- PNG helpers ---------- */

function blank(width, height) { return new PNG({ width, height }); }

function crop(src, x, y, width, height) {
  const out = blank(width, height);
  PNG.bitblt(src, out, x, y, width, height, 0, 0);
  return out;
}

// Area-average resize with premultiplied alpha (no halo around transparent edges).
function resize(src, width, height) {
  if (src.width === width && src.height === height) return src;
  const out = blank(width, height);
  const sx = src.width / width, sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * sy, y1 = Math.min(src.height, (y + 1) * sy);
    for (let x = 0; x < width; x++) {
      const x0 = x * sx, x1 = Math.min(src.width, (x + 1) * sx);
      let r = 0, g = 0, b = 0, a = 0, total = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const w = (Math.min(xx + 1, x1) - Math.max(xx, x0)) * wy;
          const i = (yy * src.width + xx) * 4, alpha = src.data[i + 3] * w;
          r += src.data[i] * alpha; g += src.data[i + 1] * alpha; b += src.data[i + 2] * alpha;
          a += alpha; total += w;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) { out.data[o] = Math.round(r / a); out.data[o + 1] = Math.round(g / a); out.data[o + 2] = Math.round(b / a); }
      out.data[o + 3] = Math.round(a / total);
    }
  }
  return out;
}

// Scale to cover the target box, then crop (center or top).
function cover(src, width, height, anchor = 'center') {
  const scale = Math.max(width / src.width, height / src.height);
  const w = Math.max(width, Math.round(src.width * scale)), h = Math.max(height, Math.round(src.height * scale));
  const scaled = resize(src, w, h);
  return crop(scaled, Math.floor((w - width) / 2), anchor === 'top' ? 0 : Math.floor((h - height) / 2), width, height);
}

// Scale to fit inside the box, centered on a transparent canvas.
function contain(src, width, height) {
  if (src.width === width && src.height === height) return src;
  const scale = Math.min(width / src.width, height / src.height);
  const w = Math.max(1, Math.round(src.width * scale)), h = Math.max(1, Math.round(src.height * scale));
  const out = blank(width, height);
  PNG.bitblt(resize(src, w, h), out, 0, 0, w, h, Math.floor((width - w) / 2), Math.floor((height - h) / 2));
  return out;
}

function darken(src, factor = 0.9) {
  const out = blank(src.width, src.height);
  for (let i = 0; i < src.data.length; i += 4) {
    out.data[i] = src.data[i] * factor; out.data[i + 1] = src.data[i + 1] * factor;
    out.data[i + 2] = src.data[i + 2] * factor; out.data[i + 3] = src.data[i + 3];
  }
  return out;
}

function circle(size, { rgb, alpha }) {
  const out = blank(size, size), r = size / 2;
  const [cr, cg, cb] = [1, 3, 5].map(i => parseInt(rgb.slice(i, i + 2), 16));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
    const coverage = Math.max(0, Math.min(1, r - d + 0.5));
    const i = (y * size + x) * 4;
    out.data[i] = cr; out.data[i + 1] = cg; out.data[i + 2] = cb; out.data[i + 3] = Math.round(255 * alpha * coverage);
  }
  return out;
}

// Reads Android nine-patch markers and returns the artwork without its 1px frame.
function unNine(src) {
  const w = src.width, h = src.height;
  const black = (x, y) => { const i = (y * w + x) * 4; return src.data[i + 3] > 128 && src.data[i] + src.data[i + 1] + src.data[i + 2] < 100; };
  const range = (length, test) => {
    const hits = [];
    for (let i = 1; i < length - 1; i++) if (test(i)) hits.push(i - 1);
    return hits.length ? { start: hits[0], end: hits[hits.length - 1] + 1 } : null;
  };
  const image = crop(src, 1, 1, w - 2, h - 2);
  const stretchX = range(w, x => black(x, 0)) || { start: Math.floor(image.width / 2), end: Math.floor(image.width / 2) + 1 };
  const stretchY = range(h, y => black(0, y)) || { start: Math.floor(image.height / 2), end: Math.floor(image.height / 2) + 1 };
  const padX = range(w, x => black(x, h - 1)) || stretchX;
  const padY = range(h, y => black(w - 1, y)) || stretchY;
  return { image, stretchX, stretchY, padX, padY };
}

/* ---------- image source ---------- */

function decodeDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/png;base64,')
    ? Buffer.from(value.split(',')[1], 'base64') : null;
}

// Loads Android resources: the user's edits first, then the template.
// loader.edited(name) tells whether a resource came from the user.
function imageLoader(data) {
  const images = data.editor?.images || {};
  const legacy = {};
  for (const [slot, url] of Object.entries(data.slots || {})) {
    if (!SLOT_FILES[slot] || typeof url !== 'string' || !url.startsWith('file:')) continue;
    try { const file = fileURLToPath(url); if (fs.existsSync(file)) legacy[SLOT_FILES[slot]] = file; } catch { /* ignore */ }
  }
  const load = name => {
    const edited = decodeDataUrl(images[name]);
    if (edited) return PNG.sync.read(edited);
    if (legacy[name]) return PNG.sync.read(fs.readFileSync(legacy[name]));
    const file = path.join(XXHDPI, name);
    return fs.existsSync(file) ? PNG.sync.read(fs.readFileSync(file)) : null;
  };
  load.edited = name => !!decodeDataUrl(images[name]) || !!legacy[name];
  return load;
}

/* ---------- iPhone state ---------- */

const IMAGE_SPECS = Object.fromEntries(IOS.images.map(spec => [spec.name, spec]));
const COLOR_KEYS = new Set(IOS.colors.map(c => c.key));
const cap = s => s[0].toUpperCase() + s.slice(1);
const pt = px => Math.max(0, Math.round(px / 3));
const validColor = v => typeof v === 'string' && /^#[\da-f]{6}([\da-f]{2})?$/i.test(v);
const argb = v => (v.length === 7 ? '#FF' + v.slice(1) : v).toUpperCase();
const validNumbers = (list, length) => Array.isArray(list) && list.length === length && list.every(n => Number.isFinite(n) && n >= 0 && n < 10000);
const validBubble = m => m && validNumbers(m.cap, 2) && validNumbers(m.insets, 4);

function fitImage(png, spec) {
  if (!spec.size) return png;
  const [w, h] = spec.size;
  return spec.fit === 'contain' ? contain(png, w, h) : cover(png, w, h, spec.fit === 'cover-top' ? 'top' : 'center');
}

// Cap insets (pt) and text insets (pt, top/left/bottom/right) from an Android bubble nine-patch.
function bubbleMetrics(bubble, nine) {
  const { image, stretchX, stretchY, padX, padY } = nine;
  // Android KakaoTalk adds its own spacing inside the nine-patch padding; iOS
  // uses the insets as-is. Offsets calibrated from Kakao's paired Android/iOS
  // samples (same artwork): +6 top, +3 bottom, +7 on the tail side, +4 opposite.
  const send = bubble.startsWith('Send');
  return {
    cap: [pt(stretchX.start), pt(stretchY.start)],
    insets: [pt(padY.start) + 6, pt(padX.start) + (send ? 4 : 7), pt(image.height - padY.end) + 3, pt(image.width - padX.end) + (send ? 7 : 4)]
  };
}

// Converts Android project data into iPhone resources.
// editedOnly: only images that came from the user's Android edits (for importing).
function convertAndroid(data = {}, { editedOnly = false } = {}) {
  const load = imageLoader(data);
  const android = projectColors(data);
  const colors = {};
  for (const c of IOS.colors) colors[c.key] = argb(validColor(android[c.from]) ? android[c.from] : '#000000');
  const images = {}, bubbles = {};
  for (const spec of IOS.images) {
    const source = load(spec.from) ? spec.from : spec.fallback;
    if (editedOnly && !(source && load.edited(source))) continue;
    let png = source && load(source);
    if (!png) throw Error(`이미지를 찾을 수 없습니다: ${spec.from}`);
    if (spec.nine) {
      const nine = unNine(png);
      png = nine.image;
      if (spec.bubble) bubbles[spec.name] = bubbleMetrics(spec.bubble, nine);
    }
    images[spec.name] = fitImage(png, spec);
  }
  const profileCount = Math.min(3, Math.max(1, Number(data.editor?.profileCount) || 1));
  return { colors, images, bubbles, profileCount };
}

let templateCache;
function templateState() { return templateCache ||= convertAndroid({}); }

// The iPhone resources a build uses. Projects without an `ios` block (made before
// the iPhone tab was separate) keep following their Android edits.
function iosState(data = {}) {
  const ios = data.ios;
  if (!ios || typeof ios !== 'object') return convertAndroid(data);
  const base = templateState();
  const colors = { ...base.colors }, images = { ...base.images }, bubbles = { ...base.bubbles };
  for (const [key, value] of Object.entries(ios.colors || {})) if (COLOR_KEYS.has(key) && validColor(value)) colors[key] = argb(value);
  for (const [name, url] of Object.entries(ios.images || {})) {
    const spec = IMAGE_SPECS[name], buffer = decodeDataUrl(url);
    if (spec && buffer) images[name] = fitImage(PNG.sync.read(buffer), spec);
  }
  for (const [name, metrics] of Object.entries(ios.bubbles || {})) if (name in bubbles && validBubble(metrics)) bubbles[name] = metrics;
  const profileCount = Math.min(3, Math.max(1, Number(ios.profileCount) || 1));
  return { colors, images, bubbles, profileCount };
}

const toDataUrl = png => 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
function exportState(state) {
  return {
    colors: { ...state.colors },
    images: Object.fromEntries(Object.entries(state.images).map(([name, png]) => [name, toDataUrl(png)])),
    bubbles: JSON.parse(JSON.stringify(state.bubbles)),
    profileCount: state.profileCount
  };
}

// Template defaults for the iPhone preview (sent to the editor once).
function previewBase() { return exportState(templateState()); }

// "안드로이드 값 가져오기": every color plus the images the user edited on Android.
function importFromAndroid(data = {}) { return exportState(convertAndroid(data, { editedOnly: true })); }

/* ---------- package ---------- */

function buildKtheme(data = {}) {
  const info = data.editor?.info || {};
  if (!info.title?.trim()) throw Error('테마 이름을 입력하세요.');
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(info.packageId || ''))
    throw Error('앱 식별자는 영문자로 시작하는 부분을 점으로 연결하세요. 예: KongeuniThema.NewThema');

  const state = iosState(data);
  const files = [];
  const warnings = [];

  // Adds name@3x.png and name@2x.png from a @3x image.
  const addScaled = (name, png3x) => {
    files.push({ name: `Images/${name}@3x.png`, data: PNG.sync.write(png3x) });
    const png2x = resize(png3x, Math.max(1, Math.round(png3x.width * 2 / 3)), Math.max(1, Math.round(png3x.height * 2 / 3)));
    files.push({ name: `Images/${name}@2x.png`, data: PNG.sync.write(png2x) });
  };

  const profiles = [];
  for (const spec of IOS.images) {
    const profile = spec.name.match(/^profileImg0(\d)$/);
    if (profile && Number(profile[1]) > state.profileCount) continue;
    if (profile) profiles.push(`'${spec.name}.png'`);
    addScaled(spec.name, state.images[spec.name]);
    if (spec.bubble) addScaled(`${spec.name}Selected`, darken(state.images[spec.name], 0.92));
  }
  addScaled('passcodeKeypadPressed', circle(180, splitColor(state.colors.keypad_pressed)));

  // Theme icon (shown in KakaoTalk's theme list)
  const iconBuffer = decodeDataUrl(info.icon) || fs.readFileSync(DEFAULT_ICON);
  files.push({ name: 'Images/commonIcoTheme.png', data: PNG.sync.write(cover(PNG.sync.read(iconBuffer), 162, 162)) });
  if (!info.icon) warnings.push('테마 아이콘을 지정하지 않아 기본 아이콘을 사용했습니다.');

  const bubbles = Object.fromEntries(Object.entries(state.bubbles).map(([name, m]) => [name.replace('chatroomBubble', ''), {
    cap: `${m.cap[0]}px ${m.cap[1]}px`,
    insets: `${m.insets[0]}px ${m.insets[1]}px ${m.insets[2]}px ${m.insets[3]}px`
  }]));
  const css = buildCss({ info, colors: state.colors, bubbles, profiles });
  files.unshift({ name: 'KakaoTalkTheme.css', data: Buffer.from(css, 'utf8') });
  return { buffer: createZip(files), css, files: files.map(f => f.name), warnings };
}

function cssString(value) {
  return "'" + String(value ?? '').replace(/[\\']/g, m => '\\' + m).replace(/[\r\n]/g, ' ') + "'";
}

function themeVersion(version) {
  return String(version || '').match(/\d+(?:\.\d+){0,2}/)?.[0] || '1.0.0';
}

// colors: iPhone keys from ios-catalog.js (#AARRGGBB).
function buildCss({ info, colors, bubbles, profiles }) {
  const c = key => splitColor(colors[key]);
  const rgb = key => c(key).rgb;
  const bodyCell = c('main_cell'), pressedCell = c('main_cell_pressed');
  const border = c('section_border'), menuButton = c('menu_button');
  const tab = (name, file = cap(name)) =>
    `    -ios-${name}-normal-icon-image: 'maintabIco${file}.png';\n    -ios-${name}-selected-icon-image: 'maintabIco${file}Selected.png';`;

  return `/*
 Manifest
 Generated by Kongeuni KT Maker
 */

ManifestStyle
{
    -kakaotalk-theme-name: ${cssString(info.title.trim())};
    -kakaotalk-theme-version: ${cssString(themeVersion(info.version))};
    -kakaotalk-theme-url: ${cssString(info.url || '')};
    -kakaotalk-author-name: ${cssString(info.author || '')};
    -kakaotalk-theme-id: ${cssString(info.packageId)};
}

/* TabBar */
TabBarStyle-Main
{
    -background-sidebar-color: ${rgb('tabbar_sidebar')};
    -ios-background-image: 'maintabBgImage.png';
${['friends', 'chats', 'now', 'shopping', 'more', 'call', 'piccoma', 'local'].map(n => tab(n)).join('\n')}
${tab('openchats', 'Now')}
}

/* Main */
HeaderStyle-Main
{
    -ios-text-color: ${rgb('header_text')};
    -ios-tab-text-color: ${rgb('header_tab_text')};
    -ios-tab-highlighted-text-color: ${rgb('header_tab_selected')};
}

MainViewStyle-Primary
{
    background-color: ${rgb('main_bg')};
    -ios-background-image: 'mainBgImage.png';
    -ios-text-color: ${rgb('main_text')};
    -ios-highlighted-text-color: ${rgb('main_text_pressed')};
    -ios-description-text-color: ${rgb('main_desc')};
    -ios-description-highlighted-text-color: ${rgb('main_desc_pressed')};
    -ios-paragraph-text-color: ${rgb('main_paragraph')};
    -ios-paragraph-highlighted-text-color: ${rgb('main_paragraph_pressed')};
    -ios-normal-background-color: ${bodyCell.rgb};
    -ios-normal-background-alpha: ${alphaText(bodyCell.alpha)};
    -ios-selected-background-color: ${pressedCell.rgb};
    -ios-selected-background-alpha: ${alphaText(pressedCell.alpha)};
}

MainViewStyle-Secondary
{
    background-color: ${rgb('secondary_bg')};
}

SectionTitleStyle-Main
{
    border-color: ${border.rgb};
    border-alpha: ${alphaText(border.alpha)};
    -ios-text-color: ${rgb('section_text')};
    -ios-text-alpha: 1.0;
}

/* Feature */
FeatureStyle-Primary
{
    -ios-text-color: ${rgb('feature_text')};
}

ButtonStyle-Main
{
    background-color: ${rgb('button_bg')};
    -ios-highlighted-background-color: ${rgb('button_pressed')};
    -ios-selected-background-color: ${rgb('button_selected')};
}

ButtonStyle-AddFriend
{
    -ios-image: 'findBtnAddFriend.png';
}

DefaultProfileStyle
{
    -ios-profile-images: ${profiles.join(', ')};
}

/* ChatRoom */
BackgroundStyle-ChatRoom
{
    background-color: ${rgb('chat_bg')};
    -ios-background-image: 'chatroomBgImage.png';
}

InputBarStyle-Chat
{
    background-color: ${rgb('input_bg')};
    -ios-send-normal-background-color: ${rgb('send_button')};
    -ios-send-normal-foreground-color: ${rgb('send_icon')};
    -ios-send-highlighted-background-color: ${rgb('send_button')};
    -ios-send-highlighted-foreground-color: ${rgb('send_icon')};
    -ios-button-normal-foreground-color: ${rgb('menu_icon')};
    -ios-button-highlighted-foreground-color: ${rgb('menu_icon')};
    -ios-button-text-color: ${rgb('input_text')};
    -ios-button-normal-background-color: ${menuButton.rgb};
    -ios-button-normal-background-alpha: ${alphaText(menuButton.alpha)};
}

MessageCellStyle-Send
{
    -ios-background-image: 'chatroomBubbleSend01.png' ${bubbles.Send01.cap};
    -ios-selected-background-image: 'chatroomBubbleSend01Selected.png' ${bubbles.Send01.cap};
    -ios-group-background-image: 'chatroomBubbleSend02.png' ${bubbles.Send02.cap};
    -ios-group-selected-background-image: 'chatroomBubbleSend02Selected.png' ${bubbles.Send02.cap};
    -ios-title-edgeinsets: ${bubbles.Send01.insets};  /* top, left, bottom, right */
    -ios-group-title-edgeinsets: ${bubbles.Send02.insets};
    -ios-text-color: ${rgb('send_text')};
    -ios-selected-text-color: ${rgb('send_text')};
    -ios-unread-text-color: ${rgb('unread')};
}

MessageCellStyle-Receive
{
    -ios-background-image: 'chatroomBubbleReceive01.png' ${bubbles.Receive01.cap};
    -ios-selected-background-image: 'chatroomBubbleReceive01Selected.png' ${bubbles.Receive01.cap};
    -ios-group-background-image: 'chatroomBubbleReceive02.png' ${bubbles.Receive02.cap};
    -ios-group-selected-background-image: 'chatroomBubbleReceive02Selected.png' ${bubbles.Receive02.cap};
    -ios-title-edgeinsets: ${bubbles.Receive01.insets};  /* top, left, bottom, right */
    -ios-group-title-edgeinsets: ${bubbles.Receive02.insets};
    -ios-text-color: ${rgb('receive_text')};
    -ios-selected-text-color: ${rgb('receive_text')};
    -ios-unread-text-color: ${rgb('unread')};
}

/* Passcode */
BackgroundStyle-Passcode
{
    background-color: ${rgb('passcode_bg')};
    -ios-background-image: 'passcodeBgImage.png';
}

LabelStyle-PasscodeTitle
{
    -ios-text-color: ${rgb('passcode_title')};
}

PasscodeStyle
{
${[1, 2, 3, 4].map((n, i) => `    -ios-bullet-${['first', 'second', 'third', 'fourth'][i]}-image: 'passcodeImgCode0${n}.png';`).join('\n')}
${[1, 2, 3, 4].map((n, i) => `    -ios-bullet-selected-${['first', 'second', 'third', 'fourth'][i]}-image: 'passcodeImgCode0${n}Selected.png';`).join('\n')}
    -ios-keypad-background-color: ${rgb('keypad_bg')};
    -ios-keypad-text-normal-color: ${rgb('keypad_text')};
    -ios-keypad-number-highlighted-image: 'passcodeKeypadPressed.png';
}

/* Notification bar */
BackgroundStyle-MessageNotificationBar
{
    background-color: ${rgb('noti_bg')};
}

LabelStyle-MessageNotificationBarName
{
    -ios-text-color: ${rgb('noti_name')};
}

LabelStyle-MessageNotificationBarMessage
{
    -ios-text-color: ${rgb('noti_message')};
}

/* Direct share */
BackgroundStyle-DirectShareBar
{
    background-color: ${rgb('share_bg')};
}

LabelStyle-DirectShareBarName
{
    -ios-text-color: ${rgb('share_name')};
}

LabelStyle-DirectShareBarMessage
{
    -ios-text-color: ${rgb('share_message')};
}

/* Bottom banner */
BottomBannerStyle
{
    background-color: ${rgb('banner_bg')};
}

BottomBannerStyle-Light
{
    background-color: ${rgb('banner_light_bg')};
}
`;
}

module.exports = { buildKtheme, buildCss, unNine, resize, splitColor, iosState, previewBase, importFromAndroid };

// Builds an iOS KakaoTalk theme (.ktheme) from the same project data used for
// the Android APK. Android xxhdpi resources map almost 1:1 to iOS @3x images,
// so every image is converted from the Android template or the user's edits.
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { PNG } = require('pngjs');
const { createZip } = require('./zip-writer.cjs');

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

function imageLoader(data) {
  const images = data.editor?.images || {};
  const legacy = {};
  for (const [slot, url] of Object.entries(data.slots || {})) {
    if (!SLOT_FILES[slot] || typeof url !== 'string' || !url.startsWith('file:')) continue;
    try { const file = fileURLToPath(url); if (fs.existsSync(file)) legacy[SLOT_FILES[slot]] = file; } catch { /* ignore */ }
  }
  return name => {
    const edited = decodeDataUrl(images[name]);
    if (edited) return PNG.sync.read(edited);
    if (legacy[name]) return PNG.sync.read(fs.readFileSync(legacy[name]));
    const file = path.join(XXHDPI, name);
    return fs.existsSync(file) ? PNG.sync.read(fs.readFileSync(file)) : null;
  };
}

/* ---------- package ---------- */

const TABS = ['friends', 'chats', 'now', 'shopping', 'more', 'call', 'piccoma'];
const cap = s => s[0].toUpperCase() + s.slice(1);
const pt = px => Math.max(0, Math.round(px / 3));

function buildKtheme(data = {}) {
  const info = data.editor?.info || {};
  if (!info.title?.trim()) throw Error('테마 이름을 입력하세요.');
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(info.packageId || ''))
    throw Error('앱 식별자는 영문자로 시작하는 부분을 점으로 연결하세요. 예: KongeuniThema.NewThema');

  const load = imageLoader(data);
  const colors = projectColors(data);
  const files = [];
  const warnings = [];

  // Adds name@3x.png and name@2x.png from a @3x (xxhdpi) image.
  const addScaled = (name, png3x) => {
    files.push({ name: `Images/${name}@3x.png`, data: PNG.sync.write(png3x) });
    const png2x = resize(png3x, Math.max(1, Math.round(png3x.width * 2 / 3)), Math.max(1, Math.round(png3x.height * 2 / 3)));
    files.push({ name: `Images/${name}@2x.png`, data: PNG.sync.write(png2x) });
  };
  const need = name => {
    const png = load(name);
    if (!png) throw Error(`이미지를 찾을 수 없습니다: ${name}`);
    return png;
  };

  // Backgrounds
  addScaled('mainBgImage', cover(need('theme_background_image.png'), 1125, 2250));
  addScaled('chatroomBgImage', cover(need('theme_chatroom_background_image.png'), 1125, 2250));
  addScaled('passcodeBgImage', cover(need('theme_passcode_background_image.png'), 1200, 1200));
  addScaled('maintabBgImage', cover(unNine(need('theme_maintab_cell_image.9.png')).image, 1410, 147, 'top'));

  // Tab icons
  for (const tab of TABS) {
    addScaled(`maintabIco${cap(tab)}`, contain(need(`theme_maintab_ico_${tab}_image.png`), 114, 114));
    addScaled(`maintabIco${cap(tab)}Selected`, contain(need(`theme_maintab_ico_${tab}_focused_image.png`), 114, 114));
  }
  // 'Local' tab has no Android counterpart; reuse the Now icons.
  addScaled('maintabIcoLocal', contain(need('theme_maintab_ico_now_image.png'), 114, 114));
  addScaled('maintabIcoLocalSelected', contain(need('theme_maintab_ico_now_focused_image.png'), 114, 114));

  // Chat bubbles: nine-patch -> plain image + cap insets / text insets
  const bubbles = {};
  for (const [ios, android] of [['Send01', 'me_01'], ['Send02', 'me_02'], ['Receive01', 'you_01'], ['Receive02', 'you_02']]) {
    const nine = unNine(need(`theme_chatroom_bubble_${android}_image.9.png`));
    addScaled(`chatroomBubble${ios}`, nine.image);
    addScaled(`chatroomBubble${ios}Selected`, darken(nine.image, 0.92));
    const { image, stretchX, stretchY, padX, padY } = nine;
    // Android KakaoTalk adds its own spacing inside the nine-patch padding; iOS
    // uses the insets as-is. Offsets calibrated from Kakao's paired Android/iOS
    // samples (same artwork): +6 top, +3 bottom, +7 on the tail side, +4 opposite.
    const send = ios.startsWith('Send');
    const [top, left, bottom, right] = [
      pt(padY.start) + 6,
      pt(padX.start) + (send ? 4 : 7),
      pt(image.height - padY.end) + 3,
      pt(image.width - padX.end) + (send ? 7 : 4)
    ];
    bubbles[ios] = {
      cap: `${pt(stretchX.start)}px ${pt(stretchY.start)}px`,
      insets: `${top}px ${left}px ${bottom}px ${right}px`
    };
  }

  // Default profiles (up to 3)
  const profileCount = Math.min(3, Math.max(1, Number(data.editor?.profileCount) || 1));
  const profiles = [];
  for (let i = 1; i <= profileCount; i++) {
    const png = load(`theme_profile_0${i}_image.png`) || need('theme_profile_01_image.png');
    addScaled(`profileImg0${i}`, cover(png, 360, 360));
    profiles.push(`'profileImg0${i}.png'`);
  }

  // Passcode
  for (let i = 1; i <= 4; i++) {
    addScaled(`passcodeImgCode0${i}`, contain(need(`theme_passcode_0${i}_image.png`), 132, 132));
    addScaled(`passcodeImgCode0${i}Selected`, contain(need(`theme_passcode_0${i}_checked_image.png`), 132, 132));
  }
  addScaled('passcodeKeypadPressed', circle(180, splitColor(colors.theme_passcode_keypad_pressed_background_color || '#99FFFFFF')));

  // Add-friend button
  addScaled('findBtnAddFriend', need('theme_find_add_friend_button_image.png'));

  // Theme icon (shown in KakaoTalk's theme list)
  const iconBuffer = decodeDataUrl(info.icon) || fs.readFileSync(DEFAULT_ICON);
  files.push({ name: 'Images/commonIcoTheme.png', data: PNG.sync.write(cover(PNG.sync.read(iconBuffer), 162, 162)) });
  if (!info.icon) warnings.push('테마 아이콘을 지정하지 않아 기본 아이콘을 사용했습니다.');

  const css = buildCss({ info, colors, bubbles, profiles });
  files.unshift({ name: 'KakaoTalkTheme.css', data: Buffer.from(css, 'utf8') });
  return { buffer: createZip(files), css, files: files.map(f => f.name), warnings };
}

function cssString(value) {
  return "'" + String(value ?? '').replace(/[\\']/g, m => '\\' + m).replace(/[\r\n]/g, ' ') + "'";
}

function themeVersion(version) {
  return String(version || '').match(/\d+(?:\.\d+){0,2}/)?.[0] || '1.0.0';
}

function buildCss({ info, colors, bubbles, profiles }) {
  const c = key => splitColor(colors[key]);
  const rgb = key => c(key).rgb;
  const bodyCell = c('theme_body_cell_color'), pressedCell = c('theme_body_cell_pressed_color');
  const border = c('theme_body_cell_border_color'), menuButton = c('theme_chatroom_input_bar_menu_button_color');
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
    -background-sidebar-color: ${rgb('theme_background_color')};
    -ios-background-image: 'maintabBgImage.png';
${['friends', 'chats', 'now', 'shopping', 'more', 'call', 'piccoma', 'local'].map(n => tab(n)).join('\n')}
${tab('openchats', 'Now')}
}

/* Main */
HeaderStyle-Main
{
    -ios-text-color: ${rgb('theme_header_color')};
    -ios-tab-text-color: ${rgb('theme_feature_browse_tab_color')};
    -ios-tab-highlighted-text-color: ${rgb('theme_feature_browse_tab_focused_color')};
}

MainViewStyle-Primary
{
    background-color: ${rgb('theme_background_color')};
    -ios-background-image: 'mainBgImage.png';
    -ios-text-color: ${rgb('theme_title_color')};
    -ios-highlighted-text-color: ${rgb('theme_title_pressed_color')};
    -ios-description-text-color: ${rgb('theme_description_color')};
    -ios-description-highlighted-text-color: ${rgb('theme_description_pressed_color')};
    -ios-paragraph-text-color: ${rgb('theme_paragraph_color')};
    -ios-paragraph-highlighted-text-color: ${rgb('theme_paragraph_pressed_color')};
    -ios-normal-background-color: ${bodyCell.rgb};
    -ios-normal-background-alpha: ${alphaText(bodyCell.alpha)};
    -ios-selected-background-color: ${pressedCell.rgb};
    -ios-selected-background-alpha: ${alphaText(pressedCell.alpha)};
}

MainViewStyle-Secondary
{
    background-color: ${rgb('theme_body_secondary_cell_color')};
}

SectionTitleStyle-Main
{
    border-color: ${border.rgb};
    border-alpha: ${alphaText(border.alpha)};
    -ios-text-color: ${rgb('theme_section_title_color')};
    -ios-text-alpha: 1.0;
}

/* Feature */
FeatureStyle-Primary
{
    -ios-text-color: ${rgb('theme_feature_primary_color')};
}

ButtonStyle-Main
{
    background-color: ${rgb('theme_header_cell_color')};
    -ios-highlighted-background-color: ${pressedCell.rgb};
    -ios-selected-background-color: ${rgb('theme_title_color')};
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
    background-color: ${rgb('theme_chatroom_background_color')};
    -ios-background-image: 'chatroomBgImage.png';
}

InputBarStyle-Chat
{
    background-color: ${rgb('theme_chatroom_input_bar_background_color')};
    -ios-send-normal-background-color: ${rgb('theme_chatroom_input_bar_send_button_color')};
    -ios-send-normal-foreground-color: ${rgb('theme_chatroom_input_bar_send_icon_color')};
    -ios-send-highlighted-background-color: ${rgb('theme_chatroom_input_bar_send_button_color')};
    -ios-send-highlighted-foreground-color: ${rgb('theme_chatroom_input_bar_send_icon_color')};
    -ios-button-normal-foreground-color: ${rgb('theme_chatroom_input_bar_menu_icon_color')};
    -ios-button-highlighted-foreground-color: ${rgb('theme_chatroom_input_bar_menu_icon_color')};
    -ios-button-text-color: ${rgb('theme_chatroom_input_bar_color')};
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
    -ios-text-color: ${rgb('theme_chatroom_bubble_me_color')};
    -ios-selected-text-color: ${rgb('theme_chatroom_bubble_me_color')};
    -ios-unread-text-color: ${rgb('theme_chatroom_unread_count_color')};
}

MessageCellStyle-Receive
{
    -ios-background-image: 'chatroomBubbleReceive01.png' ${bubbles.Receive01.cap};
    -ios-selected-background-image: 'chatroomBubbleReceive01Selected.png' ${bubbles.Receive01.cap};
    -ios-group-background-image: 'chatroomBubbleReceive02.png' ${bubbles.Receive02.cap};
    -ios-group-selected-background-image: 'chatroomBubbleReceive02Selected.png' ${bubbles.Receive02.cap};
    -ios-title-edgeinsets: ${bubbles.Receive01.insets};  /* top, left, bottom, right */
    -ios-group-title-edgeinsets: ${bubbles.Receive02.insets};
    -ios-text-color: ${rgb('theme_chatroom_bubble_you_color')};
    -ios-selected-text-color: ${rgb('theme_chatroom_bubble_you_color')};
    -ios-unread-text-color: ${rgb('theme_chatroom_unread_count_color')};
}

/* Passcode */
BackgroundStyle-Passcode
{
    background-color: ${rgb('theme_passcode_background_color')};
    -ios-background-image: 'passcodeBgImage.png';
}

LabelStyle-PasscodeTitle
{
    -ios-text-color: ${rgb('theme_passcode_color')};
}

PasscodeStyle
{
${[1, 2, 3, 4].map((n, i) => `    -ios-bullet-${['first', 'second', 'third', 'fourth'][i]}-image: 'passcodeImgCode0${n}.png';`).join('\n')}
${[1, 2, 3, 4].map((n, i) => `    -ios-bullet-selected-${['first', 'second', 'third', 'fourth'][i]}-image: 'passcodeImgCode0${n}Selected.png';`).join('\n')}
    -ios-keypad-background-color: ${rgb('theme_passcode_keypad_background_color')};
    -ios-keypad-text-normal-color: ${rgb('theme_passcode_keypad_color')};
    -ios-keypad-number-highlighted-image: 'passcodeKeypadPressed.png';
}

/* Notification bar */
BackgroundStyle-MessageNotificationBar
{
    background-color: ${rgb('theme_notification_background_color')};
}

LabelStyle-MessageNotificationBarName
{
    -ios-text-color: ${rgb('theme_notification_color')};
}

LabelStyle-MessageNotificationBarMessage
{
    -ios-text-color: ${rgb('theme_notification_color')};
}

/* Direct share */
BackgroundStyle-DirectShareBar
{
    background-color: ${rgb('theme_direct_share_background_color')};
}

LabelStyle-DirectShareBarName
{
    -ios-text-color: ${rgb('theme_direct_share_color')};
}

LabelStyle-DirectShareBarMessage
{
    -ios-text-color: ${rgb('theme_direct_share_button_color')};
}

/* Bottom banner */
BottomBannerStyle
{
    background-color: ${rgb('theme_tab_bannerbadge_background_color')};
}

BottomBannerStyle-Light
{
    background-color: ${rgb('theme_tab_lightbannerbadge_background_color')};
}
`;
}

module.exports = { buildKtheme, buildCss, unNine, resize, splitColor };

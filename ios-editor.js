// iPhone tab: its own preview and its own colors/images, saved as project.ios.
// Everything here uses ios-* class names so the Android editor scripts never touch it.
// Layout follows real iPhone KakaoTalk captures (375pt wide, drawn at 300px: 1pt = 0.8px).
(function () {
  const C = window.iosCatalog;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const validColor = v => typeof v === 'string' && /^#[\da-f]{6}([\da-f]{2})?$/i.test(v);
  const argb = v => (v.length === 7 ? '#FF' + v.slice(1) : v).toUpperCase();
  const cssColor = v => { v = argb(v); return '#' + v.slice(3) + v.slice(1, 3); };
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const clone = v => JSON.parse(JSON.stringify(v));
  const colorSpec = Object.fromEntries(C.colors.map(c => [c.key, c]));
  const imageSpec = Object.fromEntries(C.images.map(i => [i.name, i]));

  const TABS = ['friends', 'chats', 'now', 'shopping', 'more'];
  const TAB_LABELS = { friends: '친구', chats: '채팅', now: '지금', shopping: '쇼핑', more: '더보기' };
  const SCREENS = {
    friends: { title: '친구', part: 'screen-bg' },
    chats: { title: '채팅', part: 'screen-bg' },
    now: { title: '지금', part: 'screen-bg' },
    shopping: { title: '쇼핑', part: 'screen-bg' },
    more: { title: '더보기', part: 'screen-bg' },
    chatroom: { title: '채팅방', part: 'chat-bg' },
    notification: { title: '알림·공유', part: 'noti' },
    passcode: { title: '잠금화면', part: 'passcode-bg' }
  };

  // Every clickable part of the preview and the resources linked to it.
  const PARTS = {
    'screen-bg': { title: '화면 배경', colors: ['main_bg', 'tabbar_sidebar'], images: ['mainBgImage'] },
    'chat-bg': { title: '채팅방 배경', colors: ['chat_bg'], images: ['chatroomBgImage'] },
    'passcode-bg': { title: '잠금화면 배경', colors: ['passcode_bg'], images: ['passcodeBgImage'] },
    header: { title: '상단 제목·아이콘', colors: ['header_text'] },
    chips: { title: '상단 탭', colors: ['button_selected', 'button_bg', 'button_pressed', 'header_tab_text', 'header_tab_selected'] },
    button: { title: '버튼 (선물하기 등)', colors: ['button_bg', 'button_pressed', 'feature_text'] },
    cell: { title: '목록', colors: ['main_text', 'main_desc', 'main_paragraph', 'main_cell', 'main_text_pressed', 'main_desc_pressed', 'main_paragraph_pressed', 'main_cell_pressed'] },
    section: { title: '섹션 제목', colors: ['section_text', 'section_border'] },
    profile: { title: '기본 프로필', images: ['profileImg01', 'profileImg02', 'profileImg03'], profileCount: true },
    addfriend: { title: '친구 추가 버튼', images: ['findBtnAddFriend'] },
    tabbar: { title: '하단 탭', images: ['maintabBgImage', ...TABS.flatMap(t => [`maintabIco${cap(t)}`, `maintabIco${cap(t)}Selected`])] },
    ...Object.fromEntries(TABS.map(t => [`tab-${t}`, { title: `하단 ${TAB_LABELS[t]} 탭`, images: [`maintabIco${cap(t)}`, `maintabIco${cap(t)}Selected`, 'maintabBgImage'] }])),
    receive: { title: '받은 말풍선', colors: ['receive_text'], images: ['chatroomBubbleReceive01', 'chatroomBubbleReceive02'] },
    send: { title: '보낸 말풍선', colors: ['send_text'], images: ['chatroomBubbleSend01', 'chatroomBubbleSend02'] },
    unread: { title: '안읽음 숫자', colors: ['unread'] },
    inputbar: { title: '입력창', colors: ['input_bg', 'input_text', 'menu_button', 'menu_icon', 'send_button', 'send_icon'] },
    secondary: { title: '더보기 콘텐츠', colors: ['secondary_bg', 'feature_text'] },
    noti: { title: '알림', colors: ['noti_bg', 'noti_name', 'noti_message'] },
    share: { title: '공유 바', colors: ['share_bg', 'share_name', 'share_message'] },
    banner: { title: '하단 배너', colors: ['banner_bg', 'banner_light_bg'] },
    'passcode-title': { title: '잠금화면 제목', colors: ['passcode_title'] },
    bullets: { title: '암호 입력 칸', images: [1, 2, 3, 4].flatMap(n => [`passcodeImgCode0${n}`, `passcodeImgCode0${n}Selected`]) },
    keypad: { title: '키패드', colors: ['keypad_text', 'keypad_pressed', 'keypad_bg'] },
    fixed: { title: '카카오 고정 영역', fixed: '광고·카카오페이·쇼핑 카드처럼 카카오톡이 직접 그리는 부분이에요. 테마로 바꿀 수 없어요.' }
  };

  let state = null;      // iPhone edits (overrides of the template); null = not started yet
  let base = null;       // template defaults: { colors, images (data URLs), bubbles, profileCount }
  let screen = 'friends';
  let part = 'screen-bg';
  let showAll = false;
  let notice = '';
  let loading = null;
  let zoom = 1;
  let pin = 0;           // digits typed on the passcode preview
  const chipOn = {};     // selected chip per screen

  const empty = () => ({ colors: {}, images: {}, bubbles: {}, profileCount: 1 });
  const color = key => state?.colors?.[key] ?? base.colors[key];
  const image = name => state?.images?.[name] ?? base.images[name];
  const bubble = name => state?.bubbles?.[name] ?? base.bubbles[name];
  const profileCount = () => state?.profileCount || base.profileCount || 1;

  /* ---------- defaults and import ---------- */

  function androidColors(data) {
    const colors = {};
    for (const c of window.resourceCatalog?.colors || []) colors[c.key] = c.value;
    if (validColor(data.color)) colors.theme_background_color = data.color;
    for (const [key, value] of Object.entries(data.editor?.colors || {})) if (validColor(value)) colors[key] = value;
    return colors;
  }

  async function loadBase() {
    if (base) return base;
    if (window.studio?.iosPreviewBase) base = await window.studio.iosPreviewBase();
    else {
      // Browser preview without Electron: approximate with the Android template files.
      const android = androidColors({});
      base = { colors: {}, images: {}, bubbles: {}, profileCount: 1 };
      for (const c of C.colors) base.colors[c.key] = argb(android[c.from] || '#000000');
      for (const spec of C.images) base.images[spec.name] = 'android-template/src/main/theme/drawable-xxhdpi/' + spec.from;
      for (const spec of C.images.filter(s => s.bubble)) base.bubbles[spec.name] = { cap: [20, 16], insets: [10, spec.bubble.startsWith('Send') ? 11 : 14, 9, spec.bubble.startsWith('Send') ? 14 : 11] };
    }
    return base;
  }

  // Copies the current Android edits into a fresh iPhone state.
  async function fromAndroid() {
    const data = window.projectData ? window.projectData() : {};
    const android = androidColors(data);
    const next = empty();
    for (const c of C.colors) if (validColor(android[c.from])) next.colors[c.key] = argb(android[c.from]);
    next.profileCount = Math.min(3, Math.max(1, Number(data.editor?.profileCount) || 1));
    if (window.studio?.iosImportAndroid) {
      const converted = await window.studio.iosImportAndroid({ ...data, ios: null });
      Object.assign(next.images, converted.images);
      Object.assign(next.bubbles, converted.bubbles);
    }
    return next;
  }

  /* ---------- preview ---------- */

  const ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    call: '<path d="M6.5 4.5h2.8l1.4 4-1.9 1.3a10 10 0 0 0 5.4 5.4l1.3-1.9 4 1.4v2.8a1.5 1.5 0 0 1-1.6 1.5A15 15 0 0 1 5 6.1a1.5 1.5 0 0 1 1.5-1.6z"/>',
    menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
    addFriend: '<circle cx="10" cy="8.5" r="3.5"/><path d="M3.8 19.5a6.2 6.2 0 0 1 12.4 0M18.5 8v6M15.5 11h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.4h4l.5-2.4a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z"/>',
    newChat: '<path d="M12 4.5c-4.4 0-8 3-8 6.8 0 2.2 1.2 4.1 3.1 5.4L6.5 20l3.8-2.1c.6.1 1.1.2 1.7.2 4.4 0 8-3 8-6.8"/><path d="M18 3.5v5M15.5 6h5"/>',
    openChat: '<path d="M10 5.5c-3.6 0-6.5 2.4-6.5 5.4 0 1.7.9 3.2 2.4 4.2L5.5 18l3-1.6c.5.1 1 .1 1.5.1 3.6 0 6.5-2.4 6.5-5.4S13.6 5.5 10 5.5z"/><path d="M19 4v5M16.5 6.5h5"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M9.5 15.5l1-3 1 2 1-2 1 3" stroke-width="1.3"/>',
    scan: '<path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4M7 12h10"/>',
    emoji: '<circle cx="12" cy="12" r="8"/><path d="M8.8 14a3.8 3.8 0 0 0 6.4 0"/><path d="M9.5 9.8v.4M14.5 9.8v.4"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    hash: '<path d="M10 4.5l-2 15M16 4.5l-2 15M5 9h14.5M4.5 15H19"/>',
    backspace: '<path d="M9 6.5h11v11H9l-5.5-5.5z"/><path d="M12.5 10l4 4M16.5 10l-4 4"/>',
    chevronUp: '<path d="M6 15l6-6 6 6"/>',
    filter: '<path d="M4 7h9M4 12h12M4 17h8M18 15v5M15.5 17.5h5"/>',
    gift: '<rect x="4.5" y="9.5" width="15" height="10" rx="1.5"/><path d="M12 9.5v10M4.5 13.5h15M12 9.5C10.5 5.5 6.5 6 8 9M12 9.5c1.5-4 5.5-3.5 4-.5"/>',
    heartGift: '<path d="M12 19.5l-7-7a4.2 4.2 0 0 1 7-4.5 4.2 4.2 0 0 1 7 4.5z"/><path d="M12 8v11.5M7 12.5h10"/>',
    deal: '<path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    live: '<rect x="3.5" y="6" width="17" height="10" rx="1.5"/><path d="M8 19l2-3"/><path d="M7 9v4h2M11 9v4M13 9l1.2 4 1.2-4M18 9h-1.6v4H18M16.4 11H18" stroke-width="1.2"/>',
    makers: '<circle cx="12" cy="12" r="8"/><path d="M8.5 15.5v-7l3.5 4.5 3.5-4.5v7"/>',
    friendsFace: '<circle cx="12" cy="13" r="7"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><path d="M10 12h.01M14 12h.01M10.5 15.5h3"/>',
    ai: '<circle cx="12" cy="12" r="8"/><path d="M12 8a4 4 0 0 1 0 8 2 2 0 0 1 0-4 2 2 0 0 0 0-4"/>',
    idCard: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><circle cx="9" cy="11" r="2"/><path d="M6 15.5a3 3 0 0 1 6 0M14 10h4M14 13h4"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z"/>',
    calendar: '<rect x="4.5" y="5.5" width="15" height="14" rx="1"/><path d="M8.5 3.5v4M15.5 3.5v4M9 13l2 2 4-4"/>',
    reserve: '<rect x="4.5" y="5.5" width="15" height="14" rx="1"/><path d="M8.5 3.5v4M15.5 3.5v4M9 13.5h6M13 11l2.5 2.5L13 16"/>'
  };
  const icon = (name, cls = '') => `<svg class="ios-ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  const img = (name, cls = '') => `<img class="${cls}" src="${esc(image(name))}" alt="" draggable="false">`;
  const avatar = (i, cls = '') => `<span class="ios-avatar-wrap ${cls}" data-part="profile">${img(`profileImg0${(i % profileCount()) + 1}`, 'ios-avatar')}</span>`;
  const statusBar = `<div class="ios-status"><b>9:41</b><span><svg viewBox="0 0 18 12" width="15" height="10"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg><i>5G</i><svg viewBox="0 0 26 12" width="22" height="10"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2.5" y="2.5" width="11" height="7" rx="1.8"/><path d="M24 4v4a2 2 0 0 0 0-4" opacity=".45"/></svg></span></div>`;
  const screenBg = (key, imageName, partName, cls = '') => `<div class="ios-bg-layer ${cls}" data-part="${partName}" style="background-color:var(--c-${key})">${img(imageName, 'ios-bg')}</div>`;
  const titleHeader = (title, icons) => `<div class="ios-header" data-part="header"><h1>${title}</h1><div class="ios-header-icons">${icons}</div></div>`;
  const chips = (labels, extra = '') => {
    const on = chipOn[screen] ?? 0;
    return `<div class="ios-chips" data-part="chips">${labels.map((l, i) => `<span class="ios-chip${i === on ? ' on' : ''}" data-act="chip" data-index="${i}">${l}</span>`).join('')}${extra}</div>`;
  };
  const ad = (title, sub) => `<div class="ios-ad" data-part="fixed"><div><b>${title}</b><small>${sub}</small></div><span class="ios-ad-art"></span><em>AD</em></div>`;
  const sectionTitle = text => `<div class="ios-section" data-part="section"><span>${text}</span>${icon('chevronUp')}</div>`;
  const tabbar = selected => `<div class="ios-tabbar" data-part="tabbar" style="background-image:url('${esc(image('maintabBgImage'))}')">${
    TABS.map(t => `<span class="ios-tab" data-part="tab-${t}" data-act="tab:${t}">${img(`maintabIco${cap(t)}${t === selected ? 'Selected' : ''}`)}${t === 'chats' ? '<i class="ios-tab-badge">12</i>' : ''}${t === 'more' ? '<i class="ios-tab-dot"></i>' : ''}</span>`).join('')}</div>`;
  const cell = (i, name, text, { para, side, act } = {}) => `<div class="ios-cell" data-part="cell"${act ? ` data-act="${act}"` : ''}>${avatar(i)}<div class="ios-cell-text"><b>${name}</b>${text ? `<small class="${para ? 'para' : ''}">${text}</small>` : ''}</div>${side || ''}</div>`;
  const time = (t, badge) => `<div class="ios-cell-side"><time>${t}</time>${badge ? `<span class="ios-badge">${badge}</span>` : ''}</div>`;

  const views = {
    friends: () => `${screenBg('main_bg', 'mainBgImage', 'screen-bg')}${statusBar}
      <div class="ios-header ios-header-me" data-part="header">${avatar(0, 'ios-me-avatar')}<b>콩으니</b><div class="ios-header-icons">${icon('search')}<span data-part="addfriend">${img('findBtnAddFriend', 'ios-addfriend')}</span>${icon('gift')}${icon('settings')}</div></div>
      ${chips(['친구', '소식 <i class="ios-n">N</i>'])}
      <div class="ios-body">
        ${ad('광고 영역', '카카오톡이 표시하는 광고 자리예요')}
        ${sectionTitle('업데이트한 친구 5')}
        <div class="ios-updates">${['라이언', '어피치', '춘식이', '무지', '콘'].map((n, i) => `<div data-part="cell">${avatar(i)}<i class="ios-dot"></i><small>${n}</small></div>`).join('')}</div>
        ${sectionTitle('생일인 친구 1')}
        ${cell(1, '어피치 🎂', '오늘', { side: '<span class="ios-pill" data-part="button">선물하기</span>' })}
        ${sectionTitle('즐겨찾는 친구 2')}
        ${cell(2, '춘식이', '')}
        ${cell(0, '라이언', '상태메시지를 입력해 주세요')}
      </div>${tabbar('friends')}`,
    chats: () => `${screenBg('main_bg', 'mainBgImage', 'screen-bg')}${statusBar}
      ${titleHeader('채팅', `${icon('search')}${icon('newChat')}${icon('settings')}`)}
      ${chips(['전체', '안읽음 <i class="ios-count">12</i>', '즐겨찾기'], `<span class="ios-chip ios-chip-icon" data-act="chip" data-index="9">${icon('filter')}</span>`)}
      <div class="ios-body">
        ${ad('광고 영역', '카카오톡이 표시하는 광고 자리예요')}
        ${[['어피치', '오늘 날씨 좋다 🌸', '오후 3:12', 2], ['라이언', '사진을 보냈습니다.', '오후 1:05', 0], ['카카오프렌즈 5', '다음 주에 만나요', '오전 11:40', 8], ['춘식이', '고구마 먹을래?', '어제', 0], ['무지', '이모티콘을 보냈습니다.', '어제', 0]].map(([n, m, t, b], i) =>
          cell(i, n, m, { para: true, side: time(t, b), act: 'open-chat' })).join('')}
      </div>${tabbar('chats')}`,
    now: () => `${screenBg('main_bg', 'mainBgImage', 'screen-bg')}${statusBar}
      ${titleHeader('지금', `${icon('search')}${icon('openChat')}${icon('settings')}`)}
      ${chips(['오픈채팅', '숏폼'])}
      <div class="ios-body">
        ${ad('광고 영역', '카카오톡이 표시하는 광고 자리예요')}
        ${[['테마 만들기 모임 24', '새 테마 공유합니다!', '오후 2:30'], ['오늘의 산책방', '사진을 보냈습니다.', '오전 9:12'], ['고양이 사진관 58', '귀엽다 ㅎㅎ', '어제'], ['요리 레시피 나눔', '이모티콘을 보냈습니다.', '11월 20일'], ['독서 모임 12', '다음 책 정했어요', '11월 18일']].map(([n, m, t], i) =>
          cell(i, n, m, { para: true, side: time(t), act: 'open-chat' })).join('')}
      </div>${tabbar('now')}`,
    shopping: () => `${screenBg('main_bg', 'mainBgImage', 'screen-bg')}${statusBar}
      ${titleHeader('쇼핑', `${icon('search')}${icon('bag')}${icon('settings')}`)}
      ${chips(['홈', '랭킹', '특가', '브랜드'])}
      <div class="ios-body">
        <div class="ios-shop-row" data-part="fixed"><div class="ios-shop-card"><b>찜한 상품</b><small>더보기 ›</small><div><i></i><i></i><i></i></div></div><div class="ios-shop-card small"><b>주문내역</b><div><i></i></div></div></div>
        <div class="ios-shop-title" data-part="fixed">오늘의 PICK</div>
        <div class="ios-shop-pick" data-part="fixed"><div></div><div></div></div>
      </div>${tabbar('shopping')}`,
    more: () => `${screenBg('main_bg', 'mainBgImage', 'screen-bg')}${statusBar}
      ${titleHeader('더보기', `${icon('search')}${icon('scan')}${icon('settings')}`)}
      ${chips(['홈', '지갑', '게임'])}
      <div class="ios-body">
        <div class="ios-pay" data-part="fixed"><b>● pay 0원</b><span>송금 <i></i> 자산 <i></i> 결제</span></div>
        <div class="ios-secondary" data-part="secondary">${[['gift', '선물하기'], ['heartGift', '받은선물'], ['deal', '톡딜'], ['emoji', '이모티콘'], ['live', '라이브쇼핑'], ['makers', '메이커스'], ['friendsFace', '프렌즈'], ['ai', 'AI국민비서'], ['idCard', '모바일신분증'], ['cloud', '톡클라우드'], ['calendar', '캘린더'], ['reserve', '예약하기']].map(([i, x]) => `<div>${icon(i)}<span>${x}</span></div>`).join('')}
          <p class="ios-pages"><i class="on"></i><i></i><i></i></p></div>
        <div class="ios-ad ios-ad-tall" data-part="fixed"><em>AD</em></div>
      </div>${tabbar('more')}`,
    chatroom: () => `${screenBg('chat_bg', 'chatroomBgImage', 'chat-bg')}${statusBar}
      <div class="ios-chat-header"><span class="ios-glass ios-back" data-act="back">${icon('back')}<b>12</b></span><b class="ios-chat-title">어피치</b><span class="ios-glass ios-actions-pill">${icon('search')}${icon('call')}${icon('menu')}</span></div>
      <div class="ios-messages">
        <div class="ios-sender">${avatar(1)}<small>어피치</small></div>
        ${['어피치피치한', '봄~봄~봄이 왔어요', '꽃 보러 갈래?'].map((t, i, all) => `<div class="ios-row"><div class="ios-bubble recv" data-part="receive" data-bubble="chatroomBubbleReceive0${i ? 2 : 1}">${t}</div>${i === all.length - 1 ? '<span class="ios-meta"><time>오후 12:03</time></span>' : ''}</div>`).join('')}
        <div class="ios-row mine"><span class="ios-meta"><em data-part="unread">1</em><time>오후 12:04</time></span><div class="ios-bubble send" data-part="send" data-bubble="chatroomBubbleSend01">으아 설레에</div></div>
        <div class="ios-row mine"><span class="ios-meta"><em data-part="unread">1</em></span><div class="ios-bubble send" data-part="send" data-bubble="chatroomBubbleSend02">좋아! 도시락도 싸 갈게</div></div>
        <div class="ios-row mine"><span class="ios-meta"><em data-part="unread">1</em><time>오후 12:05</time></span><div class="ios-bubble send" data-part="send" data-bubble="chatroomBubbleSend02">ㅎㅎㅎ</div></div>
      </div>
      <div class="ios-inputbar" data-part="inputbar"><span class="ios-plus">${icon('plus')}</span><span class="ios-field">메시지 입력</span><span class="ios-emoji">${icon('emoji')}</span><span class="ios-send">${icon('hash')}</span></div>`,
    notification: () => `${screenBg('main_bg', 'mainBgImage', 'screen-bg')}${statusBar}
      <div class="ios-noti" data-part="noti">${avatar(1)}<div><b>어피치</b><small>새로운 메시지가 도착했어요.</small></div><time>지금</time></div>
      <div class="ios-share" data-part="share"><b>사진을 전달했습니다.</b><span>채팅방 이동</span></div>
      <div class="ios-banners" data-part="banner"><div class="ios-banner">하단 배너</div><div class="ios-banner light">하단 배너 (밝은 배경)</div></div>
      ${tabbar('friends')}`,
    passcode: () => `${screenBg('passcode_bg', 'passcodeBgImage', 'passcode-bg', 'ios-passcode-layer')}${statusBar}
      <div class="ios-passcode">
        <h2 data-part="passcode-title">암호 입력</h2><p data-part="passcode-title">카카오톡 암호를 입력해 주세요.</p>
        <div class="ios-bullets" data-part="bullets">${[1, 2, 3, 4].map(n => img(`passcodeImgCode0${n}${n <= pin ? 'Selected' : ''}`)).join('')}</div>
      </div>
      <div class="ios-keypad" data-part="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'del'].map(k =>
        `<span data-act="key:${k}">${k === 'del' ? icon('backspace') : k === 'cancel' ? '<small>취소</small>' : k}</span>`).join('')}</div>`
  };

  function applyColors() {
    const phone = $('#iphone');
    for (const c of C.colors) phone.style.setProperty('--c-' + c.key, cssColor(color(c.key)));
  }

  const sizes = new Map();
  function imageSize(url) {
    if (sizes.has(url)) return sizes.get(url);
    const promise = new Promise(resolve => { const i = new Image(); i.onload = () => resolve([i.naturalWidth, i.naturalHeight]); i.onerror = () => resolve([60, 60]); i.src = url; });
    sizes.set(url, promise);
    return promise;
  }

  // iOS stretches one point at the cap insets and pads text by the edge insets.
  const PT = 0.8;
  async function styleBubbles() {
    for (const el of document.querySelectorAll('#iphone [data-bubble]')) {
      const name = el.dataset.bubble, url = image(name), m = bubble(name);
      const [w, h] = await imageSize(url);
      const left = Math.min(m.cap[0] * 3, w - 1), top = Math.min(m.cap[1] * 3, h - 1);
      const right = Math.max(0, w - left - 3), bottom = Math.max(0, h - top - 3);
      const s = PT / 3;
      el.style.borderImage = `url('${url}') ${top} ${right} ${bottom} ${left} fill / ${top * s}px ${right * s}px ${bottom * s}px ${left * s}px stretch`;
      const [t, l, b, r] = m.insets; // iOS order: top, left, bottom, right
      el.style.padding = `${t * PT}px ${r * PT}px ${b * PT}px ${l * PT}px`;
      el.style.minWidth = (w * s) + 'px';
      el.style.minHeight = (h * s) + 'px';
    }
  }

  function markSelected() {
    document.querySelectorAll('#iphone .ios-selected').forEach(el => el.classList.remove('ios-selected'));
    if (/-bg$/.test(part)) return; // backgrounds fill the whole screen; no outline
    document.querySelectorAll(`#iphone [data-part="${part}"]`).forEach(el => { if (!el.classList.contains('ios-bg-layer')) el.classList.add('ios-selected'); });
  }

  function renderPreview() {
    const phone = $('#iphone');
    const scroll = $('#iphone .ios-body')?.scrollTop || 0;
    phone.innerHTML = `<div class="ios-screen ios-screen-${screen}">${views[screen]()}<div class="ios-home"></div></div>`;
    const body = $('#iphone .ios-body'); if (body) body.scrollTop = scroll;
    phone.style.setProperty('--zoom', zoom);
    $('#ios-zoom-value').textContent = Math.round(zoom * 100) + '%';
    applyColors();
    styleBubbles();
    markSelected();
  }

  function goTo(next, nextPart) {
    if (!views[next]) return;
    screen = next; pin = 0;
    part = nextPart || SCREENS[next].part; showAll = false;
    document.querySelectorAll('.ios-nav').forEach(b => b.classList.toggle('active', b.dataset.iosScreen === next));
    render();
  }

  /* ---------- inspector ---------- */

  function colorCard(key) {
    const c = colorSpec[key], value = argb(color(key)), edited = state.colors[key] && state.colors[key] !== base.colors[key];
    const alpha = parseInt(value.slice(1, 3), 16);
    return `<div class="ios-card ios-color" data-key="${key}">
      <label class="ios-swatch" style="--swatch:${cssColor(value)}"><input type="color" value="#${value.slice(3)}" aria-label="${esc(c.label)}"></label>
      <span class="ios-card-text"><b>${esc(c.label)}</b><small>${esc(c.css)}</small></span>
      <input type="text" class="ios-hex" value="${value}" spellcheck="false" aria-label="${esc(c.label)} ARGB">
      ${c.alpha ? `<label class="ios-alpha"><span>불투명도</span><input type="range" min="0" max="255" value="${alpha}"><output>${Math.round(alpha / 2.55)}%</output></label>` : ''}
      ${edited ? '<button type="button" class="ios-reset-one" title="기본값으로">↺</button>' : ''}
    </div>`;
  }

  function imageCard(name) {
    const spec = imageSpec[name], edited = !!state.images[name], metrics = spec.bubble ? bubble(name) : null;
    return `<div class="ios-card ios-asset" data-name="${name}">
      <button type="button" class="ios-pick" title="이미지 바꾸기"><span class="ios-thumb"><img src="${esc(image(name))}" alt=""></span>
      <span class="ios-card-text"><b>${esc(spec.label)}</b><small>${name}@3x${spec.size ? ` · ${spec.size[0]}×${spec.size[1]}` : ''}</small></span></button>
      ${edited ? '<button type="button" class="ios-reset-one" title="기본 이미지로">↺</button>' : ''}
      ${metrics ? `<div class="ios-metrics">
        <span>늘어나는 지점</span><label>X<input type="number" min="0" data-m="cap.0" value="${metrics.cap[0]}"></label><label>Y<input type="number" min="0" data-m="cap.1" value="${metrics.cap[1]}"></label>
        <span>글자 여백</span><label>위<input type="number" min="0" data-m="insets.0" value="${metrics.insets[0]}"></label><label>왼<input type="number" min="0" data-m="insets.1" value="${metrics.insets[1]}"></label><label>아래<input type="number" min="0" data-m="insets.2" value="${metrics.insets[2]}"></label><label>오른<input type="number" min="0" data-m="insets.3" value="${metrics.insets[3]}"></label>
      </div>` : ''}
    </div>`;
  }

  function section(colors = [], images = [], extra = '') {
    if (!colors.length && !images.length && !extra) return '';
    return `<section class="ios-block">
      ${colors.length ? `<div class="ios-block-head"><h3>연결된 색상</h3><span>iPhone</span></div>${colors.map(colorCard).join('')}` : ''}
      ${images.length || extra ? `<div class="ios-block-head"><h3>연결된 이미지</h3>${colors.length ? '' : '<span>iPhone</span>'}</div>${extra}${images.map(imageCard).join('')}
        <p class="ios-tip">이미지 첨부 시 이미지가 색상보다 우선 적용됩니다.</p>` : ''}
    </section>`;
  }

  function renderPanel() {
    const panel = $('#ios-panel');
    if (!base || !state) { panel.innerHTML = '<p class="ios-tip">아이폰 테마를 준비하는 중…</p>'; return; }
    let body;
    if (showAll) {
      const groups = [...new Set([...C.colors.map(c => c.group), ...C.images.map(i => i.group)])];
      body = `<small class="ios-eyebrow">아이폰 전체 항목</small><h2>모든 색상·이미지</h2>` + groups.map(g =>
        `<h4 class="ios-group-title">${g}</h4>` + section(C.colors.filter(c => c.group === g).map(c => c.key), C.images.filter(i => i.group === g).map(i => i.name))).join('');
    } else {
      const p = PARTS[part];
      const images = (p.images || []).filter(n => !/^profileImg0(\d)$/.test(n) || Number(n.slice(-1)) <= profileCount());
      const extra = p.profileCount ? `<label class="ios-profile-count">기본 프로필 개수<select id="ios-profile-count">${[1, 2, 3].map(n => `<option ${n === profileCount() ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : '';
      body = `<small class="ios-eyebrow">선택한 부분</small><h2>${esc(p.title)}</h2>${p.fixed ? `<p class="ios-fixed">${esc(p.fixed)}</p>` : section(p.colors || [], images, extra)}`;
    }
    panel.innerHTML = `${body}
      ${notice ? `<p class="ios-notice">${esc(notice)}</p>` : ''}
      <div class="ios-panel-foot">
        <button type="button" id="ios-show-all">${showAll ? '← 선택한 부분 보기' : '아이폰 전체 항목 보기'}</button>
        <div><button type="button" id="ios-import">안드로이드 값 가져오기</button><button type="button" id="ios-reset">아이폰 기본값으로</button></div>
        <p class="ios-tip">여기서 바꾼 값은 아이폰 테마에만 들어가요.</p>
      </div>`;
  }

  function render() { if (!base || !state) return renderPanel(); renderPreview(); renderPanel(); }

  function setColor(key, value) {
    if (!validColor(value)) return false;
    state.colors[key] = argb(value);
    applyColors();
    const card = document.querySelector(`#ios-panel .ios-color[data-key="${key}"] .ios-swatch`);
    card?.style.setProperty('--swatch', cssColor(value));
    return true;
  }

  function pickFile() {
    return new Promise(resolve => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png' });
      input.onchange = () => { const file = input.files[0]; if (!file) return resolve(null); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); };
      input.click();
    });
  }

  async function pickImage(name) {
    const url = window.studio?.pickImage ? await window.studio.pickImage(name + '.png') : await pickFile();
    if (!url) return;
    state.images[name] = url;
    if (imageSpec[name].bubble) {
      // New bubble artwork: stretch from its middle until the user sets the caps.
      const [w, h] = await imageSize(url);
      state.bubbles[name] = { cap: [Math.floor(w / 6), Math.floor(h / 6)], insets: [...bubble(name).insets] };
    }
    render();
  }

  function select(next) {
    if (!PARTS[next]) return;
    part = next; showAll = false; notice = '';
    markSelected(); renderPanel();
  }

  function setZoom(value) {
    zoom = Math.min(1.6, Math.max(0.6, Math.round(value * 10) / 10));
    $('#iphone').style.setProperty('--zoom', zoom);
    $('#ios-zoom-value').textContent = Math.round(zoom * 100) + '%';
  }

  // Taps inside the phone behave like the real app, and also pick what to edit.
  function act(action, el) {
    if (action.startsWith('tab:')) return goTo(action.slice(4), 'tab-' + action.slice(4));
    if (action === 'open-chat') return goTo('chatroom');
    if (action === 'back') return goTo('chats');
    if (action === 'chip') {
      const index = Number(el.dataset.index);
      if (index !== 9) { chipOn[screen] = index; el.parentElement.querySelectorAll('.ios-chip').forEach(c => c.classList.toggle('on', c === el)); }
      return select('chips');
    }
    if (action.startsWith('key:')) {
      const key = action.slice(4);
      pin = key === 'cancel' ? 0 : key === 'del' ? Math.max(0, pin - 1) : Math.min(4, pin + 1);
      document.querySelectorAll('#iphone .ios-bullets img').forEach((b, i) => { b.src = image(`passcodeImgCode0${i + 1}${i < pin ? 'Selected' : ''}`); });
      if (pin === 4) setTimeout(() => { pin = 0; if (screen === 'passcode') document.querySelectorAll('#iphone .ios-bullets img').forEach((b, i) => { b.src = image(`passcodeImgCode0${i + 1}`); }); }, 450);
      return select('keypad');
    }
  }

  /* ---------- events ---------- */

  function bind() {
    const panel = $('#ios-panel');
    panel.addEventListener('input', e => {
      const row = e.target.closest('.ios-color');
      if (row) {
        const key = row.dataset.key, hex = $('.ios-hex', row), current = argb(color(key));
        if (e.target.type === 'color') hex.value = current.slice(0, 3) + e.target.value.slice(1).toUpperCase();
        if (e.target.type === 'range') { hex.value = '#' + Number(e.target.value).toString(16).padStart(2, '0').toUpperCase() + current.slice(3); $('output', row).textContent = Math.round(e.target.value / 2.55) + '%'; }
        if (e.target !== hex) setColor(key, hex.value);
        return;
      }
      if (e.target.dataset.m) {
        const name = e.target.closest('.ios-asset').dataset.name, [field, index] = e.target.dataset.m.split('.');
        const metrics = state.bubbles[name] = clone(bubble(name));
        metrics[field][Number(index)] = Math.max(0, Math.round(Number(e.target.value) || 0));
        styleBubbles();
      }
    });
    panel.addEventListener('change', e => {
      const row = e.target.closest('.ios-color');
      if (row && e.target.classList.contains('ios-hex')) {
        if (!setColor(row.dataset.key, e.target.value.trim())) { e.target.value = argb(color(row.dataset.key)); return alert('색상은 #RRGGBB 또는 #AARRGGBB 로 입력하세요.'); }
        renderPanel();
      }
      if (row && e.target.type === 'color') renderPanel();
      if (e.target.id === 'ios-profile-count') { state.profileCount = Number(e.target.value); render(); }
    });
    panel.addEventListener('click', async e => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.id === 'ios-import') {
        if (!confirm('지금 아이폰 편집값을 안드로이드 편집값으로 덮어쓸까요?')) return;
        state = await fromAndroid(); notice = '안드로이드 편집값을 가져왔어요.'; render();
      } else if (button.id === 'ios-reset') {
        if (!confirm('아이폰 색·이미지를 모두 기본값으로 되돌릴까요? (안드로이드는 그대로예요)')) return;
        state = empty(); notice = '아이폰 기본값으로 되돌렸어요.'; render();
      } else if (button.id === 'ios-show-all') { showAll = !showAll; renderPanel(); }
      else if (button.classList.contains('ios-pick')) await pickImage(button.closest('.ios-asset').dataset.name);
      else if (button.classList.contains('ios-reset-one')) {
        const colorItem = button.closest('.ios-color'), asset = button.closest('.ios-asset');
        if (colorItem) delete state.colors[colorItem.dataset.key];
        if (asset) { delete state.images[asset.dataset.name]; delete state.bubbles[asset.dataset.name]; }
        render();
      }
    });
    $('#iphone').addEventListener('click', e => {
      const actor = e.target.closest('[data-act]'), target = e.target.closest('[data-part]');
      // A tap on a profile picture or a pill inside a row edits that piece, not the row.
      if (actor && !(target && actor.contains(target) && target !== actor && target.dataset.part !== 'cell')) return act(actor.dataset.act, actor);
      if (target) select(target.dataset.part);
    });
    document.querySelectorAll('.ios-nav').forEach(button => button.addEventListener('click', () => goTo(button.dataset.iosScreen)));
    $('#ios-zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
    $('#ios-zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
    $('#ios-zoom-value').addEventListener('click', () => setZoom(1));
    $('#ios-open-info').addEventListener('click', () => {
      document.querySelector('.platform-tab[data-platform=android]')?.click();
      [...document.querySelectorAll('#android-shell .nav')].find(b => b.textContent.trim() === '테마 정보')?.click();
    });
  }

  async function activate() {
    renderPanel();
    loading ||= loadBase();
    try { await loading; } catch (error) { loading = null; $('#ios-panel').innerHTML = `<p class="ios-notice">아이폰 미리보기를 준비하지 못했어요.<br>${esc(error.message)}</p>`; return; }
    if (!state) {
      // First visit: start from the Android edits so nothing is lost, then keep them separate.
      state = await fromAndroid();
      notice = '안드로이드 편집값을 가져와서 아이폰 테마를 시작했어요. 이제부터 아이폰은 따로 저장돼요.';
    }
    render();
  }

  function restore(saved) {
    state = saved && typeof saved === 'object' ? { ...empty(), ...clone(saved) } : null;
    notice = '';
    if (document.body.dataset.platform === 'ios') activate();
  }

  bind();
  window.iosEditor = {
    activate, restore,
    exportState: () => (state ? clone(state) : null),
    get state() { return state; }
  };
})();

// iPhone (.ktheme) resources, shared by the editor (browser) and ios-theme.cjs (Node).
// Colors are stored as #AARRGGBB like the Android editor; `from` is the Android key
// used for the template defaults and for "안드로이드 값 가져오기".
(function (root) {
  const colors = [
    ['header_text', '상단 제목 글자', '상단', 'theme_header_color', 'HeaderStyle-Main · -ios-text-color'],
    ['header_tab_text', '상단 탭 글자 (친구·소식)', '상단', 'theme_feature_browse_tab_color', 'HeaderStyle-Main · -ios-tab-text-color'],
    ['header_tab_selected', '상단 탭 선택 글자', '상단', 'theme_feature_browse_tab_focused_color', 'HeaderStyle-Main · -ios-tab-highlighted-text-color'],
    ['button_bg', '버튼·칩 배경', '상단', 'theme_header_cell_color', 'ButtonStyle-Main · background-color'],
    ['button_pressed', '버튼·칩 누름 배경', '상단', 'theme_body_cell_pressed_color', 'ButtonStyle-Main · -ios-highlighted-background-color'],
    ['button_selected', '버튼·칩 선택 배경', '상단', 'theme_title_color', 'ButtonStyle-Main · -ios-selected-background-color'],
    ['main_bg', '메인 배경색', '목록', 'theme_background_color', 'MainViewStyle-Primary · background-color'],
    ['main_text', '이름', '목록', 'theme_title_color', 'MainViewStyle-Primary · -ios-text-color'],
    ['main_text_pressed', '이름 · 누름', '목록', 'theme_title_pressed_color', 'MainViewStyle-Primary · -ios-highlighted-text-color'],
    ['main_desc', '상태메시지', '목록', 'theme_description_color', 'MainViewStyle-Primary · -ios-description-text-color'],
    ['main_desc_pressed', '상태메시지 · 누름', '목록', 'theme_description_pressed_color', 'MainViewStyle-Primary · -ios-description-highlighted-text-color'],
    ['main_paragraph', '마지막 메시지', '목록', 'theme_paragraph_color', 'MainViewStyle-Primary · -ios-paragraph-text-color'],
    ['main_paragraph_pressed', '마지막 메시지 · 누름', '목록', 'theme_paragraph_pressed_color', 'MainViewStyle-Primary · -ios-paragraph-highlighted-text-color'],
    ['main_cell', '목록 칸 배경', '목록', 'theme_body_cell_color', 'MainViewStyle-Primary · -ios-normal-background-color', true],
    ['main_cell_pressed', '목록 칸 누름 배경', '목록', 'theme_body_cell_pressed_color', 'MainViewStyle-Primary · -ios-selected-background-color', true],
    ['section_text', '섹션 제목', '목록', 'theme_section_title_color', 'SectionTitleStyle-Main · -ios-text-color'],
    ['section_border', '섹션 구분선', '목록', 'theme_body_cell_border_color', 'SectionTitleStyle-Main · border-color', true],
    ['secondary_bg', '더보기 콘텐츠 배경', '더보기', 'theme_body_secondary_cell_color', 'MainViewStyle-Secondary · background-color'],
    ['feature_text', '기능 버튼 글자 (선물하기 등)', '더보기', 'theme_feature_primary_color', 'FeatureStyle-Primary · -ios-text-color'],
    ['tabbar_sidebar', '아이패드 사이드바 배경', '하단 탭', 'theme_background_color', 'TabBarStyle-Main · -background-sidebar-color'],
    ['banner_bg', '하단 배너 배경', '하단 탭', 'theme_tab_bannerbadge_background_color', 'BottomBannerStyle · background-color'],
    ['banner_light_bg', '하단 배너 배경 (밝은)', '하단 탭', 'theme_tab_lightbannerbadge_background_color', 'BottomBannerStyle-Light · background-color'],
    ['chat_bg', '채팅방 배경색', '채팅방', 'theme_chatroom_background_color', 'BackgroundStyle-ChatRoom · background-color'],
    ['send_text', '보낸 말풍선 글자', '채팅방', 'theme_chatroom_bubble_me_color', 'MessageCellStyle-Send · -ios-text-color'],
    ['receive_text', '받은 말풍선 글자', '채팅방', 'theme_chatroom_bubble_you_color', 'MessageCellStyle-Receive · -ios-text-color'],
    ['unread', '안읽음 숫자', '채팅방', 'theme_chatroom_unread_count_color', 'MessageCellStyle · -ios-unread-text-color'],
    ['input_bg', '입력창 배경', '채팅방', 'theme_chatroom_input_bar_background_color', 'InputBarStyle-Chat · background-color'],
    ['input_text', '입력창 글자', '채팅방', 'theme_chatroom_input_bar_color', 'InputBarStyle-Chat · -ios-button-text-color'],
    ['menu_icon', '입력창 + 아이콘', '채팅방', 'theme_chatroom_input_bar_menu_icon_color', 'InputBarStyle-Chat · -ios-button-normal-foreground-color'],
    ['menu_button', '입력창 + 버튼 배경', '채팅방', 'theme_chatroom_input_bar_menu_button_color', 'InputBarStyle-Chat · -ios-button-normal-background-color', true],
    ['send_button', '전송 버튼 배경', '채팅방', 'theme_chatroom_input_bar_send_button_color', 'InputBarStyle-Chat · -ios-send-normal-background-color'],
    ['send_icon', '전송 버튼 아이콘', '채팅방', 'theme_chatroom_input_bar_send_icon_color', 'InputBarStyle-Chat · -ios-send-normal-foreground-color'],
    ['passcode_bg', '잠금화면 배경색', '잠금화면', 'theme_passcode_background_color', 'BackgroundStyle-Passcode · background-color'],
    ['passcode_title', '잠금화면 제목', '잠금화면', 'theme_passcode_color', 'LabelStyle-PasscodeTitle · -ios-text-color'],
    ['keypad_bg', '키패드 배경', '잠금화면', 'theme_passcode_keypad_background_color', 'PasscodeStyle · -ios-keypad-background-color'],
    ['keypad_text', '키패드 숫자', '잠금화면', 'theme_passcode_keypad_color', 'PasscodeStyle · -ios-keypad-text-normal-color'],
    ['keypad_pressed', '키패드 누름 원', '잠금화면', 'theme_passcode_keypad_pressed_background_color', 'passcodeKeypadPressed.png', true],
    ['noti_bg', '알림 배경', '알림·공유', 'theme_notification_background_color', 'BackgroundStyle-MessageNotificationBar'],
    ['noti_name', '알림 이름', '알림·공유', 'theme_notification_color', 'LabelStyle-MessageNotificationBarName'],
    ['noti_message', '알림 메시지', '알림·공유', 'theme_notification_color', 'LabelStyle-MessageNotificationBarMessage'],
    ['share_bg', '공유 바 배경', '알림·공유', 'theme_direct_share_background_color', 'BackgroundStyle-DirectShareBar'],
    ['share_name', '공유 바 이름', '알림·공유', 'theme_direct_share_color', 'LabelStyle-DirectShareBarName'],
    ['share_message', '공유 바 메시지', '알림·공유', 'theme_direct_share_button_color', 'LabelStyle-DirectShareBarMessage']
  ].map(([key, label, group, from, css, alpha]) => ({ key, label, group, from, css, alpha: !!alpha }));

  const cap = s => s[0].toUpperCase() + s.slice(1);
  const tabNames = { friends: '친구', chats: '채팅', now: '지금', shopping: '쇼핑', more: '더보기', call: '통화', piccoma: '픽코마', local: '로컬' };
  const images = [
    { name: 'mainBgImage', label: '메인 배경', group: '배경', from: 'theme_background_image.png', size: [1125, 2250], fit: 'cover' },
    { name: 'chatroomBgImage', label: '채팅방 배경', group: '채팅방', from: 'theme_chatroom_background_image.png', size: [1125, 2250], fit: 'cover' },
    { name: 'passcodeBgImage', label: '잠금화면 배경', group: '잠금화면', from: 'theme_passcode_background_image.png', size: [1200, 1200], fit: 'cover' },
    { name: 'maintabBgImage', label: '하단 탭 배경', group: '하단 탭', from: 'theme_maintab_cell_image.9.png', nine: true, size: [1410, 147], fit: 'cover-top' }
  ];
  for (const tab of ['friends', 'chats', 'now', 'shopping', 'more', 'call', 'piccoma', 'local']) for (const selected of [false, true]) images.push({
    name: `maintabIco${cap(tab)}${selected ? 'Selected' : ''}`, label: `${tabNames[tab]} 탭 아이콘${selected ? ' · 선택' : ''}`, group: '하단 탭',
    // 'Local' has no Android counterpart; it starts from the Now icon.
    from: `theme_maintab_ico_${tab === 'local' ? 'now' : tab}${selected ? '_focused' : ''}_image.png`, size: [114, 114], fit: 'contain', tab
  });
  for (const [bubble, android, label] of [['Send01', 'me_01', '보낸 말풍선 · 첫 메시지'], ['Send02', 'me_02', '보낸 말풍선 · 이어지는 메시지'], ['Receive01', 'you_01', '받은 말풍선 · 첫 메시지'], ['Receive02', 'you_02', '받은 말풍선 · 이어지는 메시지']])
    images.push({ name: `chatroomBubble${bubble}`, label, group: '말풍선', from: `theme_chatroom_bubble_${android}_image.9.png`, nine: true, bubble });
  for (let i = 1; i <= 3; i++) images.push({ name: `profileImg0${i}`, label: `기본 프로필 ${i}`, group: '프로필', from: `theme_profile_0${i}_image.png`, fallback: 'theme_profile_01_image.png', size: [360, 360], fit: 'cover' });
  for (let i = 1; i <= 4; i++) for (const selected of [false, true]) images.push({
    name: `passcodeImgCode0${i}${selected ? 'Selected' : ''}`, label: `암호 ${i}번째 칸${selected ? ' · 입력됨' : ''}`, group: '잠금화면',
    from: `theme_passcode_0${i}${selected ? '_checked' : ''}_image.png`, size: [132, 132], fit: 'contain'
  });
  images.push({ name: 'findBtnAddFriend', label: '친구 추가 버튼', group: '프로필', from: 'theme_find_add_friend_button_image.png' });

  const catalog = { colors, images };
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  else root.iosCatalog = catalog;
})(this);

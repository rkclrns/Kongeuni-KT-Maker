// 테마 정보 page laid out like Bear KTBaker's: icon + fields card, adaptive icon layers,
// and the display-mode card. The existing inputs (data-info) and icon picker are moved
// into the new layout so the editor's save/restore code keeps working unchanged.
(function () {
  const E = window.themeEditor, page = document.querySelector('.theme-info-page');
  if (!E || !page || page.dataset.layout) return;
  page.dataset.layout = 'v2';
  const RES = 'android-template/src/main/res/mipmap-xxxhdpi/';
  const DEFAULTS = { icon: RES + 'ic_launcher.png', iconForeground: RES + 'ic_launcher_foreground.png', iconBackground: RES + 'ic_launcher_background.png' };
  const input = key => page.querySelector(`input[data-info="${key}"]`);
  const iconImg = page.querySelector('.theme-icon-editor img'), iconPick = page.querySelector('.theme-icon-editor button');
  const presetButton = [...page.children].find(el => el.tagName === 'BUTTON');
  const note = page.querySelector(':scope > p')?.textContent || '';

  const wrap = document.createElement('div');
  wrap.className = 'info-wrap';
  wrap.innerHTML = `
    <small class="info-eyebrow">GENERAL</small>
    <h1>테마 정보</h1>
    <div class="info-card">
      <div class="info-main">
        <button type="button" class="info-icon" data-pick="icon"><span class="info-icon-tile theme-icon-editor"></span><b>Android 기본 앱 아이콘</b><small>이미지를 눌러 변경</small></button>
        <div class="info-fields"></div>
      </div>
      <div class="info-adaptive">
        <div class="info-adaptive-text"><b>Android 8 이상 적응형 앱 아이콘</b><small>전경과 배경 두 레이어가 함께 표시됩니다.</small></div>
        ${['iconForeground', 'iconBackground'].map(key => `<div class="info-layer"><button type="button" data-pick="${key}"><span class="info-layer-tile"><img alt=""></span></button>
          <b>Android 적응형 ${key === 'iconForeground' ? '전경' : '배경'}</b><small>이미지를 눌러 변경</small><button type="button" class="info-layer-reset" data-reset="${key}" title="기본 이미지로">↺</button></div>`).join('')}
      </div>
    </div>
    <div class="info-card info-mode">
      <div class="info-mode-text"><b>테마 표시 모드</b><small>이 설정은 iPhone과 Android 모두에 적용됩니다.</small></div>
      <label class="info-toggle"><span><b>다크 모드 테마로 인식</b><small>켜면 카카오톡이 이 테마를 다크 모드용으로 인식합니다.</small><em>아직 테마 파일에는 반영되지 않아요. 프로젝트에만 저장됩니다.</em></span><input type="checkbox" class="info-switch" data-flag="darkMode" aria-label="다크 모드 테마로 인식"></label>
    </div>
    <p class="info-note"></p>
    <div class="info-foot"></div>`;

  const fields = wrap.querySelector('.info-fields');
  for (const [key, label, placeholder] of [['title', '테마 이름', '새 카카오톡 테마'], ['author', '제작자', '이름 또는 닉네임'], ['version', '버전', '1.0.0'], ['packageId', '테마 식별자', 'KongeuniThema.NewThema']]) {
    const el = input(key);
    if (!el) continue;
    const row = document.createElement('label');
    row.className = 'info-row';
    row.innerHTML = `<span>${label}</span>`;
    el.placeholder ||= placeholder;
    row.append(el);
    fields.append(row);
  }
  const tile = wrap.querySelector('.info-icon-tile');
  if (iconImg) tile.append(iconImg);
  if (iconPick) { iconPick.hidden = true; tile.append(iconPick); }
  wrap.querySelector('.info-note').textContent = note;
  if (presetButton) wrap.querySelector('.info-foot').append(presetButton);
  page.replaceChildren(wrap);

  const layerImg = key => wrap.querySelector(`[data-pick="${key}"] img`);
  const sync = () => {
    const info = E.state.info || {};
    for (const key of ['iconForeground', 'iconBackground']) {
      layerImg(key).src = info[key] || DEFAULTS[key];
      wrap.querySelector(`[data-reset="${key}"]`).hidden = !info[key];
    }
    wrap.querySelector('[data-flag=darkMode]').checked = !!info.darkMode;
  };

  async function pickLayer(key) {
    const src = await window.studio?.pickImage?.();
    if (!src) return;
    const img = new Image();
    img.src = src;
    try { await img.decode(); } catch { return alert('PNG 이미지를 읽을 수 없습니다.'); }
    if (img.width !== img.height || img.width < 108) return alert('108px 이상의 정사각형 PNG를 선택해주세요. 권장: 432×432px\n주요 그림은 가운데 66% 안에 두세요.');
    E.state.info[key] = src;
    sync();
  }

  wrap.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]'), reset = e.target.closest('[data-reset]');
    if (reset) { delete E.state.info[reset.dataset.reset]; sync(); return; }
    if (!pick) return;
    if (pick.dataset.pick === 'icon') iconPick?.click();
    else pickLayer(pick.dataset.pick);
  });
  wrap.querySelector('[data-flag=darkMode]').addEventListener('change', e => { E.state.info.darkMode = e.target.checked; });

  // Keep the new controls in step when a project is opened.
  const restore = E.restore.bind(E);
  E.restore = data => { restore(data); sync(); };

  // The info page takes the whole work area, like Bear KTBaker (no right panel).
  const shell = document.querySelector('#android-shell');
  const update = () => shell?.classList.toggle('info-open', !page.classList.contains('hidden'));
  new MutationObserver(update).observe(page, { attributes: true, attributeFilter: ['class'] });
  sync(); update();
})();

// Adds the iPhone-panel headings ("선택한 부분", "연결된 이미지/색상") to the Android
// right panel whenever the editor rebuilds it. The editor scripts stay unchanged.
(function () {
  const inspector = document.querySelector('#android-shell .inspector');
  if (!inspector) return;
  const head = title => {
    const div = document.createElement('div');
    div.className = 'panel-block-head';
    div.innerHTML = `<h3>${title}</h3>`;
    return div;
  };
  function decorate() {
    for (const section of inspector.querySelectorAll('section')) {
      if (section.closest('.theme-info-page')) continue;
      const title = section.querySelector(':scope > h2');
      const firstAsset = section.querySelector(':scope > .asset-row');
      const firstColor = section.querySelector(':scope > .resource-color, :scope > .color-family');
      if (!title || (!firstAsset && !firstColor)) continue;
      // The editor refills the same section, so check the headings themselves.
      const headed = el => !el || el.previousElementSibling?.classList.contains('panel-block-head');
      if (title.previousElementSibling?.classList.contains('panel-eyebrow') && headed(firstAsset) && headed(firstColor)) continue;
      section.querySelectorAll(':scope > .panel-eyebrow, :scope > .panel-block-head').forEach(el => el.remove());
      const eyebrow = document.createElement('small');
      eyebrow.className = 'panel-eyebrow';
      eyebrow.textContent = '선택한 부분';
      title.before(eyebrow);
      if (firstColor) firstColor.before(head('연결된 색상'));
      if (firstAsset) firstAsset.before(head('연결된 이미지'));
      const first = section.querySelector('.panel-block-head');
      first.insertAdjacentHTML('beforeend', '<span>Android</span>');
    }
  }
  new MutationObserver(decorate).observe(inspector, { childList: true, subtree: true });
  decorate();
})();

// Zoom control for the Android preview, same as the iPhone tab.
(function () {
  const canvas = document.querySelector('#android-shell .canvas'), phone = document.querySelector('#phone');
  if (!canvas || !phone) return;
  let zoom = 1;
  const bar = document.createElement('div');
  bar.className = 'ios-zoom';
  bar.innerHTML = '<button type="button" aria-label="축소">−</button><button type="button" class="zoom-value" title="100%로">100%</button><button type="button" aria-label="확대">+</button>';
  const [zoomOut, value, zoomIn] = bar.children;
  const set = next => { zoom = Math.min(1.6, Math.max(0.6, Math.round(next * 10) / 10)); phone.style.setProperty('--zoom', zoom); value.textContent = Math.round(zoom * 100) + '%'; };
  zoomOut.onclick = () => set(zoom - 0.1);
  zoomIn.onclick = () => set(zoom + 0.1);
  value.onclick = () => set(1);
  canvas.append(bar);
})();

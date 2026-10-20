/* 物件介紹四大性質工作表：畫面邏輯 */
(function () {
  'use strict';
  const C = window.Checklists, A = window.App;
  const KEY_CUR = 'twrc.pitch.current.v1';
  const KEY_DRAFTS = 'twrc.pitch.drafts.v1';
  const MAX_DRAFTS = 50;
  const $ = id => document.getElementById(id);
  const esc = C.escapeHTML;

  let fields = C.validatePitchDraft({ fields: A.Store.get(KEY_CUR, {}) }) || {};
  let drafts = loadDrafts();
  let format = C.PITCH_FORMATS[0].id;

  function loadDrafts() {
    const raw = A.Store.get(KEY_DRAFTS, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(d => {
      const f = C.validatePitchDraft(d);
      return f && typeof d.name === 'string' ? { id: String(d.id || Date.now()), name: d.name.slice(0, 60), updated: String(d.updated || ''), fields: f } : null;
    }).filter(Boolean).slice(0, MAX_DRAFTS);
  }

  function renderFields() {
    $('fields').innerHTML = C.PITCH_GROUPS.map(g => {
      const rows = C.PITCH_FIELDS.filter(d => d.group === g.id).map(d => {
        const single = ['basic', 'extra'].includes(g.id) && d.id !== 'cta';
        const input = single
          ? `<input type="text" id="f-${d.id}" data-f="${d.id}" maxlength="200" placeholder="${esc(d.placeholder)}" value="${esc(fields[d.id] || '')}">`
          : `<textarea id="f-${d.id}" data-f="${d.id}" rows="2" maxlength="2000" placeholder="${esc(d.placeholder)}">${esc(fields[d.id] || '')}</textarea>`;
        return `<label class="field"><span>${esc(d.label)}${d.core ? ' <small class="hint">（建議填）</small>' : ''}</span>${input}</label>`;
      }).join('');
      return `<section class="card"><h2>${esc(g.title)} <small class="hint">${esc(g.desc)}</small></h2><div class="grid">${rows}</div></section>`;
    }).join('');
  }

  function renderTabs() {
    $('tabs').innerHTML = C.PITCH_FORMATS.map(f =>
      `<button type="button" role="tab" data-fmt="${f.id}" aria-selected="${f.id === format}">${esc(f.title)}</button>`).join('');
  }

  function renderOutput() {
    const text = C.generatePitch(fields, format);
    $('output').value = text;
    $('output').placeholder = '在上面填寫欄位後，這裡會自動產生介紹文。';
    $('printOut').innerHTML = C.PITCH_FORMATS.map(f => {
      const t = C.generatePitch(fields, f.id);
      return t ? `<h3>${esc(f.title)}</h3><div>${esc(t)}</div>` : '';
    }).join('') || '<p class="hint">尚未填寫內容。</p>';
  }

  function renderMeter() {
    const c = C.pitchCompleteness(fields);
    $('meterBar').style.width = c.percent + '%';
    $('meterPct').textContent = c.percent + '%';
    $('meterChips').innerHTML = C.PITCH_GROUPS.map(g => {
      const x = c.groups[g.id];
      return `<span class="chip${x.filled ? ' on' : ''}">${esc(g.title)} ${x.filled}/${x.total}</span>`;
    }).join('');
    $('meterHint').textContent = c.missingCore.length
      ? `建議補上：${c.missingCore.join('、')}`
      : '建議欄位都填了。';
  }

  function renderDrafts() {
    $('draftList').innerHTML = drafts.length
      ? drafts.map(d => `<option value="${esc(d.id)}">${esc(d.name)}${d.updated ? '（' + esc(d.updated) + '）' : ''}</option>`).join('')
      : '<option value="">（還沒有草稿）</option>';
  }

  function refresh() { renderMeter(); renderOutput(); }

  // ---------- 事件 ----------
  $('fields').addEventListener('input', ev => {
    const id = ev.target.dataset && ev.target.dataset.f;
    if (!id) return;
    fields[id] = ev.target.value;
    A.Store.set(KEY_CUR, fields);
    refresh();
  });

  $('tabs').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-fmt]');
    if (!b) return;
    format = b.dataset.fmt;
    renderTabs();
    renderOutput();
  });

  $('btnCopy').addEventListener('click', async () => {
    const t = $('output').value;
    if (!t) { A.toast('還沒有內容可以複製'); return; }
    if (await A.copyText(t)) { A.toast('已複製'); return; }
    $('output').focus();
    $('output').select();
    A.toast('無法自動複製，已幫你選取文字，請按 Ctrl+C（手機長按）複製');
  });

  $('btnSave').addEventListener('click', () => {
    const name = ($('draftName').value.trim() || (fields.title || '').trim() || '未命名草稿').slice(0, 60);
    const existing = drafts.find(d => d.name === name);
    const rec = { id: existing ? existing.id : String(Date.now()), name, updated: A.today(), fields: Object.assign({}, fields) };
    drafts = [rec].concat(drafts.filter(d => d !== existing)).slice(0, MAX_DRAFTS);
    const ok = A.Store.set(KEY_DRAFTS, drafts);
    renderDrafts();
    $('draftList').value = rec.id;
    A.toast(ok ? `已儲存「${name}」` : '這個瀏覽器無法儲存，請改用列印／存 PDF');
  });

  $('btnLoad').addEventListener('click', () => {
    const d = drafts.find(x => x.id === $('draftList').value);
    if (!d) return;
    fields = Object.assign({}, d.fields);
    $('draftName').value = d.name;
    A.Store.set(KEY_CUR, fields);
    renderFields();
    refresh();
    A.toast(`已載入「${d.name}」`);
  });

  $('btnDelete').addEventListener('click', () => {
    const d = drafts.find(x => x.id === $('draftList').value);
    if (!d || !confirm(`確定刪除草稿「${d.name}」？`)) return;
    drafts = drafts.filter(x => x !== d);
    A.Store.set(KEY_DRAFTS, drafts);
    renderDrafts();
  });

  $('btnClear').addEventListener('click', () => {
    if (!confirm('確定清空所有欄位？（已儲存的草稿不受影響）')) return;
    fields = {};
    $('draftName').value = '';
    A.Store.set(KEY_CUR, fields);
    renderFields();
    refresh();
  });

  $('btnPrint').addEventListener('click', () => window.print());

  A.storageNotice($('storageWarn'));
  renderFields();
  renderTabs();
  renderDrafts();
  refresh();
})();

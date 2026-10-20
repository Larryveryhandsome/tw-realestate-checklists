/* 預售屋買賣契約檢查表：畫面邏輯 */
(function () {
  'use strict';
  const C = window.Checklists, D = window.PRESALE_DATA, A = window.App;
  const KEY = 'twrc.presale.v1';
  const META_KEYS = ['project', 'date', 'checker'];
  const ids = C.allItems(D).map(i => i.id);
  const $ = id => document.getElementById(id);
  const esc = C.escapeHTML;

  let state = A.Store.get(KEY, null);
  if (!state || typeof state !== 'object') state = { meta: {}, items: {} };
  // 讀回來的本機資料也走一次驗證，壞掉就重來
  const chk = C.validateImport(Object.assign({ schema: D.schema }, state), { schema: D.schema, ids, metaKeys: META_KEYS });
  state = chk.ok ? chk.state : { meta: {}, items: {} };

  const save = () => A.Store.set(KEY, state);
  const entry = id => state.items[id] || (state.items[id] = { status: '', note: '' });

  // ---------- 繪製 ----------
  function renderSections() {
    const open = A.Store.get(KEY + '.open', null);
    let n = 0;
    $('sections').innerHTML = D.sections.map(sec => {
      const isOpen = open ? open.includes(sec.id) : false;
      const items = sec.items.map(it => {
        n++;
        const e = state.items[it.id] || {};
        const st = e.status || '';
        const btn = s => `<button type="button" data-s="${s}" aria-pressed="${st === s}">${C.STATUS_LABEL[s]}</button>`;
        return `<li class="item${st ? ' st-' + st : ''}" data-id="${esc(it.id)}">
          <div class="q"><b>${n}.</b>${esc(it.text)}</div>
          ${it.hint ? `<div class="h">${esc(it.hint)}</div>` : ''}
          <div class="seg" role="group" aria-label="檢查結果">${btn('ok')}${btn('issue')}${btn('na')}</div>
          <textarea rows="1" maxlength="2000" placeholder="備註（例如：契約第幾條、與賣方溝通結果）" aria-label="備註">${esc(e.note || '')}</textarea>
          <div class="print-status">結果：${esc(C.STATUS_LABEL[st])}${e.note ? '｜備註：' + esc(e.note) : ''}</div>
        </li>`;
      }).join('');
      return `<details class="sec" data-sec="${esc(sec.id)}"${isOpen ? ' open' : ''}>
        <summary><span class="t">${esc(sec.title)}</span><span class="c" data-count></span><div class="bar"><i data-bar></i></div></summary>
        <ul class="items">${items}</ul>
      </details>`;
    }).join('');
  }

  function renderProgress() {
    const secs = C.sectionProgress(D, state);
    for (const s of secs) {
      const el = document.querySelector(`details[data-sec="${CSS.escape(s.id)}"]`);
      if (!el) continue;
      el.querySelector('[data-count]').textContent = `${s.done}/${s.total}${s.issue ? `・有問題 ${s.issue}` : ''}`;
      el.querySelector('[data-bar]').style.width = s.percent + '%';
    }
    const o = C.overallProgress(D, state);
    $('overallBar').style.width = o.percent + '%';
    $('overallPct').textContent = o.percent + '%';
    $('overallStats').innerHTML = `<span>已檢查 ${o.done}／${o.total}</span><span class="ok">已確認 ${o.ok}</span><span class="issue">有問題 ${o.issue}</span><span class="na">不適用 ${o.na}</span>`;
    $('summary').textContent = `共 ${D.sections.length} 個點次、${o.total} 項・已檢查 ${o.percent}%`;

    const issues = C.issueSummary(D, state);
    $('issueBox').innerHTML = issues.length
      ? `<ol class="issue-list">${issues.map(x => `<li><span class="sec-name">${esc(x.section)}</span><br>${esc(x.text)}${x.note ? `<br><span class="hint">備註：${esc(x.note)}</span>` : ''}</li>`).join('')}</ol>`
      : '<p class="hint">目前沒有標為「有問題」的項目。</p>';
  }

  function updateItem(li) {
    const id = li.dataset.id;
    const e = state.items[id] || {};
    const st = e.status || '';
    li.className = 'item' + (st ? ' st-' + st : '');
    li.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === st)));
    li.querySelector('.print-status').textContent = `結果：${C.STATUS_LABEL[st]}${e.note ? '｜備註：' + e.note : ''}`;
  }

  function applyFilter() {
    const q = $('search').value.trim().toLowerCase();
    const todo = $('onlyTodo').checked;
    document.querySelectorAll('details.sec').forEach(sec => {
      let any = false;
      sec.querySelectorAll('.item').forEach(li => {
        const st = (state.items[li.dataset.id] || {}).status;
        const hit = (!q || li.querySelector('.q').textContent.toLowerCase().includes(q) || sec.querySelector('.t').textContent.toLowerCase().includes(q)) && (!todo || !st);
        li.hidden = !hit;
        if (hit) any = true;
      });
      sec.hidden = !any;
      if ((q || todo) && any) sec.open = true;
    });
  }

  function renderMeta() {
    $('metaProject').value = state.meta.project || '';
    $('metaDate').value = state.meta.date || '';
    $('metaChecker').value = state.meta.checker || '';
  }

  function renderAll() {
    renderMeta();
    renderSections();
    renderProgress();
    applyFilter();
  }

  function saveOpen() {
    const open = [...document.querySelectorAll('details.sec[open]')].map(d => d.dataset.sec);
    A.Store.set(KEY + '.open', open);
  }

  // ---------- 事件 ----------
  $('sections').addEventListener('click', ev => {
    const b = ev.target.closest('.seg button');
    if (!b) return;
    const li = b.closest('.item');
    const e = entry(li.dataset.id);
    e.status = e.status === b.dataset.s ? '' : b.dataset.s; // 再按一次取消
    save();
    updateItem(li);
    renderProgress();
  });
  $('sections').addEventListener('input', ev => {
    if (ev.target.tagName !== 'TEXTAREA') return;
    const li = ev.target.closest('.item');
    entry(li.dataset.id).note = ev.target.value.slice(0, 2000);
    save();
    updateItem(li);
  });
  $('sections').addEventListener('change', ev => { if (ev.target.tagName === 'TEXTAREA') renderProgress(); });
  $('sections').addEventListener('toggle', saveOpen, true);

  [['metaProject', 'project'], ['metaDate', 'date'], ['metaChecker', 'checker']].forEach(([el, k]) => {
    $(el).addEventListener('input', () => { state.meta[k] = $(el).value.slice(0, 200); save(); });
  });

  $('search').addEventListener('input', applyFilter);
  $('onlyTodo').addEventListener('change', applyFilter);
  $('btnExpand').addEventListener('click', () => { document.querySelectorAll('details.sec').forEach(d => { d.open = true; }); saveOpen(); });
  $('btnCollapse').addEventListener('click', () => { document.querySelectorAll('details.sec').forEach(d => { d.open = false; }); saveOpen(); });

  $('btnReset').addEventListener('click', () => {
    if (!confirm('確定要清除所有勾選與備註嗎？建議先「匯出 JSON」備份。')) return;
    state = { meta: {}, items: {} };
    save();
    renderAll();
    A.toast('已清除');
  });

  $('btnExport').addEventListener('click', () => {
    const data = C.exportState(D.schema, state, { title: D.title });
    const name = (state.meta.project || '預售屋契約檢查').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    A.downloadText(`${name}-${A.today()}.json`, JSON.stringify(data, null, 2));
    A.toast('已匯出 JSON');
  });

  $('fileImport').addEventListener('change', async ev => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    let text;
    try { text = await A.readFileText(file); } catch (e) { A.toast('讀檔失敗'); return; }
    const r = C.validateImport(text, { schema: D.schema, ids, metaKeys: META_KEYS });
    if (!r.ok) { alert('無法匯入：' + r.error); return; }
    if (!confirm('匯入會取代目前畫面上的勾選與備註，確定嗎？')) return;
    state = r.state;
    save();
    renderAll();
    A.toast(r.ignored ? `已匯入（略過 ${r.ignored} 個本版沒有的項目）` : '已匯入');
  });

  // 列印時展開所有區塊，印完恢復
  let openBefore = null;
  window.addEventListener('beforeprint', () => {
    openBefore = [...document.querySelectorAll('details.sec')].map(d => d.open);
    document.querySelectorAll('details.sec').forEach(d => { d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (!openBefore) return;
    document.querySelectorAll('details.sec').forEach((d, i) => { d.open = openBefore[i]; });
    openBefore = null;
  });
  $('btnPrint').addEventListener('click', () => window.print());

  // ---------- 啟動 ----------
  $('howTo').textContent = D.howTo;
  $('sourceNote').textContent = D.sourceNote;
  $('lastChecked').textContent = D.lastChecked;
  A.storageNotice($('storageWarn'));
  renderAll();
})();

/* 農舍興建資格自我檢查：畫面邏輯 */
(function () {
  'use strict';
  const C = window.Checklists, R = window.FARMHOUSE_RULES, A = window.App;
  const KEY = 'twrc.farmhouse.v1';
  const $ = id => document.getElementById(id);
  const esc = C.escapeHTML;

  const allowed = new Set();
  for (const q of R.questions) { allowed.add(q.id); if (q.unitField) allowed.add(q.unitField); }
  let answers = {};
  const saved = A.Store.get(KEY, null);
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(saved)) if (allowed.has(k) && typeof saved[k] === 'string') answers[k] = saved[k].slice(0, 50);
  }

  function inputFor(q) {
    const v = answers[q.id] || '';
    const name = esc(q.id);
    if (q.type === 'yesno') {
      const opt = (val, txt) => `<label><input type="radio" name="${name}" value="${val}"${v === val ? ' checked' : ''}> ${txt}</label>`;
      return `<div class="opts">${opt('yes', '是')}${opt('no', '否')}${opt('', '不確定')}</div>`;
    }
    if (q.type === 'select') {
      const opts = q.options.map(([val, txt]) => `<label><input type="radio" name="${name}" value="${esc(val)}"${v === val ? ' checked' : ''}> ${esc(txt)}</label>`).join('');
      return `<div class="opts">${opts}</div>`;
    }
    if (q.type === 'area') {
      const u = answers[q.unitField] || q.units[0][0];
      const units = q.units.map(([val, txt]) => `<option value="${esc(val)}"${u === val ? ' selected' : ''}>${esc(txt)}</option>`).join('');
      return `<div class="inline"><input type="text" inputmode="decimal" name="${name}" id="q-${name}" value="${esc(v)}" placeholder="數字" maxlength="20">
        <select name="${esc(q.unitField)}" aria-label="單位">${units}</select></div>`;
    }
    return `<div class="inline"><input type="text" inputmode="decimal" name="${name}" id="q-${name}" value="${esc(v)}" placeholder="數字" maxlength="20"> <span>${esc(q.unit || '')}</span></div>`;
  }

  function renderForm() {
    $('form').innerHTML = R.groups.map(g => {
      const qs = R.questions.filter(q => q.group === g.id).map(q => {
        const forAttr = q.type === 'number' || q.type === 'area' ? ` for="q-${esc(q.id)}"` : '';
        return `<div class="q-row"><label class="lbl"${forAttr}>${esc(q.label)}</label>${inputFor(q)}${q.help ? `<div class="hint">${esc(q.help)}</div>` : ''}</div>`;
      }).join('');
      return `<fieldset class="card" style="border:1px solid var(--line)"><legend><h2 style="margin:0">${esc(g.title)}</h2></legend>${qs}</fieldset>`;
    }).join('');
  }

  function renderResult() {
    const r = C.evaluateFarmhouse(answers, R);
    const v = $('verdict');
    v.className = 'verdict r-' + r.overall;
    v.textContent = r.label;
    $('counts').innerHTML = `<span class="ok">看起來符合 ${r.counts.pass}</span><span style="color:var(--check)">需要再確認 ${r.counts.check}</span><span class="issue">可能不符合 ${r.counts.fail}</span>`;
    const groups = [...new Set(r.items.map(i => i.group))];
    // 依嚴重程度排序：可能不符合 → 需要再確認 → 看起來符合
    const order = { fail: 0, check: 1, pass: 2 };
    $('results').innerHTML = groups.map(g => {
      const rows = r.items.filter(i => i.group === g).sort((a, b) => order[a.result] - order[b.result]).map(i =>
        `<li><span class="tag r-${i.result}">${esc(i.resultLabel)}</span><span>${esc(i.label)}</span><span class="why">${esc(i.reason)}</span></li>`).join('');
      return `<h3 class="res-group">${esc(g)}</h3><ul class="res-list">${rows}</ul>`;
    }).join('');
    $('disclaimer').textContent = r.disclaimer;
  }

  function renderStatic() {
    $('lawName').textContent = R.lawName;
    $('lawVersion').textContent = R.lawVersion;
    $('lastChecked').textContent = R.lastChecked;
    $('reminders').innerHTML = R.reminders.map(t => `<li>${esc(t)}</li>`).join('');
    const rows = Object.entries(R.thresholds).filter(([, t]) => t.value !== null && t.value !== true).map(([k, t]) => {
      const val = k === 'maxCoverage' ? Math.round(t.value * 100) + '%' : `${t.value}${t.unit && t.unit !== '比例' ? ' ' + t.unit : ''}`;
      return `<tr><td>${esc(t.note || k)}</td><td>${esc(val)}</td><td>${t.certain ? '' : '需確認'}</td></tr>`;
    }).join('');
    $('rulesTbl').innerHTML = `<thead><tr><th>規則</th><th>門檻</th><th>狀態</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function onChange(ev) {
    const el = ev.target;
    if (!el.name || !allowed.has(el.name)) return;
    if (el.type === 'radio' && !el.checked) return;
    answers[el.name] = String(el.value).slice(0, 50);
    A.Store.set(KEY, answers);
    renderResult();
  }
  $('form').addEventListener('input', onChange);
  $('form').addEventListener('change', onChange);

  $('btnReset').addEventListener('click', () => {
    if (!confirm('確定要清除所有答案嗎？')) return;
    answers = {};
    A.Store.remove(KEY);
    renderForm();
    renderResult();
  });
  $('btnPrint').addEventListener('click', () => window.print());

  A.storageNotice($('storageWarn'));
  renderStatic();
  renderForm();
  renderResult();
})();

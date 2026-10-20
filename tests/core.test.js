// 執行：npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/core.js');

const root = path.join(__dirname, '..');
function loadData(file) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
  return ctx.window;
}
const PRESALE = loadData('data-presale.js').PRESALE_DATA;
const RULES = loadData('data-farmhouse.js').FARMHOUSE_RULES;
const ids = C.allItems(PRESALE).map(i => i.id);

// ---------- 資料檔 ----------
test('預售屋資料：vm 載得進來，每一項都有 id／section／text，id 不重複且 section 對得上', () => {
  assert.ok(PRESALE.sections.length >= 16);
  assert.equal(new Set(ids).size, ids.length);
  for (const sec of PRESALE.sections) {
    assert.ok(sec.id && sec.title && sec.items.length, sec.id);
    for (const it of sec.items) {
      assert.ok(it.id && it.section && it.text, JSON.stringify(it));
      assert.equal(it.section, sec.id, it.id);
    }
  }
  assert.ok(ids.length >= 80, String(ids.length));
});

test('預售屋資料：涵蓋原始彙整表的各應記載事項點次', () => {
  const titles = PRESALE.sections.map(s => s.title).join('|');
  for (const k of ['五、', '六、', '七、', '七之一、', '八、', '十一、', '十二、', '十三、', '十四、', '十五、', '十七、', '十八、', '二十、', '二十一、', '二十四、', '當事人']) {
    assert.ok(titles.includes(k), k);
  }
  assert.ok(PRESALE.sourceNote.includes('原則上以主管機關最新公告為準'));
});

test('農舍設定：門檻值都有 value 與 certain，問卷題目有 id／group／label', () => {
  assert.ok(RULES.lawVersion && /^\d{4}-\d{2}-\d{2}$/.test(RULES.lastChecked));
  for (const [k, t] of Object.entries(RULES.thresholds)) {
    assert.ok('value' in t && typeof t.certain === 'boolean', k);
  }
  const groups = new Set(RULES.groups.map(g => g.id));
  for (const q of RULES.questions) assert.ok(q.id && groups.has(q.group) && q.label, q.id);
});

test('資料檔沒有個資：無 email、無真實手機號碼', () => {
  const files = ['data-presale.js', 'data-farmhouse.js', 'core.js'].map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8'));
  for (const s of files) {
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(s), 'email');
    const phones = s.match(/09\d{2}-?\d{3}-?\d{3}/g) || [];
    for (const p of phones) assert.ok(/^0900-?000-?\d{3}$/.test(p), p);
  }
});

// ---------- 檢查表 ----------
test('進度：空白狀態為 0%，各區 total 加總等於總項數', () => {
  const o = C.overallProgress(PRESALE, {});
  assert.equal(o.total, ids.length);
  assert.equal(o.done, 0);
  assert.equal(o.percent, 0);
  const secs = C.sectionProgress(PRESALE, null);
  assert.equal(secs.reduce((a, s) => a + s.total, 0), ids.length);
});

test('進度：已確認／有問題／不適用都算完成，未知狀態不算', () => {
  const data = { sections: [{ id: 'a', title: 'A', items: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }] }] };
  const state = { items: { 1: { status: 'ok' }, 2: { status: 'issue' }, 3: { status: 'weird' } } };
  const p = C.sectionProgress(data, state)[0];
  assert.deepEqual([p.done, p.ok, p.issue, p.na, p.percent], [2, 1, 1, 0, 50]);
  state.items[4] = { status: 'na' };
  state.items[3] = { status: 'ok' };
  assert.equal(C.overallProgress(data, state).percent, 100);
});

test('進度：百分比四捨五入（1/3 → 33%）', () => {
  const data = { sections: [{ id: 'a', title: 'A', items: [{ id: '1' }, { id: '2' }, { id: '3' }] }] };
  assert.equal(C.overallProgress(data, { items: { 1: { status: 'na' } } }).percent, 33);
  assert.equal(C.overallProgress(data, { items: { 1: { status: 'na' }, 2: { status: 'ok' } } }).percent, 67);
});

test('有問題清單：依資料順序，帶區塊標題與備註', () => {
  const state = { items: { [ids[5]]: { status: 'issue', note: ' 第 3 條寫法不同 ' }, [ids[1]]: { status: 'issue' }, [ids[2]]: { status: 'ok' } } };
  const s = C.issueSummary(PRESALE, state);
  assert.deepEqual(s.map(x => x.id), [ids[1], ids[5]]);
  assert.equal(s[1].note, '第 3 條寫法不同');
  assert.ok(s[0].section && s[0].text);
});

test('匯入：拒絕壞 JSON、陣列、schema 不符、缺 items、未知狀態、備註非文字', () => {
  const opt = { schema: PRESALE.schema, ids };
  assert.equal(C.validateImport('{oops', opt).ok, false);
  assert.equal(C.validateImport('', opt).ok, false);
  assert.equal(C.validateImport('[]', opt).ok, false);
  assert.equal(C.validateImport('null', opt).ok, false);
  assert.equal(C.validateImport(JSON.stringify({ schema: 'other', items: {} }), opt).ok, false);
  assert.equal(C.validateImport(JSON.stringify({ schema: PRESALE.schema }), opt).ok, false);
  assert.equal(C.validateImport(JSON.stringify({ schema: PRESALE.schema, items: { [ids[0]]: { status: 'done' } } }), opt).ok, false);
  assert.equal(C.validateImport(JSON.stringify({ schema: PRESALE.schema, items: { [ids[0]]: { status: 'ok', note: 5 } } }), opt).ok, false);
  assert.equal(C.validateImport(JSON.stringify({ schema: PRESALE.schema, items: { [ids[0]]: 'ok' } }), opt).ok, false);
  assert.equal(C.validateImport('x'.repeat(1000001), opt).ok, false);
});

test('匯入：合法檔案可還原，未知 id 略過並計數，備註截斷；匯出再匯入相同', () => {
  const state = { meta: { project: '示範建案', date: '2026-10-20' }, items: { [ids[0]]: { status: 'ok', note: '' }, [ids[3]]: { status: 'issue', note: 'x'.repeat(3000) } } };
  const exported = C.exportState(PRESALE.schema, state);
  exported.items.unknown = { status: 'ok' };
  const r = C.validateImport('﻿' + JSON.stringify(exported), { schema: PRESALE.schema, ids, metaKeys: ['project', 'date'] });
  assert.equal(r.ok, true);
  assert.equal(r.ignored, 1);
  assert.equal(r.state.items[ids[3]].note.length, 2000);
  assert.equal(r.state.meta.project, '示範建案');
  assert.equal(C.overallProgress(PRESALE, r.state).done, 2);
});

test('escapeHTML 跳脫 HTML 特殊字元', () => {
  assert.equal(C.escapeHTML('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  assert.equal(C.escapeHTML(null), '');
});

// ---------- 農舍 ----------
const good = {
  isFarmer: 'yes', age: '45', married: 'no', sameCounty: 'yes', householdYears: '5', isOwner: 'yes', hasOtherFarmhouse: 'no',
  farmhouseType: 'single', acquiredBeforeCutoff: 'no', landHeldYears: '3', landArea: '3000', landAreaUnit: 'sqm',
  farmUse: 'yes', farmingRecord: 'yes', landHasFarmhouse: 'no',
  zone: 'nonUrban', buildingArea: '80', buildingAreaUnit: 'ping', floorArea: '140', floorAreaUnit: 'ping', floors: '3', height: '10',
};
const ev = a => C.evaluateFarmhouse(a, RULES);
const item = (r, id) => r.items.find(x => x.id === id);

test('農舍：條件齊全 → 看起來符合，每個理由都以「原則上」開頭，並附主管機關審查聲明', () => {
  const r = ev(good);
  assert.equal(r.overall, 'pass', JSON.stringify(r.items.filter(i => i.result !== 'pass')));
  assert.equal(r.label, '看起來符合');
  for (const it of r.items) assert.ok(it.reason.startsWith('原則上'), it.reason);
  assert.ok(r.disclaimer.includes('請以地方主管機關（縣市政府）審查為準'));
});

test('農舍：完全沒填 → 需要再確認（不會判不符合）', () => {
  const r = ev({});
  assert.equal(r.overall, 'check');
  assert.equal(r.counts.fail, 0);
});

test('農舍：面積不足 0.25 公頃（一分地約 293 坪）→ 可能不符合', () => {
  const r = ev(Object.assign({}, good, { landArea: '293.4', landAreaUnit: 'ping', buildingArea: '20' }));
  assert.equal(item(r, 'landArea').result, 'fail');
  assert.equal(r.overall, 'fail');
  assert.equal(r.label, '可能不符合');
});

test('農舍：面積單位換算（0.25 公頃 = 2500 平方公尺 = 756.25 坪）邊界都算符合', () => {
  for (const [v, u] of [['0.25', 'ha'], ['2500', 'sqm'], ['756.25', 'ping']]) {
    assert.equal(item(ev(Object.assign({}, good, { landArea: v, landAreaUnit: u, buildingArea: '70' })), 'landArea').result, 'pass', u);
  }
  assert.ok(Math.abs(C.areaToSqm('756.25', 'ping') - 2500) < 1e-9);
});

test('農舍：建蔽率超過 10%、總樓地板超過 150 坪、超過 3 層 → 對應項目不符合', () => {
  const r = ev(Object.assign({}, good, { buildingArea: '100', floorArea: '160', floors: '4' }));
  assert.equal(item(r, 'buildingArea').result, 'fail');
  assert.equal(item(r, 'floorArea').result, 'fail');
  assert.equal(item(r, 'height').result, 'fail');
});

test('農舍：不確定的門檻（年齡、都市計畫區數值）不判不符合，只說需要再確認', () => {
  const young = ev(Object.assign({}, good, { age: '19', married: 'no' }));
  assert.equal(item(young, 'age').result, 'check');
  assert.ok(item(young, 'age').reason.includes('需向主管機關確認'));
  const urban = ev(Object.assign({}, good, { zone: 'urban', floorArea: '210', floors: '5', height: '15' }));
  assert.equal(item(urban, 'floorArea').result, 'check');
  assert.equal(item(urban, 'height').result, 'check');
  assert.equal(item(urban, 'urbanSetback').result, 'check');
  assert.equal(urban.overall, 'check');
});

test('農舍：2000/1/28 前取得或集村農舍 → 面積改為需要再確認；非農民 → 可能不符合', () => {
  const old = ev(Object.assign({}, good, { acquiredBeforeCutoff: 'yes', landArea: '1000', buildingArea: '20' }));
  assert.equal(item(old, 'landArea').result, 'check');
  assert.equal(item(old, 'landHeldYears').result, 'check');
  const cl = ev(Object.assign({}, good, { farmhouseType: 'cluster' }));
  assert.equal(item(cl, 'landArea').result, 'check');
  assert.equal(ev(Object.assign({}, good, { isFarmer: 'no' })).overall, 'fail');
});

test('農舍：門檻改設定檔即生效（設籍年數門檻改成 6 年）', () => {
  const rules = JSON.parse(JSON.stringify(RULES));
  rules.thresholds.householdYears.value = 6;
  assert.equal(item(C.evaluateFarmhouse(good, rules), 'householdYears').result, 'fail');
  assert.equal(item(C.evaluateFarmhouse(good, RULES), 'householdYears').result, 'pass');
});

test('toNumber：全形、千分位、負數與文字', () => {
  assert.equal(C.toNumber('１,２００'), 1200);
  assert.equal(C.toNumber('3.5'), 3.5);
  assert.equal(C.toNumber('-1'), null);
  assert.equal(C.toNumber('abc'), null);
  assert.equal(C.toNumber(''), null);
});

// ---------- 物件介紹 ----------
const pitch = {
  title: '示範路採光三房', kind: '電梯大樓', price: '1,288 萬', size: '權狀 35 坪',
  layout: '3 房 2 廳 2 衛', fit: '小家庭', life: '步行 5 分鐘有超市', traffic: '近交流道',
  plan: '規劃中的產業園區', cta: '歡迎預約看屋', contact: '○先生 0900-000-123',
};

test('物件介紹：全部空白 → 三種格式都回傳空字串，完整度 0%', () => {
  for (const f of C.PITCH_FORMATS) assert.equal(C.generatePitch({}, f.id), '');
  assert.equal(C.generatePitch({ title: '   ' }, 'fb'), '');
  const c = C.pitchCompleteness({});
  assert.equal(c.percent, 0);
  assert.equal(c.corePercent, 0);
  assert.ok(c.missingCore.length > 0);
});

test('物件介紹：三種格式都含關鍵內容與保護語，空欄位不會留下空標籤或 undefined', () => {
  for (const f of C.PITCH_FORMATS) {
    const t = C.generatePitch(pitch, f.id);
    assert.ok(t.includes('示範路採光三房'), f.id);
    assert.ok(t.includes('超市'), f.id);
    assert.ok(t.includes(C.PITCH_FOOTER), f.id);
    assert.ok(!/undefined|null/.test(t), f.id);
    assert.ok(!/：\s*$/m.test(t), f.id + ' 有空標籤');
    assert.ok(!t.includes('醫療與公家機關'), f.id + ' 不應出現未填欄位');
  }
});

test('物件介紹：LINE 短版會截短長欄位；FB 長版保留全文；只填一個性質也能產生', () => {
  const long = Object.assign({}, pitch, { life: '超市'.repeat(40) });
  const line = C.generatePitch(long, 'line');
  const fb = C.generatePitch(long, 'fb');
  assert.ok(line.length < fb.length);
  assert.ok(line.includes('…'));
  assert.ok(fb.includes('超市'.repeat(40)));
  const only = C.generatePitch({ plan: '新車站規劃中' }, 'showing');
  assert.ok(only.includes('未來性') && only.includes('新車站規劃中'));
  assert.ok(!only.includes('使用性'));
});

test('物件介紹：完整度計算與草稿驗證', () => {
  const c = C.pitchCompleteness(pitch);
  assert.equal(c.filled, 11);
  assert.equal(c.total, C.PITCH_FIELDS.length);
  assert.equal(c.corePercent, 100);
  assert.equal(c.groups.use.filled, 2);
  assert.deepEqual(C.validatePitchDraft({ fields: { title: 'A', evil: 'x', price: 5 } }), { title: 'A' });
  assert.equal(C.validatePitchDraft('nope'), null);
});

test('每個 js 檔都沒有對外連線（fetch／XMLHttpRequest／http 網址）', () => {
  for (const f of fs.readdirSync(path.join(root, 'js'))) {
    const s = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    assert.ok(!/\bfetch\(|XMLHttpRequest|https?:\/\//.test(s), f);
  }
});

/*
 * tw-realestate-checklists 核心（純函式，不碰畫面）
 * 瀏覽器：window.Checklists；Node：require('./core.js')
 *
 * 內容：
 *  - 檢查表：進度計算、有問題清單、匯入驗證
 *  - 農舍自我檢查：判斷引擎（門檻值由 js/data-farmhouse.js 提供）
 *  - 物件介紹：欄位定義、完整度、三種格式文案產生
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Checklists = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 共用 ----------
  /** 放進 innerHTML 前一律跳脫 */
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = v => (v == null ? '' : String(v)).trim();

  /** 數字：接受全形數字、千分位逗號；空白或無效回傳 null，負數也視為無效 */
  function toNumber(v) {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
    const s = String(v).trim()
      .replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[,，\s]/g, '');
    if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // ---------- 檢查表 ----------
  const STATUSES = ['ok', 'issue', 'na'];
  const STATUS_LABEL = { ok: '已確認', issue: '有問題', na: '不適用', '': '未檢查' };

  function allItems(data) {
    const out = [];
    for (const sec of (data && data.sections) || []) for (const it of sec.items || []) out.push(it);
    return out;
  }

  function entryOf(state, id) {
    const e = state && isObj(state.items) ? state.items[id] : null;
    return isObj(e) ? e : {};
  }

  /** 單一區塊或整份的統計；done = 已勾選任一狀態 */
  function tally(items, state) {
    const t = { total: items.length, done: 0, ok: 0, issue: 0, na: 0, percent: 0 };
    for (const it of items) {
      const s = entryOf(state, it.id).status;
      if (STATUSES.includes(s)) { t.done++; t[s]++; }
    }
    t.percent = t.total ? Math.round((t.done / t.total) * 100) : 0;
    return t;
  }

  function sectionProgress(data, state) {
    return ((data && data.sections) || []).map(sec => Object.assign({ id: sec.id, title: sec.title }, tally(sec.items || [], state)));
  }

  function overallProgress(data, state) {
    return tally(allItems(data), state);
  }

  /** 標為「有問題」的項目，依資料順序 */
  function issueSummary(data, state) {
    const out = [];
    for (const sec of (data && data.sections) || []) {
      for (const it of sec.items || []) {
        const e = entryOf(state, it.id);
        if (e.status === 'issue') out.push({ id: it.id, section: sec.title, text: it.text, note: str(e.note) });
      }
    }
    return out;
  }

  const MAX_IMPORT_CHARS = 1000000;
  const MAX_NOTE_CHARS = 2000;
  const MAX_META_CHARS = 200;

  /**
   * 驗證匯入的 JSON。不合格就整份拒絕，不會半套寫入。
   * @param {string|object} input  檔案文字或已解析物件
   * @param {{schema:string, ids?:string[], metaKeys?:string[]}} opt
   * @returns {{ok:true, state:object, ignored:number} | {ok:false, error:string}}
   */
  function validateImport(input, opt) {
    opt = opt || {};
    let obj = input;
    if (typeof input === 'string') {
      if (input.length > MAX_IMPORT_CHARS) return { ok: false, error: '檔案太大，不像是本工具匯出的檔案' };
      try { obj = JSON.parse(input.replace(/^﻿/, '')); } catch (e) { return { ok: false, error: '不是有效的 JSON 檔案' }; }
    }
    if (!isObj(obj)) return { ok: false, error: '檔案內容格式不對（應為物件）' };
    if (opt.schema && obj.schema !== opt.schema) return { ok: false, error: '這不是本工具這一頁匯出的檔案（schema 不符）' };
    if (!isObj(obj.items)) return { ok: false, error: '缺少 items 欄位' };
    const known = opt.ids ? new Set(opt.ids) : null;
    const items = {};
    let ignored = 0;
    for (const id of Object.keys(obj.items)) {
      const e = obj.items[id];
      if (!isObj(e)) return { ok: false, error: `項目 ${id} 格式不對` };
      const status = e.status == null ? '' : e.status;
      if (status !== '' && !STATUSES.includes(status)) return { ok: false, error: `項目 ${id} 的狀態「${status}」無法辨識` };
      if (e.note != null && typeof e.note !== 'string') return { ok: false, error: `項目 ${id} 的備註應為文字` };
      if (known && !known.has(id)) { ignored++; continue; }
      items[id] = { status, note: String(e.note || '').slice(0, MAX_NOTE_CHARS) };
    }
    const meta = {};
    if (isObj(obj.meta)) {
      for (const k of opt.metaKeys || Object.keys(obj.meta)) {
        const v = obj.meta[k];
        if (typeof v === 'string') meta[k] = v.slice(0, MAX_META_CHARS);
      }
    }
    return { ok: true, state: { items, meta }, ignored };
  }

  /** 產生匯出用物件 */
  function exportState(schema, state, extra) {
    return Object.assign({ schema, version: 1, exportedAt: new Date().toISOString() }, extra || {}, {
      meta: (state && state.meta) || {},
      items: (state && state.items) || {},
    });
  }

  // ---------- 農舍自我檢查 ----------
  const RESULT_LABEL = { pass: '看起來符合', check: '需要再確認', fail: '可能不符合' };
  const DISCLAIMER = '原則上僅供自我初步檢查，不構成法律意見；請以地方主管機關（縣市政府）審查為準。';
  const SQM_PER_PING = 400 / 121; // 1 坪 = 400/121 平方公尺 ≈ 3.3058
  const SQM_PER_HA = 10000;

  /** 面積換算成平方公尺；unit：'ha' 公頃、'sqm' 平方公尺、'ping' 坪 */
  function areaToSqm(value, unit) {
    const n = toNumber(value);
    if (n == null) return null;
    if (unit === 'ha') return n * SQM_PER_HA;
    if (unit === 'ping') return n * SQM_PER_PING;
    return n;
  }

  const yn = v => (v === 'yes' || v === true ? 'yes' : v === 'no' || v === false ? 'no' : '');

  /**
   * 農舍資格自我檢查。
   * @param {object} answers  問卷答案（id 見 data-farmhouse.js 的 questions）
   * @param {object} cfg      window.FARMHOUSE_RULES
   * @returns {{overall:string, label:string, items:object[], counts:object, disclaimer:string}}
   */
  function evaluateFarmhouse(answers, cfg) {
    const a = answers || {};
    const T = (cfg && cfg.thresholds) || {};
    const th = k => (T[k] && T[k].value != null ? T[k].value : null);
    const sure = k => !T[k] || T[k].certain !== false; // 設定檔沒有列的規則視為確定
    const items = [];

    /** 加入一項；門檻不確定時，「可能不符合」降為「需要再確認」 */
    function add(group, id, label, result, reason, ruleKey) {
      if (result === 'fail' && ruleKey && !sure(ruleKey)) {
        result = 'check';
        reason += '（此門檻需向主管機關確認，' + (T[ruleKey] && T[ruleKey].note ? T[ruleKey].note : '本工具不直接判定不符合') + '）';
      }
      items.push({ group, id, label, result, resultLabel: RESULT_LABEL[result], reason: '原則上' + reason });
    }
    function ynItem(group, id, label, goodWhen, okText, badText, ruleKey) {
      const v = yn(a[id]);
      if (!v) return add(group, id, label, 'check', '尚未回答或不確定；' + okText + '。', ruleKey);
      if (v === goodWhen) return add(group, id, label, 'pass', okText + '，此項看起來符合。', ruleKey);
      return add(group, id, label, 'fail', badText, ruleKey);
    }

    const G1 = '申請人資格', G2 = '土地條件', G3 = '建築規模限制';
    const old = yn(a.acquiredBeforeCutoff) === 'yes';
    const cluster = a.farmhouseType === 'cluster';
    const cutoff = th('oldLandCutoff') || '（請見設定檔）';

    // --- 申請人資格 ---
    ynItem(G1, 'isFarmer', '具備農民資格', 'yes',
      '需具備農民資格（例如農保、全民健保第三類農民身分，或經審查的農業經營計畫）',
      '申請人需具備農民資格，目前回答為否。');

    const age = toNumber(a.age);
    const minAge = th('minAge');
    const married = yn(a.married) === 'yes';
    if (age == null || minAge == null) add(G1, 'age', '年齡', 'check', '尚未填寫年齡，需確認是否達年齡門檻。', 'minAge');
    else if (age >= minAge) add(G1, 'age', '年齡', 'pass', `年滿 ${minAge} 歲，此項看起來符合。`, 'minAge');
    else if (married) add(G1, 'age', '年齡', 'check', `未滿 ${minAge} 歲但已婚，依原始整理資料可申請，請向主管機關確認。`, 'minAge');
    else add(G1, 'age', '年齡', 'fail', `未滿 ${minAge} 歲且未婚，可能未達年齡門檻。`, 'minAge');

    ynItem(G1, 'sameCounty', '戶籍與農地在同一縣市', 'yes',
      '戶籍與農地需在同一直轄市或縣市', '戶籍與農地需在同一縣市，目前回答為否。', 'sameCounty');

    const hy = toNumber(a.householdYears), needHy = th('householdYears');
    if (hy == null) add(G1, 'householdYears', '設籍年數', 'check', `尚未填寫，需確認設籍是否滿 ${needHy} 年。`, 'householdYears');
    else if (hy >= needHy) add(G1, 'householdYears', '設籍年數', 'pass', `設籍已滿 ${needHy} 年，此項看起來符合。`, 'householdYears');
    else add(G1, 'householdYears', '設籍年數', 'fail', `設籍未滿 ${needHy} 年（目前 ${hy} 年）。`, 'householdYears');

    ynItem(G1, 'isOwner', '為農地所有權人', 'yes',
      '申請人需為該筆農地的所有權人', '申請人需為農地所有權人，目前回答為否。', 'isOwner');
    ynItem(G1, 'hasOtherFarmhouse', '名下沒有其他農舍', 'no',
      '申請人名下不得已有其他農舍', '申請人名下已有其他農舍，可能不符合。', 'noOtherFarmhouse');

    // --- 土地條件 ---
    const ly = toNumber(a.landHeldYears), needLy = th('landHeldYears');
    if (old) add(G2, 'landHeldYears', '取得土地年數', 'check', `土地於 ${cutoff} 前取得，依原始整理資料可能不受時間限制，需檢附證明並向主管機關確認。`);
    else if (ly == null) add(G2, 'landHeldYears', '取得土地年數', 'check', `尚未填寫，需確認取得土地是否滿 ${needLy} 年。`, 'landHeldYears');
    else if (ly >= needLy) add(G2, 'landHeldYears', '取得土地年數', 'pass', `取得土地已滿 ${needLy} 年，此項看起來符合。`, 'landHeldYears');
    else add(G2, 'landHeldYears', '取得土地年數', 'fail', `取得土地未滿 ${needLy} 年（目前 ${ly} 年）。`, 'landHeldYears');

    const landSqm = areaToSqm(a.landArea, a.landAreaUnit || 'sqm');
    const minHa = th('minLandAreaHa');
    const minSqm = minHa != null ? minHa * SQM_PER_HA : null;
    const minTxt = minHa != null ? `${minHa} 公頃（約 ${fmt(minSqm / SQM_PER_PING)} 坪）` : '面積門檻';
    if (cluster) add(G2, 'landArea', '農地面積', 'check', '集村農舍的面積與申請規定與一般農舍不同（需多戶聯合申請），本工具不判斷，需向主管機關確認。', 'cluster');
    else if (old) add(G2, 'landArea', '農地面積', 'check', `土地於 ${cutoff} 前取得，依原始整理資料可能不受 ${minTxt} 限制，需向主管機關確認。`);
    else if (landSqm == null) add(G2, 'landArea', '農地面積', 'check', `尚未填寫農地面積，一般農舍需大於 ${minTxt}。`, 'minLandAreaHa');
    else if (landSqm >= minSqm) add(G2, 'landArea', '農地面積', 'pass', `農地約 ${fmt(landSqm)} 平方公尺，達 ${minTxt}。`, 'minLandAreaHa');
    else add(G2, 'landArea', '農地面積', 'fail', `農地約 ${fmt(landSqm)} 平方公尺，未達 ${minTxt}。`, 'minLandAreaHa');

    ynItem(G2, 'farmUse', '農地確供農業使用', 'yes',
      '農地需確實作農業使用', '農地需確供農業使用，目前回答為否；另可能涉及稅賦追繳。', 'farmUse');
    ynItem(G2, 'farmingRecord', `有近 ${th('farmingRecordYears') || 2} 年農業經營實績佐證`, 'yes',
      '需備妥農業經營實績佐證文件', '缺少農業經營實績佐證文件，可能無法通過審查。', 'farmingRecord');
    ynItem(G2, 'landHasFarmhouse', '該筆農地尚未興建農舍', 'no',
      '一筆農地原則上只能興建一戶農舍', '該筆農地已有農舍，可能無法再申請。', 'onePerLand');

    // --- 建築規模 ---
    const zone = a.zone === 'urban' ? 'urban' : a.zone === 'nonUrban' ? 'nonUrban' : '';
    const sfx = zone === 'urban' ? 'Urban' : 'NonUrban';
    const zoneName = zone === 'urban' ? '都市計畫區' : '非都市計畫區';

    const bSqm = areaToSqm(a.buildingArea, a.buildingAreaUnit || 'ping');
    const cov = th('maxCoverage');
    if (cluster) add(G3, 'buildingArea', '建築面積（建蔽率）', 'check', '集村農舍的建蔽率規定不同，需向主管機關確認。', 'cluster');
    else if (bSqm == null || landSqm == null || !landSqm) add(G3, 'buildingArea', '建築面積（建蔽率）', 'check', `需填寫農地面積與預計建築面積，建築面積不得超過農地面積的 ${pct(cov)}。`, 'maxCoverage');
    else if (bSqm <= landSqm * cov + 1e-9) add(G3, 'buildingArea', '建築面積（建蔽率）', 'pass', `建築面積約占農地 ${pct(bSqm / landSqm, 1)}，未超過 ${pct(cov)}。`, 'maxCoverage');
    else add(G3, 'buildingArea', '建築面積（建蔽率）', 'fail', `建築面積約占農地 ${pct(bSqm / landSqm, 1)}，超過 ${pct(cov)}。`, 'maxCoverage');

    const fSqm = areaToSqm(a.floorArea, a.floorAreaUnit || 'ping');
    const maxFloorPing = th('maxFloorAreaPing' + sfx);
    if (!zone) add(G3, 'floorArea', '總樓地板面積', 'check', '尚未選擇是否位於都市計畫區，總樓地板面積上限不同。');
    else if (fSqm == null) add(G3, 'floorArea', '總樓地板面積', 'check', `尚未填寫，${zoneName}總樓地板面積上限為 ${maxFloorPing} 坪。`, 'maxFloorAreaPing' + sfx);
    else if (fSqm <= maxFloorPing * SQM_PER_PING + 1e-6) add(G3, 'floorArea', '總樓地板面積', 'pass', `約 ${fmt(fSqm / SQM_PER_PING)} 坪，未超過${zoneName}上限 ${maxFloorPing} 坪。`, 'maxFloorAreaPing' + sfx);
    else add(G3, 'floorArea', '總樓地板面積', 'fail', `約 ${fmt(fSqm / SQM_PER_PING)} 坪，超過${zoneName}上限 ${maxFloorPing} 坪。`, 'maxFloorAreaPing' + sfx);

    const floors = toNumber(a.floors), height = toNumber(a.height);
    const maxF = th('maxFloors' + sfx), maxH = th('maxHeight' + sfx);
    if (!zone) add(G3, 'height', '樓層與高度', 'check', '尚未選擇是否位於都市計畫區，樓層與高度上限不同。');
    else if (floors == null && height == null) add(G3, 'height', '樓層與高度', 'check', `尚未填寫，${zoneName}原則上最高 ${maxF} 層、${maxH} 公尺。`, 'maxHeight' + sfx);
    else {
      const over = (floors != null && floors > maxF) || (height != null && height > maxH);
      const missing = floors == null || height == null;
      const desc = `${floors != null ? floors + ' 層' : '樓層未填'}、${height != null ? height + ' 公尺' : '高度未填'}`;
      if (over) add(G3, 'height', '樓層與高度', 'fail', `預計 ${desc}，超過${zoneName}上限 ${maxF} 層、${maxH} 公尺。`, 'maxHeight' + sfx);
      else if (missing) add(G3, 'height', '樓層與高度', 'check', `預計 ${desc}，請補齊另一項；上限 ${maxF} 層、${maxH} 公尺。`, 'maxHeight' + sfx);
      else add(G3, 'height', '樓層與高度', 'pass', `預計 ${desc}，未超過${zoneName}上限 ${maxF} 層、${maxH} 公尺。`, 'maxHeight' + sfx);
    }
    if (zone === 'urban') add(G3, 'urbanSetback', '與都市計畫道路距離', 'check', `依原始整理資料，都市計畫區農舍需與都市計畫道路保持 ${th('urbanRoadSetback') || '一定'} 公尺以上距離，需向主管機關確認。`);

    const counts = { pass: 0, check: 0, fail: 0 };
    for (const it of items) counts[it.result]++;
    const overall = counts.fail ? 'fail' : counts.check ? 'check' : 'pass';
    return { overall, label: RESULT_LABEL[overall], items, counts, disclaimer: DISCLAIMER };
  }

  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('en-US'); }
  function pct(r, d) { const p = Math.pow(10, d || 0); return Math.round(r * 100 * p) / p + '%'; }

  // ---------- 物件介紹四大性質 ----------
  /** 欄位定義：group 為 basic／use 使用性／func 機能性／build 建設性／future 未來性／extra */
  const PITCH_GROUPS = [
    { id: 'basic', title: '基本資料', desc: '案名、類型、價格、坪數' },
    { id: 'use', title: '使用性', desc: '物件本身的空間與使用狀況' },
    { id: 'func', title: '機能性', desc: '周邊現有的生活機能' },
    { id: 'build', title: '建設性', desc: '區域目前的建設與交通' },
    { id: 'future', title: '未來性', desc: '區域未來的發展潛力' },
    { id: 'extra', title: '結尾與聯絡', desc: '亮點、行動呼籲、聯絡方式' },
  ];
  const PITCH_FIELDS = [
    { id: 'title', group: 'basic', label: '案名／標題', placeholder: '例：○○路採光三房（示範）', core: true },
    { id: 'kind', group: 'basic', label: '類型', placeholder: '例：電梯大樓／透天／公寓／土地' },
    { id: 'price', group: 'basic', label: '總價', placeholder: '例：1,288 萬', core: true },
    { id: 'size', group: 'basic', label: '坪數', placeholder: '例：權狀 35 坪、室內約 24 坪', core: true },
    { id: 'layout', group: 'use', label: '格局', placeholder: '例：3 房 2 廳 2 衛＋平面車位', core: true },
    { id: 'fit', group: 'use', label: '適合對象', placeholder: '例：小家庭、首購、想換大一點的空間' },
    { id: 'condition', group: 'use', label: '屋況與使用特色', placeholder: '例：前後陽台、邊間採光、屋況整理過' },
    { id: 'landUse', group: 'use', label: '土地／使用分區', placeholder: '例：住宅區（以謄本及使用分區證明為準）' },
    { id: 'life', group: 'func', label: '生活機能', placeholder: '例：步行約 5 分鐘有超市、傳統市場', core: true },
    { id: 'school', group: 'func', label: '學區與公共設施', placeholder: '例：鄰近國小、公園、圖書館' },
    { id: 'service', group: 'func', label: '醫療與公家機關', placeholder: '例：診所、郵局、派出所' },
    { id: 'traffic', group: 'build', label: '交通', placeholder: '例：開車約 5 分鐘上快速道路、近火車站', core: true },
    { id: 'construction', group: 'build', label: '區域現有或進行中建設', placeholder: '例：周邊新社區陸續完工、道路拓寬中' },
    { id: 'plan', group: 'future', label: '未來規劃', placeholder: '例：鄰近規劃中的產業園區（以政府公告為準）', core: true },
    { id: 'trend', group: 'future', label: '長期發展與增值理由', placeholder: '例：就業人口增加、新住宅需求' },
    { id: 'highlight', group: 'extra', label: '一句話亮點', placeholder: '例：同價位少見的邊間三房' },
    { id: 'cta', group: 'extra', label: '行動呼籲', placeholder: '例：歡迎預約看屋，假日也可帶看' },
    { id: 'contact', group: 'extra', label: '聯絡方式', placeholder: '例：○先生 0900-000-123' },
  ];
  const PITCH_FORMATS = [
    { id: 'line', title: 'LINE 短版' },
    { id: 'fb', title: 'FB／社群長版' },
    { id: 'showing', title: '帶看說明條列' },
  ];
  const PITCH_FOOTER = '以上資訊原則上以現況、權狀及相關文件為準。';

  function cleanFields(fields) {
    const f = {};
    for (const d of PITCH_FIELDS) f[d.id] = str(fields && fields[d.id]).replace(/\s*\n\s*/g, '；');
    return f;
  }

  /** 完整度：全部欄位與核心欄位分開算，另附各性質是否有填 */
  function pitchCompleteness(fields) {
    const f = cleanFields(fields);
    const filled = PITCH_FIELDS.filter(d => f[d.id]);
    const core = PITCH_FIELDS.filter(d => d.core);
    const coreFilled = core.filter(d => f[d.id]);
    const groups = {};
    for (const g of PITCH_GROUPS) {
      const ds = PITCH_FIELDS.filter(d => d.group === g.id);
      groups[g.id] = { total: ds.length, filled: ds.filter(d => f[d.id]).length };
    }
    const missingCore = core.filter(d => !f[d.id]).map(d => d.label);
    return {
      filled: filled.length, total: PITCH_FIELDS.length,
      percent: Math.round((filled.length / PITCH_FIELDS.length) * 100),
      corePercent: Math.round((coreFilled.length / core.length) * 100),
      groups, missingCore,
    };
  }

  function shorten(s, n) {
    const chars = Array.from(s);
    return chars.length > n ? chars.slice(0, n - 1).join('') + '…' : s;
  }
  const join = (arr, sep) => arr.filter(Boolean).join(sep);

  /**
   * 產生物件介紹文。空欄位整行略過；全部空白回傳空字串。
   * @param {object} fields
   * @param {'line'|'fb'|'showing'} format
   */
  function generatePitch(fields, format) {
    const f = cleanFields(fields);
    if (!PITCH_FIELDS.some(d => f[d.id])) return '';
    const lines = [];
    const head = join([f.kind, f.price, f.size], '｜');

    if (format === 'line') {
      const S = s => shorten(s, 40);
      if (f.title) lines.push(`【${S(f.title)}】`);
      if (head) lines.push(head);
      if (f.highlight) lines.push(S(f.highlight));
      const use = join([f.layout, f.fit && '適合' + f.fit.replace(/^適合/, '')], '，');
      if (use) lines.push('・格局：' + S(use));
      if (f.life) lines.push('・生活：' + S(f.life));
      const build = join([f.traffic, f.construction], '；');
      if (build) lines.push('・交通建設：' + S(build));
      if (f.plan) lines.push('・未來：' + S(f.plan));
      if (f.cta) lines.push(S(f.cta));
      if (f.contact) lines.push('聯絡：' + f.contact);
      lines.push(PITCH_FOOTER);
      return lines.join('\n');
    }

    if (format === 'showing') {
      lines.push('帶看說明' + (f.title ? '｜' + f.title : ''));
      if (head) lines.push(head);
      const block = (title, ids) => {
        const rows = ids.filter(id => f[id]).map(id => `- ${labelOf(id)}：${f[id]}`);
        if (rows.length) { lines.push(''); lines.push(`■ ${title}`); lines.push(...rows); }
      };
      block('使用性（進門先講）', ['layout', 'condition', 'fit', 'landUse']);
      block('機能性（走到窗邊或門口講）', ['life', 'school', 'service']);
      block('建設性（回程路上講）', ['traffic', 'construction']);
      block('未來性（坐下來收尾講）', ['plan', 'trend']);
      if (f.highlight) { lines.push(''); lines.push('■ 一句話記住它'); lines.push('- ' + f.highlight); }
      lines.push('');
      lines.push('■ 帶看前自我提醒');
      lines.push('- 坪數、分區、建設進度等資訊，帶看前再核對謄本與公告');
      lines.push('- 未來建設請說「規劃中」，避免保證時程或漲幅');
      lines.push('');
      lines.push(PITCH_FOOTER);
      return lines.join('\n');
    }

    // fb（預設）
    if (f.title) lines.push(`【${f.title}】`);
    if (f.highlight) lines.push(f.highlight);
    if (head) lines.push(head);
    const sec = (title, ids, lead) => {
      const rows = ids.filter(id => f[id]).map(id => `・${labelOf(id)}：${f[id]}`);
      if (rows.length) { lines.push(''); lines.push(`▍${title}`); if (lead) lines.push(lead); lines.push(...rows); }
    };
    sec('使用性｜住起來怎麼樣', ['layout', 'fit', 'condition', 'landUse']);
    sec('機能性｜生活方不方便', ['life', 'school', 'service']);
    sec('建設性｜交通與周邊建設', ['traffic', 'construction']);
    sec('未來性｜區域發展潛力', ['plan', 'trend'], '（建設時程原則上以政府公告為準）');
    if (f.cta || f.contact) {
      lines.push('');
      if (f.cta) lines.push(f.cta);
      if (f.contact) lines.push('聯絡：' + f.contact);
    }
    lines.push('');
    lines.push(PITCH_FOOTER);
    return lines.join('\n');
  }

  function labelOf(id) {
    const d = PITCH_FIELDS.find(x => x.id === id);
    return d ? d.label : id;
  }

  /** 驗證物件介紹草稿匯入（只收已知欄位的文字） */
  function validatePitchDraft(obj) {
    if (!isObj(obj) || !isObj(obj.fields)) return null;
    const out = {};
    for (const d of PITCH_FIELDS) {
      const v = obj.fields[d.id];
      if (typeof v === 'string') out[d.id] = v.slice(0, MAX_NOTE_CHARS);
    }
    return out;
  }

  return {
    escapeHTML, toNumber,
    STATUSES, STATUS_LABEL, allItems, sectionProgress, overallProgress, issueSummary, validateImport, exportState,
    RESULT_LABEL, DISCLAIMER, SQM_PER_PING, areaToSqm, evaluateFarmhouse,
    PITCH_GROUPS, PITCH_FIELDS, PITCH_FORMATS, PITCH_FOOTER, pitchCompleteness, generatePitch, validatePitchDraft,
  };
});

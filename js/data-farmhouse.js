/*
 * 農舍興建資格自我檢查 設定檔（門檻值都在這裡）
 *
 * 法規改了怎麼改：
 *  1. 改 thresholds 裡的 value。
 *  2. certain：true 代表維護者已對照現行條文；false 代表「不確定／可能已修正」，
 *     判斷引擎遇到 certain:false 的門檻不會說「可能不符合」，只會說「需要再確認」。
 *  3. 更新 lawVersion 與 lastChecked。
 *
 * 本檔門檻整理自一份《農業用地興建農舍辦法》懶人包（非條文原文），未逐條對照最新條文；
 * 原則上請以地方主管機關（縣市政府）審查為準。
 */
window.FARMHOUSE_RULES = {
  schema: 'tw-realestate-checklists/farmhouse',
  title: '農舍興建資格自我檢查',
  lawName: '《農業發展條例》、《農業用地興建農舍辦法》',
  lawVersion: '依公開懶人包整理，尚未逐條對照最新條文',
  lastChecked: '2026-10-20',
  thresholds: {
    minAge: { value: 20, unit: '歲', certain: false, note: '原始資料為年滿 20 歲或未滿 20 歲已婚；民法成年年齡已調整，相關規定是否同步修正需向主管機關確認' },
    sameCounty: { value: true, certain: true, note: '戶籍與農地在同一直轄市或縣市' },
    householdYears: { value: 2, unit: '年', certain: true, note: '設籍滿 2 年' },
    isOwner: { value: true, certain: true, note: '申請人為農地所有權人' },
    noOtherFarmhouse: { value: true, certain: true, note: '申請人名下無其他農舍' },
    landHeldYears: { value: 2, unit: '年', certain: true, note: '取得農地滿 2 年' },
    oldLandCutoff: { value: '2000-01-28', certain: false, note: '此日期前取得農地者適用不同規定，需檢附證明並向主管機關確認' },
    minLandAreaHa: { value: 0.25, unit: '公頃', certain: true, note: '一般農舍農地面積需大於 0.25 公頃（約 756.25 坪）' },
    farmUse: { value: true, certain: true, note: '農地確供農業使用' },
    farmingRecordYears: { value: 2, unit: '年', certain: false, note: '原始資料寫需提交過去 2 年農業經營實績佐證' },
    farmingRecord: { value: true, certain: false, note: '所需文件種類依各縣市規定' },
    onePerLand: { value: true, certain: true, note: '一筆農地只能興建一戶農舍' },
    maxCoverage: { value: 0.10, unit: '比例', certain: true, note: '建築面積不得超過農地面積 10%' },
    maxFloorAreaPingNonUrban: { value: 150, unit: '坪', certain: true, note: '非都市計畫區總樓地板面積上限' },
    maxFloorsNonUrban: { value: 3, unit: '層', certain: true, note: '非都市計畫區樓層上限' },
    maxHeightNonUrban: { value: 10.5, unit: '公尺', certain: true, note: '非都市計畫區高度上限' },
    maxFloorAreaPingUrban: { value: 200, unit: '坪', certain: false, note: '都市計畫區數值取自原始整理資料，各地都市計畫可能另有規定' },
    maxFloorsUrban: { value: 4, unit: '層', certain: false, note: '都市計畫區數值取自原始整理資料' },
    maxHeightUrban: { value: 14, unit: '公尺', certain: false, note: '都市計畫區數值取自原始整理資料，各地都市計畫可能另有規定' },
    urbanRoadSetback: { value: 8, unit: '公尺', certain: false, note: '取自原始整理資料' },
    cluster: { value: null, certain: false, note: '集村農舍（多戶聯合申請）規定不同，本工具不判斷' },
  },

  /** 問卷題目；id 對應 js/core.js evaluateFarmhouse 讀取的答案欄位 */
  groups: [
    { id: 'person', title: '一、申請人資格' },
    { id: 'land', title: '二、土地條件' },
    { id: 'build', title: '三、預計興建的規模' },
  ],
  questions: [
    { id: 'isFarmer', group: 'person', type: 'yesno', label: '你具備農民資格嗎？', help: '例如有農保、全民健保第三類（農民）身分，或農業經營計畫經縣市政府審查通過。' },
    { id: 'age', group: 'person', type: 'number', unit: '歲', label: '申請人年齡' },
    { id: 'married', group: 'person', type: 'yesno', label: '已婚嗎？', help: '只有未達年齡門檻時才會用到。' },
    { id: 'sameCounty', group: 'person', type: 'yesno', label: '戶籍和農地在同一個縣市嗎？' },
    { id: 'householdYears', group: 'person', type: 'number', unit: '年', label: '在該縣市設籍幾年？' },
    { id: 'isOwner', group: 'person', type: 'yesno', label: '申請人是這筆農地的所有權人嗎？' },
    { id: 'hasOtherFarmhouse', group: 'person', type: 'yesno', label: '申請人名下已經有其他農舍嗎？' },

    { id: 'farmhouseType', group: 'land', type: 'select', label: '想蓋哪一種農舍？', options: [['single', '一般（個別）農舍'], ['cluster', '集村農舍（多戶聯合申請）']] },
    { id: 'acquiredBeforeCutoff', group: 'land', type: 'yesno', label: '農地是在 2000 年 1 月 28 日以前取得的嗎？', help: '此日期前取得的農地適用不同規定，需另外確認。' },
    { id: 'landHeldYears', group: 'land', type: 'number', unit: '年', label: '取得這筆農地幾年？' },
    { id: 'landArea', group: 'land', type: 'area', unitField: 'landAreaUnit', units: [['sqm', '平方公尺'], ['ha', '公頃'], ['ping', '坪']], label: '農地面積（以謄本為準）' },
    { id: 'farmUse', group: 'land', type: 'yesno', label: '農地目前確實作農業使用嗎？' },
    { id: 'farmingRecord', group: 'land', type: 'yesno', label: '有近幾年的農業經營實績佐證文件嗎？', help: '例如產銷證明、資材購買單據等，依各縣市要求準備。' },
    { id: 'landHasFarmhouse', group: 'land', type: 'yesno', label: '這筆農地上已經蓋過農舍嗎？' },

    { id: 'zone', group: 'build', type: 'select', label: '農地位在哪裡？', options: [['nonUrban', '非都市計畫區'], ['urban', '都市計畫區']] },
    { id: 'buildingArea', group: 'build', type: 'area', unitField: 'buildingAreaUnit', units: [['ping', '坪'], ['sqm', '平方公尺']], label: '預計建築面積（一樓投影）' },
    { id: 'floorArea', group: 'build', type: 'area', unitField: 'floorAreaUnit', units: [['ping', '坪'], ['sqm', '平方公尺']], label: '預計總樓地板面積（各層加總）' },
    { id: 'floors', group: 'build', type: 'number', unit: '層', label: '預計樓層數' },
    { id: 'height', group: 'build', type: 'number', unit: '公尺', label: '預計建築高度' },
  ],

  /** 結果頁一併提醒（取自原始資料，原則上以主管機關公告為準） */
  reminders: [
    '農舍原則上應供農民自用，不得出租作非農業用途，也原則上不得作為民宿（特定區域經許可者除外）。',
    '農舍與農地原則上須併同移轉，不能單獨買賣；取得使用執照後一定年限內有買賣限制。',
    '山坡地需辦理水土保持；坡度較陡的土地可能限建或禁建。',
    '污廢水排放需符合放流水標準；排入灌溉渠道等需取得同意。',
    '農地若未確供農業使用，原則上可能被追繳已減免的稅賦。',
  ],
};

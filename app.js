'use strict';
/* 人生上市 — 單機試玩版。
   資料存取集中在 Store（目前用 localStorage），之後換成雲端資料庫即可多人連線。 */

const KEY = 'lifeipo-v6';
const CAP = 15000;        // 每日營收上限（防灌水）
const LIMIT = 0.10;       // 漲跌停
const FLOOR = 1;          // 股價下限
const SHARES = 1000000;   // 發行股數（1,000 張）
const LOT = 1000;         // 交易單位：1 張 = 1,000 股
const FOUNDER = 500000;   // 創辦人持股（500 張，不可交易）
const MAXHOLD = 100000;   // 價格衝擊基準：每買賣 100 張，價格推動約 6%
const START_CASH = 1000000;

// 申報項目。id、金額、科目必須和資料庫的 action_def 一致（伺服器以資料庫為準）
const ACTIONS = [
  { id: 'run', n: '運動', a: 3000, c: 'rev' },
  { id: 'read', n: '讀書進修', a: 2500, c: 'rev' },
  { id: 'work', n: '發表作品', a: 4000, c: 'rev' },
  { id: 'save', n: '存錢', a: 2000, c: 'rev' },
  { id: 'sleep', n: '早睡', a: 1500, c: 'rev' },
  { id: 'cook', n: '自己煮飯', a: 1500, c: 'rev' },
  { id: 'clean', n: '打掃房間', a: 1200, c: 'rev' },
  { id: 'water', n: '喝水兩千毫升', a: 800, c: 'rev' },
  { id: 'family', n: '陪家人', a: 2000, c: 'rev' },
  { id: 'ontime', n: '準時下班', a: 1800, c: 'rev' },
  { id: 'todo', n: '清掉一件拖很久的事', a: 2200, c: 'rev' },
  { id: 'early', n: '早起沒賴床', a: 1500, c: 'rev' },
  { id: 'late', n: '熬夜', a: -2000, c: 'cogs' },
  { id: 'skipmeal', n: '沒吃正餐', a: -1200, c: 'cogs' },
  { id: 'overwork', n: '加班到很晚', a: -1500, c: 'cogs' },
  { id: 'coffee', n: '第三杯咖啡', a: -600, c: 'cogs' },
  { id: 'spend', n: '亂花錢', a: -3000, c: 'opex' },
  { id: 'delay', n: '拖延', a: -1500, c: 'opex' },
  { id: 'scroll', n: '滑手機三小時', a: -1800, c: 'opex' },
  { id: 'drink', n: '手搖飲第二杯', a: -800, c: 'opex' },
  { id: 'takeout', n: '外送宵夜', a: -1200, c: 'opex' },
  { id: 'impulse', n: '衝動下單', a: -2500, c: 'opex' },
  { id: 'gacha', n: '抽卡沒中', a: -2000, c: 'opex' },
  { id: 'meeting', n: '開了沒結論的會', a: -1000, c: 'opex' },
  { id: 'invoice', n: '發票中獎', a: 1000, c: 'nonop' },
  { id: 'gift', n: '收到禮物', a: 1500, c: 'nonop' },
  { id: 'treat', n: '被請客', a: 800, c: 'nonop' },
  { id: 'praise', n: '被稱讚', a: 1200, c: 'nonop' },
  { id: 'fight', n: '跟人吵架', a: -1500, c: 'nonop' },
  { id: 'sick', n: '感冒', a: -1000, c: 'nonop' },
  { id: 'lost', n: '東西弄丟', a: -1200, c: 'nonop' },
  { id: 'rain', n: '沒帶傘淋雨', a: -500, c: 'nonop' },
];
const INDUSTRY_GROUPS = [
  ['正經產業', ['半導體業', '金融保險業', '航運業', '生技醫療業', '電子零組件業', '光電業', '通信網路業', '資訊服務業', '建材營造業', '鋼鐵工業', '塑膠工業', '紡織纖維業', '食品工業', '汽車工業', '觀光餐旅業', '貿易百貨業', '綠能環保業', '文化創意業', '數位雲端業', '運動休閒業']],
  ['身心靈', ['療癒服務業', '塔羅占卜業', '星座命理業', '冥想放空業', '睡眠產業', '情緒勞動業', '心靈雞湯製造業', '自我懷疑業', '內耗產業', '躺平產業']],
  ['感情', ['戀愛腦產業', '暈船產業', '單身貴族業', '曖昧不明業', '已讀不回業', '遠距離物流業', '備胎倉儲業', '月老媒合業', '失戀重整業', '婚姻合夥事業']],
  ['職場', ['社畜代工業', '加班製造業', '摸魚養殖業', '會議馬拉松業', '簡報美化業', '離職預備業', '斜槓多角化經營', '自由接案業', '老闆情緒管理業', '午休經濟']],
  ['學生', ['期末爆肝業', '死線衝刺業', '翹課觀光業', '報告拼裝業', '社團經營業', '考研重考業', '打工換宿業', '學貸金融業']],
  ['吃喝', ['宵夜產業', '手搖飲品業', '咖啡因依賴業', '吃到飽產業', '減肥失敗業', '火鍋外交業', '便當選擇困難業', '美食探店業']],
  ['生活', ['拖延症候群產業', '熬夜產業', '賴床產業', '月光族金融業', '網購包裹物流業', '斷捨離失敗業', '健身房捐款業', '迷路導航業', '選擇障礙顧問業', '碎念製造業']],
  ['興趣', ['追星應援業', '動漫宅經濟', '電競熬夜業', '追劇馬拉松業', '韓流進口業', '露營裝備軍備業', '演唱會搶票業', '盲盒抽卡業', '迷因製造業', '貓奴服務業', '狗派遛狗業', '植物殺手園藝業']],
  ['家庭', ['育兒永動機產業', '家事外包業', '長輩圖出口業', '親戚問候應對業', '孝親費金融業', '神隊友產業', '豬隊友產業']],
  ['其他', ['不明產業', '神秘事業', '宇宙無敵綜合業', '其他']],
];
const INDUSTRIES = INDUSTRY_GROUPS.flatMap(g => g[1]);
// 重大訊息範本：g 分組、k 事件、t 公司口吻的公告文字
const EVENTS = [
  { g: '經營階層', k: '換工作', t: '本公司董事會決議變更主要營業項目，自下月起由新事業體貢獻營收。' },
  { g: '經營階層', k: '升遷', t: '本公司公告經營階層異動，董事長兼任更高職務，薪酬委員會已追認。' },
  { g: '經營階層', k: '加薪', t: '本公司上修全年財測，主要係核心業務獲利能力提升所致。' },
  { g: '經營階層', k: '離職', t: '本公司公告與最大客戶終止合作關係，目前積極開發新客源，對財務業務無重大影響。' },
  { g: '經營階層', k: '被裁員', t: '本公司公告主要產線停工，管理階層將於近期召開重大訊息說明記者會。' },
  { g: '經營階層', k: '開始創業', t: '本公司董事會通過設立子公司，持股比例百分之百，資金來源為自有資金。' },
  { g: '策略聯盟', k: '脫單', t: '本公司宣布與重要夥伴簽署策略聯盟意向書，預期對未來營運有正面助益。' },
  { g: '策略聯盟', k: '分手', t: '本公司董事會決議終止策略聯盟，原合作關係即日起解除，營運不受影響。' },
  { g: '策略聯盟', k: '結婚', t: '本公司公告與策略夥伴完成合併，合併基準日為今日，存續公司名稱不變。' },
  { g: '策略聯盟', k: '曖昧中', t: '針對媒體報導本公司洽談合作一事，本公司不評論市場傳聞，一切以公告為準。' },
  { g: '策略聯盟', k: '被已讀不回', t: '本公司公告重要訂單遞延，客戶尚未回覆，出貨時程待確認。' },
  { g: '策略聯盟', k: '復合', t: '本公司公告與前策略夥伴重啟合作，雙方已就過往爭議達成和解。' },
  { g: '資產與資金', k: '買房', t: '本公司公告取得不動產，交易金額達實收資本額百分之二十以上，資金來源為銀行借款。' },
  { g: '資產與資金', k: '買車', t: '本公司公告取得運輸設備，以提升營運效率。' },
  { g: '資產與資金', k: '搬家', t: '本公司公告營運總部遷移，新址已完成啟用。' },
  { g: '資產與資金', k: '借錢給朋友', t: '本公司公告資金貸與他人，對象為關係人，董事會已決議通過。' },
  { g: '資產與資金', k: '幫朋友作保', t: '本公司公告為他人背書保證，保證餘額未逾公司規定之限額。' },
  { g: '資產與資金', k: '中獎', t: '本公司公告認列一次性業外收益，對本期損益有重大影響。' },
  { g: '資產與資金', k: '錢包不見', t: '本公司公告發生資產減損，損失金額尚在評估中。' },
  { g: '營運狀況', k: '生病', t: '本公司公告產線進行歲修，預計短期內恢復正常產能。' },
  { g: '營運狀況', k: '失眠', t: '本公司夜間產線異常運轉，產能利用率下滑，管理階層已著手改善。' },
  { g: '營運狀況', k: '減肥成功', t: '本公司公告完成組織瘦身，營業費用率顯著下降。' },
  { g: '營運狀況', k: '考試通過', t: '本公司公告取得重要認證，有助於拓展新市場。' },
  { g: '營運狀況', k: '開始健身', t: '本公司公告資本支出計畫，將投入設備升級以提升長期競爭力。' },
  { g: '營運狀況', k: '放長假', t: '本公司公告暫停營運數日，復工日期另行公告。' },
  { g: '營運狀況', k: '養寵物', t: '本公司公告新增轉投資事業，預期短期內持續認列虧損，長期效益無法估計。' },
  { g: '澄清與說明', k: '被誤會', t: '針對媒體報導之內容，本公司澄清並無此事，特此說明。' },
  { g: '澄清與說明', k: '跟家人吵架', t: '本公司公告董事會成員意見分歧，議案保留至下次會議再議。' },
  { g: '澄清與說明', k: '道歉', t: '本公司對近期事件造成股東困擾深表歉意，已提出改善計畫。' },
  { g: '澄清與說明', k: '召開法說會', t: '本公司訂於今晚召開法人說明會，說明近期營運概況，歡迎各位股東參加。' },
  { g: '澄清與說明', k: '自訂', t: '' },
];
const BOTS = [
  ['8888', '錢途無亮控股', '月光族金融業', '小安', '每月五號入帳、六號歸零。董事會對前途保持樂觀，對錢途不予置評。'],
  ['0520', '暈船航運', '暈船產業', '佳佳', '對方回一個貼圖就啟航，目前已連續三季擱淺。'],
  ['1314', '一生一柿水果行', '戀愛腦產業', '阿哲', '承諾一生一世，目前只賣柿子，保存期限七天。'],
  ['5277', '胃什麼餐飲集團', '宵夜產業', '阿凱', '深夜常自問為什麼又吃了，胃表示沒有意見。'],
  ['8787', '薪酸實業', '社畜代工業', '陳課長', '主要產品為加班與嘆氣，原料是每月的薪水單。'],
  ['9453', '就是無薪人力派遣', '自由接案業', '小林', '代號九四五三，公司名稱已說明一切。'],
  ['3838', '肝苦人文創', '死線衝刺業', '設計師 Mia', '甘苦談不完，肝先撐不住，交稿前一晚產能全開。'],
  ['6666', '遛遛大順寵物物流', '狗派遛狗業', '柴柴爸', '每日兩趟固定航線，颱風天照常出勤，客戶會搖尾巴。'],
];

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('zh-TW');
// 股數轉成張數顯示；不是整張時保留兩位小數
const lots = sh => sh % 1000 ? (sh / 1000).toFixed(3).replace(/0+$/, '') : fmt(sh / 1000);
// 還在輔導期或申購期的公司不能買賣、不計入大盤；上市前五個交易日（蜜月期）不設漲跌幅限制
const isListed = co => !co.status || co.status === 'listed';
const isHoney = co => (co.honey || 0) >= S.day;
const p2 = n => Number(n).toFixed(2);
const r2 = n => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const chgOf = co => (co.price - co.prev) / co.prev;
const cls = v => v > 0.00001 ? 'up' : v < -0.00001 ? 'dn' : 'flat';
const pct = v => (v > 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
const limitTag = v => v >= LIMIT - 0.0006 ? '<span class="tag lim">漲停</span>' : v <= -LIMIT + 0.0006 ? '<span class="tag limd">跌停</span>' : '';

/* ---------- 資料層 ---------- */
const Store = {
  load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
  save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 無痕模式等情況：照常運作，只是不保存 */ } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { } },
};

let S;
let tab = 'market';

function seed() {
  const s = { day: 1, lastDate: todayStr(), cash: START_CASH, my: null, cos: {}, hold: {}, news: [], bots: [], trades: [], watch: [], chat: [], feedback: [] };
  for (const [code, name, ind, owner, intro] of BOTS) {
    let p = r2(rnd(6, 24)); const hist = [];
    for (let i = 0; i < 12; i++) { hist.push(p); p = Math.max(FLOOR, r2(p * (1 + rnd(-0.06, 0.06)))); }
    const prev = hist[hist.length - 1];
    s.cos[code] = { code, name, ind, owner, intro, bot: true, price: p, prev, hist: hist.concat(p), flow: 0, today: [], days: [], weeks: [], ann: [], ticks: [], k: fakeK(hist, 0) };
    s.bots.push({ name: owner, code, base: Math.round(rnd(850000, 1150000)) });
  }
  s.idxPrev = 1000; s.idxK = [];
  { let v = 1000; const cs = Object.values(s.cos);
    for (let i = cs[0].k.length - 1; i >= 0; i--) {
      const so = cs.reduce((t, c) => t + c.k[i].o, 0), sc = cs.reduce((t, c) => t + c.k[i].c, 0), o = r2(v * so / sc);
      s.idxK.unshift({ d: cs[0].k[i].d, o, c: v, h: Math.max(o, v), l: Math.min(o, v), v: cs.reduce((t, c) => t + c.k[i].v, 0) }); v = o;
    } }
  s.news.push({ d: 1, t: '人生證券交易所今日開市，歡迎各位董事長掛牌上市。' });
  return s;
}

// 上市前的示範 K 線：由收盤價序列補出高低價與成交量
function fakeK(closes, lastDay) {
  const k = [];
  for (let i = 1; i < closes.length; i++) {
    const o = closes[i - 1], c = closes[i];
    k.push({ d: lastDay - (closes.length - 1 - i), o, c, h: r2(Math.max(o, c) * (1 + Math.random() * 0.012)), l: r2(Math.min(o, c) * (1 - Math.random() * 0.012)), v: (20 + Math.floor(Math.random() * 80)) * 10000 });
  }
  return k;
}
// 大盤指數：把所有公司的逐筆成交依時間重播，算出指數的分時走勢
function allTicks() {
  if (CLOUD) return S.allTicks || [];
  const out = [];
  for (const c of Object.values(S.cos)) for (const x of (c._t || c.ticks)) out.push({ t: x.t, p: x.p, v: x.v, s: x.s, code: c.code });
  return out.sort((x, y) => x.t - y.t);
}
function idxCo() {
  const cs = Object.values(S.cos).filter(isListed); let sp = 0, sv = 0; const cur = {};
  for (const c of cs) { sv += c.prev; sp += c.price; cur[c.code] = c.prev; }
  let run = sv; const ticks = [];
  for (const x of allTicks()) {
    if (cur[x.code] == null) continue;
    run += x.p - cur[x.code]; cur[x.code] = x.p;
    ticks.push({ t: x.t, p: r2(S.idxPrev * run / sv), v: x.v, s: x.s });
  }
  return { code: 'IDX', idx: true, name: '人生加權指數', prev: S.idxPrev, price: r2(S.idxPrev * sp / sv), ticks, k: S.idxK || [], ann: [], bot: true };
}
function netWorth() {
  let v = S.cash;
  for (const [c, h] of Object.entries(S.hold)) v += h.sh * S.cos[c].price;
  // 創辦人持股不能賣，不計入總資產（另外顯示市值）
  return v;
}
function todayTotals(co) {
  let rev = 0, exp = 0;
  for (const e of co.today) { if (e.a > 0) rev += e.a; else exp -= e.a; }
  return { rawRev: rev, rev: Math.min(rev, CAP), exp };
}

/* ---------- 交易 ---------- */
// 成交價含滑價：買進會把價格推高、賣出會壓低，並以推動後的價格成交。
function impactPrice(co, sh) {
  let np = co.price * (1 + sh / MAXHOLD * 0.06);
  if (!isHoney(co)) np = clamp(np, co.prev * (1 - LIMIT), co.prev * (1 + LIMIT));
  return Math.max(FLOOR, r2(np));
}
// 費用比照台股：手續費 0.1425%（買賣都收）、證交稅 0.3%（賣出才收），無條件捨去到元
const FEE = 0.001425, TAX = 0.003;
const feeOf = a => Math.floor(a * FEE), taxOf = a => Math.floor(a * TAX);
function trade(code, sh) {
  const co = S.cos[code];
  if (!co || !Number.isInteger(sh) || sh === 0) return '請輸入股數';
  if (code === S.my) return '不能買賣自己公司的股票';
  const h = S.hold[code] || { sh: 0, cost: 0 };
  if (sh > 0 && h.sh + sh > MAXHOLD) return `單一公司最多持有 ${fmt(MAXHOLD)} 股`;
  if (sh < 0 && h.sh + sh < 0) return '庫存不足（不開放放空）';
  const px = impactPrice(co, sh), n = Math.abs(sh), amt = px * n, fee = feeOf(amt), tax = sh < 0 ? taxOf(amt) : 0;
  if (sh > 0 && amt + fee > S.cash) return '現金不足（含手續費）';
  const real = sh < 0 ? (px - h.cost) * n - fee - tax : null;
  S.cash += sh > 0 ? -(amt + fee) : amt - fee - tax;
  if (sh > 0) h.cost = (h.cost * h.sh + px * sh) / (h.sh + sh);
  h.sh += sh;
  if (h.sh === 0) delete S.hold[code]; else S.hold[code] = h;
  co.price = px; co.flow += sh; co.vol = (co.vol || 0) + n;
  co.ticks.push({ t: Date.now(), p: px, v: n, s: sh > 0 ? 1 : -1 });
  S.trades.unshift({ t: Date.now(), code, side: sh > 0 ? 1 : -1, sh: n, px, fee, tax, real, d: S.day });
  S.trades = S.trades.slice(0, 100);
  Store.save(S);
  return null;
}


/* ---------- 收盤結算 ---------- */
function settle() {
  const d = S.day; const moves = [];
  for (const co of Object.values(S.cos)) {
    let rev, exp, perf;
    if (co.bot) {
      rev = Math.round(rnd(0, CAP) / 500) * 500; exp = Math.round(rnd(0, 7000) / 500) * 500;
      perf = clamp((rev - exp) / CAP, -1, 1) * 0.04;
    } else {
      const t = todayTotals(co); rev = t.rev; exp = t.exp;
      perf = co.today.length ? clamp((rev - exp) / CAP, -1, 1) * 0.04 : -0.01; // 未申報營收小扣
    }
    const noise = rnd(-0.015, 0.015);
    const heat = co.bot ? rnd(-0.02, 0.02) : perf * 0.5 + rnd(-0.008, 0.012); // 其他股東的買賣熱度
    let np = co.price * (1 + perf + noise + heat);
    np = clamp(np, co.prev * (1 - LIMIT), co.prev * (1 + LIMIT));
    np = Math.max(FLOOR, r2(np));
    const chg = (np - co.prev) / co.prev;
    co.days.push({ d, rev, exp, close: np, chg, open: co.prev });
    const ps = co.ticks.map(x => x.p).concat(co.prev, np);
    co.k.push({ d, o: co.prev, c: np, h: Math.max(...ps), l: Math.min(...ps), v: co.ticks.reduce((a, x) => a + x.v, 0) });
    if (co.k.length > 40) co.k.shift();
    co._t = co.ticks; co.ticks = []; co.vol = 0;
    co.hist.push(np); if (co.hist.length > 30) co.hist.shift();
    co.prev = np; co.price = np; co.flow = 0;
    if (!co.bot) { // 累計本月各科目，月結時用
      const tt = todayTotals(co), ma = co.macc || { cogs: 0, opex: 0, nonop: 0, nonpos: 0 };
      ma.cogs += tt.cogs; ma.opex += tt.opex; ma.nonop += tt.nonop;
      ma.nonpos += co.today.filter(e => catOf(e) === 'nonop' && e.a > 0).reduce((s, e) => s + e.a, 0); co.macc = ma;
    }
    co.today = [];
    moves.push({ co, chg });
    if (co.bot && Math.random() < 0.12) {
      const ev = EVENTS[Math.floor(Math.random() * (EVENTS.length - 1))];
      const a = { d, t: ev.t }; co.ann.unshift(a);
      S.news.unshift({ d, ann: true, t: `【重大訊息】${co.name}（${co.code}）：${ev.t}` });
    }
  }
  { const ix = idxCo(), cs = Object.values(S.cos), so = cs.reduce((t, c) => t + c.k[c.k.length - 1].o, 0), sc = cs.reduce((t, c) => t + c.k[c.k.length - 1].c, 0);
    const nv = r2(S.idxPrev * sc / so), st = todayStats(ix);
    S.idxK.push({ d, o: S.idxPrev, c: nv, h: Math.max(st.h, nv), l: Math.min(st.l, nv), v: cs.reduce((t, c) => t + c.k[c.k.length - 1].v, 0) });
    if (S.idxK.length > 40) S.idxK.shift(); S.idxPrev = nv; for (const c of cs) delete c._t; }
  moves.sort((a, b) => b.chg - a.chg);
  const top = moves[0], bot = moves[moves.length - 1];
  for (const m of moves) {
    if (m.chg >= LIMIT - 0.0006) S.news.unshift({ d, t: `${m.co.name}（${m.co.code}）亮燈漲停，股東笑開懷` });
    else if (m.chg <= -LIMIT + 0.0006) S.news.unshift({ d, t: `${m.co.name}（${m.co.code}）跌停鎖死，董事長緊急出面喊話` });
  }
  if (top.chg > 0 && top.chg < LIMIT - 0.0006) S.news.unshift({ d, t: `${top.co.name}（${top.co.code}）收漲 ${pct(top.chg)}，登上今日漲幅王` });
  if (bot.chg < 0 && bot.chg > -LIMIT + 0.0006) S.news.unshift({ d, t: `${bot.co.name}（${bot.co.code}）下跌 ${(-bot.chg * 100).toFixed(2)}%，法人建議觀望` });

  if (d % 5 === 0) weekly(d);
  for (const b of S.bots) b.base = Math.round(b.base * (1 + rnd(-0.02, 0.022)));
  S.news = S.news.slice(0, 80);
  S.day++;
}
function weekly(d) {
  const w = d / 5; let divTotal = 0;
  for (const co of Object.values(S.cos)) {
    const l = co.days.slice(-5);
    const rev = l.reduce((s, x) => s + x.rev, 0), exp = l.reduce((s, x) => s + x.exp, 0), net = rev - exp;
    const eps = net / SHARES;
    const last = co.weeks[co.weeks.length - 1];
    const growth = last && last.rev > 0 ? (rev - last.rev) / last.rev : null;
    const open = l[0].open, close = l[l.length - 1].close;
    const div = r2(Math.max(0, eps) * 0.05);
    co.weeks.push({ w, rev, exp, net, eps, growth, wchg: (close - open) / open, div, close });
    const mine = (S.hold[co.code] ? S.hold[co.code].sh : 0) + (co.code === S.my ? FOUNDER : 0);
    divTotal += mine * div;
  }
  S.cash += divTotal;
  S.news.unshift({ d, t: `第 ${w} 週財報出爐，各公司同步配發股利${divTotal > 0 ? `，你共領到 ${fmt(divTotal)} 元` : ''}` });
}
function closeMarket(n) {
  for (let i = 0; i < n; i++) settle();
  S.lastDate = todayStr(); Store.save(S);
}

/* ---------- 畫面 ---------- */
function spark(hist, c, big) {
  const w = big ? 500 : 64, h = big ? 120 : 26, pad = 3;
  const mn = Math.min(...hist), mx = Math.max(...hist), span = mx - mn || 1;
  const pts = hist.map((v, i) => `${(pad + i * (w - pad * 2) / Math.max(1, hist.length - 1)).toFixed(1)},${(h - pad - (v - mn) / span * (h - pad * 2)).toFixed(1)}`).join(' ');
  const col = c === 'up' ? 'var(--up)' : c === 'dn' ? 'var(--dn)' : 'var(--flat)';
  return `<svg class="${big ? 'chart' : 'spark'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${big ? 2.5 : 1.8}" vector-effect="non-scaling-stroke"/></svg>`;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200);
}

const arrow = v => v > 0.00001 ? '▲' : v < -0.00001 ? '▼' : '－';
const apct = v => (Math.abs(v) * 100).toFixed(2) + '%';
const hhmmss = t => new Date(t).toLocaleTimeString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' });
// 交易時段（台北時間）：日盤 09:00–13:30、夜盤 20:00–23:00。試玩版不限時段。
const tpeMin = t => { const z = new Date(t + 8 * 3600e3); return z.getUTCHours() * 60 + z.getUTCMinutes() + z.getUTCSeconds() / 60; };
const HOURS = '日盤 09:00–13:30、夜盤 20:00–23:00';
function marketState() {
  if (!CLOUD) return { open: true, label: '試玩不限時段' };
  const m = tpeMin(Date.now());
  if (m >= 540 && m < 810) return { open: true, label: '日盤交易中' };
  if (m >= 1200 && m < 1380) return { open: true, label: '夜盤交易中' };
  return { open: false, label: m >= 810 && m < 1200 ? '休市・20:00 開夜盤' : '休市・09:00 開日盤' };
}
const limCls = v => v >= LIMIT - 0.0006 ? 'lim' : v <= -LIMIT + 0.0006 ? 'limd' : '';

function renderTop() {
  $('#top').innerHTML = `<div class="brand"><b>人生上市</b><span>${CLOUD ? esc(nick) : '試玩版'}</span></div>
    <div class="clk"><span class="${marketState().open ? 'mk-on' : 'mk-off'}">${marketState().label}</span><span>第 ${S.day} 交易日 <span id="clock">${hhmmss(Date.now())}</span></span></div>`;
  $('#tabs').innerHTML = [['market', '行情'], ['company', '我的公司'], ['port', '庫存'], ['news', '新聞'], ['rank', '排行']]
    .map(([k, n]) => `<button data-act="tab" data-k="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('');
}

let mTab = 'all', mQuery = '', pTab = 'hold', pending = null;
const lastPx = {};
function coRow(co) {
  const c = chgOf(co), k = cls(c), was = lastPx[co.code];
  const fl = was != null && was !== co.price ? (co.price > was ? ' fl-up' : ' fl-dn') : '';
  lastPx[co.code] = co.price;
  return `<button class="qr${fl}" data-act="open" data-code="${esc(co.code)}">
    <span class="qn"><b>${S.watch.includes(co.code) ? '<i class="yl">★</i>' : ''}${esc(co.name)}</b><small>人${esc(co.code)}${co.code === S.my ? '・我的公司' : ''}${co.bot ? '・示範' : ''}${isHoney(co) ? '・蜜月期' : ''}${S.hold[co.code] ? '・持有' : ''}${mTab === 'vol' ? '・量 ' + lots(co.vol || 0) + ' 張' : ''}</small></span>
    <span class="${k} ${limCls(c)}"><b>${p2(co.price)}</b></span><span class="${k}">${arrow(c)}${p2(Math.abs(co.price - co.prev))}</span><span class="${k}">${apct(c)}</span></button>`;
}
function marketList() {
  let l = Object.values(S.cos); const qy = mQuery.trim().toLowerCase();
  if (qy) l = l.filter(c => c.code.includes(qy) || c.name.toLowerCase().includes(qy));
  if (mTab === 'watch') l = l.filter(c => S.watch.includes(c.code));
  if (mTab === 'dn') l.sort((a, b) => chgOf(a) - chgOf(b));
  else if (mTab === 'vol') l.sort((a, b) => (b.vol || 0) - (a.vol || 0));
  else l.sort((a, b) => chgOf(b) - chgOf(a));
  if (l.length) return l.map(coRow).join('');
  return `<p class="note">${mTab === 'watch' && !qy ? '還沒有自選股。到個股頁右上角按 ☆ 就能加入。' : '找不到符合的公司。'}</p>`;
}
function vMarket() {
  const all = Object.values(S.cos); let up = 0, dn = 0;
  for (const c of all) { const g = chgOf(c); if (g > 0.00001) up++; else if (g < -0.00001) dn++; }
  const n = all.length, ix = idxCo(), ic = chgOf(ix), k = cls(ic), news = S.news[0];
  return `<button class="idx" data-act="open" data-code="IDX"><div class="idx-main"><small><span>人生加權指數</span><i>看大盤走勢 ›</i></small>
      <div><b class="${k}">${p2(ix.price)}</b><span class="${k}">${arrow(ic)}${p2(Math.abs(ix.price - ix.prev))}（${apct(ic)}）</span></div>
      ${spark(ix.k.slice(-14).map(x => x.c).concat(ix.price), k)}</div>
    <div class="cnt"><span class="up">漲 ${up}</span><span class="dn">跌 ${dn}</span><span class="flat">平 ${n - up - dn}</span><span class="mute">成交量 <b class="yl">${lots(all.reduce((a, c) => a + (c.vol || 0), 0))}</b> 張</span></div></button>
    ${news ? `<button class="flash" data-act="tab" data-k="news"><b>快訊</b><span>${esc(news.t)}</span></button>` : ''}
    <div class="mbar"><input id="mq" type="search" placeholder="搜尋代號或名稱" value="${esc(mQuery)}" aria-label="搜尋公司"></div>
    <div class="seg">${[['all', '漲幅'], ['dn', '跌幅'], ['vol', '成交量'], ['watch', '自選']].map(([id, t]) => `<button data-act="mtab" data-id="${id}" class="${mTab === id ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="qt"><div class="qh"><span>商品</span><span>成交</span><span>漲跌</span><span>幅度</span></div><div id="qtList">${marketList()}</div></div>
    <p class="note">${CLOUD ? '交易時間：' + HOURS + '，23:00 收盤結算。' : '試玩版：其他公司為模擬玩家，不限交易時段。'}</p>
    ${CLOUD ? '' : '<div class="gap"></div><div style="padding:0 14px"><button class="btn wide" data-act="close">收盤，進入下一個交易日</button></div>'}`;
}


function vCompany() {
  if (!S.my) return `<div class="card"><h2>申請上市（IPO）</h2>
    <p class="note">發行 ${fmt(SHARES)} 股，掛牌價 10 元，你持有 ${fmt(FOUNDER)} 股創辦人持股。</p>
    <label for="fName">公司名稱</label><input id="fName" maxlength="20" placeholder="例如：小恩療癒股份有限公司"><p class="note">請勿使用真實企業或品牌名稱，也不要用他人姓名取名。</p>
    <label for="fCode">股票代號（四碼數字）</label><input id="fCode" maxlength="4" inputmode="numeric" placeholder="例如生日 0706">
    <label for="fInd">產業類別</label><select id="fInd">${INDUSTRY_GROUPS.map(([g, l]) => `<optgroup label="${g}">${l.map(i => `<option>${i}</option>`).join('')}</optgroup>`).join('')}</select>
    <label for="fIntro">公司簡介與營業項目</label><textarea id="fIntro" maxlength="120" placeholder="本公司主要從事…"></textarea>
    <div class="gap"></div><button class="btn pri wide" data-act="ipo">敲鐘上市</button></div>`;
  const co = S.cos[S.my], c = chgOf(co), k = cls(c), t = todayTotals(co);
  const on = id => co.today.some(e => e.id === id);
  const weeks = co.weeks.slice().reverse();
  return `<div class="card"><h2>${esc(co.name)} <small>人${esc(co.code)}・${esc(co.ind)}</small></h2>
      <div class="big ${k}">${p2(co.price)} <small style="font-size:15px">${pct(c)}</small>${limitTag(c)}</div>
      ${spark(co.hist, k, true)}<p class="note">${esc(co.intro)}</p></div>
    <div class="card"><h2>今日營收申報 <small>收盤時結算</small></h2>
      <div class="grid2">${ACTIONS.map(a => `<button class="btn chk ${a.a > 0 ? 'rev' : 'exp'} ${on(a.id) ? 'on' : ''}" data-act="chk" data-id="${a.id}" aria-pressed="${on(a.id)}"><span>${a.n}</span><small class="${a.a > 0 ? 'up' : 'dn'}">${a.a > 0 ? '+' : ''}${fmt(a.a)}</small></button>`).join('')}</div>
      ${co.today.filter(e => e.custom).map(e => `<div class="kv"><span>${esc(e.n)}</span><span class="${e.a > 0 ? 'up' : 'dn'}">${e.a > 0 ? '+' : ''}${fmt(e.a)} <button class="btn" style="padding:2px 8px" data-act="delc" data-id="${e.id}" aria-label="刪除">×</button></span></div>`).join('')}
      <details><summary>新增自訂項目</summary><label for="cName">項目名稱與金額</label>
      <div style="display:flex;gap:8px"><input id="cName" maxlength="16" placeholder="項目名稱"><input id="cAmt" type="number" min="1" max="5000" placeholder="金額" style="width:96px"><select id="cType" style="width:84px" aria-label="類型"><option value="1">營收</option><option value="-1">支出</option></select></div>
      <div class="gap"></div><button class="btn wide" data-act="addc">新增（單筆上限 5,000）</button></details>
      <div class="gap"></div>
      <div class="kv"><span>營業收入</span><span class="up">${fmt(t.rev)}${t.rawRev > CAP ? '（已達上限）' : ''}</span></div>
      <div class="kv"><span>營業支出</span><span class="dn">${fmt(t.exp)}</span></div>
      <div class="kv"><span>今日淨利</span><b class="${cls(t.rev - t.exp)}">${fmt(t.rev - t.exp)}</b></div>
      <div class="bar" title="每日營收上限"><i style="width:${Math.min(100, t.rawRev / CAP * 100)}%"></i></div>
      <p class="note">每日營收上限 ${fmt(CAP)}。當天完全沒申報，股價會小跌。</p></div>
    <div class="card"><h2>重大訊息</h2><p class="note">用公司的口吻公告你的人生大事，會出現在所有人的新聞頁和你的個股頁。每天最多 3 則。</p><label for="evK">事件</label><select id="evK" data-act="evsel">${EVENTS.map((e, i) => `<option value="${i}">${e.k}</option>`).join('')}</select>
      <label for="evT">公告內容</label><textarea id="evT" maxlength="140">${esc(EVENTS[0].t)}</textarea>
      <div class="gap"></div><button class="btn pri wide" data-act="ann">發布公告</button>
      ${co.ann.slice(0, 3).map(a => `<div class="news ann"><small>第 ${a.d} 交易日</small>${esc(a.t)}</div>`).join('')}</div>
    <div class="card"><h2>財報 <small>每 5 個交易日一期</small></h2>
      ${weeks.length ? weeks.map(w => `<div class="news"><small>第 ${w.w} 週</small>
        <div class="kv"><span>營業收入</span><span>${fmt(w.rev)}</span></div>
        <div class="kv"><span>稅後淨利</span><span class="${cls(w.net)}">${fmt(w.net)}</span></div>
        <div class="kv"><span>EPS</span><span class="${cls(w.eps)}">${p2(w.eps)}</span></div>
        <div class="gap"></div><button class="btn wide" data-act="card" data-w="${w.w}">下載財報卡片</button></div>`).join('')
      : `<p class="note">還沒有財報。距離第一份週財報還有 ${5 - ((S.day - 1) % 5)} 個交易日。</p>`}</div>`;
}

function vPort() {
  const rows = Object.entries(S.hold); let mv = 0, cost = 0;
  for (const [c, h] of rows) { mv += h.sh * S.cos[c].price; cost += h.sh * h.cost; }
  const my = S.my ? S.cos[S.my] : null, fv = my ? founderShares(my) * my.price : 0, un = mv - cost;
  const real = S.trades.reduce((a, x) => a + (x.real || 0), 0), fees = S.trades.reduce((a, x) => a + x.fee + x.tax, 0);
  const sg = v => (v > 0 ? '+' : '') + fmt(v);
  const hold = rows.length ? `<div class="pt"><div class="pt-h"><span>商品</span><span>張數／均價</span><span>現價</span><span>損益</span></div>${rows.map(([code, h]) => {
    const co = S.cos[code], pl = (co.price - h.cost) * h.sh, k = cls(pl);
    return `<button data-act="open" data-code="${esc(code)}"><span class="qn"><b>${esc(co.name)}</b><small>人${esc(code)}</small></span>
      <span>${lots(h.sh)}<small>${p2(h.cost)}</small></span><span class="${cls(chgOf(co))}">${p2(co.price)}<small>${arrow(chgOf(co))}${apct(chgOf(co))}</small></span>
      <span class="${k}">${sg(pl)}<small>${(pl >= 0 ? '+' : '-') + apct(pl / (h.cost * h.sh))}</small></span></button>`;
  }).join('')}</div>` : '<p class="note">還沒有庫存。到行情頁挑一檔，開盤時間就能下單。</p>';
  const trades = S.trades.length ? `<div class="tl">${S.trades.slice(0, 50).map(x => {
    const co = S.cos[x.code];
    return `<div><div><b class="${x.side > 0 ? 'up' : 'dn'}">${x.side > 0 ? '買進' : '賣出'}</b> <span class="yl">${co ? esc(co.name) : esc(x.code)}</span><small>${hhmmss(x.t)}・第 ${x.d} 交易日</small></div>
      <div>${lots(x.sh)} 張 @ ${p2(x.px)}<small>費 ${fmt(x.fee)}${x.tax ? '・稅 ' + fmt(x.tax) : ''}${x.real == null ? '' : `・<span class="${cls(x.real)}">損益 ${sg(x.real)}</span>`}</small></div></div>`;
  }).join('')}</div>` : '<p class="note">還沒有成交紀錄。</p>';
  return `<div class="acct"><small>總資產</small><b>${fmt(netWorth())}</b>
      <div class="acct-g">
        <span>可用現金<b>${fmt(S.cash)}</b></span><span>股票市值<b>${fmt(mv)}</b></span>
        <span>未實現損益<b class="${cls(un)}">${sg(un)}${cost ? `（${(un >= 0 ? '+' : '-') + apct(un / cost)}）` : ''}</b></span><span>已實現損益<b class="${cls(real)}">${sg(real)}</b></span>
        ${my ? `<span>創辦人持股市值（閉鎖中的不計入總資產）<b>${fmt(fv)}</b></span>` : ''}<span>累計費稅<b>${fmt(fees)}</b></span>
      </div></div>
    <div class="seg">${[['hold', '庫存'], ['trades', '成交回報']].map(([id, t]) => `<button data-act="ptab" data-id="${id}" class="${pTab === id ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${pTab === 'hold' ? hold : trades}
    <p class="note">手續費 0.1425%、賣出另收證交稅 0.3%。虛擬幣僅供遊戲使用，不能購買、兌換現金或獎品，也不能轉讓。所有公司皆為玩家虛構，與任何真實公司無關，內容不構成投資建議。</p>
    <div style="padding:14px">${CLOUD ? '<button class="btn wide" data-act="logout">登出</button>' : '<button class="btn wide" data-act="reset">重新開始（清除所有資料）</button>'}</div>`;
}


function vNews() {
  return `<div class="card"><h2>即時新聞</h2>${S.news.map(n => `<div class="news ${n.ann ? 'ann' : ''}"><small>第 ${n.d} 交易日</small>${n.ann ? `<b>${esc(n.t)}</b>` : esc(n.t)}</div>`).join('')}</div>`;
}
function vRank() {
  let list = S.rank;
  if (!list) {
    list = S.bots.map(b => ({ name: b.name, bot: true, v: b.base + FOUNDER * S.cos[b.code].price }));
    list.push({ name: '你', me: true, v: netWorth() });
    list.sort((a, b) => b.v - a.v);
  }
  return `<div class="card"><h2>股神排行榜 <small>依總資產</small></h2>${list.map((p, i) => `<div class="kv"><span>${i + 1}. ${p.me ? '<b class="gold">' + esc(p.name) + '</b>' : esc(p.name)}${p.bot ? '<span class="tag">機器人</span>' : ''}</span><span>${fmt(p.v)}</span></div>`).join('')}</div>`;
}
function render() {
  renderTop();
  $('#view').innerHTML = ({ market: vMarket, company: vCompany, port: vPort, news: vNews, rank: vRank })[tab]();
}

/* ---------- 個股頁 ---------- */
let sheetCode = null, spTab = 'time';
function openSheet(code) { sheetCode = code; spTab = 'time'; pending = null; renderSheet(); $('#sheet').hidden = false; $('#sheet').scrollTop = 0; }
function closeSheet() { $('#sheet').hidden = true; sheetCode = null; pending = null; }
// 台北時間今天 00:00 的時間戳
function dayStartMs() { const z = new Date(Date.now() + 8 * 3600e3); return Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate()) - 8 * 3600e3; }
function todayStats(co) {
  const ps = co.ticks.map(x => x.p).concat(co.prev, co.price);
  let vol = 0, amt = 0, bv = 0, sv = 0;
  for (const x of co.ticks) { vol += x.v; amt += x.v * x.p; if (x.s > 0) bv += x.v; else sv += x.v; }
  return { o: co.prev, h: Math.max(...ps), l: Math.min(...ps), vol, avg: vol ? amt / vol : co.price, bv, sv };
}
const CW = 360, CH = 232, CTOP = 10, CPH = 150, CVT = 168, CVH = 40;
let chartPts = [];
const f1 = n => n.toFixed(1);

function chartTime(co) {
  // 縱軸範圍跟著當日波動縮放（最小 ±1.5%，最大到漲跌停 ±10%），小波動才看得清楚
  const dev = Math.max(...co.ticks.map(x => Math.abs(x.p / co.prev - 1)), Math.abs(co.price / co.prev - 1));
  const R = clamp(dev * 1.35, 0.015, isHoney(co) ? 0.9 : LIMIT);
  const st = dayStartMs(), hiL = co.prev * (1 + R), loL = co.prev * (1 - R);
  const X = CLOUD
    ? t => { const m = tpeMin(t); return (m >= 1380 ? 0 : m <= 810 ? clamp(m - 540, 0, 270) : 270 + clamp(m - 1200, 0, 180)) / 450 * CW; }
    : t => clamp((t - st) / 86400e3, 0, 1) * CW;
  const Y = p => CTOP + (hiL - p) / (hiL - loL) * CPH;
  const k = cls(chgOf(co)), col = k === 'up' ? 'var(--up)' : k === 'dn' ? 'var(--dn)' : 'var(--flat)';
  const pts = [[0, co.prev], ...co.ticks.map(x => [X(x.t), x.p]), [X(Date.now()), co.price]];
  const line = pts.map(p => `${f1(p[0])},${f1(Y(p[1]))}`).join(' ');
  const y0 = f1(Y(co.prev)), lastX = f1(pts[pts.length - 1][0]);
  let cum = 0, amt = 0;
  const avg = co.ticks.map(x => { cum += x.v; amt += x.v * x.p; return `${f1(X(x.t))},${f1(Y(amt / cum))}`; }).join(' ');
  const mv = Math.max(1, ...co.ticks.map(x => x.v));
  const bars = co.ticks.map(x => `<line x1="${f1(X(x.t))}" x2="${f1(X(x.t))}" y1="${CVT + CVH}" y2="${f1(CVT + CVH - x.v / mv * CVH)}" stroke="${x.s > 0 ? 'var(--up)' : 'var(--dn)'}" stroke-width="1.5"/>`).join('');
  const grid = [0, .25, .5, .75, 1].map(f => `<line x1="0" x2="${CW}" y1="${CTOP + f * CPH}" y2="${CTOP + f * CPH}" class="g"/>`).join('')
    + (CLOUD ? [.3, .6, .8] : [.25, .5, .75]).map(f => `<line x1="${f * CW}" x2="${f * CW}" y1="${CTOP}" y2="${CVT + CVH}" class="g${CLOUD && f === .6 ? ' gs' : ''}"/>`).join('');
  const lab = [[hiL, 'up', 0], [co.prev * (1 + R / 2), 'up', .25], [co.prev, 'flat', .5], [co.prev * (1 - R / 2), 'dn', .75], [loL, 'dn', 1]]
    .map(([p, c, f]) => `<text x="3" y="${CTOP + f * CPH + (f === 0 ? 10 : f === 1 ? -3 : 4)}" class="tx ${c}">${p2(p)}</text>`).join('');
  const tl = CLOUD ? [['09:00', 0], ['11:15', .3], ['13:30│20:00', .6], ['21:30', .8], ['23:00', 1]] : [['00:00', 0], ['06:00', .25], ['12:00', .5], ['18:00', .75], ['24:00', 1]];
  const times = tl.map(([t, f], i) => `<text x="${i === 0 ? 2 : i === 4 ? CW - 2 : f * CW}" y="${CH - 2}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" class="tx mute">${t}</text>`).join('');
  chartPts = co.ticks.map(x => ({ x: X(x.t), s: `${hhmmss(x.t)}　價 ${p2(x.p)}　${arrow(x.p - co.prev)}${apct(x.p / co.prev - 1)}　量 ${lots(x.v)} 張` }));
  return `<svg class="kchart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="今日分時走勢">${grid}
    <polygon points="0,${y0} ${line} ${lastX},${y0}" fill="${col}" opacity=".14"/>
    <line x1="0" x2="${CW}" y1="${y0}" y2="${y0}" stroke="var(--cyan)" stroke-width=".7" stroke-dasharray="3 3"/>
    ${avg ? `<polyline points="${avg}" fill="none" stroke="var(--mute)" stroke-width="1"/>` : ''}
    <polyline points="${line}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="${lastX}" cy="${f1(Y(co.price))}" r="2.6" fill="${col}"/>${bars}${lab}${times}<line id="xhl" y1="${CTOP}" y2="${CVT + CVH}" class="xh" visibility="hidden"/></svg>`;
}

function chartK(co) {
  const t = todayStats(co), N = 30, cw = CW / N;
  const ks = co.k.slice(-(N - 1)).concat({ d: S.day, o: t.o, h: t.h, l: t.l, c: co.price, v: t.vol });
  const hi = Math.max(...ks.map(x => x.h)), lo = Math.min(...ks.map(x => x.l)), sp = hi - lo || 1;
  const Y = p => CTOP + (hi - p) / sp * CPH, mv = Math.max(1, ...ks.map(x => x.v)), off = N - ks.length;
  const cx = i => (off + i + .5) * cw;
  const body = ks.map((x, i) => {
    const col = x.c >= x.o ? 'var(--up)' : 'var(--dn)', y1 = Y(Math.max(x.o, x.c)), hg = Math.max(1, Math.abs(Y(x.o) - Y(x.c)));
    return `<line x1="${f1(cx(i))}" x2="${f1(cx(i))}" y1="${f1(Y(x.h))}" y2="${f1(Y(x.l))}" stroke="${col}"/>
      <rect x="${f1(cx(i) - cw * .32)}" y="${f1(y1)}" width="${f1(cw * .64)}" height="${f1(hg)}" fill="${col}"/>
      <rect x="${f1(cx(i) - cw * .32)}" y="${f1(CVT + CVH - x.v / mv * CVH)}" width="${f1(cw * .64)}" height="${f1(x.v / mv * CVH)}" fill="${col}" opacity=".7"/>`;
  }).join('');
  const ma = ks.map((x, i) => i < 4 ? null : `${f1(cx(i))},${f1(Y(ks.slice(i - 4, i + 1).reduce((a, y) => a + y.c, 0) / 5))}`).filter(Boolean).join(' ');
  const grid = [0, .5, 1].map(f => `<line x1="0" x2="${CW}" y1="${CTOP + f * CPH}" y2="${CTOP + f * CPH}" class="g"/>`).join('');
  chartPts = ks.map((x, i) => ({ x: cx(i), s: `${x.d === S.day ? '今日' : x.d > 0 ? '第' + x.d + '日' : '上市前'}　開 ${p2(x.o)}　高 ${p2(x.h)}　低 ${p2(x.l)}　收 ${p2(x.c)}　量 ${lots(x.v)} 張` }));
  return `<svg class="kchart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="日 K 線">${grid}${body}
    ${ma ? `<polyline points="${ma}" fill="none" stroke="var(--yellow)" stroke-width="1"/>` : ''}
    <text x="3" y="${CTOP + 10}" class="tx flat">${p2(hi)}</text><text x="3" y="${CTOP + CPH - 3}" class="tx flat">${p2(lo)}</text>
    <text x="${f1(cx(0))}" y="${CH - 2}" text-anchor="middle" class="tx mute">${ks[0].d > 0 ? '第' + ks[0].d + '日' : '上市前'}</text>
    <text x="${CW - 2}" y="${CH - 2}" text-anchor="end" class="tx mute">今日</text>
    ${ma ? `<text x="${CW - 3}" y="${CTOP + 10}" text-anchor="end" class="tx" fill="var(--yellow)">5 日均線</text>` : ''}<line id="xhl" y1="${CTOP}" y2="${CVT + CVH}" class="xh" visibility="hidden"/></svg>`;
}

function tickRows(co, n) {
  const rows = co.ticks.slice(-n).reverse();
  if (!rows.length) return '<p class="note sp-pad">今天還沒有成交。</p>';
  return `<div class="tk"><div class="tk-h"><span>時間</span><span>成交價</span><span>張數</span><span>買賣</span></div>${rows.map(x =>
    `<div><span class="mute">${hhmmss(x.t)}</span><span class="${cls(x.p - co.prev)}">${p2(x.p)}</span><span>${lots(x.v)}</span><span class="${x.s > 0 ? 'up' : 'dn'}">${x.s > 0 ? '買' : '賣'}</span></div>`).join('')}</div>`;
}

function orderBox(co) {
  const { sign, q, unit } = pending, sh = unit === 'sh' ? q : q * LOT, px = impactPrice(co, sign * sh), amt = px * sh, fee = feeOf(amt), tax = sign < 0 ? taxOf(amt) : 0;
  return `<div class="sp-trade ord"><b class="${sign > 0 ? 'up' : 'dn'}">委託確認・現股${sign > 0 ? '買進' : '賣出'}</b>
    <div class="kv"><span>商品</span><span>${esc(co.name)} 人${esc(co.code)}</span></div>
    <div class="kv"><span>數量</span><span>${unit === 'sh' ? fmt(sh) + ' 股（零股）' : fmt(q) + ' 張（' + fmt(sh) + ' 股）'}</span></div>
    <div class="kv"><span>預估成交價（市價）</span><span>${p2(px)}</span></div>
    <div class="kv"><span>成交金額</span><span>${fmt(amt)}</span></div>
    <div class="kv"><span>手續費 0.1425%</span><span>${fmt(fee)}</span></div>
    ${sign < 0 ? `<div class="kv"><span>證交稅 0.3%</span><span>${fmt(tax)}</span></div>` : ''}
    <div class="kv"><span>${sign > 0 ? '預估應付' : '預估應收'}</span><b class="${sign > 0 ? 'up' : 'dn'}">${fmt(sign > 0 ? amt + fee : amt - fee - tax)}</b></div>
    <p class="note">市價單會立即成交，實際成交價以送出當下為準。</p>
    <div class="grid2"><button class="btn" data-act="ordCancel">取消</button><button class="btn ${sign > 0 ? 'pri' : 'sell'}" data-act="ordOk">確認送出</button></div></div>`;
}
function renderSheet(qty) {
  const co = sheetCode === 'IDX' ? idxCo() : S.cos[sheetCode], mine = co.code === S.my, h = S.hold[co.code], open = marketState().open;
  const w = !co.idx && S.watch.includes(co.code);
  let box = '';
  if (co.idx) box = '';
  else if (mine) box = '<p class="note sp-pad">這是你自己的公司，不能買賣自家股票。</p>';
  else if (pending) box = orderBox(co);
  else box = `<div class="sp-trade">
      <div class="qtyrow"><label for="qty">股數</label><input id="qty" type="number" min="1" step="1" inputmode="numeric" value="${qty || 100}">${[100, 500, 1000].map(n => `<button class="btn" data-act="setq" data-n="${n}">${n}</button>`).join('')}</div>
      <p class="note" id="est"></p>
      <div class="grid2"><button class="btn pri" data-act="buy" ${open ? '' : 'disabled'}>買進</button><button class="btn sell" data-act="sell" ${h && open ? '' : 'disabled'}>賣出${h ? '（庫存 ' + fmt(h.sh) + '）' : ''}</button></div></div>`;
  $('#sheetBody').innerHTML = `<div class="sp-nav"><button data-act="closeSheet" aria-label="返回">‹</button><b>${co.idx ? '大盤' : '個股資訊'}</b>
      ${co.idx ? '<span></span>' : `<button data-act="watch" class="star${w ? ' on' : ''}" aria-pressed="${w}" aria-label="${w ? '移出自選' : '加入自選'}">${w ? '★' : '☆'}</button>`}</div>
    <div id="spLive"></div>${box}`;
  renderSheetLive();
}

// 只更新報價與圖表，不動下單區，避免打斷輸入
function renderSheetLive() {
  const el = $('#spLive'); if (!el || !sheetCode) return;
  const co = sheetCode === 'IDX' ? idxCo() : S.cos[sheetCode]; if (!co) return;
  if (co.idx && ['ticks', 'info', 'rev', 'fin', 'ops'].includes(spTab)) spTab = 'time';
  const c = chgOf(co), k = cls(c), t = todayStats(co), h = S.hold[co.code], tot = t.bv + t.sv, bp = tot ? Math.round(t.bv / tot * 100) : 50;
  const stats = `<div class="st"><span>開 <b class="flat">${p2(t.o)}</b></span><span>高 <b class="${cls(t.h - co.prev)}">${p2(t.h)}</b></span><span>低 <b class="${cls(t.l - co.prev)}">${p2(t.l)}</b></span><span>總量 <b class="yl">${lots(t.vol)} 張</b></span></div>${co.idx ? '' : `<div class="st"><span>昨收 <b class="flat">${p2(co.prev)}</b></span>${isHoney(co) ? `<span>漲跌幅 <b class="yl">蜜月期不設限（到第 ${co.honey} 交易日）</b></span>` : `<span>漲停 <b class="up">${p2(r2(co.prev * 1.1))}</b></span><span>跌停 <b class="dn">${p2(Math.max(FLOOR, r2(co.prev * 0.9)))}</b></span>`}<span>振幅 <b class="flat">${apct((t.h - t.l) / co.prev)}</b></span></div>`}`;
  let body;
  if (spTab === 'time') body = `<div class="st1"><span class="yl">${hhmmss(Date.now()).slice(0, 5)}</span> 價 <b class="${k}">${p2(co.price)} ${arrow(c)}${p2(Math.abs(co.price - co.prev))}（${apct(c)}）</b> 均 <b class="flat">${p2(t.avg)}</b></div>
    ${chartTime(co)}${stats}
    <div class="ratio" aria-label="買賣力道">${tot ? `<i class="b" style="width:${bp}%">買 ${bp}%</i><i class="s" style="width:${100 - bp}%">賣 ${100 - bp}%</i>` : '<i class="n" style="width:100%">今日尚無成交</i>'}</div>
    ${co.idx ? '' : tickRows(co, 8)}`;
  else if (spTab === 'k') body = `<div class="st1">日 K <span class="mute">每根代表一個交易日，紅漲綠跌</span></div>${chartK(co)}${stats}`;
  else if (spTab === 'parts') chartPts = [], body = `<div class="qt"><div class="qh"><span>成分股</span><span>成交</span><span>漲跌</span><span>幅度</span></div>${Object.values(S.cos).filter(isListed).sort((x, y) => chgOf(y) - chgOf(x)).map(coRow).join('')}</div>`;
  else if (spTab === 'ticks') chartPts = [], body = tickRows(co, 60);
  else if (spTab === 'ops') chartPts = [], body = finOps(co);
  else if (spTab === 'rev') chartPts = [], body = finRev(co);
  else if (spTab === 'fin') chartPts = [], body = finQ(co);
  else body = `<div class="sp-pad">
    ${infoRows(co)}
    <div class="kv"><span>昨收</span><span>${p2(co.prev)}</span></div>
    <div class="kv"><span>漲停／跌停</span><span><span class="up">${p2(r2(co.prev * 1.1))}</span>／<span class="dn">${p2(Math.max(FLOOR, r2(co.prev * 0.9)))}</span></span></div>
    <div class="kv"><span>我的持股</span><span>${h ? `${lots(h.sh)} 張・均價 ${p2(h.cost)}` : '無'}</span></div>
    <p class="note">${esc(co.intro)}</p>
    ${co.bot ? `<p class="note">這是示範公司：董事長是機器人玩家，${CLOUD ? '用自己的帳戶照同樣規則下單' : '試玩版的股價為模擬波動'}，營收由系統模擬。</p>` : ''}
    ${co.ann.slice(0, 5).map(a => `<div class="news ann"><small>重大訊息・第 ${a.d} 交易日</small>${esc(a.t)}</div>`).join('')}
    ${CLOUD && !co.bot && co.code !== S.my ? '<button class="link" data-act="report">檢舉這家公司的名稱或內容</button>' : ''}</div>`;
  el.innerHTML = `<div class="sp-quote"><div class="sp-name"><b>${esc(co.name)}</b><small>${co.idx ? '全體上市公司・基期 1000' : cd(esc(co.code)) + (co.bot ? '・示範公司' : '・玩家公司')}</small></div>
      <b class="sp-px ${k} ${limCls(c)}">${p2(co.price)}</b>
      <div class="sp-chg ${k}"><span>${arrow(c)}${p2(Math.abs(co.price - co.prev))}</span><span>${apct(c)}</span></div></div>
    <div class="sp-tabs">${(co.idx ? [['time', '分時'], ['k', '日K'], ['parts', '成分股']] : [['time', '分時'], ['k', '日K'], ['ticks', '明細'], ['ops', '營運'], ['rev', '營收'], ['fin', '財務'], ['info', '基本資料']]).map(([id, n]) => `<button data-act="sptab" data-id="${id}" class="${spTab === id ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
  updateEst();
}
function updateEst() {
  const el = $('#est'); if (!el) return;
  const co = S.cos[sheetCode], q = parseInt($('#qty').value, 10);
  if (!co) return;
  if (!marketState().open) { el.textContent = '目前休市，可以先看盤。交易時間：' + HOURS; return; }
  if (!(q > 0)) { el.textContent = '請輸入數量'; return; }
  const sh = q * (unitNow() === 'sh' ? 1 : LOT), b = impactPrice(co, sh), s = impactPrice(co, -sh);
  el.textContent = `預估買進 ${p2(b)}（共 ${fmt(b * sh)}）・賣出 ${p2(s)}・可用現金 ${fmt(S.cash)}`;
}

/* ---------- 財報卡片 ---------- */
function reportCard(w) {
  const co = S.cos[S.my], r = co.weeks.find(x => x.w === w); if (!r) return;
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  const x = cv.getContext('2d'), F = '"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif';
  const UP = '#ff4d4f', DN = '#22c17a', col = v => v > 0 ? UP : v < 0 ? DN : '#e8edf3';
  x.fillStyle = '#0b0f14'; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = '#141a22'; x.fillRect(60, 60, 960, 1230);
  x.strokeStyle = '#263140'; x.lineWidth = 2; x.strokeRect(60, 60, 960, 1230);
  x.fillStyle = '#f5c542'; x.font = `600 34px ${F}`; x.fillText(`人生上市・第 ${r.w} 週財務報告`, 110, 150);
  x.fillStyle = '#e8edf3'; let size = 68; x.font = `700 ${size}px ${F}`;
  while (x.measureText(co.name).width > 860 && size > 30) { size -= 4; x.font = `700 ${size}px ${F}`; }
  x.fillText(co.name, 110, 260);
  x.fillStyle = '#8593a5'; x.font = `32px ${F}`; x.fillText(`${co.code}・${co.ind}`, 110, 320);
  x.fillStyle = col(r.wchg); x.font = `700 120px ${F}`; x.fillText(p2(r.close), 110, 490);
  x.font = `600 44px ${F}`; x.fillText(`週漲跌 ${pct(r.wchg)}`, 110, 560);
  const rows = [['營業收入', fmt(r.rev), '#e8edf3'], ['營業支出', fmt(r.exp), '#e8edf3'], ['稅後淨利', fmt(r.net), col(r.net)],
    ['每股盈餘 EPS', p2(r.eps), col(r.eps)], ['營收週增率', r.growth == null ? '—' : pct(r.growth), r.growth == null ? '#e8edf3' : col(r.growth)], ['每股股利', p2(r.div), '#f5c542']];
  let y = 690;
  for (const [k, v, c] of rows) {
    x.fillStyle = '#8593a5'; x.font = `36px ${F}`; x.textAlign = 'left'; x.fillText(k, 110, y);
    x.fillStyle = c; x.font = `600 44px ${F}`; x.textAlign = 'right'; x.fillText(v, 970, y);
    x.strokeStyle = '#263140'; x.beginPath(); x.moveTo(110, y + 28); x.lineTo(970, y + 28); x.stroke(); y += 92;
  }
  x.textAlign = 'left'; x.fillStyle = '#8593a5'; x.font = `26px ${F}`;
  x.fillText('本報告為遊戲內容，數字皆為虛擬，非投資建議。', 110, 1250);
  const a = document.createElement('a'); a.download = `人生上市_${co.code}_第${r.w}週財報.png`; a.href = cv.toDataURL('image/png'); a.click();
  toast('財報卡片已下載');
}


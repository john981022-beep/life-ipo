'use strict';
/* 人生上市 — 連線、登入與操作事件。
   config.js 沒填 = 單機試玩（Local）；填了 Supabase = 多人連線（Cloud）。 */

const CFG = window.LIFEIPO_CONFIG || {};
const CLOUD = !!(CFG.url && CFG.key);
let sb = null, uid = null, nick = '';

/* ---------- 內容把關（伺服器端也會再檢查一次） ---------- */
const BAD_WORDS = ["幹你","幹妳","幹他","幹她","操你","操妳","肏","靠北","靠腰","靠杯","靠夭","他媽的","她媽的","你媽的","妳媽的","你娘","妳娘","機掰","雞掰","機歪","雞歪","雞巴","懶叫","懶覺","屌你","去死","白癡","白痴","智障","腦殘","低能","賤人","賤貨","婊子","臭婊","破麻","北七","垃圾人","王八蛋","畜生","人渣","死全家","做愛","性交","口交","肛交","打炮","約炮","援交","賣淫","嫖","色情","裸照","裸聊","陰莖","陰道","奶子","乳交","自慰","打手槍","強姦","強暴","性侵","迷姦","亂倫","a片","av女優","成人影片","情色","自殺","殺了你","殺死你","砍死你","弄死你","支那","死gay","死同性戀","黑鬼","番仔","死胖子","殘廢","毒品","安非他命","海洛因","k他命","賭博","博弈","娛樂城","百家樂","六合彩","簽賭","運彩代","加line","加賴","加我賴","fuck","shit","bitch","dick","pussy","porn","nigger","asshole"];
const REAL_BRANDS = ['台積', '臺積', '鴻海', '聯發科', '中華電', '富邦', '國泰', '台達電', '大立光', '長榮', '陽明海運', '中信', '玉山金', '兆豐', '統一企業', '統一超', '台塑', '南亞', '中鋼', '華碩', '宏碁', '廣達', '聯電', '日月光', '和碩', '緯創', '蘋果', 'apple', 'google', '谷歌', '微軟', 'microsoft', '特斯拉', 'tesla', '輝達', 'nvidia', 'meta', '亞馬遜', 'amazon', '三星', 'samsung', '索尼', 'sony', '豐田', 'toyota'];
const REAL_CODES = ['0050', '0051', '0052', '0053', '0055', '0056', '0057', '1101', '1216', '1301', '1303', '2002', '2303', '2308', '2317', '2330', '2353', '2357', '2382', '2412', '2454', '2603', '2609', '2615', '2881', '2882', '2884', '2886', '2891', '3008', '3231', '3711', '4938'];
// 比對前先去掉空格、標點與符號，避免用「幹 你」這類寫法繞過
function checkText(t) { const s = String(t).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ''); if (BAD_WORDS.some(w => s.includes(w))) throw new Error('內容包含不允許的字詞，請修改後再試'); }
function checkBrand(t) { const s = String(t).toLowerCase(); if (REAL_BRANDS.some(w => s.includes(w))) throw new Error('公司名稱不能使用真實企業或品牌的名稱'); }

/* ---------- 單機版 ---------- */
const Local = {
  async init() {
    S = Store.load() || seed();
    const diff = Math.round((new Date(todayStr()) - new Date(S.lastDate)) / 86400000);
    if (diff > 0) closeMarket(Math.min(diff, 5)); else Store.save(S);
    // 模擬玩家的盤中波動，讓試玩版也有即時走勢
    setInterval(() => {
      if (document.hidden) return;
      for (const co of Object.values(S.cos)) {
        if (!co.bot || Math.random() > 0.5) continue;
        const np = Math.max(FLOOR, r2(clamp(co.price * (1 + rnd(-0.007, 0.007)), co.prev * (1 - LIMIT), co.prev * (1 + LIMIT))));
        const v = (1 + Math.floor(Math.random() * 9)) * 1000;
        co.ticks.push({ t: Date.now(), p: np, v, s: np >= co.price ? 1 : -1 }); co.vol = (co.vol || 0) + v;
        if (co.ticks.length > 400) co.ticks.shift();
        co.price = np;
      }
      Store.save(S); softRender();
    }, 5000);
  },
  async ipo(o) {
    if (S.cos[o.code]) throw new Error('這個代號已經有公司使用');
    S.cos[o.code] = { code: o.code, name: o.name, ind: o.ind, owner: '你', intro: o.intro || '本公司尚未提供簡介。', bot: false, price: 10, prev: 10, hist: [10], flow: 0, vol: 0, today: [], days: [], weeks: [], ann: [], ticks: [], k: [] };
    S.my = o.code;
    S.news.unshift({ d: S.day, t: `${o.name}（${o.code}）今日以每股 10 元掛牌上市，董事長親自敲鐘` });
    Store.save(S);
  },
  async toggle(id) {
    const co = S.cos[S.my], a = ACTIONS.find(x => x.id === id), i = co.today.findIndex(e => e.id === id);
    if (i >= 0) co.today.splice(i, 1); else co.today.push({ id, n: a.n, a: a.a });
    Store.save(S);
  },
  async addCustom(n, amt, sign) {
    const co = S.cos[S.my];
    if (co.today.filter(e => e.custom).length >= 5) throw new Error('每天最多 5 筆自訂項目');
    co.today.push({ id: 'c' + Date.now(), n, a: amt * sign, custom: true }); Store.save(S);
  },
  async delCustom(id) { const co = S.cos[S.my]; co.today = co.today.filter(e => e.id !== id); Store.save(S); },
  async announce(t) {
    const co = S.cos[S.my];
    if (co.ann.filter(a => a.d === S.day).length >= 3) throw new Error('每天最多發布 3 則重大訊息');
    co.ann.unshift({ d: S.day, t });
    S.news.unshift({ d: S.day, ann: true, t: `【重大訊息】${co.name}（${co.code}）：${t}` }); Store.save(S);
  },
  async trade(code, sh) { const err = trade(code, sh); if (err) throw new Error(err); return S.cos[code].price; },
  async close() { closeMarket(1); },
  async watch(code) { const i = S.watch.indexOf(code); if (i >= 0) S.watch.splice(i, 1); else S.watch.push(code); Store.save(S); },
  async reset() { Store.clear(); S = seed(); Store.save(S); },
};

/* ---------- 連線版 ---------- */
const q = async builder => { const { data, error } = await builder; if (error) throw new Error(error.message); return data; };
const fetchTicks = async (code, day) => (await q(sb.from('ticks').select('price,shares,side,created_at').eq('code', code).eq('day', day).order('id', { ascending: false }).limit(600)))
  .reverse().map(x => ({ t: Date.parse(x.created_at), p: Number(x.price), v: x.shares, s: x.side }));
const fetchAllTicks = async day => (await q(sb.from('ticks').select('code,price,shares,side,created_at').eq('day', day).order('id', { ascending: false }).limit(3000)))
  .reverse().map(x => ({ t: Date.parse(x.created_at), p: Number(x.price), v: x.shares, s: x.side, code: x.code }));
const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message); return data; };
const Cloud = {
  async init() {
    await this.refresh();
    let timer = null;
    const bump = () => { clearTimeout(timer); timer = setTimeout(async () => { try { await Cloud.refresh(); softRender(); } catch (e) { /* 下次操作時會再同步 */ } }, 600); };
    sb.channel('market')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticks' }, bump)
      .subscribe();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) bump(); });
    setInterval(() => { if (!document.hidden) bump(); }, 45000); // 定時同步，也讓示範公司持續有盤中波動
  },
  async refresh() {
    const day = await rpc('ensure_settled');
    const [cos, recs, prof, hold, news, anns, rank, mkt, idays, trs, wl] = await Promise.all([
      q(sb.from('companies').select('*')),
      q(sb.from('day_records').select('code,day,open_px,high_px,low_px,close_px,vol').gte('day', day - 40).order('day')),
      q(sb.from('profiles').select('*').eq('id', uid).single()),
      q(sb.from('holdings').select('*').eq('user_id', uid)),
      q(sb.from('news').select('*').order('id', { ascending: false }).limit(60)),
      q(sb.from('announcements').select('*').order('id', { ascending: false }).limit(80)),
      q(sb.from('leaderboard').select('*').order('net_worth', { ascending: false }).limit(50)),
      q(sb.from('market').select('idx').single()),
      q(sb.from('index_days').select('*').gte('day', day - 40).order('day')),
      q(sb.from('trades').select('*').order('id', { ascending: false }).limit(100)),
      q(sb.from('watchlist').select('code')),
    ]);
    const s = { day, cash: Number(prof.cash), my: null, cos: {}, hold: {}, watch: wl.map(x => x.code),
      trades: trs.map(x => ({ t: Date.parse(x.created_at), code: x.code, side: x.side, sh: x.shares, px: Number(x.price), fee: Number(x.fee), tax: Number(x.tax), real: x.realized == null ? null : Number(x.realized), d: x.day })), idxPrev: Number(mkt.idx), allTicks: (S && S.day === day && S.allTicks) || [],
      idxK: idays.map(r => { const o = Number(r.open_px), c = Number(r.close_px); return { d: r.day, o, c, h: Math.max(o, c), l: Math.min(o, c), v: r.vol }; }),
      news: news.map(n => ({ d: n.day, t: n.body, ann: n.is_ann })),
      rank: rank.map(r => ({ name: r.nickname, v: Number(r.net_worth), me: r.id === uid, bot: r.is_bot })) };
    for (const c of cos) {
      const hide = c.flagged && c.owner !== uid;
      s.cos[c.code] = { code: c.code, name: hide ? '審核中公司' : c.name, ind: c.industry, owner: c.owner_name, flagged: c.flagged,
        intro: hide ? '這家公司遭多人檢舉，名稱與簡介審核中。' : c.intro, bot: c.is_bot, vol: c.vol, status: c.status || 'listed', ipoDay: c.ipo_day, fs: c.founder_shares == null ? null : c.founder_shares, listDay: c.list_day, honey: c.honey_until || 0,
        offer: c.offer_price == null ? null : Number(c.offer_price), ipoEps: c.ipo_eps == null ? null : Number(c.ipo_eps), ipoPe: c.ipo_pe == null ? null : Number(c.ipo_pe),
        price: Number(c.price), prev: Number(c.prev_close), hist: [], today: [], weeks: [], ann: [], ticks: [], k: [] };
      if (c.owner === uid) s.my = c.code;
    }
    for (const r of recs) { const c = s.cos[r.code]; if (!c) continue; c.hist.push(Number(r.close_px)); c.k.push({ d: r.day, o: Number(r.open_px), h: Number(r.high_px), l: Number(r.low_px), c: Number(r.close_px), v: r.vol }); }
    if (sheetCode === 'IDX') s.allTicks = await fetchAllTicks(day);
    else if (sheetCode && s.cos[sheetCode]) s.cos[sheetCode].ticks = await fetchTicks(sheetCode, day);
    for (const c of Object.values(s.cos)) c.hist.push(c.price);
    for (const a of anns) { const c = s.cos[a.code]; if (c && !(c.flagged && c.code !== s.my)) c.ann.push({ d: a.day, t: a.body }); }
    for (const h of hold) s.hold[h.code] = { sh: h.shares, cost: Number(h.cost), tb: h.today_bought || 0 };
    if (s.my) {
      const [ent, weeks] = await Promise.all([
        q(sb.from('entries').select('*').eq('code', s.my).eq('day', day).order('id')),
        q(sb.from('weeks').select('*').eq('code', s.my).order('week')),
      ]);
      s.cos[s.my].today = ent.map(e => ({ id: e.action_id || String(e.id), n: e.label, a: e.amount, custom: !e.action_id }));
      s.cos[s.my].weeks = weeks.map(w => ({ cogs: w.cogs, opex: w.opex, nonop: w.nonop, filed: w.filed, late: w.late, deadline: w.deadline, w: w.week, rev: w.rev, exp: w.expense, net: w.net, eps: Number(w.eps), growth: w.growth == null ? null : Number(w.growth), wchg: Number(w.wchg), div: Number(w.dividend), close: Number(w.close_px) }));
    }
    S = s;
  },
  async ipo(o) { await rpc('ipo', { p_name: o.name, p_code: o.code, p_industry: o.ind, p_intro: o.intro, p_mode: o.mode }); await this.refresh(); },
  async toggle(id) { await rpc('toggle_action', { p_action: id }); await this.refresh(); },
  async addCustom(n, amt, sign) { await rpc('add_custom', { p_label: n, p_amount: amt, p_sign: sign }); await this.refresh(); },
  async delCustom(id) { await rpc('del_custom', { p_id: Number(id) }); await this.refresh(); },
  async announce(t) { await rpc('announce', { p_body: t }); await this.refresh(); },
  async trade(code, sh) { const px = await rpc('trade', { p_code: code, p_shares: sh }); await this.refresh(); return Number(px); },
  async watch(code) { await rpc('toggle_watch', { p_code: code }); await this.refresh(); },
  async report(code, reason) { await rpc('report_company', { p_code: code, p_reason: reason }); },
};
const B = CLOUD ? Cloud : Local;

// 別人的交易推送進來時重畫；使用者正在輸入時只更新數字，不打斷輸入
function softRender() {
  if (sheetCode) { if (sheetCode !== 'IDX' && !S.cos[sheetCode]) return closeSheet(); renderSheetLive(); return; }
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return renderTop();
  render();
}

/* ---------- 登入畫面 ---------- */
const RULES = `<p class="note">遊戲規範：虛擬幣僅供遊戲使用，不能購買、兌換現金或獎品，也不能轉讓。所有公司皆為玩家虛構，與任何真實公司無關，內容不構成投資建議。請勿使用真實企業名稱，或以他人姓名取名攻擊他人。</p>`;
function gate(html) {
  $('#top').innerHTML = '<div class="brand"><b>人生上市</b><span>把自己經營成一家上市公司</span></div>';
  $('#tabs').hidden = true; $('#view').innerHTML = html;
}
function showAuth() {
  gate(`<div class="card"><h2>登入</h2>
    <label for="aEmail">Email</label><input id="aEmail" type="email" autocomplete="email">
    <label for="aPass">密碼（至少 6 碼）</label><input id="aPass" type="password" autocomplete="current-password">
    <div class="gap"></div><div class="grid2"><button class="btn pri" data-act="login">登入</button><button class="btn" data-act="signup">註冊新帳號</button></div>
    <div class="gap"></div>${RULES}<p class="note">註冊即表示你同意以上規範。Email 只用於登入，不會公開。</p></div>`);
}
function showNick() {
  gate(`<div class="card"><h2>取一個暱稱</h2><p class="note">其他玩家會在排行榜和公司頁看到這個名字。</p>
    <label for="aNick">暱稱（最多 12 個字）</label><input id="aNick" maxlength="12">
    <div class="gap"></div><button class="btn pri wide" data-act="join">開始遊戲</button></div>`);
}
async function start() {
  if (CLOUD) {
    if (!window.supabase) return gate('<div class="card"><h2>無法連線</h2><p class="note">連線元件載入失敗，請檢查網路後重新整理。</p></div>');
    if (!sb) sb = window.supabase.createClient(CFG.url, CFG.key);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showAuth();
    uid = session.user.id;
    const prof = await q(sb.from('profiles').select('nickname').eq('id', uid).maybeSingle());
    if (!prof) return showNick();
    nick = prof.nickname;
  }
  await B.init();
  $('#tabs').hidden = false; render();
}

/* ---------- 操作 ---------- */
let busy = false;
async function run(fn) {
  if (busy) return; busy = true;
  try { await fn(); } catch (e) { toast(e && e.message ? e.message : '發生錯誤，請再試一次'); } finally { busy = false; }
}
function askOrder(sign) {
  const qv = parseInt($('#qty').value, 10);
  if (!(qv > 0)) return toast('請輸入數量');
  unitSel = unitNow();
  pending = { sign, q: qv, unit: unitSel }; renderSheet(qv);
}
async function doTrade() {
  const { sign, q: qv, unit } = pending, code = sheetCode;
  try {
    const px = await B.trade(code, qv * (unit === 'sh' ? 1 : LOT) * sign);
    toast(`${sign > 0 ? '買進' : '賣出'}成交：${fmt(qv)} ${unit === 'sh' ? '股' : '張'} @ ${p2(px)}`);
  } finally { pending = null; render(); if (sheetCode === code) renderSheet(qv); }
}
const acts = {
  tab: el => { tab = el.dataset.k; render(); window.scrollTo(0, 0); },
  open: el => { const code = el.dataset.code; openSheet(code); if (CLOUD) run(async () => { if (code === 'IDX') S.allTicks = await fetchAllTicks(S.day); else S.cos[code].ticks = await fetchTicks(code, S.day); if (sheetCode === code) renderSheetLive(); }); },
  sptab: el => { spTab = el.dataset.id; renderSheetLive(); },
  closeSheet,
  card: el => reportCard(Number(el.dataset.w)),
  setq: el => { $('#qty').value = el.dataset.n; updateEst(); },
  close: () => run(async () => { await B.close(); render(); toast(`已收盤，現在是第 ${S.day} 交易日`); }),
  ipo: () => run(async () => {
    const o = { name: $('#fName').value.trim(), code: $('#fCode').value.trim(), ind: $('#fInd').value, intro: $('#fIntro').value.trim(), mode: ($('#fMode') || {}).value || 'direct' };
    if (!o.name) throw new Error('請輸入公司名稱');
    if (!/^\d{4}$/.test(o.code)) throw new Error('股票代號需為四碼數字');
    checkBrand(o.name); checkText(o.name); checkText(o.intro);
    await B.ipo(o); render(); toast(CLOUD && o.mode === 'public' ? '已送件，進入輔導期' : '恭喜掛牌上市');
  }),
  chk: el => run(async () => { await B.toggle(el.dataset.id); render(); }),
  addc: () => run(async () => {
    const n = $('#cName').value.trim(), amt = parseInt($('#cAmt').value, 10), sign = Number($('#cType').value);
    if (!n) throw new Error('請輸入項目名稱');
    if (!(amt > 0 && amt <= 5000)) throw new Error('金額需在 1 到 5,000 之間');
    checkText(n); await B.addCustom(n, amt, sign); render();
  }),
  delc: el => run(async () => { await B.delCustom(el.dataset.id); render(); }),
  ann: () => run(async () => {
    const t = $('#evT').value.trim(); if (!t) throw new Error('請輸入公告內容');
    checkText(t); await B.announce(t); render(); toast('公告已發布');
  }),
  buy: () => askOrder(1),
  sell: () => askOrder(-1),
  ordOk: () => run(doTrade),
  ordCancel: () => { const v = pending && pending.q; pending = null; renderSheet(v); },
  watch: () => run(async () => { const v = parseInt(($('#qty') || {}).value, 10); await B.watch(sheetCode); renderSheet(v > 0 ? v : undefined); render(); }),
  mtab: el => { mTab = el.dataset.id; render(); },
  ptab: el => { pTab = el.dataset.id; render(); },
  report: () => run(async () => {
    if (!confirm('確定要檢舉這家公司的名稱或內容嗎？多人檢舉後會先隱藏並進入審核。')) return;
    await B.report(sheetCode, ''); toast('已送出檢舉，謝謝你的回報');
  }),
  reset: () => run(async () => { if (confirm('確定要清除所有資料並重新開始嗎？此動作無法復原。')) { await B.reset(); tab = 'market'; render(); } }),
  login: () => run(async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $('#aEmail').value.trim(), password: $('#aPass').value });
    if (error) throw new Error('登入失敗，請確認 Email 與密碼');
    await start();
  }),
  signup: () => run(async () => {
    const email = $('#aEmail').value.trim(), password = $('#aPass').value;
    if (!email || password.length < 6) throw new Error('請輸入 Email 與至少 6 碼的密碼');
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw new Error('註冊失敗：' + error.message);
    if (!data.session) return toast('註冊成功，請到信箱點擊確認信後再登入');
    await start();
  }),
  join: () => run(async () => {
    const n = $('#aNick').value.trim(); if (!n) throw new Error('請輸入暱稱');
    checkText(n); await rpc('join_game', { p_nickname: n }); await start();
  }),
  logout: () => run(async () => { await sb.auth.signOut(); location.reload(); }),
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const f = acts[el.dataset.act]; if (f) f(el);
});
document.addEventListener('input', e => {
  if (e.target.id === 'qty') updateEst();
  if (e.target.id === 'mq') { mQuery = e.target.value; $('#qtList').innerHTML = marketList(); }
});
// 十字查價：在走勢圖上移動或按住，顯示最接近那一點的時間、價格、成交量
function crosshair(e) {
  const svg = e.target.closest && e.target.closest('svg.kchart'); if (!svg || !chartPts.length) return;
  const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * CW;
  let best = chartPts[0]; for (const p of chartPts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  const l = svg.querySelector('#xhl'), lab = $('.st1');
  if (l) { l.setAttribute('x1', best.x); l.setAttribute('x2', best.x); l.setAttribute('visibility', 'visible'); }
  if (lab) { lab.textContent = best.s; lab.classList.add('xh-on'); }
}
document.addEventListener('pointermove', crosshair);
document.addEventListener('pointerdown', crosshair);
document.addEventListener('change', e => { if (e.target.id === 'evK') $('#evT').value = EVENTS[Number(e.target.value)].t; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

let lastMk = '';
setInterval(() => {
  const c = $('#clock'); if (!c || !S) return;
  c.textContent = hhmmss(Date.now());
  const l = marketState().label; // 開盤、收盤的瞬間重畫，讓下單鈕跟著開關
  if (lastMk && l !== lastMk) { if (sheetCode) { const v = parseInt(($('#qty') || {}).value, 10); renderSheet(v > 0 ? v : undefined); } renderTop(); }
  lastMk = l;
}, 1000);
// 等所有腳本（含 ext.js 的擴充）都載入後才啟動
document.addEventListener('DOMContentLoaded', () => start().catch(e => gate(`<div class="card"><h2>啟動失敗</h2><p class="note">${esc(e.message || e)}</p></div>`)));
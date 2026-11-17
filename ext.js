'use strict';
/* 人生上市 — 連線擴充：月營收公告、季報、聊天室、客服回報、管理、新聞推播。
   在 main.js 之後載入，把新功能接到既有的 Local／Cloud 後端和操作表上。 */

Object.assign(Local, {
  async fileMonth() { throw new Error('試玩版的月營收會自動公告'); },
  async chatSend(t) { S.chat = (S.chat || []).concat({ name: '你', body: t, t: Date.now(), me: true }).slice(-80); Store.save(S); },
});

{
  const baseRefresh = Cloud.refresh.bind(Cloud), baseInit = Cloud.init.bind(Cloud);
  const mapChat = m => ({ id: m.id, name: m.nickname, body: m.body, t: Date.parse(m.created_at), me: m.user_id === uid });
  Cloud.refresh = async function () {
    const old = S;
    await baseRefresh();
    // 先沿用上一輪的資料，避免新資料抓回來之前畫面短暫缺東西
    if (old) { S.chat = old.chat; S.feedback = old.feedback; S.admin = old.admin; S.newsFeed = old.newsFeed; S.date = old.date; S.ipoApps = old.ipoApps; S.ipoTotals = old.ipoTotals; if (S.my && old.my === S.my && old.cos[S.my]) S.cos[S.my].quarters = old.cos[S.my].quarters; }
    const my = S.my;
    let chat, fb, prof, qs, feed, mkt;
    // 資料庫還沒更新到第 6 版時，這些資料表不存在；略過擴充功能，讓遊戲本體照常運作
    try { [chat, fb, prof, qs, feed, mkt] = await Promise.all([
      q(sb.from('chat').select('*').order('id', { ascending: false }).limit(80)),
      q(sb.from('feedback').select('*').order('id', { ascending: false }).limit(200)),
      q(sb.from('profiles').select('is_admin').eq('id', uid).single()),
      my ? q(sb.from('quarters').select('*').eq('code', my).order('quarter')) : [],
      q(sb.from('news').select('id,body,created_at').order('id', { ascending: false }).limit(40)),
      q(sb.from('market').select('last_date').single()),
    ]); } catch (e) { S.chat = S.chat || []; S.feedback = S.feedback || []; S.extOff = true; return; }
    S.extOff = false;
    S.chat = chat.reverse().map(mapChat);
    S.feedback = fb.map(f => ({ id: f.id, name: f.nickname, kind: f.kind, body: f.body, status: f.status, reply: f.reply, t: Date.parse(f.created_at), mine: f.user_id === uid }));
    S.admin = !!prof.is_admin;
    S.newsFeed = feed.reverse().map(n => ({ id: n.id, body: n.body, t: Date.parse(n.created_at) }));
    S.date = mkt.last_date;  // 目前交易日對應的日曆日期（23:00 換日）
    // 新股申購：只需要還沒掛牌那幾檔的申購紀錄
    const pre = Object.values(S.cos).filter(co => !isListed(co)).map(co => co.code);
    S.ipoApps = {}; S.ipoTotals = {};
    if (pre.length) for (const ap of await q(sb.from('ipo_apps').select('code,user_id,lots,won').in('code', pre))) {
      S.ipoTotals[ap.code] = (S.ipoTotals[ap.code] || 0) + ap.lots;
      if (ap.user_id === uid) S.ipoApps[ap.code] = { lots: ap.lots, won: ap.won };
    }
    if (my && S.cos[my]) S.cos[my].quarters = qs.map(x => ({ q: x.quarter, rev: x.rev, cogs: x.cogs, opex: x.opex, nonop: x.nonop, pretax: x.pretax, tax: x.tax, net: x.net, eps: Number(x.eps), div: Number(x.dividend), close: Number(x.close_px), qchg: Number(x.qchg) }));
    if (S.admin) for (const c of await q(sb.from('companies').select('code,name').eq('flagged', true))) if (S.cos[c.code]) S.cos[c.code].realName = c.name;
  };
  Cloud.init = async function () {
    await baseInit();
    sb.channel('social')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat' }, p => {
        const m = mapChat(p.new);
        if (!(S.chat || []).some(x => x.id === m.id)) S.chat = (S.chat || []).concat(m).slice(-80);
        if (tab === 'chat') updateChat();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, p => {
        // 新聞同時進聊天室，讓大家有話題可以聊
        if (!(S.newsFeed || []).some(x => x.id === p.new.id)) S.newsFeed = (S.newsFeed || []).concat({ id: p.new.id, body: p.new.body, t: Date.parse(p.new.created_at) }).slice(-60);
        if (tab === 'chat') updateChat();
        pushNews(p.new.body);
      })
      .subscribe();
  };
  Cloud.fileMonth = async function () { await rpc('file_month'); await this.refresh(); };
  Cloud.chatSend = async function (t) { await rpc('send_chat', { p_body: t }); await this.refresh(); };
}

function updateChat() { const l = $('#chatList'); if (l) { l.innerHTML = chatRows(); l.scrollTop = l.scrollHeight; } }

/* 新聞推播：頁面開著時在上方跳出標題橫幅；分頁在背景且已允許通知時，另外發系統通知。
   同一時間湧進多則（例如收盤結算）只顯示最新一則並標示則數。 */
let pushTimer = null, pushCount = 0;
function pushNews(body) {
  let el = $('#push');
  if (!el) { el = document.createElement('button'); el.id = 'push'; el.dataset.act = 'tab'; el.dataset.k = 'news'; document.body.appendChild(el); }
  pushCount = el.hidden === false ? pushCount + 1 : 1;
  el.innerHTML = `<b>快訊${pushCount > 1 ? ' ×' + pushCount : ''}</b><span>${nz(body)}</span>`;
  el.hidden = false;
  clearTimeout(pushTimer); pushTimer = setTimeout(() => { el.hidden = true; pushCount = 0; }, 6000);
  try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('人生上市', { body, icon: 'icon.svg', tag: 'lifeipo-news' }); } catch (e) { /* 部分瀏覽器不支援，從頁面內橫幅看即可 */ }
}

Object.assign(acts, {
  file: () => run(async () => { await B.fileMonth(); render(); toast('月營收已公告'); }),
  chatSend: () => run(async () => {
    const el = $('#chatT'), t = el.value.trim(); if (!t) return;
    checkText(t); await B.chatSend(t);
    if (tab === 'chat') { render(); $('#chatT').focus(); }
  }),
  rtab: el => { rTab = el.dataset.id; render(); },
  fbSend: () => run(async () => {
    const body = $('#fbT').value.trim(); if (!body) throw new Error('請描述一下遇到的狀況');
    await rpc('send_feedback', { p_kind: $('#fbK').value, p_body: body });
    await Cloud.refresh(); render(); toast('已收到你的回報，謝謝');
  }),
  fbSave: el => run(async () => {
    const id = el.dataset.id;
    await rpc('admin_feedback', { p_id: Number(id), p_status: $('#fbS' + id).value, p_reply: $('#fbR' + id).value });
    await Cloud.refresh(); render(); toast('已儲存');
  }),
  unflag: el => run(async () => { await rpc('admin_unflag', { p_code: el.dataset.code, p_flag: false }); await Cloud.refresh(); render(); toast('已恢復顯示'); }),
  notifyOn: () => { Notification.requestPermission().then(p => { render(); if (p === 'granted') toast('已開啟新聞推播'); }); },
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'chatT' && !e.isComposing) acts.chatSend(); });

/* 個股頁的營收與財務：打開某一檔時才去抓那家公司的月營收和季報 */
async function loadFin(code) {
  if (!CLOUD || code === 'IDX' || !S.cos[code]) return;
  const [ws, qs] = await Promise.all([
    q(sb.from('weeks').select('*').eq('code', code).order('week')),
    q(sb.from('quarters').select('*').eq('code', code).order('quarter')),
  ]);
  const co = S.cos[code]; if (!co) return;
  if (code !== S.my) co.weeks = ws.map(w => ({ w: w.week, rev: w.rev, cogs: w.cogs, opex: w.opex, nonop: w.nonop, net: w.net, growth: w.growth == null ? null : Number(w.growth), filed: w.filed, late: w.late, deadline: w.deadline }));
  co.quarters = qs.map(x => ({ q: x.quarter, rev: x.rev, cogs: x.cogs, opex: x.opex, nonop: x.nonop, pretax: x.pretax, tax: x.tax, net: x.net, eps: Number(x.eps), div: Number(x.dividend), close: Number(x.close_px), qchg: Number(x.qchg) }));
  co.finLoaded = true;
}
{
  const baseOpen = acts.open, baseRefresh2 = Cloud.refresh.bind(Cloud);
  acts.open = el => {
    baseOpen(el);
    const code = el.dataset.code;
    if (CLOUD && code !== 'IDX') loadFin(code).then(() => { if (sheetCode === code) renderSheetLive(); }).catch(() => {});
  };
  // 每次同步後，正在看的那一檔要重新補上財務資料（同步會換掉整份狀態）
  Cloud.refresh = async function () { await baseRefresh2(); if (sheetCode && sheetCode !== 'IDX') { try { await loadFin(sheetCode); } catch (e) { /* 下次同步再補 */ } } };
}

/* 行情排序：分類鈕給預設排序，欄位標題再點一次就反向 */
Object.assign(acts, {
  mtab: el => {
    mTab = el.dataset.id;
    const preset = { all: ['pct', -1], dn: ['pct', 1], px: ['px', -1], vol: ['vol', -1] }[mTab];
    if (preset) mSort = { k: preset[0], d: preset[1] };
    render();
  },
  msort: el => {
    const k = el.dataset.k;
    mSort = mSort.k === k ? { k, d: -mSort.d } : { k, d: -1 };
    // 讓上方分類鈕跟著目前的排序亮起；自選是篩選條件，維持不變
    if (mTab !== 'watch') mTab = k === 'pct' ? (mSort.d < 0 ? 'all' : 'dn') : k === 'px' && mSort.d < 0 ? 'px' : 'custom';
    render();
  },
});

/* 新股申購與零股單位 */
Object.assign(acts, {
  ipoApply: el => run(async () => {
    const code = el.dataset.code, co = S.cos[code], n = Number($('#ipoN' + code).value);
    const cost = n * 1000 * co.offer + 20;
    if (!confirm(`申購 ${co.name} ${n} 張，承銷價 ${p2(co.offer)} 元。\n現在會先扣款 ${fmt(cost)} 元（含處理費 20 元），沒中籤的部分會退款，處理費不退。\n送出後不能更改，確定嗎？`)) return;
    await rpc('ipo_apply', { p_code: code, p_lots: n });
    await Cloud.refresh(); render(); toast('申購完成，等待抽籤');
  }),
});
document.addEventListener('change', ev => { if (ev.target.id === 'unit') { unitSel = ev.target.value; updateEst(); } });

/* ---------- 第三批：當沖、創辦人持股轉讓、營運日誌、聊天檢舉、產業兩層選單 ---------- */
async function loadOps(code) {
  if (!CLOUD || code === 'IDX' || !S.cos[code] || S.cos[code].bot) return;
  const rows = await q(sb.from('entries').select('day,label,amount').eq('code', code).gte('day', S.day - 6).order('id'));
  const by = {};
  for (const r of rows) (by[r.day] = by[r.day] || []).push({ n: r.label, a: r.amount });
  if (S.cos[code]) S.cos[code].ops = Object.keys(by).map(Number).sort((x, y) => y - x).map(d => ({ d, items: by[d] }));
}
{
  const baseRefresh3 = Cloud.refresh.bind(Cloud), baseOpen3 = acts.open, baseOrdOk = acts.ordOk;
  Cloud.refresh = async function () {
    const old = S;
    await baseRefresh3();
    if (old) { S.shorts = old.shorts; S.fdecl = old.fdecl; S.opsPosted = old.opsPosted; S.chatFlag = old.chatFlag; }
    try {
      const my = S.my;
      const [sh, fd, op] = await Promise.all([
        q(sb.from('shorts').select('code,shares,price')),
        my ? q(sb.from('founder_decl').select('*').eq('code', my).maybeSingle()) : null,
        my ? q(sb.from('ops_posts').select('day').eq('code', my).eq('day', S.day)) : [],
      ]);
      S.shorts = {}; for (const x of sh) S.shorts[x.code] = { sh: x.shares, px: Number(x.price) };
      S.fdecl = fd ? { left: fd.shares_left, from: fd.from_day, until: fd.until_day, soldDay: fd.sold_day, soldToday: fd.sold_today } : null;
      S.opsPosted = op.length > 0;
      S.chatFlag = [];
      if (S.admin) {
        const cnt = {}; for (const r of await q(sb.from('chat_reports').select('chat_id'))) cnt[r.chat_id] = (cnt[r.chat_id] || 0) + 1;
        const ids = Object.keys(cnt).map(Number);
        if (ids.length) S.chatFlag = (await q(sb.from('chat').select('*').in('id', ids).order('id', { ascending: false }))).map(x => ({ id: x.id, name: x.nickname, body: x.body, hidden: x.hidden, n: cnt[x.id] }));
      }
      if (sheetCode && sheetCode !== 'IDX') await loadOps(sheetCode);
    } catch (err) { S.shorts = S.shorts || {}; /* 資料庫還沒更新到第 11 版時略過 */ }
  };
  acts.open = el => {
    baseOpen3(el);
    const code = el.dataset.code;
    if (CLOUD && code !== 'IDX') loadOps(code).then(() => { if (sheetCode === code && spTab === 'ops') renderSheetLive(); }).catch(() => {});
  };
  const ask = (kind, sign) => {
    const qv = parseInt($('#qty').value, 10);
    if (!(qv > 0)) return toast('請輸入數量');
    unitSel = unitNow();
    pending = { kind, sign, q: qv, unit: unitSel }; renderSheet(qv);
  };
  Object.assign(acts, {
    short: () => ask('short', -1),
    cover: () => ask('cover', 1),
    ordOk: () => {
      if (!pending || (pending.kind !== 'short' && pending.kind !== 'cover')) return baseOrdOk();
      run(async () => {
        const { kind, q: qv, unit } = pending, code = sheetCode, sh = qv * (unit === 'sh' ? 1 : LOT);
        try {
          const px = await rpc(kind === 'short' ? 'short_sell' : 'short_cover', { p_code: code, p_shares: sh });
          toast(`${kind === 'short' ? '先賣' : '回補'}成交：${fmt(qv)} ${unit === 'sh' ? '股' : '張'} @ ${p2(Number(px))}`);
        } finally { pending = null; await Cloud.refresh(); render(); if (sheetCode === code) renderSheet(); }
      });
    },
    fDeclare: () => run(async () => {
      const n = Number($('#fdN').value);
      if (!confirm(`申報轉讓 ${n} 張創辦人持股？\n這會發布公告讓所有人看到，申報後第 3 天起才能賣，效期 30 天。`)) return;
      await rpc('founder_declare', { p_lots: n }); await Cloud.refresh(); render(); toast('已申報並公告');
    }),
    fSell: () => run(async () => {
      const n = Number($('#fsN').value);
      if (!confirm(`以市價賣出 ${n} 張創辦人持股？賣出後不能買回成創辦人持股。`)) return;
      const px = await rpc('founder_sell', { p_lots: n }); await Cloud.refresh(); render(); toast(`已賣出 ${n} 張 @ ${p2(Number(px))}`);
    }),
    opsPost: () => run(async () => { await rpc('publish_ops'); await Cloud.refresh(); render(); toast('營運日誌已發布'); }),
    chatReport: el => run(async () => {
      if (!confirm('檢舉這則訊息？同一則訊息被 3 個人檢舉會先隱藏，再由管理者處理。')) return;
      await rpc('report_chat', { p_id: Number(el.dataset.id) }); toast('已送出檢舉');
    }),
    chatAdmin: el => run(async () => { await rpc('admin_chat', { p_id: Number(el.dataset.id), p_action: el.dataset.op }); await Cloud.refresh(); render(); toast('已處理'); }),
  });
}
document.addEventListener('change', ev => { if (ev.target.id === 'fCat') $('#fInd').innerHTML = indOptions(Number(ev.target.value)); });

'use strict';
/* 人生上市 — CEO 體驗：營運申報（四大科目）、月營收公告、季報、重大訊息、聊天室、客服、管理頁。
   這個檔案在 app.js 之後載入，會覆蓋 app.js 裡同名的舊版函式。

   制度對照（台灣上市公司 → 遊戲）：
   - 每月 10 日前公告上月營收 → 連線版照真實日曆：月底收盤結算，次月 10 日收盤前要按「公告」，逾期罰 24,000
   - 季報 → 連線版照真實公布日：5/15、8/14、11/14、隔年 3/31，公布時扣 20% 所得稅並配息
   （單機試玩版為了能快轉測試，仍用 5 個交易日一個月、15 個交易日一季）
   - 重大訊息即時公告 → 隨時可發，每天最多 3 則
   - 庫藏股上限 10% → 董事長最多買回 100 張自家股票
   - 持股超過 5%（50 張）申報、達 20%（200 張）公開收購 → 自動發公告
   每家公司發行 100 萬股（1,000 張），交易單位為 1 張 = 1,000 股。 */

const CATS = [
  ['rev', '營業收入', '把自己顧好的本業'],
  ['cogs', '營業成本', '做事付出的代價'],
  ['opex', '營業費用', '推銷、管理、研發的開銷'],
  ['nonop', '營業外收支', '不是本業、偶發的事'],
];
const OWN_MAX = 100000, FLOAT = 500000, LATE_FINE = 24000;
const catOf = e => { const a = ACTIONS.find(x => x.id === e.id); return a ? a.c : e.a > 0 ? 'rev' : 'opex'; };
const sgn = v => (v > 0 ? '+' : '') + fmt(v);

function todayTotals(co) {
  const t = { rawRev: 0, rev: 0, exp: 0, cogs: 0, opex: 0, nonop: 0, op: 0 };
  for (const e of co.today) {
    const c = catOf(e);
    if (e.a > 0) t.rawRev += e.a; else t.exp -= e.a;
    if (c === 'rev') t.op += e.a; else if (c === 'cogs') t.cogs -= e.a; else if (c === 'opex') t.opex -= e.a; else t.nonop += e.a;
  }
  t.rev = Math.min(t.rawRev, CAP);
  return t;
}

/* ---------- 單機版：持股規則、月結、季報 ---------- */
function trade(code, sh) {
  const co = S.cos[code];
  if (!co || !Number.isInteger(sh) || sh === 0) return '請輸入張數';
  if (sh % LOT) return '交易單位為 1 張（1,000 股）';
  const own = code === S.my, h = S.hold[code] || { sh: 0, cost: 0 };
  if (sh < 0 && h.sh + sh < 0) return '庫存不足（不開放放空）';
  if (sh > 0 && own && h.sh + sh > OWN_MAX) return `買回自家股票不得超過已發行股份的 10%（${lots(OWN_MAX)} 張），你目前持有 ${lots(h.sh)} 張`;
  if (sh > 0 && h.sh + sh > FLOAT) return `流通在外的股票不足，目前最多還能買 ${lots(FLOAT - h.sh)} 張`;
  const px = impactPrice(co, sh), n = Math.abs(sh), amt = px * n, fee = feeOf(amt), tax = sh < 0 ? taxOf(amt) : 0;
  if (sh > 0 && amt + fee > S.cash) return '現金不足（含手續費）';
  const real = sh < 0 ? (px - h.cost) * n - fee - tax : null;
  S.cash += sh > 0 ? -(amt + fee) : amt - fee - tax;
  if (sh > 0) {
    if (own && h.sh === 0) S.news.unshift({ d: S.day, t: `【庫藏股】${co.name}（${co.code}）董事會決議買回自家股票，以維護公司信用及股東權益` });
    else if (!own && h.sh < 200000 && h.sh + sh >= 200000) S.news.unshift({ d: S.day, t: `【公開收購】你取得 ${co.name}（${co.code}）達 20% 股份，依規定公告` });
    else if (!own && h.sh <= 50000 && h.sh + sh > 50000) S.news.unshift({ d: S.day, t: `【大量持股申報】你取得 ${co.name}（${co.code}）超過 5% 股份` });
    h.cost = (h.cost * h.sh + px * sh) / (h.sh + sh);
  }
  h.sh += sh;
  if (h.sh === 0) delete S.hold[code]; else S.hold[code] = h;
  co.price = px; co.flow += sh; co.vol = (co.vol || 0) + n;
  co.ticks.push({ t: Date.now(), p: px, v: n, s: sh > 0 ? 1 : -1 });
  S.trades.unshift({ t: Date.now(), code, side: sh > 0 ? 1 : -1, sh: n, px, fee, tax, real, d: S.day });
  S.trades = S.trades.slice(0, 100);
  Store.save(S);
  return null;
}
function weekly(d) {
  const m = d / 5;
  for (const co of Object.values(S.cos)) {
    const l = co.days.slice(-5); if (!l.length) continue;
    let rev = l.reduce((s, x) => s + x.rev, 0), cogs, opex, nonop = 0;
    const exp = l.reduce((s, x) => s + x.exp, 0), acc = co.macc || { cogs: 0, opex: 0, nonop: 0, nonpos: 0 };
    if (co.bot) { cogs = Math.floor(exp * 0.6); opex = exp - cogs; }
    else { cogs = acc.cogs; opex = acc.opex; nonop = acc.nonop; rev = Math.max(0, rev - acc.nonpos); }
    co.macc = null; co.quarters = co.quarters || [];
    const last = co.weeks[co.weeks.length - 1];
    co.weeks.push({ w: m, rev, cogs, opex, nonop, net: rev - cogs - opex + nonop, growth: last && last.rev > 0 ? (rev - last.rev) / last.rev : null, filed: true, late: false });
    if (d % 15 === 0) {
      const ms = co.weeks.slice(-3), sum = k => ms.reduce((s, x) => s + x[k], 0);
      const pre = sum('rev') - sum('cogs') - sum('opex') + sum('nonop'), tax = Math.max(0, Math.floor(pre * 0.2)), net = pre - tax, eps = net / SHARES;
      const div = r2(Math.max(0, eps) * 0.5), open = co.k.length >= 15 ? co.k[co.k.length - 15].o : co.k[0].o;
      co.quarters.push({ q: d / 15, rev: sum('rev'), cogs: sum('cogs'), opex: sum('opex'), nonop: sum('nonop'), pretax: pre, tax, net, eps, div, close: co.price, qchg: (co.price - open) / open });
      S.cash += ((S.hold[co.code] ? S.hold[co.code].sh : 0) + (co.code === S.my ? FOUNDER : 0)) * div;
    }
  }
  S.news.unshift({ d, t: `第 ${m} 月結束，月營收已自動公告${d % 15 === 0 ? `；第 ${d / 15} 季財報出爐，同步配發股利` : ''}` });
}

/* ---------- 我的公司 ---------- */
function vCompany() {
  if (!S.my) return `<div class="card"><h2>申請上市（IPO）</h2>
    <p class="note">發行 ${lots(SHARES)} 張（${fmt(SHARES)} 股），你持有 ${lots(FOUNDER)} 張創辦人持股，另外 ${lots(FLOAT)} 張在市場流通。${CLOUD ? '送件後會先經過 3 個交易日的輔導期，這三天的營運表現會決定你的承銷價；接著開放 2 個交易日的公開申購抽籤，然後正式掛牌。' : '試玩版送件後立刻以 10 元掛牌。'}</p>
    <label for="fName">公司名稱</label><input id="fName" maxlength="20" placeholder="例如：小恩療癒股份有限公司"><p class="note">請勿使用真實企業或品牌名稱，也不要用他人姓名取名。</p>
    <label for="fCode">股票代號（四碼數字）</label><input id="fCode" maxlength="4" inputmode="numeric" placeholder="例如生日 0706">
    <label for="fInd">產業類別</label><select id="fInd">${INDUSTRY_GROUPS.map(([g, l]) => `<optgroup label="${g}">${l.map(i => `<option>${i}</option>`).join('')}</optgroup>`).join('')}</select>
    <label for="fIntro">公司簡介與營業項目</label><textarea id="fIntro" maxlength="120" placeholder="本公司主要從事…"></textarea>
    <div class="gap"></div><button class="btn pri wide" data-act="ipo">${CLOUD ? '送件申請上市' : '敲鐘上市'}</button></div>`;
  const co = S.cos[S.my], c = chgOf(co), k = cls(c), t = todayTotals(co), own = S.hold[co.code];
  const on = id => co.today.some(e => e.id === id);
  const months = co.weeks.slice().reverse(), quarters = (co.quarters || []).slice().reverse();
  const pend = co.weeks.filter(w => !w.filed);
  const gross = t.op - t.cogs, opInc = gross - t.opex, pre = opInc + t.nonop;
  const line = (n, v, cl, strong) => `<div class="kv${strong ? ' tot' : ''}"><span>${n}</span>${strong ? `<b class="${cl || cls(v)}">${fmt(v)}</b>` : `<span class="${cl || ''}">${fmt(v)}</span>`}</div>`;
  const evGroups = [...new Set(EVENTS.map(e => e.g))];
  return `${ipoBanner(co)}<div class="card"><h2>${esc(co.name)} <small>人${esc(co.code)}・${esc(co.ind)}</small></h2>
      <div class="big ${k}">${p2(co.price)} <small style="font-size:15px">${arrow(c)}${p2(Math.abs(co.price - co.prev))}（${apct(c)}）</small>${limitTag(c)}</div>
      ${spark(co.hist, k, true)}<p class="note">${esc(co.intro)}</p>
      <div class="kv"><span>創辦人持股</span><span>${lots(founderShares(co))} 張</span></div>
      <div class="kv"><span>庫藏股（買回自家股票）</span><span>${lots(own ? own.sh : 0)}／${lots(OWN_MAX)} 張</span></div>
      ${isListed(co) ? `<div class="gap"></div><button class="btn wide" data-act="open" data-code="${esc(co.code)}">看走勢／買回自家股票</button>` : ''}</div>

    <div class="card"><h2>董事長待辦 <small>第 ${S.day} 交易日</small></h2>
      ${pend.length ? pend.map(w => `<div class="todo warn"><div><b>公告${mLabel(w.w)}營收</b><small>營收 ${fmt(w.rev)} 元。請在${deadlineText(w)}公告，逾期罰鍰 ${fmt(LATE_FINE)}。</small></div><button class="btn pri" data-act="file">公告</button></div>`).join('') : ''}
      <div class="todo"><div><b>申報今日營運</b><small>${co.today.length ? `已申報 ${co.today.length} 項，收盤（23:00）時結算` : '今天還沒申報，整天沒申報股價會小跌'}</small></div><span class="${co.today.length ? 'up' : 'mute'}">${co.today.length ? '已申報' : '未申報'}</span></div>
      ${calTodo()}</div>

    <div class="card"><h2>今日營運申報 <small>點選今天發生的事</small></h2>
      ${CATS.map(([id, name, hint]) => `<div class="cat"><div class="cat-h"><b>${name}</b><small>${hint}</small></div><div class="chips">${ACTIONS.filter(a => a.c === id).map(a =>
        `<button class="chip ${a.a > 0 ? 'rev' : 'exp'}${on(a.id) ? ' on' : ''}" data-act="chk" data-id="${a.id}" aria-pressed="${on(a.id)}">${a.n}${chipAmt(co, a)}</button>`).join('')}</div></div>`).join('')}
      ${co.today.filter(e => e.custom).map(e => `<div class="kv"><span>${esc(e.n)}（自訂）</span><span class="${e.a > 0 ? 'up' : 'dn'}">${sgn(e.a)} <button class="btn" style="padding:2px 8px" data-act="delc" data-id="${e.id}" aria-label="刪除">×</button></span></div>`).join('')}
      <details><summary>新增自訂項目</summary><label for="cName">項目名稱與金額</label>
      <div style="display:flex;gap:8px"><input id="cName" maxlength="16" placeholder="項目名稱"><input id="cAmt" type="number" min="1" max="5000" placeholder="金額" style="width:96px"><select id="cType" style="width:84px" aria-label="類型"><option value="1">收入</option><option value="-1">費用</option></select></div>
      <div class="gap"></div><button class="btn wide" data-act="addc">新增（單筆上限 5,000）</button></details>
      <div class="gap"></div><div class="is"><div class="is-h">今日損益試算</div>
        ${line('營業收入', t.op)}${line('營業成本', t.cogs)}${line('營業毛利', gross, null, true)}
        ${line('營業費用', t.opex)}${line('營業利益', opInc, null, true)}
        ${line('營業外收支', t.nonop)}${t.rawRev > CAP ? line('超過每日收入上限，不計入', -(t.rawRev - CAP)) : ''}${line('稅前淨利', pre - Math.max(0, t.rawRev - CAP), null, true)}</div>
      <div class="bar" title="每日收入上限"><i style="width:${Math.min(100, t.rawRev / CAP * 100)}%"></i></div>
      <p class="note">每日收入上限 ${fmt(CAP)}${t.rawRev > CAP ? '（已達上限）' : ''}。今日損益越好，收盤時股價越有支撐。</p></div>

    <div class="card"><h2>重大訊息 <small>每天最多 3 則</small></h2>
      <p class="note">用公司的口吻公告你的人生大事，會出現在所有人的新聞頁和你的個股頁。</p>
      <label for="evK">事件</label><select id="evK">${evGroups.map(g => `<optgroup label="${g}">${EVENTS.map((e, i) => e.g === g ? `<option value="${i}">${e.k}</option>` : '').join('')}</optgroup>`).join('')}</select>
      <label for="evT">公告內容</label><textarea id="evT" maxlength="140">${esc(EVENTS[0].t)}</textarea>
      <div class="gap"></div><button class="btn pri wide" data-act="ann">發布公告</button>
      ${co.ann.slice(0, 3).map(a => `<div class="news ann"><small>第 ${a.d} 交易日</small>${esc(a.t)}</div>`).join('')}</div>

    <div class="card"><h2>月營收 <small>${CLOUD ? '月底結算，次月 10 日前公告' : '每 5 個交易日為一個月'}</small></h2>
      ${months.length ? `<div class="mt"><div class="mt-h"><span>月份</span><span>營收</span><span>月增率</span><span>狀態</span></div>${months.map(w => `<div><span>${mLabel(w.w)}</span><span>${fmt(w.rev)}</span>
        <span class="${w.growth == null ? 'mute' : cls(w.growth)}">${w.growth == null ? '—' : (w.growth >= 0 ? '+' : '-') + apct(w.growth)}</span>
        <span class="${!w.filed ? 'yl' : w.late ? 'dn' : 'mute'}">${!w.filed ? '待公告' : w.late ? '逾期' : '已公告'}</span></div>`).join('')}</div>`
      : `<p class="note">還沒有月營收。${CLOUD ? '每個月最後一天收盤（23:00）後結算，你要在次月 10 日收盤前公告。' : '第一個月在第 5 交易日收盤後結算。'}</p>`}</div>

    <div class="card"><h2>季報 <small>${CLOUD ? '5/15、8/14、11/14、3/31 公布' : '每 15 個交易日一季'}</small></h2>
      ${quarters.length ? quarters.map(q => `<div class="is"><div class="is-h">${qLabel(q.q)}合併綜合損益表</div>
        ${line('營業收入', q.rev)}${line('營業成本', q.cogs)}${line('營業毛利', q.rev - q.cogs, null, true)}
        ${line('營業費用', q.opex)}${line('營業利益', q.rev - q.cogs - q.opex, null, true)}
        ${line('營業外收支', q.nonop)}${line('稅前淨利', q.pretax, null, true)}${line('所得稅（20%）', q.tax)}${line('本期淨利', q.net, null, true)}
        <div class="kv"><span>每股盈餘 EPS</span><b class="${cls(q.eps)}">${p2(q.eps)}</b></div>
        <div class="kv"><span>毛利率／營益率</span><span>${q.rev ? ((q.rev - q.cogs) / q.rev * 100).toFixed(1) + '%／' + ((q.rev - q.cogs - q.opex) / q.rev * 100).toFixed(1) + '%' : '—'}</span></div>
        <div class="kv"><span>每股股利</span><span class="yl">${p2(q.div)}</span></div>
        <div class="gap"></div><button class="btn wide" data-act="card" data-w="${q.q}">下載季報卡片</button></div>`).join('<div class="gap"></div>')
      : `<p class="note">還沒有季報。${CLOUD ? '季報比照真實公布日：第 1 季 5/15、第 2 季 8/14、第 3 季 11/14、第 4 季隔年 3/31。' : '第一份季報在第 15 交易日收盤後自動產生。'}公布時會扣 20% 所得稅並依獲利配發股利。</p>`}</div>`;
}

/* ---------- 季報卡片 ---------- */
function reportCard(qn) {
  const co = S.cos[S.my], q = (co.quarters || []).find(x => x.q === qn); if (!q) return;
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  const x = cv.getContext('2d'), F = '"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif';
  const UP = '#ff3d3d', DN = '#1fd66e', TX = '#e4e9f1', MU = '#7c889d', col = v => v > 0 ? UP : v < 0 ? DN : TX;
  x.fillStyle = '#05080f'; x.fillRect(0, 0, 1080, 1350);
  x.strokeStyle = '#35d4e4'; x.lineWidth = 3; x.strokeRect(50, 50, 980, 1250);
  x.fillStyle = '#35d4e4'; x.font = `600 34px ${F}`; x.fillText(`人生上市・${qLabel(q.q)}財務報告`, 100, 135);
  x.fillStyle = '#ffe14a'; let size = 64; x.font = `700 ${size}px ${F}`;
  while (x.measureText(co.name).width > 880 && size > 30) { size -= 4; x.font = `700 ${size}px ${F}`; }
  x.fillText(co.name, 100, 230);
  x.fillStyle = MU; x.font = `30px ${F}`; x.fillText(`${co.code}・${co.ind}`, 100, 282);
  x.fillStyle = col(q.qchg); x.font = `700 104px ${F}`; x.fillText(p2(q.close), 100, 420);
  x.font = `600 40px ${F}`; x.fillText(`季漲跌 ${arrow(q.qchg)}${apct(q.qchg)}`, 100, 480);
  const rows = [['營業收入', fmt(q.rev), TX], ['營業成本', fmt(q.cogs), TX], ['營業毛利', fmt(q.rev - q.cogs), col(q.rev - q.cogs)], ['營業費用', fmt(q.opex), TX],
    ['營業利益', fmt(q.rev - q.cogs - q.opex), col(q.rev - q.cogs - q.opex)], ['營業外收支', fmt(q.nonop), col(q.nonop)], ['所得稅（20%）', fmt(q.tax), TX],
    ['本期淨利', fmt(q.net), col(q.net)], ['每股盈餘 EPS', p2(q.eps), col(q.eps)], ['每股股利', p2(q.div), '#ffe14a']];
  let y = 580;
  for (const [n, v, c] of rows) {
    x.fillStyle = MU; x.font = `32px ${F}`; x.textAlign = 'left'; x.fillText(n, 100, y);
    x.fillStyle = c; x.font = `600 38px ${F}`; x.textAlign = 'right'; x.fillText(v, 980, y);
    x.strokeStyle = '#1d2739'; x.lineWidth = 1; x.beginPath(); x.moveTo(100, y + 20); x.lineTo(980, y + 20); x.stroke(); y += 64;
  }
  x.textAlign = 'left'; x.fillStyle = MU; x.font = `24px ${F}`;
  x.fillText('本報告為遊戲內容，數字皆為虛擬，非投資建議。', 100, 1262);
  const a = document.createElement('a'); a.download = `人生上市_${co.code}_${qLabel(q.q).replace(/\s/g, '')}財報.png`; a.href = cv.toDataURL('image/png'); a.click();
  toast('季報卡片已下載');
}

/* ---------- 個股頁：自家股票也能下單（庫藏股） ---------- */
function renderSheet(qty) {
  const co = sheetCode === 'IDX' ? idxCo() : S.cos[sheetCode], mine = co.code === S.my, h = S.hold[co.code], open = marketState().open;
  const w = !co.idx && S.watch.includes(co.code);
  let box = '';
  if (co.idx) box = '';
  else if (pending) box = orderBox(co);
  else box = `<div class="sp-trade">
      ${mine ? `<p class="note" style="margin:0 0 8px">這是你自己的公司。買回自家股票比照庫藏股，上限為已發行股份的 10%（${lots(OWN_MAX)} 張），目前持有 ${lots(h ? h.sh : 0)} 張。</p>` : ''}
      <div class="qtyrow"><label for="qty">數量</label><input id="qty" type="number" min="1" step="1" inputmode="numeric" value="${qty || 1}"><select id="unit" aria-label="單位：張或零股"><option value="lot">張</option><option value="sh"${unitSel === 'sh' ? ' selected' : ''}>股</option></select>${[1, 5, 10].map(n => `<button class="btn" data-act="setq" data-n="${n}">${n}</button>`).join('')}</div>
      <p class="note" id="est"></p>
      <div class="grid2"><button class="btn pri" data-act="buy" ${open ? '' : 'disabled'}>買進</button><button class="btn sell" data-act="sell" ${h && open ? '' : 'disabled'}>賣出${h ? '（庫存 ' + lots(h.sh) + ' 張）' : ''}</button></div></div>`;
  $('#sheetBody').innerHTML = `<div class="sp-nav"><button data-act="closeSheet" aria-label="返回">‹</button><b>${co.idx ? '大盤' : '個股資訊'}</b>
      ${co.idx ? '<span></span>' : `<button data-act="watch" class="star${w ? ' on' : ''}" aria-pressed="${w}" aria-label="${w ? '移出自選' : '加入自選'}">${w ? '★' : '☆'}</button>`}</div>
    <div id="spLive"></div>${box}`;
  renderSheetLive();
}

/* ---------- 聊天室 ---------- */
function chatRows() {
  // 每天例行的漲跌幅王不放進聊天室，其餘新聞（重大訊息、月營收、上市、漲跌停、連漲連跌等）都會跳出來
  const news = (S.newsFeed || []).filter(n => !/登上今日漲幅王|法人建議觀望/.test(n.body)).map(n => ({ t: n.t, news: true, body: n.body }));
  const l = (S.chat || []).concat(news).sort((a, b) => a.t - b.t).slice(-120);
  if (!l.length) return '<p class="note">還沒有人說話。聊聊今天看好哪一檔吧。</p>';
  return l.map(m => m.news
    ? `<div class="msg sys"><small>快訊・${hhmmss(m.t).slice(0, 5)}</small><span>${esc(m.body)}</span></div>`
    : `<div class="msg${m.me ? ' me' : ''}"><small>${esc(m.name)}・${hhmmss(m.t).slice(0, 5)}</small><span>${esc(m.body)}</span></div>`).join('');
}
function vChat() {
  return `<div class="chat"><div class="chat-h"><b>交易聊天室</b><small>${CLOUD ? '所有玩家即時可見，請勿留下個資' : '試玩版只有你自己看得到'}</small></div>
    <div id="chatList">${chatRows()}</div>
    <div class="chat-in"><input id="chatT" maxlength="120" placeholder="說點什麼…" aria-label="訊息" autocomplete="off"><button class="btn pri" data-act="chatSend">送出</button></div></div>`;
}

/* ---------- 排行、客服、管理 ---------- */
let rTab = 'rank';
const FB_KIND = { bug: '系統問題', idea: '功能建議', other: '其他' }, FB_ST = { open: '待處理', doing: '處理中', done: '已完成' };
function vRank() {
  let list = S.rank;
  if (!list) {
    list = S.bots.map(b => ({ name: b.name, bot: true, v: b.base }));
    list.push({ name: '你', me: true, v: netWorth() });
    list.sort((a, b) => b.v - a.v);
  }
  const tabs = [['rank', '排行榜'], ['support', '客服回報']].concat(S.admin ? [['admin', '管理']] : []);
  const seg = `<div class="seg">${tabs.map(([id, t]) => `<button data-act="rtab" data-id="${id}" class="${rTab === id ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const fb = S.feedback || [];
  if (rTab === 'support') {
    const mine = fb.filter(f => f.mine);
    return seg + `<div class="card"><h2>回報問題或建議</h2>
      ${CLOUD ? `<label for="fbK">類型</label><select id="fbK">${Object.entries(FB_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <label for="fbT">內容</label><textarea id="fbT" maxlength="500" placeholder="例如：在哪一頁、做了什麼、看到什麼錯誤訊息"></textarea>
      <div class="gap"></div><button class="btn pri wide" data-act="fbSend">送出回報</button>` : '<p class="note">試玩版沒有客服功能，連線版才能回報。</p>'}</div>
      <div class="card"><h2>我的回報 <small>${mine.length} 則</small></h2>${mine.length ? mine.map(f => `<div class="news"><small>${FB_KIND[f.kind]}・${new Date(f.t).toLocaleDateString('zh-TW')}・<span class="${f.status === 'done' ? 'up' : 'yl'}">${FB_ST[f.status]}</span></small>${esc(f.body)}${f.reply ? `<div class="reply">官方回覆：${esc(f.reply)}</div>` : ''}</div>`).join('') : '<p class="note">還沒有回報紀錄。</p>'}</div>`;
  }
  if (rTab === 'admin' && S.admin) {
    const flagged = Object.values(S.cos).filter(c => c.flagged);
    return seg + `<div class="card"><h2>玩家回報 <small>${fb.filter(f => f.status !== 'done').length} 則未完成／共 ${fb.length} 則</small></h2>
      ${fb.length ? fb.map(f => `<div class="news"><small>#${f.id}・${esc(f.name)}・${FB_KIND[f.kind]}・${new Date(f.t).toLocaleString('zh-TW')}</small>${esc(f.body)}
        <div class="fb-ed"><select id="fbS${f.id}" aria-label="狀態">${Object.entries(FB_ST).map(([k, v]) => `<option value="${k}"${f.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <input id="fbR${f.id}" maxlength="300" placeholder="回覆玩家（可留空）" value="${esc(f.reply)}" aria-label="回覆"><button class="btn" data-act="fbSave" data-id="${f.id}">儲存</button></div></div>`).join('') : '<p class="note">目前沒有玩家回報。</p>'}</div>
      <div class="card"><h2>被檢舉隱藏的公司 <small>${flagged.length} 家</small></h2>${flagged.length ? flagged.map(c => `<div class="kv"><span>${esc(c.realName || c.name)}（${esc(c.code)}）</span><button class="btn" data-act="unflag" data-code="${esc(c.code)}">恢復顯示</button></div>`).join('') : '<p class="note">目前沒有被隱藏的公司。</p>'}</div>`;
  }
  return seg + `<div class="card"><h2>股神排行榜 <small>現金＋持股＋已解除閉鎖的創辦人持股</small></h2>${list.map((p, i) => `<div class="kv"><span>${i + 1}. ${p.me ? '<b class="gold">' + esc(p.name) + '</b>' : esc(p.name)}${p.bot ? '<span class="tag">機器人</span>' : ''}</span><span>${fmt(p.v)}</span></div>`).join('')}</div>`;
}

/* ---------- 新聞（含推播開關） ---------- */
function vNews() {
  const can = 'Notification' in window, st = can ? Notification.permission : 'denied';
  return `<div class="card"><h2>即時新聞 <small>${S.news.length} 則</small></h2>
    ${can && st !== 'granted' ? `<button class="btn wide" data-act="notifyOn"${st === 'denied' ? ' disabled' : ''}>${st === 'denied' ? '瀏覽器已封鎖通知，請到網站設定開啟' : '開啟新聞推播通知'}</button><div class="gap"></div>` : ''}
    ${S.news.map(n => `<div class="news ${n.ann ? 'ann' : ''}"><small>第 ${n.d} 交易日</small>${n.ann ? `<b>${nz(n.t)}</b>` : nz(n.t)}</div>`).join('')}</div>`;
}

/* ---------- 外框 ---------- */
function renderTop() {
  $('#top').innerHTML = `<div class="brand"><b>人生上市</b><span>${CLOUD ? esc(nick) : '試玩版'}</span></div>
    <div class="clk"><span class="${marketState().open ? 'mk-on' : 'mk-off'}">${marketState().label}</span><span>第 ${S.day} 交易日 <span id="clock">${hhmmss(Date.now())}</span></span></div>`;
  const pend = S.my ? S.cos[S.my].weeks.filter(w => !w.filed).length : 0;
  $('#tabs').innerHTML = [['market', '行情'], ['company', '公司'], ['port', '庫存'], ['news', '新聞'], ['chat', '聊天'], ['rank', '排行']]
    .map(([k, n]) => `<button data-act="tab" data-k="${k}" class="${tab === k ? 'on' : ''}">${n}${k === 'company' && pend ? '<i class="dot" aria-label="有待辦"></i>' : ''}</button>`).join('');
}
function render() {
  renderTop();
  $('#view').innerHTML = ({ market: vMarket, company: vCompany, port: vPort, news: vNews, rank: vRank, chat: vChat })[tab]();
  if (tab === 'chat') { const l = $('#chatList'); l.scrollTop = l.scrollHeight; }
}

/* ---------- 個股頁：營收、財務、基本資料 ---------- */
// 月營收只顯示已公告的月份；別人還沒公告的數字不能提前看到
function finRev(co) {
  const ms = (co.weeks || []).filter(w => w.filed !== false).slice(-12);
  if (co.finLoading) return '<p class="note sp-pad">讀取中…</p>';
  if (!ms.length) return '<p class="note sp-pad">這家公司還沒有公告過月營收。月底結算後，要在次月 10 日前公告。</p>';
  const mx = Math.max(1, ...ms.map(w => w.rev)), bw = CW / 12;
  const bars = ms.map((w, i) => { const h = w.rev / mx * 96; return `<rect x="${f1(i * bw + bw * .2)}" y="${f1(110 - h)}" width="${f1(bw * .6)}" height="${f1(h)}" fill="var(--cyan)"/><text x="${f1(i * bw + bw / 2)}" y="124" text-anchor="middle" class="tx mute">${w.w > 100000 ? w.w % 100 : w.w}月</text>`; }).join('');
  return `<div class="st1">月營收 <span class="mute">單位：元</span></div>
    <svg class="kchart" viewBox="0 0 ${CW} 130" role="img" aria-label="月營收長條圖"><line x1="0" x2="${CW}" y1="110" y2="110" class="g"/>${bars}<text x="3" y="12" class="tx flat">${fmt(mx)}</text></svg>
    <div class="ft"><div class="ft-h"><span>月份</span><span>營收</span><span>月增率</span><span>備註</span></div>${ms.slice().reverse().map(w => `<div><span>${mLabel(w.w)}</span><span>${fmt(w.rev)}</span>
      <span class="${w.growth == null ? 'mute' : cls(w.growth)}">${w.growth == null ? '—' : (w.growth >= 0 ? '+' : '-') + apct(w.growth)}</span><span class="${w.late ? 'dn' : 'mute'}">${w.late ? '逾期公告' : ''}</span></div>`).join('')}</div>`;
}
function finQ(co) {
  const qs = (co.quarters || []).slice(-4);
  if (co.finLoading) return '<p class="note sp-pad">讀取中…</p>';
  if (!qs.length) return '<p class="note sp-pad">這家公司還沒有季報。公布日為 5/15、8/14、11/14 與隔年 3/31。</p>';
  const row = (n, f, color) => `<div><span>${n}</span>${qs.map(q => { const v = f(q); return `<span class="${color ? cls(typeof v === 'number' ? v : 0) : ''}">${typeof v === 'number' ? fmt(v) : v}</span>`; }).join('')}</div>`;
  const pc = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
  return `<div class="st1">合併綜合損益表 <span class="mute">最近 ${qs.length} 季，單位：元</span></div>
    <div class="ft q${qs.length}"><div class="ft-h"><span>科目</span>${qs.map(q => `<span>${q.q > 10000 ? String(Math.floor(q.q / 10)).slice(2) + 'Q' + q.q % 10 : '第 ' + q.q + ' 季'}</span>`).join('')}</div>
      ${row('營業收入', q => q.rev)}${row('營業成本', q => q.cogs)}${row('營業毛利', q => q.rev - q.cogs, true)}${row('營業費用', q => q.opex)}
      ${row('營業利益', q => q.rev - q.cogs - q.opex, true)}${row('業外收支', q => q.nonop, true)}${row('所得稅', q => q.tax)}${row('本期淨利', q => q.net, true)}
      ${row('EPS', q => p2(q.eps))}${row('毛利率', q => pc(q.rev - q.cogs, q.rev))}${row('營益率', q => pc(q.rev - q.cogs - q.opex, q.rev))}${row('每股股利', q => p2(q.div))}</div>`;
}
// 本益比用最近一季 EPS 換算成全年（×4）；殖利率同理。季報還沒出來就顯示「—」。
function infoRows(co) {
  const q = (co.quarters || []).slice(-1)[0], eps4 = q ? q.eps * 4 : null, div4 = q ? q.div * 4 : null;
  const kv = (n, v) => `<div class="kv"><span>${n}</span><span>${v}</span></div>`;
  return kv('公司名稱', esc(co.name)) + kv('股票代號', cd(esc(co.code))) + kv('產業類別', esc(co.ind)) + kv('董事長', esc(co.owner) + (co.bot ? '（機器人）' : ''))
    + kv('公司類型', co.bot ? '示範公司' : '玩家公司') + kv('發行股數', fmt(SHARES) + ' 股（' + lots(SHARES) + ' 張）') + kv('流通在外', lots(FLOAT) + ' 張（其餘為創辦人持股）')
    + kv('每股面額', '10.00') + kv('股本', fmt(SHARES * 10)) + kv('市值', fmt(co.price * SHARES))
    + kv('本益比', eps4 > 0 ? p2(co.price / eps4) : '—') + kv('殖利率', div4 > 0 ? (div4 / co.price * 100).toFixed(2) + '%' : '—')
    + kv('最近一季 EPS', q ? p2(q.eps) : '—');
}

/* ---------- 日期標示：連線版用真實日曆，單機版用交易日序號 ---------- */
const mLabel = w => w > 100000 ? ` ${w % 100} 月` : `第 ${w} 月`;
const qLabel = q => q > 10000 ? `${Math.floor(q / 10)} 年第 ${q % 10} 季` : `第 ${q} 季`;
function deadlineText(w) {
  if (!w.deadline) return `第 ${w.w * 5 + 2} 交易日收盤前`;
  const [, m, d] = w.deadline.split('-').map(Number);
  return ` ${m} 月 ${d} 日收盤（23:00）前`;
}
function calTodo() {
  const row = (t, s) => `<div class="todo"><div><b>${t}</b><small>${s}</small></div></div>`;
  if (!CLOUD || !S.date) {
    const nm = Math.ceil(S.day / 5) * 5, nq = Math.ceil(S.day / 15) * 15;
    return row('下次月結', `第 ${nm} 交易日收盤，還有 ${nm - S.day} 個交易日`) + row('下次季報與配息', `第 ${nq} 交易日收盤，還有 ${nq - S.day} 個交易日`);
  }
  const [y, m, d] = S.date.split('-').map(Number), today = Date.UTC(y, m - 1, d), days = t => Math.round((t - today) / 86400e3);
  const mEnd = Date.UTC(y, m, 0), nm = m === 12 ? 1 : m + 1;
  // 季報公布日：[月, 日, 季別, 年度差]
  const pubs = [[3, 31, 4, -1], [5, 15, 1, 0], [8, 14, 2, 0], [11, 14, 3, 0]];
  let best = null;
  for (const yy of [y, y + 1]) for (const [pm, pd, q, dy] of pubs) { const t = Date.UTC(yy, pm - 1, pd); if (t >= today && (!best || t < best.t)) best = { t, pm, pd, q, yr: yy + dy }; }
  return row('本月月結', `${m} 月 ${new Date(mEnd).getUTCDate()} 日收盤（23:00），還有 ${days(mEnd)} 天。${nm} 月 10 日收盤前要公告 ${m} 月營收`)
    + row('下次季報與配息', `${best.pm} 月 ${best.pd} 日公布 ${best.yr} 年第 ${best.q} 季，還有 ${days(best.t)} 天`);
}

/* ---------- 行情：分類排行＋點欄位標題切換升冪降冪 ---------- */
let mSort = { k: 'pct', d: -1 };  // k：pct 幅度、chg 漲跌、px 成交價、vol 成交量；d：-1 由大到小、1 由小到大
const SORT_VAL = { pct: co => chgOf(co), chg: co => co.price - co.prev, px: co => co.price, vol: co => co.vol || 0 };
function marketList() {
  let l = Object.values(S.cos).filter(isListed); const qy = mQuery.trim().toLowerCase();
  if (qy) l = l.filter(co => co.code.includes(qy) || co.name.toLowerCase().includes(qy));
  if (mTab === 'watch') l = l.filter(co => S.watch.includes(co.code));
  const val = SORT_VAL[mSort.k];
  l.sort((a, b) => (val(a) - val(b)) * mSort.d || a.code.localeCompare(b.code));
  if (l.length) return l.map(coRow).join('');
  return `<p class="note">${mTab === 'watch' && !qy ? '還沒有自選股。到個股頁右上角按 ☆ 就能加入。' : '找不到符合的公司。'}</p>`;
}
function vMarket() {
  const all = Object.values(S.cos).filter(isListed); let up = 0, dn = 0;
  for (const co of all) { const g = chgOf(co); if (g > 0.00001) up++; else if (g < -0.00001) dn++; }
  const n = all.length, ix = idxCo(), ic = chgOf(ix), k = cls(ic), news = S.news[0];
  const th = (key, name) => `<button data-act="msort" data-k="${key}" class="${mSort.k === key ? 'on' : ''}" aria-label="${name}排序，目前${mSort.k === key ? (mSort.d < 0 ? '由高到低' : '由低到高') : '未排序'}">${name}${mSort.k === key ? (mSort.d < 0 ? '▼' : '▲') : ''}</button>`;
  return `<button class="idx" data-act="open" data-code="IDX"><div class="idx-main"><small><span>人生加權指數</span><i>看大盤走勢 ›</i></small>
      <div><b class="${k}">${p2(ix.price)}</b><span class="${k}">${arrow(ic)}${p2(Math.abs(ix.price - ix.prev))}（${apct(ic)}）</span></div>
      ${spark(ix.k.slice(-14).map(x => x.c).concat(ix.price), k)}</div>
    <div class="cnt"><span class="up">漲 ${up}</span><span class="dn">跌 ${dn}</span><span class="flat">平 ${n - up - dn}</span><span class="mute">成交量 <b class="yl">${lots(all.reduce((a, co) => a + (co.vol || 0), 0))}</b> 張</span></div></button>
    ${news ? `<button class="flash" data-act="tab" data-k="news"><b>快訊</b><span>${nz(news.t)}</span></button>` : ''}
    ${ipoSection()}
    <div class="mbar"><input id="mq" type="search" placeholder="搜尋代號或名稱" value="${esc(mQuery)}" aria-label="搜尋公司"></div>
    <div class="seg">${[['all', '漲幅'], ['dn', '跌幅'], ['px', '股價'], ['vol', '成交量'], ['watch', '自選']].map(([id, t]) => `<button data-act="mtab" data-id="${id}" class="${mTab === id ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="qt"><div class="qh"><span>商品</span>${th('px', '成交')}${th('chg', '漲跌')}${th('pct', '幅度')}</div><div id="qtList">${marketList()}</div></div>
    <p class="note">點「成交、漲跌、幅度」可以切換由高到低或由低到高。${CLOUD ? '交易時間：' + HOURS + '，23:00 收盤結算。' : '試玩版：其他公司為模擬玩家，不限交易時段。'}</p>
    ${CLOUD ? '' : '<div class="gap"></div><div style="padding:0 14px"><button class="btn wide" data-act="close">收盤，進入下一個交易日</button></div>'}`;
}

/* ---------- 零股：下單單位可選「張」或「股」 ---------- */
let unitSel = 'lot';
const unitNow = () => { const el = $('#unit'); return el ? el.value : unitSel; };

/* ---------- 上市流程：輔導期 → 承銷價 → 公開申購抽籤 → 掛牌（蜜月期） ---------- */
const IPO_OFFER_LOTS = 50, IPO_FEE = 20;
function ipoStage(co) {
  if (co.status === 'coach') {
    const n = Math.min(3, Math.max(1, S.day - co.ipoDay + 1)), left = co.ipoDay + 2 - S.day;
    return { t: `輔導期第 ${n}／3 天`, s: left <= 0 ? '今天 23:00 收盤後訂出承銷價' : `還有 ${left} 個交易日訂出承銷價` };
  }
  const left = co.ipoDay + 4 - S.day;
  return { t: `公開申購中・承銷價 ${p2(co.offer)}`, s: left <= 0 ? '今天 23:00 截止，收盤後抽籤、明天掛牌' : '明天 23:00 截止' };
}
// 行情頁的新股申購區
function ipoSection() {
  const l = Object.values(S.cos).filter(co => !isListed(co));
  if (!l.length) return '';
  const apps = S.ipoApps || {}, tot = S.ipoTotals || {};
  return `<div class="ipo"><div class="ipo-h"><b>新股申購</b><small>每檔釋出 ${IPO_OFFER_LOTS} 張，超額抽籤</small></div>${l.map(co => {
    const st = ipoStage(co), mine = co.code === S.my, ap = apps[co.code];
    let act = co.status === 'coach' ? `<span class="ipo-f"><button class="btn" disabled>第 ${co.ipoDay + 3} 交易日開放申購</button></span>` : '';
    if (co.status === 'sub') {
      if (mine) act = '<small class="mute">自己的公司不能申購</small>';
      else if (ap) act = `<small class="yl">已申購 ${ap.lots} 張，等待抽籤</small>`;
      else act = `<span class="ipo-f"><select id="ipoN${esc(co.code)}" aria-label="申購張數">${[1, 2, 3, 5, 10].map(n => `<option value="${n}">${n} 張</option>`).join('')}</select><button class="btn pri" data-act="ipoApply" data-code="${esc(co.code)}">申購</button></span>`;
    }
    return `<div class="ipo-r"><div><b>${esc(co.name)}</b><small>人${esc(co.code)}・${esc(co.ind)}・董事長 ${esc(co.owner)}</small>
      <small class="cy">${st.t}・${st.s}</small>
      ${co.status === 'sub' ? `<small>預估年 EPS ${p2(co.ipoEps)} × 同業本益比 ${co.ipoPe} 倍 × 九折。目前申購 ${tot[co.code] || 0} 張。每張預扣 ${fmt(co.offer * 1000)} 元，另收處理費 ${IPO_FEE} 元，沒中籤會退款。</small>` : '<small>輔導期間不能買賣，董事長正在累積營運成績。</small>'}</div>${act}</div>`;
  }).join('')}</div>`;
}
// 「我的公司」頁最上面的上市進度
function ipoBanner(co) {
  if (isListed(co)) return isHoney(co) ? `<div class="card"><h2>蜜月期 <small>到第 ${co.honey} 交易日</small></h2><p class="note">剛掛牌的前五個交易日不設漲跌幅限制，股價波動會比較大。</p></div>` : '';
  const st = ipoStage(co);
  const step = (on, done, t, d) => `<div class="todo"><div><b class="${on ? 'yl' : done ? '' : 'mute'}">${done ? '✓ ' : ''}${t}</b><small>${d}</small></div></div>`;
  const sub = co.status === 'sub';
  return `<div class="card"><h2>上市進度 <small>${st.t}</small></h2>
    ${step(!sub, sub, '1. 輔導期（3 個交易日）', sub ? '已完成' : st.s + '。這三天每天都要申報營運，平均每日淨利越高，承銷價越高。')}
    ${step(sub, false, '2. 公開申購抽籤（2 個交易日）', sub ? `承銷價 ${p2(co.offer)} 元 = 預估年 EPS ${p2(co.ipoEps)} × 同業本益比 ${co.ipoPe} 倍 × 九折。釋出 ${IPO_OFFER_LOTS} 張，目前申購 ${(S.ipoTotals || {})[co.code] || 0} 張。${st.s}。` : '訂出承銷價後開放其他玩家申購，超額就抽籤。')}
    ${step(false, false, '3. 掛牌與蜜月期', '掛牌後前五個交易日不設漲跌幅限制。')}
    <p class="note">承銷價限制在 5 到 50 元之間。掛牌前股票不能買賣，也還不計入大盤。</p></div>`;
}

'use strict';
/* 人生上市 — 第九批：K 線分頁（日／週／月／1、5、15、30、60 分）、點一下固定十字線、新上市公司的 K 線排版。在 v8.js 之後載入。 */

/* ---------- 1. 資料 ---------- */
let kPer = 'D', chartSel = null;  // chartSel：{ code, tab, per, key } 目前固定住的那一根
const K_PERS = [['D', '日'], ['W', '週'], ['M', '月'], ['1', '1分'], ['5', '5分'], ['15', '15分'], ['30', '30分'], ['60', '60分']];
const kCache = {};

// 交易日 d 的日曆日期（每個日曆日都是一個交易日，23:00 換日）
function kDateOf(d) {
  let base;
  if (typeof S !== 'undefined' && S.date) base = Date.parse(S.date + 'T00:00:00Z');
  else { const z = new Date(Date.now() + 8 * 3600e3); base = Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate()); }
  return base - (S.day - d) * 86400e3;
}
const kYmd = ms => { const z = new Date(ms); return `${z.getUTCFullYear()}/${String(z.getUTCMonth() + 1).padStart(2, '0')}/${String(z.getUTCDate()).padStart(2, '0')}`; };
const kHm = t => { const z = new Date(t + 8 * 3600e3); return `${String(z.getUTCHours()).padStart(2, '0')}:${String(z.getUTCMinutes()).padStart(2, '0')}`; };
const kMd = t => { const z = new Date(t + 8 * 3600e3); return `${z.getUTCMonth() + 1}/${z.getUTCDate()}`; };

// 雲端版：週、月 K 要更早的日資料；分 K 要前一天的逐筆（資料庫只保留當日與前一日）
function kFetch(co, type) {
  if (!CLOUD || co.idx) return [];
  const id = co.code + '|' + type, c = kCache[id];
  if (c && c.day === S.day) return c.data;  // 載入中是 null
  kCache[id] = { day: S.day, data: null };
  (async () => {
    let data = [];
    try {
      if (type === 'days') data = (await q(sb.from('day_records').select('day,open_px,high_px,low_px,close_px,vol').eq('code', co.code).lt('day', S.day).order('day', { ascending: false }).limit(1000)))
        .reverse().map(r => ({ d: r.day, o: Number(r.open_px), h: Number(r.high_px), l: Number(r.low_px), c: Number(r.close_px), v: r.vol }));
      else data = (await q(sb.from('ticks').select('price,shares,side,created_at').eq('code', co.code).lt('day', S.day).order('id', { ascending: false }).limit(1000)))
        .reverse().map(x => ({ t: Date.parse(x.created_at), p: Number(x.price), v: x.shares, s: x.side }));
    } catch (e) { /* 拿不到就只畫手上有的 */ }
    kCache[id] = { day: S.day, data };
    if (sheetCode === co.code && spTab === 'k') renderSheetLive();
  })();
  return null;
}

// 回傳 K 棒陣列 [{ key, lab, full, o, h, l, c, v }]；資料還在載入時回傳 null
function kBars(co) {
  const t = todayStats(co);
  if (/^\d+$/.test(kPer)) {  // 分 K
    const old = kFetch(co, 'ticks'); if (old === null) return null;
    const ticks = old.concat(co.ticks || []).sort((a, b) => a.t - b.t), ms = Number(kPer) * 60e3, out = [];
    let cur = null, last = null;
    for (const x of ticks) {
      const b = Math.floor(x.t / ms) * ms;
      if (!cur || cur.b !== b) {
        if (cur) out.push(cur);
        const o = last == null ? x.p : last;  // 開盤用上一根的收盤，成交稀少時 K 棒才不會都是一條線
        cur = { b, key: 'm' + b, o, h: Math.max(o, x.p), l: Math.min(o, x.p), c: x.p, v: 0 };
      }
      cur.h = Math.max(cur.h, x.p); cur.l = Math.min(cur.l, x.p); cur.c = x.p; cur.v += x.v; last = x.p;
    }
    if (cur) out.push(cur);
    return out.map(x => ({ ...x, lab: kHm(x.b), full: `${kMd(x.b)} ${kHm(x.b)}` }));
  }
  let days;
  if (co.idx) days = (S.idxK || []).slice();
  else if (kPer === 'D') days = co.k.slice();
  else { const d = kFetch(co, 'days'); if (d === null) return null; days = d.length ? d : co.k.slice(); }
  days.push({ d: S.day, o: t.o, h: t.h, l: t.l, c: co.price, v: t.vol, today: true });
  if (kPer === 'D') return days.map(x => { const ms = kDateOf(x.d), f = kYmd(ms); return { ...x, key: 'd' + x.d, lab: f.slice(5), full: f + (x.today ? '（今日）' : '') }; });
  const groups = new Map();
  for (const x of days) {
    const ms = kDateOf(x.d), z = new Date(ms);
    const g = kPer === 'W' ? ms - ((z.getUTCDay() + 6) % 7) * 86400e3 : Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), 1);
    const a = groups.get(g);
    if (!a) groups.set(g, { key: kPer + g, g, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v });
    else { a.h = Math.max(a.h, x.h); a.l = Math.min(a.l, x.l); a.c = x.c; a.v += x.v; }
  }
  return [...groups.values()].map(a => {
    const f = kYmd(a.g);
    return { ...a, lab: kPer === 'W' ? f.slice(5) : f.slice(0, 7), full: kPer === 'W' ? f + ' 當週' : f.slice(0, 7) + ' 月' };
  });
}

/* ---------- 2. 畫 K 線 ---------- */
const KL = 36, KN = 30;  // 左邊留給價格刻度；畫面上最多 30 根
const MAS = [[5, 'var(--yellow)'], [10, '#e05ee0'], [20, 'var(--cyan)']];
let kView = null;  // 這次畫出來的 K 棒，讓資訊列顯示用

chartK = function (co) {
  const per = `<div class="kper" role="tablist">${K_PERS.map(([id, n]) => `<button data-act="kper" data-id="${id}" class="${kPer === id ? 'on' : ''}" role="tab" aria-selected="${kPer === id}">${n}</button>`).join('')}</div>`;
  const all = kBars(co);
  if (all === null) { chartPts = []; kView = null; return per + '<p class="note sp-pad">K 線資料載入中…</p>'; }
  if (!all.length) { chartPts = []; kView = null; return per + `<p class="note sp-pad">${/^\d+$/.test(kPer) ? '今天和昨天都還沒有成交，分 K 會在有成交後出現。' : '還沒有 K 線資料。'}</p>`; }
  const maOf = (n, i) => i < n - 1 ? null : all.slice(i - n + 1, i + 1).reduce((a, x) => a + x.c, 0) / n;
  const st = Math.max(0, all.length - KN), ks = all.slice(st), cw = (CW - KL - 4) / KN;
  for (let i = 0; i < ks.length; i++) { ks[i].ma = MAS.map(([n]) => maOf(n, st + i)); ks[i].pc = st + i > 0 ? all[st + i - 1].c : (co.idx ? null : ks[i].o); }
  let hi = Math.max(...ks.map(x => x.h)), lo = Math.min(...ks.map(x => x.l));
  const sp0 = Math.max(hi - lo, hi * 0.02); hi += sp0 * 0.08; lo -= sp0 * 0.08;
  const sp = hi - lo, Y = p => CTOP + (hi - p) / sp * CPH, mv = Math.max(1, ...ks.map(x => x.v));
  const cx = i => KL + (i + 0.5) * cw;  // 根數少時靠左排，跟券商 App 一樣
  const body = ks.map((x, i) => {
    const col = x.c > x.o ? 'var(--up)' : x.c < x.o ? 'var(--dn)' : 'var(--flat)', y1 = Y(Math.max(x.o, x.c)), hg = Math.max(1, Math.abs(Y(x.o) - Y(x.c))), vh = x.v / mv * (CVH - 4);
    return `<line x1="${f1(cx(i))}" x2="${f1(cx(i))}" y1="${f1(Y(x.h))}" y2="${f1(Y(x.l))}" stroke="${col}"/>
      <rect x="${f1(cx(i) - cw * .34)}" y="${f1(y1)}" width="${f1(cw * .68)}" height="${f1(hg)}" fill="${col}"/>
      ${x.v ? `<rect x="${f1(cx(i) - cw * .34)}" y="${f1(CVT + CVH - vh)}" width="${f1(cw * .68)}" height="${f1(Math.max(.8, vh))}" fill="${col}" opacity=".75"/>` : ''}`;
  }).join('');
  const lines = MAS.map(([, c], m) => { const p = ks.map((x, i) => x.ma[m] == null ? null : `${f1(cx(i))},${f1(Y(x.ma[m]))}`).filter(Boolean); return p.length > 1 ? `<polyline points="${p.join(' ')}" fill="none" stroke="${c}" stroke-width="1"/>` : ''; }).join('');
  const grid = [0, .25, .5, .75, 1].map(f => `<line x1="${KL}" x2="${CW}" y1="${f1(CTOP + f * CPH)}" y2="${f1(CTOP + f * CPH)}" class="g"/>`).join('')
    + `<line x1="0" x2="${CW}" y1="${CVT - 3}" y2="${CVT - 3}" class="gs"/>`;
  const lab = [0, .5, 1].map(f => `<text x="2" y="${f1(CTOP + f * CPH + (f === 0 ? 8 : f === 1 ? -2 : 3))}" class="tx flat">${p2(hi - f * sp)}</text>`).join('')
    + `<text x="2" y="${CVT + 8}" class="tx mute">量</text><text x="2" y="${CVT + 18}" class="tx mute">${lots(mv)}</text>`;
  // 日期刻度：最多 4 個，彼此至少隔 7 根，不會疊在一起
  const step = Math.max(7, Math.ceil(ks.length / 4)), ticks = [];
  for (let i = 0; i < ks.length; i += step) ticks.push(i);
  const xl = ticks.map(i => `<text x="${f1(Math.min(CW - 22, Math.max(KL + 14, cx(i))))}" y="${CH - 2}" text-anchor="middle" class="tx mute">${esc(ks[i].lab)}</text>`).join('');
  kView = ks;
  chartPts = ks.map((x, i) => ({ x: cx(i), y: Y(x.c), key: x.key, i }));
  return `${per}<div id="kInfo" class="kinfo"></div><div id="kMa" class="kma"></div>
    <svg class="kchart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="K 線圖">${grid}${body}${lines}${lab}${xl}
    <line id="xhl" y1="${CTOP}" y2="${CVT + CVH}" class="xh" visibility="hidden"/><line id="xhh" x1="${KL}" x2="${CW}" class="xh" visibility="hidden"/></svg>`;
};

// K 線上方的開高低收資訊列（沒有選的時候顯示最新一根）
function kInfo(i, on) {
  const el = $('#kInfo'), ma = $('#kMa'); if (!el || !kView || !kView.length) return;
  const x = kView[i == null ? kView.length - 1 : i], c = x.pc == null ? 'flat' : cls(x.c - x.pc);
  const ch = x.pc ? `${arrow(x.c - x.pc)}${p2(Math.abs(x.c - x.pc))}（${apct(x.c / x.pc - 1)}）` : '';
  const k = v => cls(v - (x.pc == null ? x.o : x.pc));
  el.classList.toggle('on', !!on);
  el.innerHTML = `<span class="kd">${esc(x.full)}</span><span>開 <b class="${k(x.o)}">${p2(x.o)}</b></span><span>高 <b class="${k(x.h)}">${p2(x.h)}</b></span>
    <span>量 <b class="yl">${lots(x.v)}${co_isIdx() ? '' : ' 張'}</b></span><span>低 <b class="${k(x.l)}">${p2(x.l)}</b></span><span>收 <b class="${c}">${p2(x.c)}</b></span>
    ${ch ? `<span class="kc">漲跌 <b class="${c}">${ch}</b></span>` : ''}`;
  if (ma) ma.innerHTML = MAS.map(([n, col], m) => x.ma[m] == null ? '' : `<span style="color:${col}">MA${n} ${p2(x.ma[m])}</span>`).join('');
}
const co_isIdx = () => sheetCode === 'IDX';

/* ---------- 3. 十字線：點一下固定，再點別根才移動 ---------- */
function chartDraw(p) {
  const svg = $('#spLive svg.kchart'); if (!svg) return;
  const v = svg.querySelector('#xhl'), h = svg.querySelector('#xhh');
  if (!p) {
    if (v) v.setAttribute('visibility', 'hidden'); if (h) h.setAttribute('visibility', 'hidden');
    if (spTab === 'k') kInfo(null, false);
    return;
  }
  if (v) { v.setAttribute('x1', p.x); v.setAttribute('x2', p.x); v.setAttribute('visibility', 'visible'); }
  if (h && p.y != null) { h.setAttribute('y1', p.y); h.setAttribute('y2', p.y); h.setAttribute('visibility', 'visible'); }
  if (spTab === 'k') kInfo(p.i, true);
  else { const lab = $('#spLive .st1'); if (lab && p.s) { lab.textContent = p.s; lab.classList.add('xh-on'); } }
}
const selHere = () => chartSel && chartSel.code === sheetCode && chartSel.tab === spTab && (spTab !== 'k' || chartSel.per === kPer);
function chartPick(svg, clientX, toggle) {
  if (!chartPts.length) return;
  const r = svg.getBoundingClientRect(), x = (clientX - r.left) / r.width * CW;
  let best = chartPts[0]; for (const p of chartPts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  if (toggle && selHere() && chartSel.key === best.key) {  // 再點同一根：取消
    chartSel = null;
    if (spTab === 'k') chartDraw(null); else renderSheetLive();
    return;
  }
  chartSel = { code: sheetCode, tab: spTab, per: kPer, key: best.key };
  chartDraw(best);
}
crosshair = function (e) { const svg = e.target.closest && e.target.closest('#spLive svg.kchart'); if (svg) chartPick(svg, e.clientX, false); };

// 在 window 的捕捉階段先處理走勢圖上的手勢，取代舊的「滑鼠移到哪線就跟到哪」與「按住才出現」
{
  let st = null;
  const onC = e => e.target.closest && e.target.closest('#spLive svg.kchart');
  addEventListener('pointerdown', e => {
    const svg = onC(e); if (!svg) return;
    e.stopImmediatePropagation();
    if (e.pointerType === 'mouse') { if (e.button === 0) { chartPick(svg, e.clientX, true); st = { svg, mouse: true }; } return; }
    st = { svg, x0: e.clientX, y0: e.clientY, held: false, moved: false };
    st.timer = setTimeout(() => { if (!st || st.moved) return; st.held = true; chartHeld = true; chartPick(svg, st.x0, false); }, 300);
  }, true);
  addEventListener('pointermove', e => {
    if (!st) { if (onC(e)) e.stopImmediatePropagation(); return; }
    e.stopImmediatePropagation();
    if (st.mouse) { if (e.buttons & 1) chartPick(st.svg, e.clientX, false); return; }
    if (st.held) chartPick(st.svg, e.clientX, false);  // 按住後左右移動：連續查價，放開後停在最後一根
    else if (Math.abs(e.clientX - st.x0) > 8 || Math.abs(e.clientY - st.y0) > 8) { st.moved = true; clearTimeout(st.timer); }
  }, true);
  const end = (e, cancel) => {
    if (!st) return;
    e.stopImmediatePropagation(); clearTimeout(st.timer);
    if (!st.mouse && !cancel && !st.held && !st.moved) chartPick(st.svg, e.clientX, true);  // 輕點一下：固定在那一根
    st = null; setTimeout(() => { chartHeld = false; }, 0);
  };
  addEventListener('pointerup', e => end(e, false), true);
  addEventListener('pointercancel', e => end(e, true), true);
}

/* ---------- 4. 分時圖的點也帶 key，重畫後十字線留在原位 ---------- */
{
  const base = chartTime;
  chartTime = function (co) {
    const h = base(co);
    chartPts.forEach((p, i) => { const t = co.ticks[i]; p.key = 't' + (t ? t.t : i); });
    return h;
  };
}

/* ---------- 5. 個股頁：「日K」改成「K線」，重畫後保留十字線 ---------- */
{
  const base = renderSheetLive;
  renderSheetLive = function () {
    base();
    const live = $('#spLive'); if (!live) return;
    const b = live.querySelector('.sp-tabs button[data-id="k"]'); if (b) b.textContent = 'K線';
    if (spTab === 'k') {
      // 舊的說明列和今日開高低改由 K 線上方的資訊列取代
      const s1 = live.querySelector('.st1'); if (s1) s1.remove();
      live.querySelectorAll('svg.kchart ~ .st').forEach(el => el.remove());
    }
    const p = selHere() ? chartPts.find(x => x.key === chartSel.key) : null;
    if (p) chartDraw(p); else if (spTab === 'k') kInfo(null, false);
  };
  acts.kper = el => { kPer = el.dataset.id; renderSheetLive(); const bar = $('#spLive .kper'), on = bar && bar.querySelector('.on'); if (on) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2; };
  // 換股票時取消固定的十字線
  const baseOpen = openSheet;
  openSheet = function (code) { if (!chartSel || chartSel.code !== code) chartSel = null; baseOpen(code); };
}

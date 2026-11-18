'use strict';
/* 人生上市 — 第七批：行情表改成「成交、漲跌（含幅度）、成交量」，股票名稱下方加當日買賣力道線。在 v6.js 之後載入。 */

// 當日買賣量：連線版從伺服器的統計拿，試玩版用本機的逐筆成交算
function flowOf(code) {
  if (CLOUD) return (S.flow || {})[code] || { b: 0, s: 0 };
  const co = S.cos[code], f = { b: 0, s: 0 };
  for (const x of (co && co.ticks) || []) { if (x.s > 0) f.b += x.v; else f.s += x.v; }
  return f;
}
// 成交量以「張」顯示，超過一萬張用「萬」
function volTxt(sh) {
  const l = (sh || 0) / 1000;
  return l >= 10000 ? (l / 10000).toFixed(2) + '萬' : fmt(l);
}
coRow = function (co) {
  const c = chgOf(co), k = cls(c), was = lastPx[co.code];
  const fl = was != null && was !== co.price ? (co.price > was ? ' fl-up' : ' fl-dn') : '';
  lastPx[co.code] = co.price;
  const f = flowOf(co.code), tot = f.b + f.s, sp = tot ? Math.round(f.s / tot * 100) : 50;
  const bar = tot ? `<i class="bs" title="今日賣出 ${sp}%、買進 ${100 - sp}%"><i class="s" style="width:${sp}%"></i><i class="b" style="width:${100 - sp}%"></i></i>` : '<i class="bs none" title="今日尚無成交"></i>';
  return `<button class="qr${fl}" data-act="open" data-code="${esc(co.code)}">
    <span class="qn"><b>${S.watch.includes(co.code) ? '<i class="yl">★</i>' : ''}${esc(co.name)}</b><small>人${esc(co.code)}${co.code === S.my ? '・我的公司' : ''}${co.bot ? '・示範' : ''}${isHoney(co) ? '・蜜月期' : ''}${S.hold[co.code] ? '・持有' : ''}</small>${bar}</span>
    <span class="${k} ${limCls(c)}"><b>${p2(co.price)}</b></span>
    <span class="${k} chg2"><span>${arrow(c)}${p2(Math.abs(co.price - co.prev))}</span><small>(${apct(c)})</small></span>
    <span class="yl vol2">${volTxt(co.vol)}</span></button>`;
};
// 欄位標題：成交、漲跌（依幅度排序）、成交量
{
  const base = vMarket;
  vMarket = function () {
    return base()
      .replace(/<button data-act="msort" data-k="chg"[^>]*>[^<]*<\/button>/, '')
      .replace(/(<button data-act="msort" data-k="pct"[^>]*>)幅度/, '$1漲跌')
      .replace('</div><div id="qtList">', `<button data-act="msort" data-k="vol" class="${mSort.k === 'vol' ? 'on' : ''}" aria-label="成交量排序">成交量${mSort.k === 'vol' ? (mSort.d < 0 ? '▼' : '▲') : ''}</button></div><div id="qtList">`)
      .replace('點「成交、漲跌、幅度」', '點「成交、漲跌、成交量」');
  };
  // 大盤的成分股表頭
  const baseLive = renderSheetLive;
  renderSheetLive = function () {
    baseLive();
    const h = document.querySelector('#spLive .qh');
    if (h && h.textContent.includes('幅度')) h.innerHTML = '<span>成分股</span><span>成交</span><span>漲跌</span><span>成交量(張)</span>';
  };
}
// 同步時順便拿當日買賣量
{
  const base = Cloud.refresh.bind(Cloud);
  Cloud.refresh = async function () {
    await base();
    try {
      const rows = await q(sb.from('today_flow').select('*'));
      S.flow = {}; for (const r of rows) S.flow[r.code] = { b: Number(r.buy_vol), s: Number(r.sell_vol) };
    } catch (e) { S.flow = S.flow || {}; /* 資料庫還沒更新到第 16 版時略過 */ }
  };
}

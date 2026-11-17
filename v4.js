'use strict';
/* 人生上市 — 第四批：申報即時回饋、分享功能、新手內容不空。在 intro.js 之後載入。 */

/* ---------- 1. 申報即時回饋 ----------
   以前點一下要等伺服器存好、再整份重新同步（1～2 秒）才看得到勾選，期間連點還會被忽略。
   現在先在畫面上立刻勾選並重算淨利，背景依序送出，最後再同步一次確認。 */
let chkQueue = Promise.resolve(), chkTimer = null, chkPending = 0;
acts.chk = el => {
  const id = el.dataset.id, co = S.my && S.cos[S.my];
  if (!co) return;
  if (!CLOUD) { Local.toggle(id).then(render); return; }
  const a = ACTIONS.find(x => x.id === id), i = co.today.findIndex(e => e.id === id);
  if (i >= 0) co.today.splice(i, 1); else co.today.push({ id, n: a.n, a: a.a });
  render();
  chkPending++;
  chkQueue = chkQueue
    .then(() => rpc('toggle_action', { p_action: id }))
    .catch(err => { toast(err.message || '申報沒有存到，請再試一次'); })
    .then(() => {
      chkPending--;
      clearTimeout(chkTimer);
      // 全部送完才同步，避免同步回來的舊資料蓋掉還在送的勾選
      if (!chkPending) chkTimer = setTimeout(async () => { try { await Cloud.refresh(); if (tab === 'company') render(); } catch (e) { /* 下次同步再補 */ } }, 700);
    });
};
// 同步時如果還有申報在送，先不要用伺服器的舊資料覆蓋今天的勾選
{
  const base = Cloud.refresh.bind(Cloud);
  Cloud.refresh = async function () {
    const keep = chkPending && S && S.my && S.cos[S.my] ? S.cos[S.my].today.slice() : null;
    await base();
    if (keep && S.my && S.cos[S.my]) S.cos[S.my].today = keep;
  };
}

/* ---------- 2. 分享 ---------- */
const SITE = () => location.origin + location.pathname.replace(/index\.html$/, '');
function shareCanvas(co) {
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  const x = cv.getContext('2d'), F = '"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif', N = '"Roboto Mono",Consolas,monospace';
  const c = chgOf(co), UP = '#ff3d3d', DN = '#1fd66e', col = c > 0.00001 ? UP : c < -0.00001 ? DN : '#e4e9f1';
  x.fillStyle = '#05080f'; x.fillRect(0, 0, 1080, 1350);
  x.strokeStyle = '#35d4e4'; x.lineWidth = 4; x.strokeRect(48, 48, 984, 1254);
  x.fillStyle = '#35d4e4'; x.font = `700 46px ${F}`; x.fillText('人生上市', 100, 140);
  x.fillStyle = '#7c889d'; x.font = `28px ${F}`; x.fillText('把自己經營成一家上市公司', 100, 186);
  x.fillStyle = '#ffe14a'; let size = 76; x.font = `700 ${size}px ${F}`;
  while (x.measureText(co.name).width > 880 && size > 34) { size -= 4; x.font = `700 ${size}px ${F}`; }
  x.fillText(co.name, 100, 320);
  x.fillStyle = '#7c889d'; x.font = `32px ${F}`; x.fillText(`人${co.code}・${co.ind}・董事長 ${co.owner}`, 100, 376);
  x.fillStyle = col; x.font = `700 150px ${N}`; x.fillText(p2(co.price), 100, 560);
  x.font = `600 50px ${N}`; x.fillText(`${arrow(c)}${p2(Math.abs(co.price - co.prev))}  ${arrow(c)}${apct(c)}`, 100, 640);
  // 走勢
  const h = (co.k || []).slice(-29).map(k => k.c).concat(co.price);
  if (h.length > 1) {
    const mn = Math.min(...h), mx = Math.max(...h), sp = mx - mn || 1, X0 = 100, W = 880, Y0 = 700, H = 300;
    x.strokeStyle = '#1d2739'; x.lineWidth = 2; x.strokeRect(X0, Y0, W, H);
    x.beginPath(); h.forEach((v, i) => { const px = X0 + i / (h.length - 1) * W, py = Y0 + H - (v - mn) / sp * (H - 30) - 15; i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.strokeStyle = col; x.lineWidth = 6; x.lineJoin = 'round'; x.stroke();
    x.fillStyle = '#7c889d'; x.font = `24px ${F}`; x.fillText(`近 ${h.length} 個交易日`, X0, Y0 + H + 40);
  }
  x.fillStyle = '#e4e9f1'; x.font = `600 40px ${F}`; x.fillText(co.code === S.my ? '來買我的股票，當我的股東！' : '這檔你怎麼看？', 100, 1140);
  x.fillStyle = '#35d4e4'; x.font = `30px ${N}`; x.fillText(SITE().replace(/^https?:\/\//, ''), 100, 1200);
  x.fillStyle = '#7c889d'; x.font = `22px ${F}`; x.fillText('遊戲內容，公司皆為虛構，虛擬幣不能兌換現金，非投資建議。', 100, 1262);
  return cv;
}
async function shareOut(text, canvas, filename) {
  const url = SITE(), full = `${text}\n${url}`;
  let file = null;
  if (canvas) { const blob = await new Promise(r => canvas.toBlob(r, 'image/png')); file = new File([blob], filename, { type: 'image/png' }); }
  // 手機：呼叫系統分享（LINE、IG、Threads 都在裡面）
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: full }); return; }
    if (!file && navigator.share) { await navigator.share({ text: full }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  // 電腦：下載圖片＋複製文字
  if (file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  try { await navigator.clipboard.writeText(full); toast(file ? '圖片已下載，分享文字已複製' : '分享文字已複製，貼到 LINE 或 IG 就好'); }
  catch (e) { toast(file ? '圖片已下載' : '請複製網址分享：' + url); }
}
function shareStock(code) {
  const co = S.cos[code]; if (!co) return;
  const c = chgOf(co), mine = code === S.my;
  const text = mine ? `我在人生上市開了「${co.name}」（人${code}），今天 ${p2(co.price)} 元 ${arrow(c)}${apct(c)}，來買我的股票！`
    : `「${co.name}」（人${code}）今天 ${p2(co.price)} 元 ${arrow(c)}${apct(c)}，你看好還是看壞？`;
  return shareOut(text, shareCanvas(co), `人生上市_人${code}.png`);
}
function shareRank() {
  const i = (S.rank || []).findIndex(r => r.me);
  const text = i >= 0 ? `我在人生上市的股神排行第 ${i + 1} 名，總資產 ${fmt(S.rank[i].v)}，來挑戰我！` : '我在玩人生上市，把自己經營成一家上市公司，一起來！';
  return shareOut(text, null, '');
}
Object.assign(acts, {
  share: el => run(() => shareStock(el.dataset.code || sheetCode)),
  shareRank: () => run(shareRank),
});
// 個股頁：報價下方加分享鈕
{
  const base = renderSheetLive;
  renderSheetLive = function () {
    base();
    const q = $('#spLive .sp-quote');
    if (q && sheetCode && sheetCode !== 'IDX' && !q.nextElementSibling?.classList.contains('shr-row'))
      q.insertAdjacentHTML('afterend', `<div class="shr-row"><button class="link" data-act="share" data-code="${esc(sheetCode)}">分享這檔股票（產生圖卡）</button></div>`);
  };
}
// 公司頁：自己的公司加分享鈕；排行榜加分享名次
{
  const baseC = vCompany, baseR = vRank;
  vCompany = function () {
    const h = baseC();
    if (!S.my || !isListed(S.cos[S.my])) return h;
    return h + `<div class="card"><h2>邀請朋友當股東</h2><p class="note">產生一張你公司的股價圖卡，手機可以直接分享到 LINE、IG、Threads，電腦會下載圖片並複製邀請文字。</p><div class="gap"></div><button class="btn pri wide" data-act="share" data-code="${esc(S.my)}">分享我的公司</button></div>`;
  };
  vRank = function () {
    const h = baseR();
    return rTab === 'rank' ? h + `<div style="padding:0 14px 14px"><button class="btn wide" data-act="shareRank">分享我的排名</button></div>` : h;
  };
}

/* ---------- 3. 新手內容不空 ---------- */
// 自選股還沒加任何一檔時，先顯示今天的熱門股票
{
  const base = marketList;
  marketList = function () {
    if (mTab !== 'watch' || mQuery.trim() || S.watch.length) return base();
    const hot = Object.values(S.cos).filter(isListed).sort((a, b) => (b.vol || 0) - (a.vol || 0) || Math.abs(chgOf(b)) - Math.abs(chgOf(a))).slice(0, 6);
    return `<p class="note" style="margin:10px 14px">還沒有自選股，先看看今天成交最熱的股票。進個股頁按右上角 ☆ 就能加入自選。</p>${hot.map(coRow).join('')}`;
  };
}

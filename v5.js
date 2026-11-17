'use strict';
/* 人生上市 — 第五批：申報邊際遞減的標示、股東質疑。在 v4.js 之後載入。 */

// 申報項目的金額：已勾選的顯示實際存進去的金額，連續申報打折時標出第幾天
function chipAmt(co, a) {
  const e = co.today.find(x => x.id === a.id);
  if (!e || e.a === a.a) return `<small>${a.a > 0 ? '+' : ''}${fmt(a.a)}</small>`;
  return `<small class="disc">${a.a > 0 ? '+' : ''}${fmt(e.a)}${e.st ? `・連續第 ${e.st} 天` : '・連續申報打折'}</small>`;
}

/* ---------- 股東質疑 ---------- */
async function loadChallenges(code) {
  if (!CLOUD || !S.cos[code]) return;
  const rows = await q(sb.from('challenges').select('user_id').eq('code', code).eq('day', S.day));
  if (S.cos[code]) S.cos[code].ch = { n: rows.length, me: rows.some(r => r.user_id === uid) };
}
{
  const baseOps = finOps;
  finOps = function (co) {
    let h = baseOps(co);
    if (!CLOUD || co.bot || co.code === S.my || !isListed(co)) return h;
    const hd = S.hold[co.code], held = hd ? hd.sh - (hd.tb || 0) : 0, todayOps = (co.ops || []).find(o => o.d === S.day);
    const ch = co.ch || { n: 0, me: false };
    let btn;
    if (!todayOps) btn = '<p class="note">董事長今天還沒申報，申報之後才能質疑。</p>';
    else if (ch.me) btn = `<p class="note warn">你已經質疑過今天的申報。目前 ${ch.n} 位股東質疑${ch.n >= 2 ? '，今天的營收收盤時會以五折計算' : '，再 1 位就會打折'}。</p>`;
    else if (held < 1000) btn = `<p class="note">持有至少 1 張（不含今天買進）的股東可以質疑今天的申報。目前 ${ch.n} 位股東質疑。</p>`;
    else btn = `<button class="btn wide" data-act="challenge" data-code="${esc(co.code)}">質疑今天的申報（目前 ${ch.n} 位）</button>`;
    return h + `<div class="sp-pad"><div class="gap"></div>${btn}<p class="note">2 位股東質疑，董事長當天的營收在收盤時以五折計算，並發布新聞。每人每天最多質疑 3 次。</p></div>`;
  };
  // 打開個股頁、切到營運分頁、或同步時，順便讀取質疑人數
  const baseOpen = acts.open, baseRefresh = Cloud.refresh.bind(Cloud);
  acts.open = el => {
    baseOpen(el);
    const code = el.dataset.code;
    if (CLOUD && code !== 'IDX') loadChallenges(code).then(() => { if (sheetCode === code && spTab === 'ops') renderSheetLive(); }).catch(() => {});
  };
  Cloud.refresh = async function () {
    await baseRefresh();
    try {
      if (sheetCode && sheetCode !== 'IDX') await loadChallenges(sheetCode);
      if (S.my) await loadChallenges(S.my);
    } catch (e) { /* 資料庫還沒更新到第 13 版時略過 */ }
  };
  acts.challenge = el => run(async () => {
    const code = el.dataset.code, co = S.cos[code];
    if (!confirm(`質疑「${co.name}」董事長今天的營運申報？\n2 位股東質疑，今天的營收收盤時會以五折計算。每人每天最多質疑 3 次，送出後不能撤回。`)) return;
    const n = await rpc('challenge_report', { p_code: code });
    await loadChallenges(code); renderSheetLive();
    toast(n >= 2 ? '已送出質疑，今天的營收將以五折計算' : '已送出質疑，再 1 位股東質疑就會打折');
  });
}
// 董事長自己的公司頁：被質疑時提醒
{
  const base = vCompany;
  vCompany = function () {
    const h = base(), co = S.my && S.cos[S.my];
    if (!co || !co.ch || !co.ch.n) return h;
    return `<div class="card"><h2 class="dn">股東質疑 <small>${co.ch.n} 位</small></h2><p class="note">${co.ch.n >= 2 ? '今天的申報已被 2 位以上股東質疑，今天的營收收盤時會以五折計算。' : '有 1 位股東質疑你今天的申報，再 1 位就會打五折。'}誠實申報、發布營運日誌讓股東放心，是最好的回應。</p></div>` + h;
  };
}

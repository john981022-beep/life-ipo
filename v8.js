'use strict';
/* 人生上市 — 第八批：開場動畫（K 線長出來＋敲鐘開市）、訪客參觀。在 v7.js 之後載入。 */

/* ---------- 1. 開場動畫 ----------
   約 3 秒，點一下就跳過；同一次開啟只播一次（重新整理不會再播），系統設定「減少動態效果」時不播。 */
(function opening() {
  let seen = false;
  try { seen = sessionStorage.getItem('lifeipo-op') === '1'; sessionStorage.setItem('lifeipo-op', '1'); } catch (e) { /* 存不了就照播 */ }
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // K 線：20 根，前段震盪、最後一路往上衝
  let p = 50, bars = '';
  const W = 300, n = 20, bw = W / n;
  for (let i = 0; i < n; i++) {
    const up = i > 13 ? true : Math.random() > 0.45, d = i > 13 ? 6 + Math.random() * 5 : (Math.random() * 7 + 2);
    const o = p, c = up ? p - d : p + d, hi = Math.min(o, c) - Math.random() * 3, lo = Math.max(o, c) + Math.random() * 3;
    const x = i * bw + bw / 2, col = up ? 'var(--up)' : 'var(--dn)';
    bars += `<g class="op-k" style="animation-delay:${(i * 0.045).toFixed(2)}s"><line x1="${x}" x2="${x}" y1="${hi.toFixed(1)}" y2="${lo.toFixed(1)}" stroke="${col}" stroke-width="1"/><rect x="${(x - bw * 0.3).toFixed(1)}" y="${Math.min(o, c).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${Math.max(1.5, Math.abs(o - c)).toFixed(1)}" fill="${col}"/></g>`;
    p = Math.max(8, Math.min(92, c));
  }
  const tape = ['人8888 錢途無亮 ▲3.2%', '人0520 暈船航運 ▼1.8%', '人1314 一生一柿 ▲5.5%', '人8787 薪酸實業 ▲0.9%', '人3838 肝苦人文創 ▼2.4%', '人0214 單身狗糧 ▲9.9%'];
  const el = document.createElement('div');
  el.id = 'opening'; el.setAttribute('role', 'presentation');
  el.innerHTML = `<div class="op-tape"><span>${tape.concat(tape).map(t => `<i class="${t.includes('▲') ? 'up' : 'dn'}">${t}</i>`).join('')}</span></div>
    <svg class="op-chart" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">${bars}
      <polyline class="op-line" points="0,80 70,62 110,72 160,50 210,38 260,18 300,6" fill="none" stroke="var(--up)" stroke-width="2.5" stroke-linejoin="round"/></svg>
    <div class="op-bell" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 6c-2 0-3.5 1.5-3.5 3.5v1.6C19.6 13 14 20.7 14 30v12l-5 6v2h46v-2l-5-6V30c0-9.3-5.6-17-14.5-18.9V9.5C35.5 7.5 34 6 32 6z" fill="var(--yellow)"/><circle cx="32" cy="55" r="5" fill="var(--yellow)"/></svg><b>噹</b></div>
    <div class="op-flash"></div>
    <div class="op-logo"><b>人生上市</b><span>把自己經營成一家上市公司</span><small>開盤！</small></div>
    <p class="op-skip">點一下跳過</p>`;
  const close = () => { if (!el.isConnected) return; el.classList.add('op-out'); setTimeout(() => el.remove(), 380); };
  el.addEventListener('click', close);
  addEventListener('keydown', function k(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { close(); removeEventListener('keydown', k); } });
  // 等標誌蓋章動畫真的播完再停留 0.9 秒後淡出（手機效能差時動畫會變慢，不能只靠固定秒數）；最多 7 秒
  const mount = () => {
    document.body.appendChild(el);
    el.querySelector('.op-logo').addEventListener('animationend', () => setTimeout(close, 900), { once: true });
    setTimeout(close, 7000);
  };
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
})();

/* ---------- 2. 訪客參觀 ----------
   訪客用匿名身分進入，可以看行情、大盤、個股走勢、新聞和排行；
   下單、公司、庫存、聊天、自選、申購、質疑、客服都要先登入。 */
{
  const base = showAuth;
  showAuth = function () {
    base();
    const card = $('#view .card');
    if (card && !card.querySelector('[data-act="guest"]')) card.insertAdjacentHTML('beforeend', '<div class="gap"></div><button class="btn wide" data-act="guest">先以訪客身分逛逛（只能看盤）</button>');
  };
  // 需要登入才能用的動作與分頁
  const LOCKED_ACTS = new Set(['buy', 'sell', 'short', 'cover', 'ordOk', 'watch', 'chatSend', 'mic', 'challenge', 'ipoApply', 'fbSend', 'file', 'chk', 'addc', 'ann', 'ipo', 'opsPost', 'fDeclare', 'fSell', 'chatReport', 'report', 'share', 'shareRank']);
  const LOCKED_TABS = new Set(['company', 'port', 'chat']);
  async function goLogin(msg) {
    toast(msg || '這個功能要先登入或註冊');
    if (typeof closeSheet === 'function' && sheetCode) { $('#sheet').hidden = true; sheetCode = null; pending = null; }
    try { await Promise.race([sb.auth.signOut({ scope: 'local' }), new Promise(r => setTimeout(r, 2000))]); } catch (e) { /* 下面會清掉 */ }
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k); } catch (e) { /* 無痕模式 */ }
    GUEST = false; uid = null; S = null; $('#tabs').hidden = true;
    showAuth();
  }
  // 在一般的點擊處理之前攔截（capture）
  document.addEventListener('click', e => {
    if (!GUEST) return;
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (LOCKED_ACTS.has(act) || (act === 'tab' && LOCKED_TABS.has(el.dataset.k)) || (act === 'rtab' && el.dataset.id === 'support')) {
      e.stopImmediatePropagation(); e.preventDefault();
      goLogin(act === 'tab' ? '登入後才能使用這個分頁' : '登入後才能使用這個功能');
    }
  }, true);
  acts.guest = () => run(async () => {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw new Error(/disabled|not enabled/i.test(error.message) ? '訪客功能暫時關閉，請先註冊' : '訪客登入失敗，請稍後再試');
    await start();
    toast('你正在以訪客身分參觀，登入後才能下單和聊天');
  });
  acts.guestLogin = () => goLogin('登入或註冊後就能開始交易');
  // 頂列：訪客顯示「登入／註冊」按鈕
  const baseTop = renderTop;
  renderTop = function () {
    baseTop();
    if (!GUEST) return;
    const b = $('#top .brand span'); if (b) b.textContent = '訪客參觀中';
    const c = $('#top .clk');
    if (c && !c.querySelector('.glogin')) c.insertAdjacentHTML('afterbegin', '<button class="help glogin" data-act="guestLogin">登入／註冊</button>');
  };
  // 個股頁的下單區換成登入提示
  const baseSheet = renderSheet;
  renderSheet = function (qty) {
    baseSheet(qty);
    if (!GUEST) return;
    const t = $('#sheetBody .sp-trade');
    if (t) t.innerHTML = '<p class="note" style="margin:0 0 8px">訪客只能看盤。登入或註冊後就能下單，還送 100 萬虛擬幣。</p><button class="btn pri wide" data-act="guestLogin">登入／註冊開始交易</button>';
    const star = $('#sheetBody .sp-nav .star'); if (star) star.hidden = true;
  };
  // 訪客不顯示新手導覽與下單導覽
  const baseTour = tourStart;
  tourStart = function (force) { if (!GUEST) baseTour(force); };
}

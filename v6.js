'use strict';
/* 人生上市 — 第六批：密碼顯示與忘記密碼、新手介紹可滑動、下單操作導覽、聊天語音輸入、
   個股頁滑動轉場、可安裝到手機（PWA）。在 v5.js 之後載入。 */

const SITE_URL = () => location.origin + location.pathname.replace(/index\.html$/, '');
const pwField = (id, label, ac) => `<label for="${id}">${label}</label>
  <div class="pw"><input id="${id}" type="password" autocomplete="${ac}" minlength="8"><button type="button" class="eye" data-act="eye" data-for="${id}" aria-label="顯示密碼" aria-pressed="false">顯示</button></div>`;

/* ---------- 1. 登入頁：密碼可顯示、忘記密碼、重設密碼 ---------- */
showAuth = function () {
  gate(`<div class="card"><h2>登入</h2>
    <label for="aEmail">Email</label><input id="aEmail" type="email" autocomplete="email" inputmode="email">
    ${pwField('aPass', '密碼（至少 8 碼）', 'current-password')}
    <div class="gap"></div><div class="grid2"><button class="btn pri" data-act="login">登入</button><button class="btn" data-act="signup">註冊新帳號</button></div>
    <button class="link" data-act="forgot">忘記密碼？</button>
    <div class="gap"></div>${RULES}<p class="note">註冊即表示你同意以上規範。Email 只用於登入與找回密碼，不會公開。</p></div>`);
};
function showForgot() {
  const em = ($('#aEmail') || {}).value || '';
  gate(`<div class="card"><h2>忘記密碼</h2>
    <p class="note">輸入你註冊時用的 Email，我們會寄一封重設密碼的信給你。點信裡的連結會回到遊戲，設定新密碼後就能登入。</p>
    <label for="fEmail">Email</label><input id="fEmail" type="email" autocomplete="email" inputmode="email" value="${esc(em)}">
    <div class="gap"></div><button class="btn pri wide" data-act="forgotSend">寄出重設密碼信</button>
    <button class="link" data-act="backLogin">回到登入</button>
    <p class="note">沒收到信的話，請看一下垃圾郵件匣。為了安全，同一個 Email 短時間內只能寄一次。</p></div>`);
}
function showReset() {
  gate(`<div class="card"><h2>設定新密碼</h2>
    ${pwField('rPass', '新密碼（至少 8 碼）', 'new-password')}
    ${pwField('rPass2', '再輸入一次新密碼', 'new-password')}
    <div class="gap"></div><button class="btn pri wide" data-act="resetSave">儲存新密碼</button></div>`);
}
{
  // 從重設密碼信回來時，網址會帶 type=recovery；先顯示設定新密碼，不直接進遊戲
  let recovering = /type=recovery/.test(location.hash);
  const baseStart = start;
  start = async function () {
    if (CLOUD && window.supabase) {
      if (!sb) sb = window.supabase.createClient(CFG.url, CFG.key);
      sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { recovering = true; showReset(); } });
      if (recovering) { await sb.auth.getSession(); return showReset(); }
    }
    return baseStart();
  };
  const strong = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
  const baseSignup = acts.signup;
  Object.assign(acts, {
    eye: el => {
      const inp = $('#' + el.dataset.for); if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      el.textContent = show ? '隱藏' : '顯示';
      el.setAttribute('aria-pressed', String(show)); el.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
    },
    forgot: showForgot,
    backLogin: showAuth,
    forgotSend: () => run(async () => {
      const email = $('#fEmail').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('請輸入正確的 Email');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL() });
      if (error) throw new Error(/rate|seconds/i.test(error.message) ? '寄信太頻繁了，請過幾分鐘再試' : '寄信失敗，請稍後再試');
      // 不論這個 Email 有沒有註冊都顯示同樣的訊息，避免被拿來查誰有帳號
      gate(`<div class="card"><h2>信已寄出</h2><p class="note">如果 ${esc(email)} 有註冊過，幾分鐘內會收到重設密碼的信。點信裡的連結，回到遊戲設定新密碼。</p><div class="gap"></div><button class="btn wide" data-act="backLogin">回到登入</button></div>`);
    }),
    resetSave: () => run(async () => {
      const p = $('#rPass').value, p2 = $('#rPass2').value;
      if (!strong(p)) throw new Error('新密碼至少 8 碼，而且要同時有英文字母和數字');
      if (p !== p2) throw new Error('兩次輸入的密碼不一樣');
      const { error } = await sb.auth.updateUser({ password: p });
      if (error) throw new Error('重設失敗，連結可能已過期，請重新申請');
      recovering = false;
      history.replaceState(null, '', location.pathname);
      toast('新密碼已儲存');
      await baseStart();
    }),
    // 註冊時要求比較安全的密碼
    signup: el => {
      const p = ($('#aPass') || {}).value || '';
      if (!strong(p)) return toast('密碼至少 8 碼，而且要同時有英文字母和數字');
      return baseSignup(el);
    },
  });
}

/* ---------- 2. 新手介紹：左右滑動換頁 ---------- */
function onSwipe(el, cb, opts = {}) {
  let x0 = null, y0 = 0, t0 = 0, skip = false;
  el.addEventListener('touchstart', e => {
    const t = e.touches[0]; skip = opts.ignore ? opts.ignore(e.target) : false;
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null || skip) { x0 = null; return; }
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0, edge = x0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - t0 > 700) return;
    cb(dx < 0 ? 'left' : 'right', edge);
  }, { passive: true });
}
{
  const t = setInterval(() => {
    const el = $('#intro'); if (!el || el.dataset.sw) return;
    el.dataset.sw = '1';
    onSwipe(el, dir => { if (dir === 'left') acts.introNext(); else acts.introPrev(); });
  }, 400);
  setTimeout(() => clearInterval(t), 60000);
}
// 介紹最後一頁加上「重看下單導覽」
{
  const last = INTRO[INTRO.length - 1];
  last.b += '<div class="gap"></div><button class="btn wide" data-act="tourReplay">重看下單操作導覽</button>';
}

/* ---------- 3. 下單操作導覽（第一次打開個股頁時） ---------- */
const TOUR_KEY = 'lifeipo-tour-v1';
const TOUR = [
  ['.sp-quote', '即時報價', '這是目前成交價和今天的漲跌。紅色是漲、綠色是跌，跟台股一樣。'],
  ['.sp-tabs', '看盤分頁', '分時是今天的走勢，日 K 看每天的漲跌，明細是每一筆成交，營運是董事長每天申報了什麼。左右滑動也能切換。'],
  ['svg.kchart', '十字查價', '手指按住走勢圖左右移動，可以看到每個時間點的價格和成交量。'],
  ['.qtyrow', '數量與單位', '輸入要買幾張，右邊可以改成「股」買零股。1 張 = 1,000 股。'],
  ['[data-act="buy"]', '買進', '按下去會先出現確認單，告訴你成交價、手續費和總金額，確認後才真的下單。'],
  ['[data-act="sell"]', '賣出', '有庫存才能賣。賣出時會收手續費和證交稅，當天買當天賣的稅只收一半。'],
  ['[data-act="short"]', '先賣後買', '看壞也能賺：先賣再買回來。但收盤 23:00 前一定要買回，否則會強制回補並收違約金。'],
  ['.sp-nav .star', '自選股', '按星星把這檔加入自選，行情頁的「自選」就能快速找到。'],
  ['.sp-nav button', '返回', '看完了按這裡回到行情頁，也可以從畫面最左邊往右滑。'],
];
let tourAt = -1, tourSteps = [];
function tourStart(force) {
  if (!force) { try { if (localStorage.getItem(TOUR_KEY)) return; } catch (e) { /* 存不了就照常顯示 */ } }
  tourSteps = TOUR.filter(s => { const el = document.querySelector('#sheet:not([hidden]) ' + s[0]); return el && el.getBoundingClientRect().width > 0; });
  if (!tourSteps.length) return;
  tourAt = 0; tourShow();
}
function tourShow() {
  let ov = $('#tour');
  if (!ov) { ov = document.createElement('div'); ov.id = 'tour'; document.body.appendChild(ov); }
  const [sel, title, text] = tourSteps[tourAt], el = document.querySelector('#sheet ' + sel);
  if (!el) return tourEnd();
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = el.getBoundingClientRect(), pad = 6, vh = innerHeight, below = r.top + r.height / 2 < vh / 2;
  const last = tourAt === tourSteps.length - 1;
  ov.innerHTML = `<div class="tour-hole" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>
    <div class="tour-tip ${below ? 'below' : 'above'}" style="${below ? `top:${r.bottom + pad + 14}px` : `bottom:${vh - r.top + pad + 14}px`}" role="dialog" aria-live="polite">
      <i class="tour-arrow"></i>
      <small>${tourAt + 1}／${tourSteps.length}</small><b>${title}</b><p>${text}</p>
      <div class="tour-btns"><button class="link" data-act="tourEnd">略過導覽</button><button class="btn pri" data-act="${last ? 'tourEnd' : 'tourNext'}">${last ? '開始交易' : '下一步'}</button></div></div>`;
  ov.hidden = false;
  // 箭頭對準目標中央
  const tip = ov.querySelector(".tour-tip"), ar = ov.querySelector(".tour-arrow"), tl = tip.getBoundingClientRect().left;
  ar.style.left = Math.min(Math.max(r.left + r.width / 2 - tl - 8, 12), tip.offsetWidth - 28) + "px";
}
function tourEnd() {
  const ov = $('#tour'); if (ov) ov.hidden = true; tourAt = -1;
  try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* 無痕模式 */ }
}
Object.assign(acts, {
  tourNext: () => { tourAt++; tourShow(); },
  tourEnd,
  tourReplay: () => {
    closeIntro();
    const first = Object.values(S.cos).find(c => isListed(c) && c.code !== S.my);
    if (!first) return;
    tab = 'market'; render();
    const el = document.createElement('button'); el.dataset.code = first.code; acts.open(el);
    setTimeout(() => tourStart(true), 500);
  },
});
addEventListener('resize', () => { if (tourAt >= 0) tourShow(); });

/* ---------- 4. 個股頁滑動轉場 ---------- */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
{
  const baseOpen = openSheet, baseClose = closeSheet;
  openSheet = function (code) {
    baseOpen(code);
    const sh = $('#sheet');
    if (!reduceMotion) { sh.classList.remove('slide-out'); sh.classList.add('slide-in'); setTimeout(() => sh.classList.remove('slide-in'), 320); }
    if (code !== 'IDX' && CLOUD) setTimeout(() => tourStart(false), 450);
  };
  closeSheet = function () {
    const sh = $('#sheet');
    if (tourAt >= 0) tourEnd();
    if (reduceMotion || sh.hidden) return baseClose();
    sh.classList.add('slide-out');
    setTimeout(() => { sh.classList.remove('slide-out'); baseClose(); }, 260);
  };
  acts.closeSheet = () => closeSheet();  // 返回鈕原本綁的是舊函式，改成呼叫有動畫的版本
  // 分頁切換：新內容從切換方向滑進來
  const order = () => [...document.querySelectorAll('.sp-tabs button')].map(b => b.dataset.id);
  const baseLive = renderSheetLive;
  let lastTab = null;
  renderSheetLive = function () {
    baseLive();
    const o = order(), was = o.indexOf(lastTab), now = o.indexOf(spTab);
    if (lastTab && lastTab !== spTab && was >= 0 && now >= 0 && !reduceMotion) {
      const tabs = $('#spLive .sp-tabs'), cls = now > was ? 'from-right' : 'from-left';
      for (let el = tabs && tabs.nextElementSibling; el; el = el.nextElementSibling) { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 300); }
      const on = tabs && tabs.querySelector('.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    lastTab = spTab;
  };
  // 手勢：個股頁內容左右滑換分頁；從最左邊往右滑返回
  const sh = $('#sheet');
  onSwipe(sh, (dir, x0) => {
    if (sh.hidden || pending) return;
    if (dir === 'right' && x0 < 30) return closeSheet();
    const o = order(), i = o.indexOf(spTab), j = dir === 'left' ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= o.length) return;
    spTab = o[j]; renderSheetLive();
  }, { ignore: t => !!(t.closest('svg.kchart') || t.closest('.sp-trade') || t.closest('input,select,textarea')) });
}

/* ---------- 5. 聊天室語音輸入 ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
{
  const base = vChat;
  vChat = function () {
    let h = base();
    if (!SR) return h;
    return h.replace('<button class="btn pri" data-act="chatSend">送出</button>', '<button class="btn mic" data-act="mic" aria-label="語音輸入" aria-pressed="false">🎤</button><button class="btn pri" data-act="chatSend">送出</button>');
  };
  acts.mic = el => {
    if (rec) { rec.stop(); return; }
    const inp = $('#chatT'), before = inp.value;
    rec = new SR(); rec.lang = 'zh-TW'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; inp.value = (before + t).slice(0, 120); };
    rec.onerror = e => { toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? '請允許使用麥克風才能語音輸入' : '沒有聽清楚，再試一次'); };
    rec.onend = () => { rec = null; const b = $('[data-act="mic"]'); if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); } inp.focus(); };
    try { rec.start(); el.classList.add('on'); el.setAttribute('aria-pressed', 'true'); toast('請開始說話，說完會自動停止'); }
    catch (e) { rec = null; toast('這個瀏覽器不支援語音輸入'); }
  };
}

/* ---------- 6. 可安裝到手機（PWA） ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* 註冊失敗不影響遊戲 */ }));
}
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S && tab === 'market') render(); });
addEventListener('appinstalled', () => { installEvt = null; toast('已安裝到主畫面'); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const INSTALL_KEY = 'lifeipo-install-hide';
function installCard() {
  if (isStandalone()) return '';
  try { if (localStorage.getItem(INSTALL_KEY)) return ''; } catch (e) { /* 照常顯示 */ }
  if (installEvt) return `<div class="inst"><div><b>把人生上市裝到手機</b><small>像 App 一樣從主畫面打開，全螢幕看盤</small></div><button class="btn pri" data-act="install">安裝</button><button class="x" data-act="instHide" aria-label="不要再顯示">×</button></div>`;
  if (isIOS()) return `<div class="inst"><div><b>把人生上市裝到手機</b><small>用 Safari 打開，點下方的「分享」按鈕，再選「加入主畫面」</small></div><button class="x" data-act="instHide" aria-label="不要再顯示">×</button></div>`;
  return '';
}
{
  const base = vMarket;
  vMarket = function () { return installCard() + base(); };
  Object.assign(acts, {
    install: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; render(); },
    instHide: () => { try { localStorage.setItem(INSTALL_KEY, '1'); } catch (e) { /* 無痕模式 */ } render(); },
  });
}

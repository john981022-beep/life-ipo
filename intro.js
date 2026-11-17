'use strict';
/* 人生上市 — 新手介紹。第一次進入遊戲時自動出現，之後可從右上角「玩法」再打開。
   看過的紀錄存在瀏覽器（只是方便，清掉資料就會再看到一次）。 */

const INTRO_KEY = 'lifeipo-intro-v1';
const INTRO = [
  {
    t: '歡迎來到人生上市',
    b: `<p class="lead">把自己經營成一家上市公司，也買賣朋友的人生。</p>
      <div class="ib"><b>你現在有</b><span>100 萬虛擬幣</span></div>
      <div class="ib"><b>你可以</b><span>買賣其他人的公司股票</span></div>
      <div class="ib"><b>也可以</b><span>開一家自己的公司，當董事長</span></div>
      <p class="note">股價會即時跳動，有大盤、分時走勢、日 K、成交明細，看盤體驗跟真的券商 App 一樣。</p>`,
  },
  {
    t: '你的人生就是公司營收',
    b: `<p>開公司之後，每天到「公司」頁點選今天做了什麼：</p>
      <div class="ib up"><b>算營收</b><span>運動、讀書、早睡、準時下班、陪家人…</span></div>
      <div class="ib dn"><b>算成本與費用</b><span>熬夜、亂花錢、滑手機三小時、抽卡沒中…</span></div>
      <p>每天 23:00 收盤時，當天賺多少會推動你的股價。累積起來就是月營收、季報、每股盈餘和股利，全部照台灣上市公司的時程走。</p>
      <p class="note">你申報了什麼，股東都看得到。董事長連續熬夜五天，可能就有人開始賣你的股票。</p>`,
  },
  {
    t: '好玩的地方',
    b: `<div class="ib"><b>重大訊息</b><span>分手是「終止策略聯盟」，脫單是「完成策略聯盟」，換工作是「業務轉型」。用公司的口吻公告你的人生大事。</span></div>
      <div class="ib"><b>新股抽籤</b><span>朋友用公開承銷上市時可以申購，超額就抽籤，掛牌後五天不設漲跌幅。</span></div>
      <div class="ib"><b>當沖</b><span>當天買賣稅減半，也能先賣後買。</span></div>
      <div class="ib"><b>聊天室</b><span>重大訊息、漲跌停、連三漲都會即時跳出來，大家一起看熱鬧。</span></div>
      <div class="ib"><b>股神排行榜</b><span>比誰的總資產最多。</span></div>`,
  },
  {
    t: '交易規則',
    b: `<div class="kv"><span>交易時間（台北時間）</span><span>日盤 09:00–13:30<br>夜盤 20:00–23:00</span></div>
      <div class="kv"><span>收盤結算</span><span>每天 23:00</span></div>
      <div class="kv"><span>漲跌幅限制</span><span>每天 ±10%</span></div>
      <div class="kv"><span>交易單位</span><span>1 張 = 1,000 股，也可以買零股</span></div>
      <div class="kv"><span>手續費</span><span>0.1425%</span></div>
      <div class="kv"><span>證交稅（賣出時）</span><span>0.3%，當沖 0.15%</span></div>
      <div class="kv"><span>先賣後買</span><span>收盤前要回補，否則強制回補加 1% 違約金</span></div>
      <p class="note">每家公司發行 1,000 張，創辦人持有 500 張，掛牌滿 30 天才能分批賣出。</p>`,
  },
  {
    t: '遊戲守則',
    b: `<div class="ib"><b>虛擬幣只在遊戲裡用</b><span>不能購買、不能換成現金或獎品，也不能轉讓。</span></div>
      <div class="ib"><b>所有公司都是虛構的</b><span>跟真實企業無關，內容不構成投資建議。股票代號前面都有「人」字，不會和真實股票混淆。</span></div>
      <div class="ib"><b>友善交流</b><span>公司名稱、簡介、公告和聊天都不能出現不雅、色情、歧視或攻擊他人的內容，也不要用別人的本名取名。違規內容會被檢舉、隱藏或禁言。</span></div>
      <p class="note">遇到問題或有建議，到「排行」分頁的「客服回報」告訴我們。</p>`,
  },
];
let introAt = 0;

function introHtml() {
  const s = INTRO[introAt], last = introAt === INTRO.length - 1;
  return `<div class="intro-card" role="dialog" aria-modal="true" aria-labelledby="introT">
    <div class="intro-top"><span>${introAt + 1}／${INTRO.length}</span><button data-act="introClose" aria-label="關閉介紹">跳過</button></div>
    <h2 id="introT">${s.t}</h2>
    <div class="intro-b">${s.b}</div>
    <div class="intro-dots">${INTRO.map((_, i) => `<i class="${i === introAt ? 'on' : ''}"></i>`).join('')}</div>
    <div class="grid2">${introAt ? '<button class="btn" data-act="introPrev">上一頁</button>' : '<span></span>'}
      <button class="btn pri" data-act="${last ? 'introClose' : 'introNext'}">${last ? '我了解了，開始玩' : '下一頁'}</button></div></div>`;
}
function showIntro(at = 0) {
  introAt = at;
  let el = $('#intro');
  if (!el) { el = document.createElement('div'); el.id = 'intro'; document.body.appendChild(el); }
  el.innerHTML = introHtml(); el.hidden = false;
  const b = el.querySelector('.btn.pri'); if (b) b.focus();
}
function closeIntro() {
  const el = $('#intro'); if (el) el.hidden = true;
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* 無痕模式存不了，下次會再看到，不影響遊戲 */ }
}

Object.assign(acts, {
  introNext: () => showIntro(Math.min(introAt + 1, INTRO.length - 1)),
  introPrev: () => showIntro(Math.max(introAt - 1, 0)),
  introClose: closeIntro,
  introOpen: () => showIntro(0),
});
document.addEventListener('keydown', e => {
  const el = $('#intro'); if (!el || el.hidden) return;
  if (e.key === 'Escape') closeIntro();
  else if (e.key === 'ArrowRight') acts.introNext();
  else if (e.key === 'ArrowLeft') acts.introPrev();
});

// 右上角加一個「玩法」按鈕
{
  const base = renderTop;
  renderTop = function () {
    base();
    const c = $('#top .clk');
    if (c && !c.querySelector('.help')) c.insertAdjacentHTML('afterbegin', '<button class="help" data-act="introOpen">玩法說明</button>');
  };
}
// 第一次進入遊戲（底部分頁出現）時自動打開
{
  const timer = setInterval(() => {
    const tabs = $('#tabs');
    if (!tabs || tabs.hidden || !S) return;
    clearInterval(timer);
    let seen = false;
    try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { /* 讀不到就當作沒看過 */ }
    if (!seen) showIntro(0);
  }, 500);
}

'use strict';
/* 人生上市 — 第三批功能的畫面：
   產業兩層選單、兩種上市方式、「人」字代號、當沖（含先賣後買）、創辦人持股轉讓、營運日誌、聊天檢舉。
   在 ceo.js 之後載入，會覆蓋或包住前面檔案的同名函式。 */

// 股票代號顯示時一律加上「人」，和真實股票代號區隔
const cd = code => '人' + code;
// 新聞文字裡的（0706）也補上「人」
const nz = t => esc(t).replace(/（(\d{4})）/g, '（人$1）');

/* ---------- 產業：先選大類，再選細項 ---------- */
const IND = [
  ['科技電子', ['半導體業', '晶片設計業', '電子零組件業', '光電業', '通信網路業', '資訊服務業', '軟體開發業', '人工智慧業', '雲端運算業', '資安防護業', '遊戲開發業', '電競產業', '機器人產業', '無人機產業', '電動車產業', '電池儲能業', '元宇宙地產業', '當機重開機服務業', '藍屏觀賞業', '密碼忘記救援業', '更新到一半產業', '充電線失蹤調查業', '訊號格數焦慮業', '電量焦慮產業']],
  ['金融保險', ['銀行業', '保險業', '證券期貨業', '投資信託業', '租賃業', '支付金流業', '記帳理財業', '月光族金融業', '存錢筒管理業', '零用錢信託業', '紅包理財業', '發票對獎業', '學貸金融業', '孝親費金融業', '分期零利率研究業', '錢包失血管理業', '薪水過路財神業', '樂觀估值業', '套牢陪伴業', '抄底抄到半山腰業', '停損做不到產業', '本金保衛業']],
  ['餐飲食品', ['食品工業', '餐飲業', '手搖飲品業', '咖啡飲品業', '烘焙業', '便當業', '火鍋外交業', '宵夜產業', '吃到飽產業', '早餐店經濟', '夜市小吃業', '美食探店業', '減肥失敗業', '便當選擇困難業', '咖啡因依賴業', '泡麵研發業', '剩菜再生業', '珍珠加量業', '香菜爭議調解業', '鳳梨披薩外交業', '第二個胃產業', '吃播陪伴業', '半糖少冰協商業', '冰箱剩食考古業']],
  ['醫療健康', ['生技醫療業', '製藥業', '醫療器材業', '長照服務業', '健身產業', '按摩養生業', '睡眠產業', '眼睛疲勞照護業', '肩頸僵硬復健業', '熬夜產業', '賴床產業', '健身房捐款業', '保健食品囤積業', '體重管理失敗業', '喝水提醒業', '久坐產業', '黑眼圈養殖業', '補眠產業', '掉髮觀測業', '過敏季節限定業', '伸展拉筋業', '養生朋克業']],
  ['製造工業', ['鋼鐵工業', '塑膠工業', '紡織纖維業', '機械製造業', '汽車工業', '化學工業', '水泥工業', '造紙工業', '橡膠工業', '玻璃建材業', '電機機械業', '手工藝製造業', '模型組裝業', '積木違建業', '家具組裝崩潰業', '螺絲多一顆產業', '說明書失蹤業', '膠帶萬用修理業', '紙箱收藏業', '電池永遠沒電業', '半成品倉儲業', '三分鐘熱度製造業']],
  ['營建不動產', ['建材營造業', '不動產業', '室內設計業', '營造修繕業', '租屋產業', '搬家業', '物業管理業', '房東關係維護業', '合租外交業', '頭期款儲蓄業', '看房觀光業', '收納空間不足業', '斷捨離失敗業', '陽台植物園業', '隔音不良研究業', '管線漏水追蹤業', '違章夢想建築業', '空中樓閣建設業', '沙發馬鈴薯養殖業', '床鋪引力研究業']],
  ['交通運輸', ['航運業', '航空業', '鐵路運輸業', '物流貨運業', '計程車業', '共享機車業', '外送平台業', '快遞業', '遠距離物流業', '網購包裹物流業', '塞車觀光業', '找車位產業', '迷路導航業', '末班車衝刺業', '誤點理由製造業', '行李超重業', '通勤補眠業', '暈船產業', '備胎倉儲業', '繞路散心業', '下錯站探險業', '公車過站不停研究業']],
  ['零售百貨', ['貿易百貨業', '便利商店業', '電商平台業', '服飾業', '美妝保養業', '禮品業', '文具業', '二手拍賣業', '團購主產業', '盲盒抽卡業', '限量搶購業', '衝動下單業', '購物車堆積業', '免運湊單業', '週年慶備戰業', '贈品收藏業', '退貨物流業', '開箱產業', '比價研究業', '集點強迫症業', '試吃環島業', '只逛不買業']],
  ['文化娛樂', ['文化創意業', '出版業', '影音串流業', '廣告行銷業', '音樂產業', '電影產業', '動漫宅經濟', '追星應援業', '追劇馬拉松業', '演唱會搶票業', '迷因製造業', '梗圖進出口業', '韓流進口業', '直播產業', '自媒體產業', '網紅孵化業', '劇透防治業', '片尾彩蛋等待業', '二創產業', '冷知識批發業', '諧音梗製造業', '尷尬舞蹈業', '洗腦神曲產業', '電競熬夜業']],
  ['教育學習', ['補習教育業', '語言學習業', '線上課程業', '幼兒教育業', '證照考試業', '期末爆肝業', '死線衝刺業', '翹課觀光業', '報告拼裝業', '社團經營業', '考研重考業', '打工換宿業', '筆記美化業', '臨時抱佛腳業', '選課搶位業', '小組報告擺爛觀察業', '單字背了又忘業', '讀書計畫製作業', '課本收藏業', '畢業即失業預備業', '螢光筆塗滿業', '圖書館佔位業']],
  ['職場人生', ['社畜代工業', '加班製造業', '摸魚養殖業', '會議馬拉松業', '簡報美化業', '離職預備業', '斜槓多角化經營', '自由接案業', '老闆情緒管理業', '午休經濟', '客服外包業', '管理顧問業', '人力派遣業', '已讀不回業', '信件開頭問候業', '週一症候群產業', '準時下班研究業', '特休存量管理業', '履歷美化業', '面試話術業', '群組潛水業', '背鍋物流業', '畫大餅烘焙業', '打卡藝術業']],
  ['感情人際', ['戀愛腦產業', '月老媒合業', '婚姻合夥事業', '單身貴族業', '曖昧不明業', '失戀重整業', '媒合平台業', '徵信業', '親戚問候應對業', '長輩圖出口業', '神隊友產業', '豬隊友產業', '好人卡印製業', '紀念日備忘業', '冷戰外交業', '吃醋釀造業', '閨蜜情報業', '兄弟義氣業', '尬聊產業', '句點王產業', '道歉文案業', '和好儀式業', '飯搭子媒合業', '育兒永動機產業']],
  ['生活服務', ['療癒服務業', '洗衣業', '保全業', '家事外包業', '美容美髮業', '寵物服務業', '貓奴服務業', '狗派遛狗業', '觀光餐旅業', '影印輸出業', '電信業', '電力能源業', '拖延症候群產業', '選擇障礙顧問業', '碎念製造業', '找東西產業', '鑰匙失蹤協尋業', '雨傘流通業', '襪子單隻失蹤業', '冰箱考古業', '植物殺手園藝業', '鬧鐘貪睡業', '垃圾車追趕業', '露營裝備軍備業']],
  ['身心靈玄學', ['塔羅占卜業', '星座命理業', '冥想放空業', '情緒勞動業', '心靈雞湯製造業', '自我懷疑業', '內耗產業', '躺平產業', '水逆甩鍋業', '風水擺設業', '許願池管理業', '轉運手環業', '拜拜跑廟業', '好運借貸業', '人品儲蓄業', '玻璃心修復業', '正能量批發業', '厭世美學業', '發呆產業', '佛系經營業', '鬆弛感養成業', '情緒價值供應業']],
  ['農林漁牧與公共', ['農業', '漁業', '畜牧業', '林業', '公共事業', '環保回收業', '綠能環保業', '志工服務業', '社區營造業', '里長伯服務業', '巷口情報業', '流浪貓外交業', '資源回收分類研究業', '停水停電應變業', '颱風假期待業', '公園運動器材業', '阿嬤菜園業', '鄰居借醬油業', '路邊攤觀察業', '陽台種菜失敗業']],
  ['異想天開', ['時光機維修業', '外星人接待業', '平行宇宙旅遊業', '恐龍復育業', '雲朵養殖業', '彩虹批發業', '月球房地產業', '夢境出租業', '超能力開發業', '龍族飼育業', '魔法掃帚物流業', '時間暫停服務業', '隱形斗篷製造業', '空氣販售業', '影子保管業', '回憶典當業', '未來預購業', '宇宙無敵綜合業', '神秘事業', '不明產業', '其他']],
];
const indOptions = i => IND[i][1].map(x => `<option>${x}</option>`).join('');

function ipoForm() {
  return `<div class="card"><h2>申請上市（IPO）</h2>
    <p class="note">發行 ${lots(SHARES)} 張（${fmt(SHARES)} 股），你持有 ${lots(FOUNDER)} 張創辦人持股，另外 ${lots(FLOAT)} 張在市場流通。上市後你就是董事長，要負責申報營運、公告月營收、發布重大訊息。</p>
    <label for="fName">公司名稱</label><input id="fName" maxlength="20" placeholder="例如：小恩療癒股份有限公司"><p class="note">請勿使用真實企業或品牌名稱，也不要用他人姓名取名。</p>
    <label for="fCode">股票代號（四碼數字，顯示時前面會加「人」）</label><input id="fCode" maxlength="4" inputmode="numeric" placeholder="例如生日 0706 → 人0706"><p class="note">和真實上市櫃股票相同的代號不能使用。</p>
    <label for="fCat">產業大類（共 ${IND.length} 類、${IND.reduce((a, g) => a + g[1].length, 0)} 種產業）</label><select id="fCat">${IND.map((g, i) => `<option value="${i}">${g[0]}</option>`).join('')}</select>
    <label for="fInd">產業</label><select id="fInd">${indOptions(0)}</select>
    <label for="fIntro">公司簡介與營業項目</label><textarea id="fIntro" maxlength="120" placeholder="本公司主要從事…"></textarea>
    ${CLOUD ? `<label for="fMode">上市方式</label><select id="fMode"><option value="direct">直接上市：今天就以 10 元掛牌</option><option value="public">公開承銷：5 個交易日後掛牌，價格看表現</option></select>
    <p class="note"><b class="yl">直接上市</b>：送件立刻掛牌，固定 10 元，沒有申購抽籤和蜜月期。<br><b class="yl">公開承銷</b>：先 3 天輔導期（這三天的營運決定承銷價，5 到 50 元），再 2 天公開申購抽籤，掛牌後前五天不設漲跌幅限制。比較慢，但表現好的話掛牌價比較高，也會有一批抽中的股東。</p>` : ''}
    <div class="gap"></div><button class="btn pri wide" data-act="ipo">${CLOUD ? '送件申請上市' : '敲鐘上市'}</button></div>`;
}

/* ---------- 創辦人持股：閉鎖、申報、賣出 ---------- */
const founderShares = co => co.fs == null ? FOUNDER : co.fs;
// 已解除閉鎖、還沒賣掉的張數（股）。掛牌滿 30 天解除 150 張，滿 60 天再解除 150 張，至少保留 200 張。
function founderUnlocked(co) {
  if (!CLOUD || !co || !isListed(co)) return 0;
  const fs = founderShares(co), ld = co.listDay || 1;
  return Math.max(0, S.day >= ld + 60 ? fs - 200000 : S.day >= ld + 30 ? fs - 350000 : 0);
}
function netWorth() {
  let v = S.cash;
  for (const [c, h] of Object.entries(S.hold)) if (S.cos[c]) v += h.sh * S.cos[c].price;
  // 創辦人持股只計入已解除閉鎖的部分
  if (S.my && S.cos[S.my]) v += founderUnlocked(S.cos[S.my]) * S.cos[S.my].price;
  return v;
}
function founderCard() {
  const co = S.cos[S.my];
  if (!CLOUD || !isListed(co)) return '';
  const ld = co.listDay || 1, can = founderUnlocked(co), f = S.fdecl, fs = founderShares(co);
  const opt = (max, sel) => Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>${i + 1} 張</option>`).join('');
  let body;
  if (S.day < ld + 30) body = `<div class="todo"><div><b>閉鎖期</b><small>掛牌滿 30 天才能申報轉讓。第 ${ld + 30} 交易日起解除 150 張，還有 ${ld + 30 - S.day} 個交易日；第 ${ld + 60} 交易日起再解除 150 張。</small></div></div>`;
  else if (f && f.left > 0 && S.day <= f.until) {
    const today = f.soldDay === S.day ? f.soldToday : 0, max = Math.min(10 - today / 1000, f.left / 1000);
    body = `<div class="kv"><span>已申報、尚未賣出</span><span>${lots(f.left)} 張</span></div>
      <div class="kv"><span>可賣出期間</span><span>第 ${f.from}～${f.until} 交易日</span></div>
      <div class="kv"><span>今日已賣</span><span>${lots(today)}／10 張</span></div>
      ${S.day < f.from ? `<p class="note">申報後第 3 天起才能賣，第 ${f.from} 交易日開始。</p>`
      : max >= 1 ? `<div class="gap"></div><div class="fb-ed"><select id="fsN" aria-label="賣出張數">${opt(Math.floor(max), 1)}</select><button class="btn sell" data-act="fSell" ${marketState().open ? '' : 'disabled'}>賣出創辦人持股</button></div>${marketState().open ? '' : '<p class="note">目前休市，開盤後才能賣。</p>'}`
      : '<p class="note">今天的賣出上限已用完，明天再賣。</p>'}`;
  } else if (can >= 1000) body = `<div class="kv"><span>目前可申報轉讓</span><span>${lots(can)} 張</span></div>
      <div class="gap"></div><div class="fb-ed"><select id="fdN" aria-label="申報張數">${opt(Math.min(50, can / 1000), Math.min(10, can / 1000))}</select><button class="btn" data-act="fDeclare">申報轉讓</button></div>
      <p class="note">申報會發布「內部人持股轉讓申報」公告，所有人都看得到。申報後第 3 天起可以賣，效期 30 天，每天最多賣 10 張。</p>`;
  else body = '<p class="note">目前沒有可以申報轉讓的創辦人持股。</p>';
  return `<div class="card"><h2>創辦人持股轉讓 <small>目前持有 ${lots(fs)} 張</small></h2>${body}
    <p class="note">至少要保留 200 張。已解除閉鎖的持股會計入你的總資產與排行。賣出時和一般賣單一樣會壓低股價。</p></div>`;
}

/* ---------- 今日營運：即時預估＋發布營運日誌 ---------- */
function opsCard() {
  const co = S.cos[S.my], t = todayTotals(co), net = t.rev - t.exp;
  const est = co.today.length ? clamp(net / CAP, -1, 1) * 5 : -1;
  return `<div class="card"><h2>今日營運成績 <small>收盤（23:00）結算</small></h2>
    <div class="kv"><span>今日預估淨利</span><b class="${cls(net)}">${(net > 0 ? '+' : '') + fmt(net)}</b></div>
    <div class="kv"><span>對今天收盤股價的影響</span><b class="${cls(est)}">約 ${(est > 0 ? '+' : '') + est.toFixed(1)}%</b></div>
    <p class="note">${co.today.length ? '這是營運表現帶來的部分，實際收盤價還會受買賣和隨機波動影響。申報內容會累計成月營收、季報和股利，其他玩家在你的個股頁「營運」分頁看得到。' : '今天還沒申報。整天沒申報，收盤時股價會小跌約 1%。到下面「今日營運申報」點選今天發生的事。'}</p>
    ${CLOUD ? `<div class="gap"></div><button class="btn wide" data-act="opsPost" ${co.today.length && !S.opsPosted ? '' : 'disabled'}>${S.opsPosted ? '今天已發布營運日誌' : '發布營運日誌到新聞與聊天室'}</button>` : ''}</div>`;
}
{
  const base = vCompany;
  vCompany = function () { return S.my ? opsCard() + base() + founderCard() : ipoForm(); };
}

// 個股頁「營運」分頁：董事長最近幾天申報了什麼，所有人都看得到
function finOps(co) {
  if (!CLOUD) return '<p class="note sp-pad">試玩版沒有其他玩家的營運紀錄。</p>';
  if (co.bot) return '<p class="note sp-pad">示範公司的營運由系統模擬，沒有逐項紀錄。</p>';
  if (!co.ops) return '<p class="note sp-pad">讀取中…</p>';
  if (!co.ops.length) return '<p class="note sp-pad">這家公司最近 7 個交易日都沒有申報營運。</p>';
  return `<div class="st1">董事長的營運申報 <span class="mute">最近 7 個交易日</span></div>${co.ops.map(o => {
    const net = Math.min(o.items.filter(x => x.a > 0).reduce((s, x) => s + x.a, 0), CAP) + o.items.filter(x => x.a < 0).reduce((s, x) => s + x.a, 0);
    return `<div class="news sp-pad"><small>第 ${o.d} 交易日${o.d === S.day ? '（今天）' : ''}・淨利 <span class="${cls(net)}">${(net > 0 ? '+' : '') + fmt(net)}</span></small>${o.items.map(x => `<span class="opi ${x.a > 0 ? 'up' : 'dn'}">${esc(x.n)}</span>`).join('')}</div>`;
  }).join('')}`;
}

/* ---------- 下單：買進、賣出、先賣後買、回補 ---------- */
function orderBox(co) {
  const { sign, q, unit } = pending, kind = pending.kind || (sign > 0 ? 'buy' : 'sell');
  const sh = unit === 'sh' ? q : q * LOT, px = impactPrice(co, sign * sh), amt = px * sh, fee = feeOf(amt);
  const h = S.hold[co.code], so = (S.shorts || {})[co.code];
  const kv = (n, v, strong) => `<div class="kv"><span>${n}</span>${strong ? `<b class="${strong}">${v}</b>` : `<span>${v}</span>`}</div>`;
  let title, rows = '', note = '市價單會立即成交，實際成交價以送出當下為準。', color = sign > 0 ? 'up' : 'dn';
  if (kind === 'buy') { title = '現股買進'; rows = kv('預估應付', fmt(amt + fee), 'up'); }
  else if (kind === 'sell') {
    const dt = Math.min(sh, h ? h.tb || 0 : 0), tax = Math.floor(px * dt * 0.0015) + Math.floor(px * (sh - dt) * 0.003);
    title = dt > 0 ? '現股賣出（含當沖）' : '現股賣出';
    rows = kv(dt > 0 ? `證交稅（當沖 ${lots(dt)} 張 0.15%，其餘 0.3%）` : '證交稅 0.3%', fmt(tax)) + kv('預估應收', fmt(amt - fee - tax), 'dn');
  } else if (kind === 'short') {
    const tax = Math.floor(amt * 0.0015);
    title = '先賣後買（當沖賣出）';
    rows = kv('證交稅 0.15%', fmt(tax)) + kv('保證金（回補時退回）', fmt(amt)) + kv('現在預扣', fmt(amt + fee + tax), 'dn');
    note = '今天 23:00 收盤前要回補。沒回補的部分會以收盤價強制回補，並加收 1% 違約金。';
  } else {
    title = '回補（當沖買回）';
    const pl = (so.px - px) * sh - fee;
    rows = kv('當初賣出均價', p2(so.px)) + kv('預估損益', (pl > 0 ? '+' : '') + fmt(pl), cls(pl)) + kv('退回保證金與損益', fmt((2 * so.px - px) * sh - fee), 'up');
  }
  return `<div class="sp-trade ord"><b class="${color}">委託確認・${title}</b>
    ${kv('商品', esc(co.name) + ' ' + cd(esc(co.code)))}
    ${kv('數量', unit === 'sh' ? fmt(sh) + ' 股（零股）' : fmt(q) + ' 張（' + fmt(sh) + ' 股）')}
    ${kv('預估成交價（市價）', p2(px))}${kv('成交金額', fmt(amt))}${kv('手續費 0.1425%', fmt(fee))}${rows}
    <p class="note">${note}</p>
    <div class="grid2"><button class="btn" data-act="ordCancel">取消</button><button class="btn ${sign > 0 ? 'pri' : 'sell'}" data-act="ordOk">確認送出</button></div></div>`;
}
function renderSheet(qty) {
  const co = sheetCode === 'IDX' ? idxCo() : S.cos[sheetCode], mine = co.code === S.my, h = S.hold[co.code], open = marketState().open;
  const w = !co.idx && S.watch.includes(co.code), so = (S.shorts || {})[co.code];
  const canShort = CLOUD && !mine && !h && !so && !isHoney(co);
  let box = '';
  if (co.idx) box = '';
  else if (pending) box = orderBox(co);
  else box = `<div class="sp-trade">
      ${mine ? `<p class="note" style="margin:0 0 8px">這是你自己的公司。買回自家股票比照庫藏股，上限為已發行股份的 10%（${lots(OWN_MAX)} 張），目前持有 ${lots(h ? h.sh : 0)} 張。</p>` : ''}
      ${so ? `<p class="note warn" style="margin:0 0 8px">先賣後買還沒回補：${lots(so.sh)} 張，賣出均價 ${p2(so.px)}。今天 23:00 收盤前要回補，否則以收盤價強制回補並加收 1% 違約金。</p>` : ''}
      <div class="qtyrow"><label for="qty">數量</label><input id="qty" type="number" min="1" step="1" inputmode="numeric" value="${qty || (so && unitSel !== 'sh' ? Math.max(1, Math.floor(so.sh / 1000)) : 1)}"><select id="unit" aria-label="單位：張或零股"><option value="lot">張</option><option value="sh"${unitSel === 'sh' ? ' selected' : ''}>股</option></select>${[1, 5, 10].map(n => `<button class="btn" data-act="setq" data-n="${n}">${n}</button>`).join('')}</div>
      <p class="note" id="est"></p>
      ${so ? `<button class="btn pri wide" data-act="cover" ${open ? '' : 'disabled'}>回補（買回）</button>`
      : `<div class="grid2"><button class="btn pri" data-act="buy" ${open ? '' : 'disabled'}>買進</button><button class="btn sell" data-act="sell" ${h && open ? '' : 'disabled'}>賣出${h ? '（庫存 ' + lots(h.sh) + ' 張）' : ''}</button></div>
        ${canShort ? `<div class="gap"></div><button class="btn wide" data-act="short" ${open ? '' : 'disabled'}>先賣後買（當沖，收盤前要回補）</button>` : ''}`}</div>`;
  $('#sheetBody').innerHTML = `<div class="sp-nav"><button data-act="closeSheet" aria-label="返回">‹</button><b>${co.idx ? '大盤' : '個股資訊'}</b>
      ${co.idx ? '<span></span>' : `<button data-act="watch" class="star${w ? ' on' : ''}" aria-pressed="${w}" aria-label="${w ? '移出自選' : '加入自選'}">${w ? '★' : '☆'}</button>`}</div>
    <div id="spLive"></div>${box}`;
  renderSheetLive();
}
// 庫存頁最上面提醒還沒回補的當沖部位
{
  const base = vPort;
  vPort = function () {
    const l = Object.entries(S.shorts || {});
    if (!l.length) return base();
    return `<div class="card"><h2>先賣後買・尚未回補 <small>23:00 收盤前要回補</small></h2>${l.map(([code, x]) => {
      const co = S.cos[code], pl = co ? (x.px - co.price) * x.sh : 0;
      return `<button class="row" data-act="open" data-code="${esc(code)}"><span class="nm"><b>${co ? esc(co.name) : cd(esc(code))}</b><small>${lots(x.sh)} 張・賣出均價 ${p2(x.px)}</small></span><span class="px ${cls(pl)}"><b>${(pl > 0 ? '+' : '') + fmt(pl)}</b><small>未實現</small></span></button>`;
    }).join('')}</div>` + base();
  };
}

/* ---------- 聊天室：可以檢舉訊息；管理頁處理被檢舉的訊息 ---------- */
function chatRows() {
  const news = (S.newsFeed || []).filter(n => !/登上今日漲幅王|法人建議觀望/.test(n.body)).map(n => ({ t: n.t, news: true, body: n.body }));
  const l = (S.chat || []).concat(news).sort((a, b) => a.t - b.t).slice(-120);
  if (!l.length) return '<p class="note">還沒有人說話。聊聊今天看好哪一檔吧。</p>';
  return l.map(m => m.news
    ? `<div class="msg sys"><small>快訊・${hhmmss(m.t).slice(0, 5)}</small><span>${nz(m.body)}</span></div>`
    : `<div class="msg${m.me ? ' me' : ''}"><small>${esc(m.name)}・${hhmmss(m.t).slice(0, 5)}${CLOUD && !m.me && m.id ? `・<button class="rp" data-act="chatReport" data-id="${m.id}">檢舉</button>` : ''}</small><span>${esc(m.body)}</span></div>`).join('');
}
{
  const base = vRank;
  vRank = function () {
    let h = base();
    if (rTab !== 'admin' || !S.admin) return h;
    const l = S.chatFlag || [];
    return h + `<div class="card"><h2>被檢舉的聊天訊息 <small>${l.length} 則</small></h2>${l.length ? l.map(m => `<div class="news"><small>${esc(m.name)}・${m.n} 人檢舉・${m.hidden ? '<span class="dn">已隱藏</span>' : '顯示中'}</small>${esc(m.body)}
      <div class="fb-ed"><button class="btn" data-act="chatAdmin" data-id="${m.id}" data-op="${m.hidden ? 'show' : 'hide'}">${m.hidden ? '恢復顯示' : '隱藏'}</button><button class="btn" data-act="chatAdmin" data-id="${m.id}" data-op="mute">隱藏並禁言</button><button class="btn" data-act="chatAdmin" data-id="${m.id}" data-op="unmute">解除禁言</button></div></div>`).join('') : '<p class="note">目前沒有被檢舉的訊息。同一則訊息被 3 個人檢舉會先自動隱藏。</p>'}</div>`;
  };
}

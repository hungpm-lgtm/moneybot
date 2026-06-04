/* ============================================================
   MoneyBot - App theo dõi chi tiêu cá nhân (data-driven)
   Dữ liệu lưu trong localStorage trên thiết bị.
   ============================================================ */

/* ---------- Danh mục ---------- */
const EXPENSE_CATS = [
  {name:'Thức ăn & Đồ uống', icon:'🍽️', color:'#F472B6'},
  {name:'Nhà', icon:'🏠', color:'#3B82F6'},
  {name:'Giao thông', icon:'⛽', color:'#34D399'},
  {name:'Giải trí', icon:'🎮', color:'#FBBF24'},
  {name:'Mua sắm', icon:'🛍️', color:'#10B981'},
  {name:'Quà tặng', icon:'🎁', color:'#A78BFA'},
  {name:'Làm đẹp', icon:'💄', color:'#FB7185'},
  {name:'Y tế', icon:'🏥', color:'#22D3EE'},
  {name:'Học tập', icon:'📚', color:'#F59E0B'},
  {name:'Hóa đơn', icon:'🧾', color:'#6366F1'},
  {name:'Khác', icon:'📦', color:'#9CA3AF'},
];
const INCOME_CATS = [
  {name:'Lương', icon:'💰', color:'#10B981'},
  {name:'Thưởng', icon:'🎯', color:'#F59E0B'},
  {name:'Đầu tư', icon:'📈', color:'#3B82F6'},
  {name:'Được tặng', icon:'🎁', color:'#A78BFA'},
  {name:'Khác', icon:'💵', color:'#9CA3AF'},
];
const WALLET_ICONS = ['💼','💵','🏦','💳','👛','🐷','💰','🪙'];
const SAVING_ICONS = ['🏖️','📱','🏠','🚗','💍','🎓','💻','✈️','🎁','🐷'];

/* ---------- Lưu trữ ---------- */
const STORE_KEY = 'moneybot_v1';
let db = { wallets:[], transactions:[], budgets:[], savings:[], debts:[], challenges:[], profile:{name:'Người dùng', code:''}, settings:{activeWalletId:null} };

// Tạo mã ví ngắn gọn: VD HNG-4821
function genUserCode(name){
  const prefix = (name||'MB').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3).padEnd(3,'X');
  const num = Math.floor(1000 + Math.random()*9000);
  return prefix + '-' + num;
}

function loadDB(){
  try { const r = localStorage.getItem(STORE_KEY); if (r) db = JSON.parse(r); } catch(e){}
  db.wallets = db.wallets || [];
  db.transactions = db.transactions || [];
  db.budgets = db.budgets || [];
  db.savings = db.savings || [];
  db.debts = db.debts || [];
  db.challenges = db.challenges || [];
  db.profile = db.profile || {name:'Người dùng', code:''};
  db.settings = db.settings || {};
  // Danh mục tuỳ chỉnh — migrate từ hằng số nếu chưa có
  if (!db.categories) {
    db.categories = { expense: [...EXPENSE_CATS], income: [...INCOME_CATS] };
  }
  // Tự tạo mã ví nếu chưa có
  if (!db.profile.code) db.profile.code = genUserCode(db.profile.name);
  if (db.wallets.length === 0) {
    const w = { id: uid(), name:'Ví của tôi', icon:'💼', currency:'VND', initialBalance:0 };
    db.wallets.push(w);
    db.settings.activeWalletId = w.id;
  }
  if (!db.wallets.find(w => w.id === db.settings.activeWalletId)) {
    db.settings.activeWalletId = db.wallets[0].id;
  }
}
function saveDB(){
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
  if (typeof schedulePush === 'function') schedulePush(); // Sync lên cloud nếu đã login
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* ---------- Trạng thái giao diện ---------- */
let currentScreen = 'home';
let currentPeriod = 'month';
let anchor = new Date();
let homeTab = 'expense';
let editingTxId = null, editingWalletId = null, editingBudgetId = null, editingSavingId = null, addMoneyId = null;
let editingDebtId = null, editingChallengeId = null, debtTab = 'lend';
let formType = 'expense', formCat = null, walletIconSel = '💼', savingIconSel = '🏖️';
let debtFormType = 'lend';
let calAnchor = new Date(); // Anchor cho calendar

/* ---------- Tiện ích ---------- */
function pad(n){ return n < 10 ? '0'+n : ''+n; }
function pd(s){ const a = s.split('-').map(Number); return new Date(a[0], a[1]-1, a[2]); }
function todayStr(){ const d = new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function activeWallet(){ return db.wallets.find(w => w.id === db.settings.activeWalletId) || db.wallets[0]; }
function curSym(cur){ return cur === 'USD' ? '$' : '₫'; }
// Định dạng số VND: dùng dấu "." ngăn cách hàng nghìn (1.500.000)
function fmtVND(n){ return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function fmt(n, cur){
  cur = cur || (activeWallet() ? activeWallet().currency : 'VND');
  return curSym(cur) + fmtVND(n);
}
function fmtSigned(n, cur){ return (n < 0 ? '-' : '') + fmt(n, cur); }
function fmtShort(n){
  const a = Math.abs(n);
  if (a >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,'').replace('.',',') + 'tỷ';
  if (a >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'').replace('.',',') + 'tr';
  if (a >= 1e3) return (n/1e3).toFixed(0) + 'k';
  return ''+Math.round(n);
}
function catMeta(name, type){
  const list = type === 'income'
    ? (db.categories ? db.categories.income : INCOME_CATS)
    : (db.categories ? db.categories.expense : EXPENSE_CATS);
  return list.find(c => c.name === name) || {icon:'📦', color:'#9CA3AF'};
}
const DAYS_SHORT = ['CN','Th 2','Th 3','Th 4','Th 5','Th 6','Th 7'];
function fmtDateHeader(s){ const d = pd(s); return DAYS_SHORT[d.getDay()]+', '+d.getDate()+' thg '+(d.getMonth()+1)+', '+d.getFullYear(); }

/* ---------- Kỳ thời gian ---------- */
function periodRange(){
  const a = anchor; let start, end;
  if (currentPeriod === 'day') { start = new Date(a.getFullYear(), a.getMonth(), a.getDate()); end = new Date(a.getFullYear(), a.getMonth(), a.getDate()+1); }
  else if (currentPeriod === 'week') { const dow = (a.getDay()+6)%7; start = new Date(a.getFullYear(), a.getMonth(), a.getDate()-dow); end = new Date(start); end.setDate(start.getDate()+7); }
  else if (currentPeriod === 'year') { start = new Date(a.getFullYear(),0,1); end = new Date(a.getFullYear()+1,0,1); }
  else { start = new Date(a.getFullYear(), a.getMonth(), 1); end = new Date(a.getFullYear(), a.getMonth()+1, 1); }
  return { start, end };
}
function periodLabel(){
  const a = anchor;
  if (currentPeriod === 'day') return DAYS_SHORT[a.getDay()]+', '+pad(a.getDate())+'/'+pad(a.getMonth()+1)+'/'+a.getFullYear();
  if (currentPeriod === 'week') { const r = periodRange(); const e = new Date(r.end); e.setDate(e.getDate()-1); return pad(r.start.getDate())+'/'+pad(r.start.getMonth()+1)+' – '+pad(e.getDate())+'/'+pad(e.getMonth()+1)+'/'+e.getFullYear(); }
  if (currentPeriod === 'year') return 'Năm '+a.getFullYear();
  return 'Tháng '+(a.getMonth()+1)+', '+a.getFullYear();
}
function monthLabel(){ return 'Tháng '+(anchor.getMonth()+1)+', '+anchor.getFullYear(); }
function setPeriod(p){ currentPeriod = p; renderAll(); }
function navPeriod(dir){
  const a = new Date(anchor);
  if (currentPeriod === 'day') a.setDate(a.getDate()+dir);
  else if (currentPeriod === 'week') a.setDate(a.getDate()+7*dir);
  else if (currentPeriod === 'year') a.setFullYear(a.getFullYear()+dir);
  else a.setMonth(a.getMonth()+dir);
  anchor = a; renderAll();
}
function navMonth(dir){ const a = new Date(anchor); a.setMonth(a.getMonth()+dir); anchor = a; renderAll(); }
function setHomeTab(t){ homeTab = t; renderAll(); }

/* ---------- Truy vấn dữ liệu ---------- */
// txInPeriod: gộp TẤT CẢ ví (home/chart), hoặc lọc theo txWalletFilter (transactions screen)
let txWalletFilter = 'all'; // 'all' hoặc walletId cụ thể

function txInPeriod(walletId){
  const r = periodRange();
  const wid = walletId || null; // null = tất cả ví
  return db.transactions.filter(t =>
    t.type !== 'transfer'                            // loại trừ chuyển khoản khỏi thu/chi
    && (wid ? t.walletId === wid : true)
    && pd(t.date) >= r.start && pd(t.date) < r.end
  );
}
function txInPeriodAll(walletId){  // Bao gồm cả transfer (cho màn Giao dịch)
  const r = periodRange();
  const wid = walletId || null;
  return db.transactions.filter(t => {
    if (wid) {
      return (t.walletId === wid || t.toWalletId === wid) && pd(t.date) >= r.start && pd(t.date) < r.end;
    }
    return pd(t.date) >= r.start && pd(t.date) < r.end;
  });
}
function walletBalance(wid){
  const w = db.wallets.find(x => x.id === wid); if (!w) return 0;
  let bal = Number(w.initialBalance) || 0;
  db.transactions.forEach(t => {
    if (t.type === 'income' && t.walletId === wid) bal += t.amount;
    else if (t.type === 'expense' && t.walletId === wid) bal -= t.amount;
    else if (t.type === 'transfer') {
      if (t.walletId === wid) bal -= t.amount;       // ví nguồn
      if (t.toWalletId === wid) bal += t.amount;    // ví đích
    }
  });
  return bal;
}
function totalBalance(){
  return db.wallets.reduce((s, w) => s + walletBalance(w.id), 0);
}
function monthExpenseAllWallets(year, month){
  const start = new Date(year, month, 1), end = new Date(year, month+1, 1);
  return db.transactions.filter(t => t.type === 'expense' && pd(t.date) >= start && pd(t.date) < end)
    .reduce((s,t) => s + t.amount, 0);
}
function monthExpense(year, month, wid){
  const start = new Date(year, month, 1), end = new Date(year, month+1, 1);
  const filter = wid ? (t => t.walletId === wid) : () => true;
  return db.transactions.filter(t => filter(t) && t.type === 'expense' && pd(t.date) >= start && pd(t.date) < end)
    .reduce((s,t) => s + t.amount, 0);
}

/* ---------- Điều hướng màn hình ---------- */
function switchScreen(name){
  const toolScreens = ['budget','savings','ai','debt','challenge'];
  const settingsScreens = ['categories'];
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screenEl = document.getElementById('screen-' + name);
  if (screenEl) screenEl.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navTarget = toolScreens.includes(name) ? 'tools' : settingsScreens.includes(name) ? 'settings' : name;
  const navEl = document.getElementById('nav-' + navTarget);
  if (navEl) navEl.classList.add('active');
  currentScreen = name;
  const fab = document.getElementById('fabBtn');
  const fabScreens = ['home','transactions','debt','challenge'];
  fab.style.display = fabScreens.includes(name) ? 'flex' : 'none';
  // FAB action thay đổi theo màn hình
  if (name === 'debt') fab.onclick = () => openDebtModal(null);
  else if (name === 'challenge') fab.onclick = () => openChallengeModal(null);
  else fab.onclick = null; // dùng drag handler
  renderAll();
}
function openTool(name){
  if (name === 'budget') switchScreen('budget');
  else if (name === 'savings') switchScreen('savings');
  else if (name === 'debt') switchScreen('debt');
  else if (name === 'challenge') switchScreen('challenge');
}
function openAIAnalysis(){ switchScreen('ai'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
function openModal(id){ document.getElementById(id).classList.add('open'); }
function openPremiumModal(){ openModal('modal-premium'); }
function activatePremium(){ closeModal('modal-premium'); showToast('🎉 Đã kích hoạt Premium! Mọi tính năng đã mở!'); }
function quickTransfer(){ showToast('Mẹo: tạo 1 chi ở ví này và 1 thu ở ví kia để chuyển quỹ.'); }
function quickRecurring(){ showToast('Giao dịch định kỳ đang được phát triển!'); }
function toggleSearch(){ const r = document.getElementById('txSearchRow'); r.classList.toggle('show'); if (r.classList.contains('show')) document.getElementById('txSearch').focus(); else { document.getElementById('txSearch').value=''; renderTransactions(); } }
function goToday(){ anchor = new Date(); renderAll(); showToast('Đã về kỳ hiện tại'); }

/* ============================================================
   RENDER
   ============================================================ */
function renderAll(){
  document.querySelectorAll('#periodSelector .period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === currentPeriod));
  const pl = document.getElementById('periodLabel'); if (pl) pl.textContent = periodLabel();
  document.getElementById('tabExpense').className = 'tab-btn' + (homeTab === 'expense' ? '' : ' inactive');
  document.getElementById('tabIncome').className = 'tab-btn' + (homeTab === 'income' ? '' : ' inactive');
  renderTotalAssets();
  renderSummary();
  renderChart();
  renderTransactions();
  renderBudgets();
  renderSavings();
  renderInsights();
  renderDebtScreen();
  renderChallengeScreen();
  renderProfileUI();
  renderCatScreen();
  if (typeof renderSyncUI === 'function') renderSyncUI();
}

function renderTotalAssets(){
  const total = totalBalance();
  const el = document.getElementById('totalAssetsAmount');
  if (el) el.textContent = fmtSigned(total);

  // Wallet chips compact — nằm ngang, cuộn được
  const row = document.getElementById('walletChipsRow');
  if (!row) return;
  let html = '<div class="wallet-chips-compact">';
  db.wallets.forEach(w => {
    const bal = walletBalance(w.id);
    const balColor = bal < 0 ? 'rgba(255,160,160,1)' : '#fff';
    html += '<div class="wcc-chip" onclick="openWalletModal(\'' + w.id + '\')">'
      + '<div class="wcc-icon">' + (w.icon||'💼') + '</div>'
      + '<div class="wcc-info">'
      + '<div class="wcc-name">' + esc(w.name) + '</div>'
      + '<div class="wcc-bal" style="color:' + balColor + '">' + fmtShort(bal) + ' ₫</div>'
      + '</div></div>';
  });
  html += '<div class="wcc-chip add-chip" onclick="openWalletModal(null)">'
    + '<div class="wcc-icon">＋</div>'
    + '<div class="wcc-info"><div class="wcc-name" style="color:rgba(255,255,255,0.7)">Thêm ví</div></div>'
    + '</div>';
  html += '</div>';
  row.innerHTML = html;
}

function renderSummary(){
  // Gộp TẤT CẢ ví
  const txs = txInPeriod(); // không truyền wid = tất cả ví
  let exp = 0, inc = 0;
  txs.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
  const net = inc - exp;
  document.getElementById('summaryCard').innerHTML =
      '<div class="summary-label">Thay đổi ròng (tất cả ví)</div>'
    + '<div class="summary-amount">' + fmtSigned(net) + '</div>'
    + '<div class="summary-row">'
    + '  <div class="summary-item"><div class="summary-item-label">Chi phí</div><div class="summary-item-amount">🔻 ' + fmt(exp) + '</div></div>'
    + '  <div class="summary-item"><div class="summary-item-label">Thu nhập</div><div class="summary-item-amount">🔺 ' + fmt(inc) + '</div></div>'
    + '</div>';
}

function renderChart(){
  const el = document.getElementById('chartContainer');
  // Gộp TẤT CẢ ví
  const txs = txInPeriod().filter(t => t.type === homeTab);
  const total = txs.reduce((s,t) => s + t.amount, 0);
  if (total === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-emoji">📭</div><p>Chưa có ' + (homeTab === 'expense' ? 'chi phí' : 'thu nhập') + ' trong kỳ này</p><p class="hint">Nhấn nút + để thêm giao dịch</p></div>';
    return;
  }
  const map = {};
  txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
  const arr = Object.keys(map).map(k => ({ name:k, amount:map[k], meta:catMeta(k, homeTab) })).sort((a,b) => b.amount - a.amount);
  const C = 2 * Math.PI * 60;
  let offset = 0, circles = '';
  arr.forEach(a => {
    const dash = (a.amount / total) * C;
    circles += '<circle cx="80" cy="80" r="60" fill="none" stroke="' + a.meta.color + '" stroke-width="28" stroke-dasharray="' + dash.toFixed(1) + ' ' + (C-dash).toFixed(1) + '" stroke-dashoffset="' + (-offset).toFixed(1) + '" transform="rotate(-90 80 80)"/>';
    offset += dash;
  });
  let list = '';
  arr.forEach(a => {
    const pct = Math.round(a.amount / total * 100);
    list += '<div class="category-item"><div class="cat-icon" style="background:' + a.meta.color + '22">' + a.meta.icon + '</div>'
      + '<div class="cat-info"><div class="cat-name">' + esc(a.name) + '</div>'
      + '<div class="cat-bar-wrap"><div class="cat-bar-bg"><div class="cat-bar" style="width:' + pct + '%;background:' + a.meta.color + '"></div></div><div class="cat-pct">' + pct + '%</div></div></div>'
      + '<div class="cat-amount">' + fmt(a.amount) + '</div></div>';
  });
  el.innerHTML = '<div class="donut-wrapper"><svg class="donut-svg" viewBox="0 0 160 160">'
    + '<circle cx="80" cy="80" r="60" fill="none" stroke="#E5E7EB" stroke-width="28"/>' + circles
    + '<circle cx="80" cy="80" r="46" fill="white"/>'
    + '<text x="80" y="74" text-anchor="middle" font-size="10" fill="#9CA3AF">Tổng</text>'
    + '<text x="80" y="92" text-anchor="middle" font-size="14" font-weight="700" fill="#374151">' + fmtShort(total) + '</text>'
    + '</svg></div><div class="category-list">' + list + '</div>';
}

function renderTransactions(){
  const lbl = document.getElementById('txPeriodLabel'); if (lbl) lbl.textContent = periodLabel();

  // Render wallet filter chips
  const filterRow = document.getElementById('txWalletFilter');
  if (filterRow) {
    filterRow.innerHTML = '<button class="wf-chip' + (txWalletFilter === 'all' ? ' active' : '') + '" onclick="setTxFilter(\'all\')">Tất cả ví</button>'
      + db.wallets.map(w => '<button class="wf-chip' + (txWalletFilter === w.id ? ' active' : '') + '" onclick="setTxFilter(\'' + w.id + '\')">' + (w.icon||'💼') + ' ' + esc(w.name) + '</button>').join('');
  }

  const q = (document.getElementById('txSearch') ? document.getElementById('txSearch').value : '').trim().toLowerCase();
  const filterWid = txWalletFilter === 'all' ? null : txWalletFilter;
  let txs = txInPeriodAll(filterWid); // bao gồm cả transfer
  if (q) txs = txs.filter(t => (t.note||'').toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q));
  let exp = 0, inc = 0;
  txs.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
  document.getElementById('txSummaryBar').innerHTML =
      '<span class="s-expense">🔻 ' + fmt(exp) + '</span><span class="s-sep">|</span>'
    + '<span class="s-income">🔺 ' + fmt(inc) + '</span><span class="s-sep">|</span>'
    + '<span class="s-balance">= ' + fmtSigned(inc-exp) + '</span>';
  const list = document.getElementById('txList');
  if (txs.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-emoji">🗒️</div><p>Chưa có giao dịch nào</p><p class="hint">Nhấn nút + để thêm giao dịch đầu tiên</p></div>';
    return;
  }
  const groups = {};
  txs.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
  // Sắp xếp theo giờ giảm dần trong mỗi ngày (mới nhất lên đầu)
  Object.keys(groups).forEach(d => {
    groups[d].sort((a,b) => (b.time||'00:00') > (a.time||'00:00') ? 1 : -1);
  });
  const dates = Object.keys(groups).sort((a,b) => a < b ? 1 : -1);
  let html = '';
  dates.forEach(d => {
    let dnet = 0;
    groups[d].forEach(t => { dnet += t.type === 'income' ? t.amount : -t.amount; });
    html += '<div class="tx-group"><div class="tx-date-header"><span>' + fmtDateHeader(d) + '</span>'
      + '<span style="color:' + (dnet >= 0 ? 'var(--teal)' : 'var(--pink)') + '">' + fmtSigned(dnet) + '</span></div>';
    groups[d].forEach(t => {
      if (t.type === 'transfer') {
        const wFrom = db.wallets.find(w => w.id === t.walletId);
        const wTo = db.wallets.find(w => w.id === t.toWalletId);
        html += '<div class="tx-item" onclick="openTransferDetail(\'' + t.id + '\')">'
          + '<div class="tx-icon" style="background:#EDE9FE">⇄</div>'
          + '<div class="tx-info"><div class="tx-cat">Chuyển khoản</div>'
          + '<div class="tx-note">' + (wFrom?wFrom.icon+' '+esc(wFrom.name):'?') + ' → ' + (wTo?wTo.icon+' '+esc(wTo.name):'?') + '</div>'
          + (t.note ? '<div class="tx-note">' + esc(t.note) + '</div>' : '') + '</div>'
          + '<div class="tx-amount transfer">⇄ ' + fmt(t.amount) + '</div></div>';
        return;
      }
      const m = catMeta(t.category, t.type);
      const tw = db.wallets.find(w => w.id === t.walletId);
      const walletTag = db.wallets.length > 1
        ? '<span style="font-size:10px;color:var(--gray-400);margin-top:1px;">' + (tw ? tw.icon + ' ' + esc(tw.name) : '') + '</span>'
        : '';
      const timeTag = t.time ? '<span style="font-size:10px;color:var(--gray-300);margin-left:4px;">'+t.time+'</span>' : '';
      html += '<div class="tx-item" onclick="openTxModal(\'' + t.id + '\')">'
        + '<div class="tx-icon" style="background:' + m.color + '22">' + m.icon + '</div>'
        + '<div class="tx-info"><div class="tx-cat">' + esc(t.category) + timeTag + '</div>'
        + '<div class="tx-note">' + esc(t.note||'') + '</div>' + walletTag + '</div>'
        + '<div class="tx-amount ' + t.type + '">' + (t.type === 'income' ? '🔺' : '🔻') + ' ' + fmt(t.amount, tw ? tw.currency : 'VND') + '</div></div>';
    });
    html += '</div>';
  });
  list.innerHTML = html;
}
function setTxFilter(wid){ txWalletFilter = wid; renderTransactions(); }

function renderBudgets(){
  const lbl = document.getElementById('budgetMonthLabel'); if (lbl) lbl.textContent = monthLabel();
  const el = document.getElementById('budgetList'); if (!el) return;
  const wid = db.settings.activeWalletId;
  const budgets = db.budgets.filter(b => b.walletId === wid);
  let html = '';
  if (budgets.length === 0) {
    html += '<div class="empty-state"><div class="empty-emoji">📊</div><p>Chưa có ngân sách nào</p><p class="hint">Đặt hạn mức cho từng danh mục để kiểm soát chi tiêu</p></div>';
  } else {
    budgets.forEach(b => {
      const sp = db.transactions.filter(t => t.walletId === wid && t.type === 'expense' && t.category === b.category
        && pd(t.date) >= new Date(anchor.getFullYear(), anchor.getMonth(), 1)
        && pd(t.date) < new Date(anchor.getFullYear(), anchor.getMonth()+1, 1)).reduce((s,t) => s + t.amount, 0);
      const pct = b.limit > 0 ? Math.round(sp / b.limit * 100) : 0;
      const barW = Math.min(100, pct);
      const m = catMeta(b.category, 'expense');
      let barCls = '', foot;
      if (pct > 100) { barCls = ' danger'; foot = '<span style="color:var(--pink)">⚠️ Vượt ngân sách ' + fmt(sp - b.limit) + '</span>'; }
      else if (pct >= 80) { barCls = ' warning'; foot = pct + '% đã dùng · còn ' + fmt(b.limit - sp); }
      else { foot = pct + '% đã dùng · còn ' + fmt(b.limit - sp); }
      html += '<div class="budget-item" onclick="openBudgetModal(\'' + b.id + '\')">'
        + '<div class="budget-header"><div class="budget-name">' + m.icon + ' ' + esc(b.category) + '</div>'
        + '<div class="budget-amounts"><span class="budget-spent">' + fmt(sp) + '</span><span class="budget-total"> / ' + fmt(b.limit) + '</span></div></div>'
        + '<div class="budget-bar-bg"><div class="budget-bar' + barCls + '" style="width:' + barW + '%"></div></div>'
        + '<div class="budget-pct">' + foot + '</div></div>';
    });
  }
  html += '<button class="submit-btn" style="margin-top:4px;" onclick="openBudgetModal(null)">+ Thêm ngân sách mới</button>';
  el.innerHTML = html;
}

function renderSavings(){
  const el = document.getElementById('savingsList'); if (!el) return;
  let html = '';
  if (db.savings.length === 0) {
    html += '<div class="empty-state"><div class="empty-emoji">🐷</div><p>Chưa có mục tiêu tiết kiệm</p><p class="hint">Đặt mục tiêu và theo dõi tiến trình của bạn</p></div>';
  } else {
    db.savings.forEach(s => {
      const pct = s.target > 0 ? Math.min(100, Math.round(s.current / s.target * 100)) : 0;
      const sub = s.deadline ? ('Mục tiêu đến ' + pd(s.deadline).getDate() + '/' + (pd(s.deadline).getMonth()+1) + '/' + pd(s.deadline).getFullYear()) : 'Mục tiêu dài hạn';
      const remain = Math.max(0, s.target - s.current);
      html += '<div class="savings-item">'
        + '<div class="savings-edit-btn" onclick="openSavingModal(\'' + s.id + '\')">✏️</div>'
        + '<div class="savings-header"><div class="savings-icon">' + (s.icon||'🐷') + '</div>'
        + '<div class="savings-info"><div class="savings-name">' + esc(s.name) + '</div><div class="savings-sub">' + sub + '</div></div></div>'
        + '<div class="savings-target" style="margin-bottom:8px;">' + fmt(s.current) + ' / ' + fmt(s.target) + '</div>'
        + '<div class="savings-bar-bg"><div class="savings-bar" style="width:' + pct + '%"></div></div>'
        + '<div class="savings-footer"><span>' + pct + '% hoàn thành</span><span>Còn ' + fmt(remain) + '</span></div>'
        + '<button class="savings-add-btn" onclick="openAddMoney(\'' + s.id + '\')">➕ Nạp tiền</button>'
        + '</div>';
    });
  }
  html += '<button class="submit-btn" onclick="openSavingModal(null)">+ Thêm mục tiêu tiết kiệm</button>';
  el.innerHTML = html;
}

function renderInsights(){
  const el = document.getElementById('insightsSection'); if (!el) return;
  const wid = db.settings.activeWalletId;
  const y = anchor.getFullYear(), mo = anchor.getMonth();
  const start = new Date(y, mo, 1), end = new Date(y, mo+1, 1);
  // Gộp tất cả ví
  const monthTx = db.transactions.filter(t => pd(t.date) >= start && pd(t.date) < end);
  let exp = 0, inc = 0; const catMap = {};
  monthTx.forEach(t => { if (t.type === 'income') inc += t.amount; else { exp += t.amount; catMap[t.category] = (catMap[t.category]||0) + t.amount; } });
  const prev = monthExpense(mo === 0 ? y-1 : y, mo === 0 ? 11 : mo-1, null);
  const cards = [];

  if (monthTx.length === 0) {
    cards.push({bg:'#EFF6FF', bd:'#3B82F630', icon:'👋', tc:'#2563EB', title:'Bắt đầu nào', text:'Chưa có giao dịch trong ' + monthLabel().toLowerCase() + '. Hãy thêm giao dịch để MoneyBot phân tích thói quen chi tiêu của bạn!'});
  } else {
    // Tổng quan
    let cmp = '';
    if (prev > 0) { const diff = Math.round((exp - prev) / prev * 100); cmp = diff >= 0 ? (' — nhiều hơn tháng trước <strong>' + diff + '%</strong>') : (' — ít hơn tháng trước <strong>' + Math.abs(diff) + '%</strong> 👏'); }
    const net = inc - exp;
    cards.push({bg:'#F0FDF4', bd:'#10B98130', icon:'📊', tc:'#059669', title:'Tổng quan ' + monthLabel().toLowerCase(),
      text:'Tổng tài sản hiện tại <strong>' + fmt(totalBalance()) + '</strong>. Tháng này chi <strong>' + fmt(exp) + '</strong>' + cmp + '. Thu nhập <strong>' + fmt(inc) + '</strong>, ' + (net >= 0 ? 'dư <strong>' + fmt(net) + '</strong> 🎉' : 'thiếu <strong>' + fmt(Math.abs(net)) + '</strong> ⚠️') + '.'});
    // Top danh mục
    const top = Object.keys(catMap).map(k => ({k, v:catMap[k]})).sort((a,b) => b.v - a.v)[0];
    if (top) { const pct = Math.round(top.v / exp * 100); cards.push({bg:'#FDF4FF', bd:'#A855F730', icon:'🏷️', tc:'#9333EA', title:'Chi nhiều nhất', text:'Danh mục <strong>' + esc(top.k) + '</strong> chiếm <strong>' + pct + '%</strong> chi tiêu (' + fmt(top.v) + ').'}); }
    // Cảnh báo ngân sách (tất cả ví)
    const overs = [];
    db.budgets.forEach(b => {
      const sp = catMap[b.category] || 0;
      if (b.limit > 0 && sp > b.limit) overs.push(esc(b.category) + ' (vượt ' + fmt(sp - b.limit) + ')');
    });
    if (overs.length) cards.push({bg:'#FFF7ED', bd:'#F59E0B30', icon:'⚠️', tc:'#D97706', title:'Cảnh báo ngân sách', text:'Bạn đã vượt ngân sách: <strong>' + overs.join(', ') + '</strong>. Cân nhắc điều chỉnh chi tiêu.'});
  }
  // Tiết kiệm
  const near = db.savings.filter(s => s.target > 0).sort((a,b) => (b.current/b.target) - (a.current/a.target))[0];
  if (near) { const pct = Math.min(100, Math.round(near.current/near.target*100)); cards.push({bg:'#F0FDF4', bd:'#10B98130', icon:'🐷', tc:'#059669', title:'Mục tiêu tiết kiệm', text:'Mục tiêu "<strong>' + esc(near.name) + '</strong>" đã đạt <strong>' + pct + '%</strong>. Còn ' + fmt(Math.max(0, near.target - near.current)) + ' nữa thôi!'}); }

  el.innerHTML = cards.map(c =>
    '<div class="insight-card" style="background:linear-gradient(135deg,' + c.bg + ',white); border-color:' + c.bd + ';">'
    + '<div class="insight-header"><span class="insight-icon">' + c.icon + '</span><span class="insight-title" style="color:' + c.tc + ';">' + c.title + '</span></div>'
    + '<div class="insight-text">' + c.text + '</div></div>'
  ).join('');
}

/* ============================================================
   GIAO DỊCH (CRUD)
   ============================================================ */
function openAddTransaction(){ openTxModal(null); }
function openTxModal(id){
  editingTxId = id || null;
  const sel = document.getElementById('txWallet');
  sel.innerHTML = db.wallets.map(w => '<option value="' + w.id + '">' + esc(w.icon + ' ' + w.name) + '</option>').join('');
  const amtEl = document.getElementById('txAmount');
  if (id) {
    const t = db.transactions.find(x => x.id === id);
    formType = t.type; formCat = t.category;
    // Hiển thị số có định dạng dấu chấm
    amtEl.value = fmtVND(t.amount);
    document.getElementById('txNote').value = t.note || '';
    document.getElementById('txDate').value = t.date;
    document.getElementById('txTime').value = t.time || '';
    sel.value = t.walletId;
    document.getElementById('txModalTitle').textContent = 'Sửa giao dịch';
    document.getElementById('txDeleteBtn').style.display = 'block';
  } else {
    formType = 'expense'; formCat = null;
    // Pre-fill "000" — người dùng gõ số trước 3 số 0
    amtEl.value = '000';
    document.getElementById('txNote').value = '';
    document.getElementById('txDate').value = todayStr();
    // Tự động lấy giờ:phút hiện tại
    const now = new Date();
    document.getElementById('txTime').value = pad(now.getHours()) + ':' + pad(now.getMinutes());
    sel.value = db.settings.activeWalletId;
    document.getElementById('txModalTitle').textContent = 'Thêm giao dịch';
    document.getElementById('txDeleteBtn').style.display = 'none';
  }
  setType(formType);
  openModal('modal-add-tx');
  // Focus vào cuối (sửa) hoặc đầu (mới — trước 000)
  setTimeout(() => {
    const a = document.getElementById('txAmount');
    a.focus();
    if (!id) { try { a.setSelectionRange(0, 0); } catch(e){} }
  }, 320);
}
function setType(type){
  formType = type;
  document.getElementById('typeExpense').className = 'type-btn expense' + (type === 'expense' ? ' active' : '');
  document.getElementById('typeIncome').className = 'type-btn income' + (type === 'income' ? ' active' : '');
  renderCatGrid();
}
function renderCatGrid(){
  const cats = (formType === 'income' ? db.categories.income : db.categories.expense);
  if (!cats.find(c => c.name === formCat)) formCat = cats[0] ? cats[0].name : null;
  document.getElementById('txCatGrid').innerHTML = cats.map(c =>
    '<div class="cat-chip' + (c.name === formCat ? ' selected' : '') + '" onclick="selectCat(\'' + encodeURIComponent(c.name) + '\')"><span>' + c.icon + '</span><p>' + esc(c.name) + '</p></div>'
  ).join('')
  // Nút thêm danh mục nhanh
  + '<div class="cat-chip" onclick="openCatModalInline(\'' + formType + '\')" style="border-style:dashed;opacity:0.6;"><span>＋</span><p>Thêm</p></div>';
}
function selectCat(enc){ formCat = decodeURIComponent(enc); renderCatGrid(); }
function submitTransaction(){
  // Parse từ text có dấu chấm (VD: "1.500.000" → 1500000)
  const raw = document.getElementById('txAmount').value.replace(/\./g,'').replace(/[^0-9]/g,'');
  const amt = parseInt(raw, 10);
  if (!amt || amt <= 0) { showToast('Vui lòng nhập số tiền hợp lệ!'); return; }
  if (!formCat) { showToast('Vui lòng chọn danh mục!'); return; }
  const date = document.getElementById('txDate').value || todayStr();
  const time = document.getElementById('txTime').value || (pad(new Date().getHours())+':'+pad(new Date().getMinutes()));
  const walletId = document.getElementById('txWallet').value;
  if (editingTxId) {
    const t = db.transactions.find(x => x.id === editingTxId);
    Object.assign(t, { type:formType, amount:amt, category:formCat, note:document.getElementById('txNote').value.trim(), date, time, walletId });
  } else {
    db.transactions.push({ id:uid(), walletId, type:formType, amount:amt, category:formCat, note:document.getElementById('txNote').value.trim(), date, time });
  }
  saveDB(); closeModal('modal-add-tx'); renderAll();
  showToast('✓ Đã ' + (editingTxId ? 'cập nhật' : 'thêm') + ' ' + (formType === 'expense' ? 'chi phí' : 'thu nhập') + ' ' + fmt(amt));
}
function deleteTransaction(){
  if (!editingTxId) return;
  db.transactions = db.transactions.filter(t => t.id !== editingTxId);
  saveDB(); closeModal('modal-add-tx'); renderAll(); showToast('🗑 Đã xoá giao dịch');
}

/* ============================================================
   VÍ (CRUD)
   ============================================================ */
function openWalletSettings(){
  if (db.wallets.length === 1) { openWalletModal(db.wallets[0].id); return; }
  openWalletModal(db.wallets[0].id);
}
function openWalletModal(id){
  editingWalletId = id || null;
  const picker = document.getElementById('walletIconPicker');
  if (id) {
    const w = db.wallets.find(x => x.id === id);
    walletIconSel = w.icon || '💼';
    document.getElementById('walletName').value = w.name;
    document.getElementById('walletCurrency').value = w.currency || 'VND';
    document.getElementById('walletInitial').value = w.initialBalance || 0;
    document.getElementById('walletModalTitle').textContent = 'Sửa ví';
    document.getElementById('walletDeleteBtn').style.display = db.wallets.length > 1 ? 'block' : 'none';
  } else {
    walletIconSel = '💼';
    document.getElementById('walletName').value = '';
    document.getElementById('walletCurrency').value = 'VND';
    document.getElementById('walletInitial').value = 0;
    document.getElementById('walletModalTitle').textContent = 'Thêm ví mới';
    document.getElementById('walletDeleteBtn').style.display = 'none';
  }
  picker.innerHTML = WALLET_ICONS.map(i => '<div class="icon-opt' + (i === walletIconSel ? ' selected' : '') + '" onclick="pickWalletIcon(\'' + i + '\')">' + i + '</div>').join('');
  openModal('modal-wallet');
}
function pickWalletIcon(i){ walletIconSel = i; document.querySelectorAll('#walletIconPicker .icon-opt').forEach(el => el.classList.toggle('selected', el.textContent === i)); }
function submitWallet(){
  const name = document.getElementById('walletName').value.trim();
  if (!name) { showToast('Vui lòng nhập tên ví!'); return; }
  const currency = document.getElementById('walletCurrency').value;
  const initialBalance = parseFloat(document.getElementById('walletInitial').value) || 0;
  if (editingWalletId) {
    const w = db.wallets.find(x => x.id === editingWalletId);
    Object.assign(w, { name, icon:walletIconSel, currency, initialBalance });
  } else {
    const w = { id:uid(), name, icon:walletIconSel, currency, initialBalance };
    db.wallets.push(w); db.settings.activeWalletId = w.id;
  }
  saveDB(); closeModal('modal-wallet'); renderAll(); showToast('💾 Đã lưu ví');
}
function deleteWallet(){
  if (!editingWalletId || db.wallets.length <= 1) { showToast('Không thể xoá ví cuối cùng!'); return; }
  if (!confirm('Xoá ví này sẽ xoá toàn bộ giao dịch và ngân sách của ví. Tiếp tục?')) return;
  db.wallets = db.wallets.filter(w => w.id !== editingWalletId);
  db.transactions = db.transactions.filter(t => t.walletId !== editingWalletId);
  db.budgets = db.budgets.filter(b => b.walletId !== editingWalletId);
  if (db.settings.activeWalletId === editingWalletId) db.settings.activeWalletId = db.wallets[0].id;
  saveDB(); closeModal('modal-wallet'); renderAll(); showToast('🗑 Đã xoá ví');
}

/* ============================================================
   NGÂN SÁCH (CRUD)
   ============================================================ */
function openBudgetModal(id){
  editingBudgetId = id || null;
  const sel = document.getElementById('budgetCategory');
  sel.innerHTML = db.categories.expense.map(c => '<option value="' + esc(c.name) + '">' + c.icon + ' ' + esc(c.name) + '</option>').join('');
  if (id) {
    const b = db.budgets.find(x => x.id === id);
    sel.value = b.category;
    document.getElementById('budgetLimit').value = b.limit;
    document.getElementById('budgetModalTitle').textContent = 'Sửa ngân sách';
    document.getElementById('budgetDeleteBtn').style.display = 'block';
  } else {
    sel.selectedIndex = 0;
    document.getElementById('budgetLimit').value = '';
    document.getElementById('budgetModalTitle').textContent = 'Thêm ngân sách';
    document.getElementById('budgetDeleteBtn').style.display = 'none';
  }
  openModal('modal-budget');
}
function submitBudget(){
  const category = document.getElementById('budgetCategory').value;
  const limit = parseFloat(document.getElementById('budgetLimit').value);
  if (!limit || limit <= 0) { showToast('Vui lòng nhập hạn mức hợp lệ!'); return; }
  const wid = db.settings.activeWalletId;
  if (editingBudgetId) {
    const b = db.budgets.find(x => x.id === editingBudgetId);
    Object.assign(b, { category, limit });
  } else {
    const dup = db.budgets.find(b => b.walletId === wid && b.category === category);
    if (dup) { dup.limit = limit; }
    else db.budgets.push({ id:uid(), walletId:wid, category, limit });
  }
  saveDB(); closeModal('modal-budget'); renderAll(); showToast('💾 Đã lưu ngân sách');
}
function deleteBudget(){
  if (!editingBudgetId) return;
  db.budgets = db.budgets.filter(b => b.id !== editingBudgetId);
  saveDB(); closeModal('modal-budget'); renderAll(); showToast('🗑 Đã xoá ngân sách');
}

/* ============================================================
   TIẾT KIỆM (CRUD)
   ============================================================ */
function openSavingModal(id){
  editingSavingId = id || null;
  const picker = document.getElementById('savingIconPicker');
  if (id) {
    const s = db.savings.find(x => x.id === id);
    savingIconSel = s.icon || '🏖️';
    document.getElementById('savingName').value = s.name;
    document.getElementById('savingTarget').value = s.target;
    document.getElementById('savingCurrent').value = s.current;
    document.getElementById('savingDeadline').value = s.deadline || '';
    document.getElementById('savingModalTitle').textContent = 'Sửa mục tiêu';
    document.getElementById('savingDeleteBtn').style.display = 'block';
  } else {
    savingIconSel = '🏖️';
    document.getElementById('savingName').value = '';
    document.getElementById('savingTarget').value = '';
    document.getElementById('savingCurrent').value = 0;
    document.getElementById('savingDeadline').value = '';
    document.getElementById('savingModalTitle').textContent = 'Thêm mục tiêu tiết kiệm';
    document.getElementById('savingDeleteBtn').style.display = 'none';
  }
  picker.innerHTML = SAVING_ICONS.map(i => '<div class="icon-opt' + (i === savingIconSel ? ' selected' : '') + '" onclick="pickSavingIcon(\'' + i + '\')">' + i + '</div>').join('');
  openModal('modal-saving');
}
function pickSavingIcon(i){ savingIconSel = i; document.querySelectorAll('#savingIconPicker .icon-opt').forEach(el => el.classList.toggle('selected', el.textContent === i)); }
function submitSaving(){
  const name = document.getElementById('savingName').value.trim();
  const target = parseFloat(document.getElementById('savingTarget').value);
  const current = parseFloat(document.getElementById('savingCurrent').value) || 0;
  const deadline = document.getElementById('savingDeadline').value || '';
  if (!name) { showToast('Vui lòng nhập tên mục tiêu!'); return; }
  if (!target || target <= 0) { showToast('Vui lòng nhập số tiền mục tiêu!'); return; }
  if (editingSavingId) {
    const s = db.savings.find(x => x.id === editingSavingId);
    Object.assign(s, { name, target, current, deadline, icon:savingIconSel });
  } else {
    db.savings.push({ id:uid(), name, target, current, deadline, icon:savingIconSel });
  }
  saveDB(); closeModal('modal-saving'); renderAll(); showToast('💾 Đã lưu mục tiêu');
}
function deleteSaving(){
  if (!editingSavingId) return;
  db.savings = db.savings.filter(s => s.id !== editingSavingId);
  saveDB(); closeModal('modal-saving'); renderAll(); showToast('🗑 Đã xoá mục tiêu');
}
function openAddMoney(id){ addMoneyId = id; document.getElementById('addMoneyAmount').value = ''; openModal('modal-addmoney'); }
function submitAddMoney(){
  const amt = parseFloat(document.getElementById('addMoneyAmount').value);
  if (!amt || amt <= 0) { showToast('Vui lòng nhập số tiền!'); return; }
  const s = db.savings.find(x => x.id === addMoneyId);
  if (s) { s.current += amt; saveDB(); }
  closeModal('modal-addmoney'); renderAll(); showToast('➕ Đã nạp ' + fmt(amt) + ' vào mục tiêu');
}

/* ============================================================
   AI CHAT - nhập nhanh giao dịch
   ============================================================ */
function parseChatAmount(lower){
  let m = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|triẹu|m)\b/);
  if (m) return Math.round(parseFloat(m[1].replace(',','.')) * 1e6);
  m = lower.match(/(\d+(?:[.,]\d+)?)\s*k\b/);
  if (m) return Math.round(parseFloat(m[1].replace(',','.')) * 1e3);
  m = lower.match(/(\d{4,})/);
  if (m) return parseInt(m[1]);
  m = lower.match(/(\d+)/);
  if (m) return parseInt(m[1]) * 1000; // số nhỏ coi như nghìn
  return null;
}
const CHAT_CAT_KEYWORDS = [
  {cat:'Thức ăn & Đồ uống', kw:['ăn','uống','cafe','cà phê','bún','phở','cơm','trà sữa','nhậu','bữa','đồ ăn','quán']},
  {cat:'Giao thông', kw:['xăng','grab','taxi','xe','vé xe','gửi xe','đổ xăng','bus']},
  {cat:'Nhà', kw:['điện','nước','thuê nhà','tiền nhà','internet','wifi','gas']},
  {cat:'Giải trí', kw:['phim','game','netflix','spotify','nhạc','chơi','du lịch','xem']},
  {cat:'Mua sắm', kw:['mua','shopee','lazada','quần áo','giày','áo','váy','đồ']},
  {cat:'Y tế', kw:['thuốc','khám','bệnh','viện','bác sĩ']},
  {cat:'Học tập', kw:['học','sách','khoá học','học phí']},
  {cat:'Làm đẹp', kw:['tóc','spa','mỹ phẩm','son','làm đẹp','nail']},
  {cat:'Quà tặng', kw:['quà','tặng','mừng','lì xì']},
];
const INCOME_KEYWORDS = ['lương','thưởng','nhận','thu nhập','được trả','bán','tiền về','hoàn tiền'];
function detectCat(lower, type){
  if (type === 'income') {
    if (lower.includes('thưởng')) return 'Thưởng';
    if (lower.includes('lương')) return 'Lương';
    if (lower.includes('bán') || lower.includes('đầu tư')) return 'Đầu tư';
    return 'Lương';
  }
  for (const g of CHAT_CAT_KEYWORDS) { if (g.kw.some(k => lower.includes(k))) return g.cat; }
  return 'Khác';
}
function sendChatMessage(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const container = document.getElementById('chatMessages');
  const userMsg = document.createElement('div');
  userMsg.className = 'msg-user';
  userMsg.textContent = text;
  container.appendChild(userMsg);
  input.value = '';
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    const lower = text.toLowerCase();
    const amount = parseChatAmount(lower);
    if (amount) {
      const type = INCOME_KEYWORDS.some(k => lower.includes(k)) ? 'income' : 'expense';
      const cat = detectCat(lower, type);
      const meta = catMeta(cat, type);
      const note = text.replace(/[\d.,]+\s*(tr|triệu|triẹu|k|m)?\b/gi, '').trim() || cat;
      const date = todayStr();
      db.transactions.push({ id:uid(), walletId:db.settings.activeWalletId, type, amount, category:cat, note, date });
      saveDB(); renderAll();
      const d = new Date();
      const receipt = document.createElement('div');
      receipt.className = 'tx-receipt';
      receipt.style.borderLeftColor = meta.color;
      receipt.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<span class="receipt-label">Đã ghi nhận: ' + (type === 'income' ? 'Thu nhập' : 'Chi phí') + '</span>'
        + '<span class="receipt-date">' + DAYS_SHORT[d.getDay()] + ', ' + d.getDate() + ' thg ' + (d.getMonth()+1) + '</span></div>'
        + '<div class="receipt-row"><div class="receipt-icon" style="background:' + meta.color + '22">' + meta.icon + '</div>'
        + '<div class="receipt-info"><div class="receipt-cat">' + esc(cat) + '</div><div class="receipt-note">' + esc(note) + '</div></div>'
        + '<div class="receipt-amount" style="color:' + (type === 'income' ? 'var(--teal)' : 'var(--pink)') + '">' + (type === 'income' ? '🔺' : '🔻') + ' ' + fmt(amount) + '</div></div>';
      container.appendChild(receipt);
    } else {
      const botMsg = document.createElement('div');
      botMsg.className = 'msg-bot';
      botMsg.textContent = 'Hãy nhập kèm số tiền nhé, ví dụ: "ăn tối 50k", "đổ xăng 100k" hoặc "lương 15tr". 😊';
      container.appendChild(botMsg);
    }
    container.scrollTop = container.scrollHeight;
  }, 400);
}

/* ============================================================
   DỮ LIỆU: Xuất CSV / Đặt lại
   ============================================================ */
function exportCSV(){
  if (db.transactions.length === 0) { showToast('Chưa có giao dịch để xuất!'); return; }
  const rows = [['Ngày','Loại','Danh mục','Số tiền','Ghi chú','Ví']];
  const sorted = db.transactions.slice().sort((a,b) => a.date < b.date ? -1 : 1);
  sorted.forEach(t => {
    const w = db.wallets.find(x => x.id === t.walletId);
    rows.push([t.date, t.type === 'income' ? 'Thu' : 'Chi', t.category, t.amount, (t.note||''), w ? w.name : '']);
  });
  const csv = '﻿' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'moneybot-' + todayStr() + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📤 Đã xuất file CSV');
}
function resetData(){
  if (!confirm('Xoá TOÀN BỘ dữ liệu (ví, giao dịch, ngân sách, tiết kiệm)? Hành động này không thể hoàn tác.')) return;
  localStorage.removeItem(STORE_KEY);
  db = { wallets:[], transactions:[], budgets:[], savings:[], settings:{activeWalletId:null} };
  loadDB(); saveDB(); anchor = new Date(); switchScreen('home');
  showToast('🗑 Đã đặt lại toàn bộ dữ liệu');
}

/* ---------- Toast ---------- */
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ============================================================
   PROFILE (1.4)
   ============================================================ */
function renderProfileUI(){
  const p = db.profile;
  const nameEl = document.getElementById('profileName');
  const codeEl = document.getElementById('profileCode');
  const avEl   = document.getElementById('profileAvatar');
  if (nameEl) nameEl.textContent = p.name || 'Người dùng';
  if (codeEl) codeEl.textContent = 'Mã ví: ' + (p.code || '---');
  if (avEl) avEl.textContent = (p.name||'N')[0].toUpperCase();
}
function openProfileModal(){
  const p = db.profile;
  document.getElementById('profileNameInput').value = p.name || '';
  document.getElementById('profileCodeDisplay').value = p.code || '';
  openModal('modal-profile');
}
function submitProfile(){
  const name = document.getElementById('profileNameInput').value.trim() || 'Người dùng';
  db.profile.name = name;
  if (!db.profile.code) db.profile.code = genUserCode(name);
  saveDB(); closeModal('modal-profile'); renderProfileUI();
  showToast('✓ Đã lưu thông tin');
}
function copyUserCode(){
  const code = db.profile.code;
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(()=>showToast('✓ Đã sao chép mã ' + code));
  else showToast('Mã ví: ' + code);
}

/* ============================================================
   CHUYỂN KHOẢN giữa ví (2.1 / 2.2)
   ============================================================ */
function openTransferModal(){
  if (db.wallets.length < 2) { showToast('Cần ít nhất 2 ví để chuyển khoản'); return; }
  const fromSel = document.getElementById('transferFrom');
  const toSel   = document.getElementById('transferTo');
  fromSel.innerHTML = db.wallets.map(w => '<option value="'+w.id+'">'+esc(w.icon+' '+w.name)+'</option>').join('');
  toSel.innerHTML   = db.wallets.map(w => '<option value="'+w.id+'">'+esc(w.icon+' '+w.name)+'</option>').join('');
  // Mặc định: from = ví đầu, to = ví thứ 2
  fromSel.selectedIndex = 0;
  toSel.selectedIndex = 1;
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferDate').value = todayStr();
  document.getElementById('transferNote').value = '';
  openModal('modal-transfer');
}
function submitTransfer(){
  const fromId = document.getElementById('transferFrom').value;
  const toId   = document.getElementById('transferTo').value;
  if (fromId === toId) { showToast('Ví nguồn và ví đích không thể giống nhau!'); return; }
  const rawAmt = document.getElementById('transferAmount').value.replace(/\./g,'').replace(/\D/g,'');
  const amt = parseInt(rawAmt, 10);
  if (!amt || amt <= 0) { showToast('Vui lòng nhập số tiền hợp lệ!'); return; }
  const date = document.getElementById('transferDate').value || todayStr();
  const note = document.getElementById('transferNote').value.trim();
  db.transactions.push({ id:uid(), type:'transfer', walletId:fromId, toWalletId:toId, amount:amt, date, note, category:'Chuyển khoản' });
  saveDB(); closeModal('modal-transfer'); renderAll();
  const wFrom = db.wallets.find(w=>w.id===fromId);
  const wTo   = db.wallets.find(w=>w.id===toId);
  showToast('⇄ Đã chuyển ' + fmt(amt) + ' từ ' + (wFrom?wFrom.name:'?') + ' → ' + (wTo?wTo.name:'?'));
}
function openTransferDetail(id){
  // Cho phép xoá giao dịch chuyển khoản
  const t = db.transactions.find(x=>x.id===id);
  if (!t) return;
  const wFrom = db.wallets.find(w=>w.id===t.walletId);
  const wTo   = db.wallets.find(w=>w.id===t.toWalletId);
  if (confirm('Xoá giao dịch chuyển khoản\n' + (wFrom?wFrom.name:'?') + ' → ' + (wTo?wTo.name:'?') + '\n' + fmt(t.amount) + '?')) {
    db.transactions = db.transactions.filter(x=>x.id!==id);
    saveDB(); renderAll(); showToast('🗑 Đã xoá chuyển khoản');
  }
}

/* ============================================================
   MÓN NỢ (1.2)
   ============================================================ */
function setDebtTab(tab){
  debtTab = tab;
  document.getElementById('debtTabLend').className = 'debt-tab' + (tab==='lend'?' active':'');
  document.getElementById('debtTabBorrow').className = 'debt-tab' + (tab==='borrow'?' active':'');
  renderDebtScreen();
}
function setDebtType(type){
  debtFormType = type;
  document.getElementById('debtTypeLend').className = 'type-btn expense' + (type==='lend'?' active':'');
  document.getElementById('debtTypeBorrow').className = 'type-btn income' + (type==='borrow'?' active':'');
}
function renderDebtScreen(){
  const el = document.getElementById('debtList'); if (!el) return;
  const debts = db.debts.filter(d => d.type === debtTab);
  if (debts.length === 0) {
    const label = debtTab === 'lend' ? 'khoản cho vay' : 'khoản nợ';
    el.innerHTML = '<div class="empty-state" style="padding-top:40px;"><div class="empty-emoji">🤝</div><p>Chưa có ' + label + ' nào</p><p class="hint">Nhấn + để thêm</p></div>';
    return;
  }
  el.innerHTML = debts.map(d => {
    const remaining = Math.max(0, d.amount - (d.paid||0));
    const pct = d.amount > 0 ? Math.min(100, Math.round((d.paid||0)/d.amount*100)) : 0;
    const settled = remaining === 0;
    const dueStr = d.due ? (' · Hạn: ' + pd(d.due).getDate()+'/'+(pd(d.due).getMonth()+1)+'/'+pd(d.due).getFullYear()) : '';
    return '<div class="debt-item">'
      + '<div class="debt-edit-btn" onclick="openDebtModal(\'' + d.id + '\')">✏️</div>'
      + '<div class="debt-header">'
      + '<div class="debt-person">' + (d.type==='lend'?'💸 ':'📥 ') + esc(d.person) + '</div>'
      + '<div class="debt-type-badge ' + d.type + '">' + (d.type==='lend'?'Cho vay':'Đang nợ') + (settled?' ✓':'') + '</div>'
      + '</div>'
      + '<div class="debt-amounts">'
      + '<div class="debt-total">Gốc: ' + fmt(d.amount) + ' · Đã ' + (d.type==='lend'?'thu':'trả') + ': ' + fmt(d.paid||0) + dueStr + '</div>'
      + '<div class="debt-remaining ' + d.type + '">' + (settled ? '✅ Đã tất toán' : fmt(remaining) + ' còn lại') + '</div>'
      + '</div>'
      + '<div class="debt-bar-bg"><div class="debt-bar ' + (d.type==='borrow'?'borrow':'') + '" style="width:' + pct + '%"></div></div>'
      + '<div class="debt-footer"><span>' + pct + '% hoàn thành</span><span style="color:var(--gray-400);font-size:11px;">' + (d.note?esc(d.note):'') + '</span></div>'
      + '</div>';
  }).join('');
}
function openDebtModal(id){
  editingDebtId = id || null;
  if (id) {
    const d = db.debts.find(x=>x.id===id);
    debtFormType = d.type;
    document.getElementById('debtPerson').value = d.person;
    document.getElementById('debtAmount').value = fmtVND(d.amount);
    document.getElementById('debtPaid').value = fmtVND(d.paid||0);
    document.getElementById('debtDate').value = d.date || todayStr();
    document.getElementById('debtDue').value = d.due || '';
    document.getElementById('debtNote').value = d.note || '';
    document.getElementById('debtModalTitle').textContent = 'Sửa khoản nợ';
    document.getElementById('debtDeleteBtn').style.display = 'block';
  } else {
    debtFormType = debtTab;
    document.getElementById('debtPerson').value = '';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtPaid').value = '';
    document.getElementById('debtDate').value = todayStr();
    document.getElementById('debtDue').value = '';
    document.getElementById('debtNote').value = '';
    document.getElementById('debtModalTitle').textContent = 'Thêm khoản nợ';
    document.getElementById('debtDeleteBtn').style.display = 'none';
  }
  setDebtType(debtFormType);
  openModal('modal-debt');
}
function submitDebt(){
  const person = document.getElementById('debtPerson').value.trim();
  if (!person) { showToast('Vui lòng nhập tên người!'); return; }
  const rawAmt = document.getElementById('debtAmount').value.replace(/\./g,'').replace(/\D/g,'');
  const amount = parseInt(rawAmt, 10);
  if (!amount || amount <= 0) { showToast('Vui lòng nhập số tiền!'); return; }
  const rawPaid = document.getElementById('debtPaid').value.replace(/\./g,'').replace(/\D/g,'');
  const paid = parseInt(rawPaid, 10) || 0;
  const debt = { id: editingDebtId||uid(), type:debtFormType, person, amount, paid:Math.min(paid,amount), date:document.getElementById('debtDate').value||todayStr(), due:document.getElementById('debtDue').value||'', note:document.getElementById('debtNote').value.trim() };
  if (editingDebtId) { const i = db.debts.findIndex(x=>x.id===editingDebtId); db.debts[i] = debt; }
  else db.debts.push(debt);
  debtTab = debtFormType;
  saveDB(); closeModal('modal-debt'); renderDebtScreen(); renderAll();
  showToast('💾 Đã lưu khoản ' + (debtFormType==='lend'?'cho vay':'nợ'));
}
function deleteDebt(){
  if (!editingDebtId) return;
  db.debts = db.debts.filter(d=>d.id!==editingDebtId);
  saveDB(); closeModal('modal-debt'); renderDebtScreen(); showToast('🗑 Đã xoá');
}

/* ============================================================
   THỬ THÁCH (1.2)
   ============================================================ */
function renderChallengeScreen(){
  const el = document.getElementById('challengeList'); if (!el) return;
  if (db.challenges.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding-top:40px;"><div class="empty-emoji">🏆</div><p>Chưa có thử thách nào</p><p class="hint">Đặt giới hạn chi tiêu và thử sức!</p></div>';
    return;
  }
  const today = todayStr();
  el.innerHTML = db.challenges.map(c => {
    const start = pd(c.startDate), end = pd(c.endDate);
    const now = new Date();
    const isOngoing = now >= start && now <= end;
    const isPast = now > end;
    // Tính chi tiêu trong kỳ
    const spent = db.transactions.filter(t => {
      if (t.type==='transfer' || t.type==='income') return false;
      if (c.category && t.category !== c.category) return false;
      const d = pd(t.date);
      return d >= start && d <= end;
    }).reduce((s,t) => s+t.amount, 0);
    const pct = c.limit > 0 ? Math.min(100, Math.round(spent/c.limit*100)) : 0;
    const over = spent > c.limit;
    let statusLabel, statusClass;
    if (isOngoing) { statusLabel = '⏳ Đang chạy'; statusClass = 'ongoing'; }
    else if (isPast && !over) { statusLabel = '✅ Vượt thách'; statusClass = 'pass'; }
    else if (isPast && over) { statusLabel = '❌ Không đạt'; statusClass = 'fail'; }
    else { statusLabel = '🔜 Sắp bắt đầu'; statusClass = 'ongoing'; }
    const daysLeft = isOngoing ? Math.ceil((end-now)/(86400000)) : 0;
    return '<div class="challenge-item">'
      + '<div class="challenge-edit-btn" onclick="openChallengeModal(\'' + c.id + '\')">✏️</div>'
      + '<div class="challenge-header">'
      + '<div class="challenge-name">' + esc(c.name) + '</div>'
      + '<div class="challenge-status ' + statusClass + '">' + statusLabel + '</div>'
      + '</div>'
      + '<div class="challenge-amounts">Đã chi: <strong>' + fmt(spent) + '</strong> / ' + fmt(c.limit) + (c.category?' · '+esc(c.category):' · Tất cả') + '</div>'
      + '<div class="challenge-bar-bg"><div class="challenge-bar' + (over?' danger':'') + '" style="width:' + pct + '%"></div></div>'
      + '<div class="challenge-footer"><span>' + pct + '% đã dùng</span><span>' + (isOngoing ? 'Còn ' + daysLeft + ' ngày' : (c.startDate+' → '+c.endDate)) + '</span></div>'
      + '</div>';
  }).join('');
}
function openChallengeModal(id){
  editingChallengeId = id || null;
  const sel = document.getElementById('challengeCategory');
  sel.innerHTML = '<option value="">Tất cả danh mục</option>'
    + EXPENSE_CATS.map(c => '<option value="'+esc(c.name)+'">'+c.icon+' '+esc(c.name)+'</option>').join('');
  if (id) {
    const c = db.challenges.find(x=>x.id===id);
    document.getElementById('challengeName').value = c.name;
    sel.value = c.category || '';
    document.getElementById('challengeLimit').value = fmtVND(c.limit);
    document.getElementById('challengeStart').value = c.startDate;
    document.getElementById('challengeEnd').value = c.endDate;
    document.getElementById('challengeModalTitle').textContent = 'Sửa thử thách';
    document.getElementById('challengeDeleteBtn').style.display = 'block';
  } else {
    document.getElementById('challengeName').value = '';
    sel.value = '';
    document.getElementById('challengeLimit').value = '';
    document.getElementById('challengeStart').value = todayStr();
    const end = new Date(); end.setDate(end.getDate()+7);
    document.getElementById('challengeEnd').value = end.toISOString().split('T')[0];
    document.getElementById('challengeModalTitle').textContent = 'Tạo thử thách';
    document.getElementById('challengeDeleteBtn').style.display = 'none';
  }
  openModal('modal-challenge');
}
function submitChallenge(){
  const name = document.getElementById('challengeName').value.trim();
  if (!name) { showToast('Vui lòng nhập tên thử thách!'); return; }
  const rawLmt = document.getElementById('challengeLimit').value.replace(/\./g,'').replace(/\D/g,'');
  const limit = parseInt(rawLmt, 10);
  if (!limit || limit <= 0) { showToast('Vui lòng nhập ngân sách tối đa!'); return; }
  const startDate = document.getElementById('challengeStart').value;
  const endDate   = document.getElementById('challengeEnd').value;
  if (!startDate || !endDate || startDate > endDate) { showToast('Ngày không hợp lệ!'); return; }
  const ch = { id:editingChallengeId||uid(), name, category:document.getElementById('challengeCategory').value, limit, startDate, endDate };
  if (editingChallengeId) { const i = db.challenges.findIndex(x=>x.id===editingChallengeId); db.challenges[i] = ch; }
  else db.challenges.push(ch);
  saveDB(); closeModal('modal-challenge'); renderChallengeScreen();
  showToast('🏆 Đã tạo thử thách!');
}
function deleteChallenge(){
  if (!editingChallengeId) return;
  db.challenges = db.challenges.filter(c=>c.id!==editingChallengeId);
  saveDB(); closeModal('modal-challenge'); renderChallengeScreen(); showToast('🗑 Đã xoá thử thách');
}

/* ============================================================
   LỊCH CHI TIÊU (1.7)
   ============================================================ */
function openCalendar(){
  calAnchor = new Date(anchor); // dùng anchor hiện tại
  renderCalendar();
  openModal('modal-calendar');
}
function navCalendarMonth(dir){
  calAnchor = new Date(calAnchor);
  calAnchor.setMonth(calAnchor.getMonth() + dir);
  renderCalendar();
}
function renderCalendar(){
  const y = calAnchor.getFullYear(), mo = calAnchor.getMonth();
  document.getElementById('calendarTitle').textContent = 'Tháng ' + (mo+1) + ' / ' + y;
  // Gom thu/chi theo ngày trong tháng
  const start = new Date(y, mo, 1), end = new Date(y, mo+1, 1);
  const dayMap = {};
  db.transactions.forEach(t => {
    if (t.type === 'transfer') return;
    const d = pd(t.date);
    if (d < start || d >= end) return;
    const key = t.date;
    if (!dayMap[key]) dayMap[key] = 0;
    dayMap[key] += t.type === 'income' ? t.amount : -t.amount;
  });
  const today = todayStr();
  const firstDow = (new Date(y, mo, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(y, mo+1, 0).getDate();
  const DOWS = ['T2','T3','T4','T5','T6','T7','CN'];
  let html = DOWS.map(d => '<div class="cal-dow">' + d + '</div>').join('');
  // Ô trống đầu tháng
  for (let i=0; i<firstDow; i++) html += '<div class="cal-day empty"></div>';
  for (let day=1; day<=daysInMonth; day++) {
    const ds = y + '-' + pad(mo+1) + '-' + pad(day);
    const net = dayMap[ds] || 0;
    const isToday = ds === today;
    let amtHtml = '';
    if (net !== 0) {
      amtHtml = '<div class="cal-amount ' + (net>=0?'pos':'neg') + '">'
        + (net >= 0 ? '+' : '') + fmtShort(net) + '</div>';
    }
    html += '<div class="cal-day' + (isToday?' today':'') + '">'
      + '<div class="cal-day-num">' + day + '</div>'
      + amtHtml
      + '</div>';
  }
  document.getElementById('calendarGrid').innerHTML = html;
}

/* ============================================================
   DANH MỤC TUỲ CHỈNH
   ============================================================ */
const CAT_PALETTE = ['#F472B6','#3B82F6','#34D399','#FBBF24','#10B981','#A78BFA','#FB7185','#22D3EE','#F59E0B','#6366F1','#E05B6D','#8B5CF6','#06B6D4','#84CC16','#F97316','#9CA3AF'];
let catTab = 'expense', catFormType = 'expense', catEditIndex = null, catSelColor = CAT_PALETTE[0];

function setCatTab(type){
  catTab = type;
  document.getElementById('catTabExpense').className = 'debt-tab' + (type==='expense'?' active':'');
  document.getElementById('catTabIncome').className  = 'debt-tab' + (type==='income'?' active':'');
  renderCatScreen();
}
function setCatType(type){
  catFormType = type;
  document.getElementById('catTypeExpense').className = 'type-btn expense' + (type==='expense'?' active':'');
  document.getElementById('catTypeIncome').className  = 'type-btn income' + (type==='income'?' active':'');
}
function renderCatScreen(){
  const el = document.getElementById('catList'); if (!el) return;
  const cats = db.categories[catTab];
  if (cats.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-emoji">📂</div><p>Chưa có danh mục</p></div>';
    return;
  }
  el.innerHTML = cats.map((c, i) =>
    '<div style="background:white;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow-sm);cursor:pointer;" onclick="openCatModal(\'' + catTab + '\','+i+')">'
    + '<div style="width:40px;height:40px;border-radius:50%;background:' + c.color + '22;display:flex;align-items:center;justify-content:center;font-size:20px;">' + c.icon + '</div>'
    + '<div style="flex:1;font-size:14px;font-weight:700;color:var(--gray-900);">' + esc(c.name) + '</div>'
    + '<div style="width:12px;height:12px;border-radius:50%;background:' + c.color + '"></div>'
    + '<div style="font-size:18px;color:var(--gray-300);">›</div>'
    + '</div>'
  ).join('');
}
function openCatModal(type, index){
  if (index !== undefined && index !== null) {
    // Sửa
    catEditIndex = index; catFormType = type || catTab;
    const c = db.categories[catFormType][index];
    catSelColor = c.color || CAT_PALETTE[0];
    document.getElementById('catIcon').value = c.icon;
    document.getElementById('catName').value = c.name;
    document.getElementById('catModalTitle').textContent = 'Sửa danh mục';
    document.getElementById('catDeleteBtn').style.display = 'block';
  } else {
    // Thêm
    catEditIndex = null; catFormType = type || catTab;
    catSelColor = CAT_PALETTE[Math.floor(Math.random()*CAT_PALETTE.length)];
    document.getElementById('catIcon').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catModalTitle').textContent = 'Thêm danh mục';
    document.getElementById('catDeleteBtn').style.display = 'none';
  }
  setCatType(catFormType);
  // Render color picker
  document.getElementById('catColorPicker').innerHTML = CAT_PALETTE.map(col =>
    '<div onclick="pickCatColor(\'' + col + '\')" style="width:32px;height:32px;border-radius:50%;background:' + col + ';cursor:pointer;border:3px solid ' + (col===catSelColor?'#333':'transparent') + ';transition:border 0.15s;" id="cp_' + col.replace('#','') + '"></div>'
  ).join('');
  openModal('modal-cat');
}
function openCatModalInline(type){ closeModal('modal-add-tx'); catFormType=type; openCatModal(type, null); }
function pickCatColor(col){
  catSelColor = col;
  document.querySelectorAll('#catColorPicker div').forEach(el => el.style.border = '3px solid transparent');
  const target = document.getElementById('cp_' + col.replace('#',''));
  if (target) target.style.border = '3px solid #333';
}
function submitCat(){
  const icon = document.getElementById('catIcon').value.trim() || '📦';
  const name = document.getElementById('catName').value.trim();
  if (!name) { showToast('Vui lòng nhập tên danh mục!'); return; }
  const cat = { name, icon, color: catSelColor };
  const list = db.categories[catFormType];
  if (catEditIndex !== null) {
    list[catEditIndex] = cat;
  } else {
    // Kiểm tra trùng tên
    if (list.find(c => c.name === name)) { showToast('Danh mục đã tồn tại!'); return; }
    list.push(cat);
  }
  catTab = catFormType;
  saveDB(); closeModal('modal-cat'); renderCatScreen();
  showToast('💾 Đã lưu danh mục');
}
function deleteCat(){
  if (catEditIndex === null) return;
  const list = db.categories[catFormType];
  const catName = list[catEditIndex].name;
  // Kiểm tra có giao dịch nào đang dùng không
  const used = db.transactions.some(t => t.category === catName && t.type === catFormType);
  if (used && !confirm('Danh mục "' + catName + '" đang có giao dịch. Xoá sẽ không xoá giao dịch. Tiếp tục?')) return;
  list.splice(catEditIndex, 1);
  saveDB(); closeModal('modal-cat'); renderCatScreen();
  showToast('🗑 Đã xoá danh mục');
}

/* ============================================================
   FIREBASE — Đồng bộ đám mây
   ============================================================
   HƯỚNG DẪN THIẾT LẬP:
   1. Vào https://console.firebase.google.com → Tạo project "moneybot"
   2. Thêm Web App → copy firebaseConfig bên dưới
   3. Authentication → Sign-in method → Bật Google
   4. Firestore Database → Tạo DB → chọn "production mode"
   5. Firestore → Rules → dán rules (xem hướng dẫn)
   6. Dán config của bạn vào FIREBASE_CONFIG bên dưới
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBFC3zt8kEI6aDO6d4NZcIx7r8KqU6xBJc",
  authDomain:        "moneybot-fd2e2.firebaseapp.com",
  projectId:         "moneybot-fd2e2",
  storageBucket:     "moneybot-fd2e2.firebasestorage.app",
  messagingSenderId: "51757805010",
  appId:             "1:51757805010:web:1c5087f0ad375c7ae5ec0b"
};

// ── Biến Firebase ──
let fbApp = null, fbAuth = null, fbStore = null, fbUser = null;
let fbReady = false;
let _syncTimer = null;
let _syncStatus = 'local'; // 'local' | 'syncing' | 'synced' | 'error'
let _cloudSaveEnabled = true; // Tạm tắt khi đang pull để tránh vòng lặp

// ── Khởi tạo Firebase ──
function initFirebase() {
  const hasConfig = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;
  if (!hasConfig) {
    renderSyncUI(); return; // Chạy localStorage-only
  }
  try {
    fbApp   = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth  = firebase.auth();
    fbStore = firebase.firestore();
    fbReady = true;
    // Theo dõi trạng thái đăng nhập
    fbAuth.onAuthStateChanged(user => {
      fbUser = user;
      if (user) onSignedIn(user); else onSignedOut();
    });
  } catch(e) {
    console.warn('Firebase init error:', e);
    renderSyncUI();
  }
}

// ── Khi đăng nhập thành công ──
async function onSignedIn(user) {
  _syncStatus = 'syncing'; renderSyncUI();
  try {
    await pullFromCloud();
    _syncStatus = 'synced';
    db.settings._lastSync = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    showToast('☁️ Đã đồng bộ dữ liệu từ cloud');
  } catch(e) {
    _syncStatus = 'error';
    console.warn('Pull error:', e);
    showToast('⚠️ Không thể đồng bộ — dùng dữ liệu cục bộ');
  }
  renderSyncUI(); renderAll();
}

function onSignedOut() {
  _syncStatus = 'local'; renderSyncUI();
}

// ── Lấy dữ liệu từ Firestore ──
async function pullFromCloud() {
  if (!fbUser || !fbStore) return;
  const ref = fbStore.collection('users').doc(fbUser.uid).collection('app').doc('data');
  const snap = await ref.get();

  if (!snap.exists) {
    // Lần đầu đăng nhập — upload local lên cloud
    await pushToCloud(true);
    return;
  }

  const cloudData = snap.data();
  const cloudDb = cloudData.db;
  if (!cloudDb) { await pushToCloud(true); return; }

  // So sánh: cloud mới hơn → dùng cloud; local mới hơn → upload lên
  const cloudTs = cloudData.updatedAtMs || 0;
  const localTs  = db.settings._localUpdatedAt || 0;

  if (cloudTs > localTs) {
    // Cloud mới hơn
    _cloudSaveEnabled = false;
    db = cloudDb;
    // Đảm bảo các trường tồn tại
    ['wallets','transactions','budgets','savings','debts','challenges'].forEach(k => { db[k] = db[k]||[]; });
    db.categories = db.categories || { expense:[...EXPENSE_CATS], income:[...INCOME_CATS] };
    db.profile    = db.profile    || {name:'Người dùng', code:''};
    db.settings   = db.settings   || {};
    saveDB();
    _cloudSaveEnabled = true;
  } else {
    // Local mới hơn hoặc bằng
    await pushToCloud(true);
  }
}

// ── Đẩy dữ liệu lên Firestore ──
async function pushToCloud(immediate = false) {
  if (!fbUser || !fbStore) return;
  const ref = fbStore.collection('users').doc(fbUser.uid).collection('app').doc('data');
  const payload = {
    db: JSON.parse(JSON.stringify(db)),
    updatedAtMs: Date.now(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(payload);
  _syncStatus = 'synced';
  db.settings._lastSync = new Date().toISOString();
  renderSyncUI();
}

// ── Debounced auto-push (gọi sau mỗi saveDB) ──
function schedulePush() {
  if (!fbUser || !fbReady || !_cloudSaveEnabled) return;
  _syncStatus = 'syncing'; renderSyncUI();
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    try {
      db.settings._localUpdatedAt = Date.now();
      await pushToCloud();
    } catch(e) {
      _syncStatus = 'error'; renderSyncUI();
    }
  }, 2500); // Chờ 2.5s sau thay đổi cuối mới push
}

// ── Đăng nhập / Đăng xuất ──
async function signInWithGoogle() {
  if (!fbAuth) { showToast('Firebase chưa được cấu hình'); return; }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await fbAuth.signInWithPopup(provider);
  } catch(e) { showToast('❌ Lỗi đăng nhập: ' + e.message); }
}
async function fbSignOut() {
  if (!fbAuth) return;
  await fbAuth.signOut();
  showToast('Đã đăng xuất khỏi tài khoản Google');
}

// ── Sync thủ công ──
async function manualSync() {
  if (!fbUser) { showToast('Hãy đăng nhập để đồng bộ'); return; }
  _syncStatus = 'syncing'; renderSyncUI();
  try { await pushToCloud(true); showToast('☁️ Đã đồng bộ lên cloud'); }
  catch(e) { _syncStatus = 'error'; renderSyncUI(); showToast('❌ Lỗi kết nối'); }
}

// ── Render phần Sync trong Settings ──
function renderSyncUI() {
  const el = document.getElementById('syncSection');
  if (!el) return;

  if (!fbReady) {
    // Firebase chưa cấu hình
    el.innerHTML = '<div style="background:var(--gray-100);border-radius:var(--radius-sm);padding:12px 14px;font-size:12px;color:var(--gray-500);line-height:1.6;">'
      + '⚙️ Chưa cấu hình Firebase. Dữ liệu đang lưu trên thiết bị này.<br>'
      + '<a href="https://console.firebase.google.com" target="_blank" style="color:var(--teal-dark);font-weight:700;">→ Hướng dẫn cài đặt Firebase</a>'
      + '</div>';
    return;
  }

  if (!fbUser) {
    // Chưa đăng nhập
    el.innerHTML = '<div class="sync-card" onclick="signInWithGoogle()">'
      + '<div class="sync-card-avatar">🔑</div>'
      + '<div style="flex:1;">'
      + '<div style="font-size:14px;font-weight:700;color:var(--gray-900);">Đăng nhập với Google</div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-top:2px;">Đồng bộ dữ liệu giữa các thiết bị</div>'
      + '</div>'
      + '<div style="font-size:18px;color:var(--gray-300);">›</div>'
      + '</div>';
    return;
  }

  // Đã đăng nhập
  const dotClass = {synced:'synced', syncing:'syncing', error:'error', local:'local'}[_syncStatus] || 'local';
  const statusText = {synced:'Đã đồng bộ', syncing:'Đang đồng bộ...', error:'Lỗi kết nối', local:'Cục bộ'}[_syncStatus] || '';
  const lastSync = db.settings._lastSync
    ? new Date(db.settings._lastSync).toLocaleString('vi-VN', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'})
    : '—';
  const photo = fbUser.photoURL
    ? '<img src="' + fbUser.photoURL + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'">'
    : '<div class="sync-card-avatar">' + (fbUser.displayName||'?')[0] + '</div>';

  el.innerHTML = '<div style="background:var(--white);border-radius:var(--radius-sm);padding:14px 16px;box-shadow:var(--shadow-sm);">'
    + '<div style="display:flex;align-items:center;gap:10px;">'
    + photo
    + '<div style="flex:1;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--gray-900);">' + esc(fbUser.displayName || fbUser.email) + '</div>'
    + '<div style="font-size:11px;color:var(--gray-400);">' + esc(fbUser.email) + '</div>'
    + '</div>'
    + '<div onclick="fbSignOut()" style="font-size:12px;color:var(--pink);font-weight:700;cursor:pointer;padding:4px 8px;">Thoát</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--gray-100);">'
    + '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray-500);">'
    + '<div class="sync-status-dot ' + dotClass + '"></div>'
    + statusText
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;">'
    + '<div style="font-size:11px;color:var(--gray-400);">Lần cuối: ' + lastSync + '</div>'
    + '<div onclick="manualSync()" style="font-size:12px;color:var(--teal-dark);font-weight:700;cursor:pointer;">🔄 Sync</div>'
    + '</div>'
    + '</div></div>';
}

/* ============================================================
   IMPORT CSV — Khôi phục dữ liệu
   ============================================================ */
function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) { showToast('File CSV trống hoặc không hợp lệ!'); return; }
      // Parse header
      const header = parseCSVLine(lines[0]).map(h => h.trim());
      // Expected: Ngày, Loại, Danh mục, Số tiền, Ghi chú, Ví
      const iDate = header.indexOf('Ngày'), iType = header.indexOf('Loại');
      const iCat  = header.indexOf('Danh mục'), iAmt = header.indexOf('Số tiền');
      const iNote = header.indexOf('Ghi chú'), iWallet = header.indexOf('Ví');
      if (iDate === -1 || iAmt === -1) { showToast('File CSV không đúng định dạng MoneyBot!'); return; }

      let importedCount = 0, skipped = 0;
      const existingIds = new Set(db.transactions.map(t => t.date + '_' + t.amount + '_' + t.category));

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 4) continue;
        const date   = cols[iDate] || todayStr();
        const typeRaw= iType > -1 ? cols[iType] : 'Chi';
        const type   = typeRaw.startsWith('Thu') ? 'income' : 'expense';
        const category = iCat > -1 ? cols[iCat] : 'Khác';
        const amount   = parseInt((cols[iAmt]||'0').replace(/\D/g,''), 10) || 0;
        const note     = iNote > -1 ? cols[iNote] : '';
        const walletName = iWallet > -1 ? cols[iWallet] : '';
        if (!amount) { skipped++; continue; }
        // Tìm ví tương ứng
        let walletId = db.settings.activeWalletId || db.wallets[0]?.id;
        if (walletName) {
          const w = db.wallets.find(x => x.name === walletName);
          if (w) walletId = w.id;
        }
        // Kiểm tra trùng
        const key = date + '_' + amount + '_' + category;
        if (existingIds.has(key)) { skipped++; continue; }
        existingIds.add(key);
        db.transactions.push({ id:uid(), walletId, type, amount, category, note, date });
        importedCount++;
      }

      saveDB(); renderAll();
      showToast('✅ Đã nhập ' + importedCount + ' giao dịch' + (skipped ? ' (' + skipped + ' bỏ qua)' : ''));
    } catch(err) {
      showToast('❌ Lỗi đọc file: ' + err.message);
    }
    event.target.value = ''; // Reset input
  };
  reader.readAsText(file, 'utf-8');
}

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === ',' && !inQuote) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

/* ---------- Khởi động ---------- */
loadDB();
document.getElementById('txDate').value = todayStr();
initFirebase(); // Khởi tạo Firebase (nếu đã cấu hình)
switchScreen('home');

/* ============================================================
   AMOUNT INPUT — định dạng VND dấu "." + pre-fill "000"
   ============================================================ */
(function(){
  const amtEl = document.getElementById('txAmount');

  // Khi focus: nếu đang là "000" → đặt cursor ở đầu để gõ trước
  amtEl.addEventListener('focus', function(){
    const el = this;
    setTimeout(() => {
      if (el.value === '000') {
        try { el.setSelectionRange(0, 0); } catch(e){}
      }
    }, 50);
  });

  // Khi gõ: chỉ chấp nhận chữ số, giữ định dạng dấu "."
  amtEl.addEventListener('keydown', function(e){
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End','Enter'];
    if (allowed.includes(e.key)) return;
    if (e.key >= '0' && e.key <= '9') return;
    e.preventDefault(); // chặn mọi ký tự khác (kể cả dấu phẩy)
  });

  // Sau mỗi thay đổi: format với dấu "." nhưng KHÔNG khi giá trị = "000"
  amtEl.addEventListener('input', function(){
    const raw = this.value.replace(/\./g,'').replace(/\D/g,'');
    if (!raw || raw === '000' || raw === '00' || raw === '0') return; // giữ nguyên khi đang gõ đầu
    const n = parseInt(raw, 10);
    if (!n) return;
    const formatted = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (this.value !== formatted) this.value = formatted;
  });

  // Khi blur: làm sạch — nếu "000" coi như trống
  amtEl.addEventListener('blur', function(){
    const raw = this.value.replace(/\./g,'').replace(/\D/g,'');
    if (!raw || raw === '000' || raw === '00' || raw === '0') { this.value = ''; return; }
    const n = parseInt(raw, 10);
    this.value = n > 0 ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  });
})();

/* ============================================================
   FAB — chỉ kéo DỌC, khoá ngang cứng ở right: 20px
   ============================================================ */
(function(){
  const fab = document.getElementById('fabBtn');
  let dragging = false, moved = false, startY = 0, startTop = 0;
  const FAB_RIGHT = 20; // px từ phải — cố định

  function getFabTop(){
    return fab.getBoundingClientRect().top;
  }

  // Khoá X cứng sau mỗi lần cập nhật vị trí
  function setFabTop(newTop){
    const clamped = Math.max(60, Math.min(window.innerHeight - 80, newTop));
    fab.style.position = 'fixed';
    fab.style.top    = clamped + 'px';
    fab.style.bottom = 'auto';
    fab.style.right  = FAB_RIGHT + 'px';  // khoá ngang
    fab.style.left   = 'auto';            // ngăn left ảnh hưởng
    fab.style.transform = 'none';         // chặn transform làm dịch ngang
  }

  fab.addEventListener('touchstart', function(e){
    dragging = true; moved = false;
    startY = e.touches[0].clientY;
    startTop = getFabTop();
    e.stopPropagation();
  }, {passive: true});

  fab.addEventListener('touchmove', function(e){
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > 8) {
      moved = true;
      e.preventDefault();
      setFabTop(startTop + dy);
    }
  }, {passive: false});

  fab.addEventListener('touchend', function(e){
    if (!moved) {
      // Nhấn nhẹ = mở form (chỉ khi chưa gán onclick riêng)
      if (!fab.onclick) openAddTransaction();
    }
    dragging = false; moved = false;
  });

  // Desktop: mouse drag
  fab.addEventListener('mousedown', function(e){
    if (e.button !== 0) return;
    dragging = true; moved = false;
    startY = e.clientY; startTop = getFabTop();
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e){
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 5) moved = true;
    if (moved) setFabTop(startTop + dy);
  });
  document.addEventListener('mouseup', function(e){
    if (dragging && !moved && !fab.onclick) openAddTransaction();
    dragging = false; moved = false;
  });
})();

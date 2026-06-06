# MoneyBot — App theo dõi chi tiêu cá nhân

> **File này dành cho Claude khi vào workspace.** Đọc kỹ trước khi sửa code.
> **User là người Việt** — luôn trả lời tiếng Việt, ngắn gọn, không dùng emoji nịnh.

---

## 1. TÓM TẮT DỰ ÁN

App web theo dõi chi tiêu cá nhân, **single-page**, deploy trên Vercel. Một người dùng — chủ dự án. Mobile-first (dùng chính trên iPhone), sửa code trên máy Windows.

**Live:** https://moneybot-two.vercel.app
**GitHub:** https://github.com/hungpm-lgtm/moneybot

---

## 2. TECH STACK

| Phần | Công nghệ |
|---|---|
| Frontend | Vanilla HTML + CSS + JavaScript (KHÔNG framework, KHÔNG build step) |
| Storage local | `localStorage` (key `moneybot_v1`) |
| Cloud sync | Firebase Firestore (project `moneybot-fd2e2`) |
| Auth | Firebase Google Sign-in |
| Hosting | Vercel (auto-deploy từ GitHub branch `main`) |
| Repo | GitHub `hungpm-lgtm/moneybot` |

**Không có:** npm/node_modules, build tool, TypeScript, framework. Mọi thứ thuần plain JS, edit-and-deploy.

---

## 3. CẤU TRÚC FILE

```
app chi tiêu cá nhân/
├── rolly-finance-app.html  # App chính — chỉ HTML structure (~700 dòng)
├── styles.css              # Toàn bộ CSS (~1000 dòng)
├── app.js                  # Toàn bộ logic JS (~1700 dòng)
├── quick-add.html          # Trang Ghi nhanh độc lập (URL /quick) — tự chứa CSS+JS
├── vercel.json             # Routes: / → app chính, /quick → quick-add
├── .gitignore              # .claude/ .vercel/ giao diện app/
├── CLAUDE.md               # File này
└── HANDOFF.md              # Tài liệu bàn giao chi tiết hơn cho user
```

**Quan trọng:** App chính đã được tách 3 file để giảm context window khi edit. Đừng gộp lại.

---

## 4. CONVENTIONS USER YÊU CẦU

- **Tiếng Việt cho mọi phản hồi và code comment**
- **Ngắn gọn, đi thẳng vấn đề** — đừng giải thích dài dòng kiểu "Tuyệt vời! Bạn nói đúng tuyệt đối!..."
- **Không tự thêm tính năng** không được yêu cầu — user thường rõ về scope
- **Mobile-first** — UI phải hoạt động trên iPhone trước
- **Tiền VND** dùng dấu chấm `.` ngăn cách hàng nghìn (1.500.000)
- **Format code** — dùng `var` (CSS var) qua `:root`, JS dùng function global (KHÔNG ES module vì không có build)
- **Git commit message** ngắn, prefix theo loại (`feat:`, `fix:`, `ui:`, `refactor:`, `tweak:`)
- **Test trước khi push** — dùng preview tool nếu có, hoặc đọc kỹ file
- **Không tự confirm push** — nhiều khi user chỉ muốn xem trước

---

## 5. WORKFLOW DEPLOY

User dùng GitHub + Vercel auto-deploy:

```bash
# Mọi thay đổi đều push qua main
git add <files>
git commit -m "feat: short message"
git push
# Vercel tự deploy trong ~30 giây
```

Không có CI/CD test, không có staging. Push thẳng main.

**Backup:** dữ liệu user lưu trên Firebase Firestore (project `moneybot-fd2e2`, region asia-southeast1 Singapore). User đã đăng nhập sẵn, các thiết bị sync tự động.

---

## 6. FIREBASE CONFIG (đã trong code, không bí mật)

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBFC3zt8kEI6aDO6d4NZcIx7r8KqU6xBJc",
  authDomain: "moneybot-fd2e2.firebaseapp.com",
  projectId: "moneybot-fd2e2",
  storageBucket: "moneybot-fd2e2.firebasestorage.app",
  messagingSenderId: "51757805010",
  appId: "1:51757805010:web:1c5087f0ad375c7ae5ec0b"
};
```

**Firestore Rules:** mỗi user chỉ đọc/ghi được dữ liệu của chính mình (`users/{uid}/app/data`).

**Authorized domains:** `localhost`, `moneybot-fd2e2.firebaseapp.com`, `moneybot-two.vercel.app`.

User đã setup Firebase từ trước — không cần làm lại.

---

## 7. DATA MODEL (lưu trong localStorage + Firestore)

```javascript
db = {
  wallets: [
    { id, name, icon, currency: 'VND'|'CNY', initialBalance, type: 'cash'|'checking'|'credit'|'saving'|'investment' }
  ],
  transactions: [
    { id, walletId, type: 'expense'|'income'|'transfer', amount, category, note, date: 'YYYY-MM-DD', time: 'HH:MM',
      toWalletId /* chỉ transfer */ }
  ],
  budgets: [ { id, walletId, category, limit } ],          // hạn mức/tháng
  savings: [ { id, name, target, current, deadline } ],
  debts: [ { id, type: 'lend'|'borrow', person, amount, paid, date, due, note } ],
  challenges: [ { id, name, category, limit, startDate, endDate } ],
  categories: { expense: [{name,icon,color}], income: [...] },  // tuỳ chỉnh được
  profile: { name, code: 'NGI-1234' },
  settings: {
    activeWalletId,
    mainCurrency: 'VND'|'CNY',
    exchangeRates: { CNY: 3500 },     // 1 đơn vị → bao nhiêu VND
    theme: 'default'|'pastel',
    quickSaveDelayMs: 1500,            // chỉ dùng cho /quick
    _lastBackup, _lastSync, _localUpdatedAt
  }
}
```

---

## 8. TÍNH NĂNG ĐÃ LÀM (KHÔNG GỢI Ý LẠI)

### Nhóm 1 — Cốt lõi
- Đa ví (VND + CNY) với 13 preset ngân hàng VN (VCB, TCB, MB, BIDV, ACB, TPBank, MoMo, ZaloPay...)
- 5 loại ví (cash/checking/credit/saving/investment)
- Tổng tài sản quy đổi đa tệ
- Thu/Chi/Chuyển khoản (3 loại tx)
- Cảnh báo số dư âm (trừ credit)

### Nhóm 2 — Giao dịch
- Thêm/sửa/xoá giao dịch, có time HH:MM tự lấy giờ
- Number input pre-fill "000" với dấu `.` ngăn cách
- Phím tắt số tiền (+10k/20k/50k/100k/500k/1tr ở app chính; +1k/2k/5k/10k/20k/50k/100k/500k/1tr ở /quick)
- Chuyển khoản giữa ví (loại transfer, không tính vào thu/chi)
- Filter theo ví / loại / danh mục
- Tìm kiếm toàn cục (bỏ giới hạn kỳ khi search)
- Lịch tháng (icon 📅) hiện net từng ngày
- Long-press / swipe trái để xoá + Undo toast 5s

### Nhóm 3 — Phân tích
- Trang chủ: donut chart + % thay đổi so kỳ trước + TB chi/ngày
- Hiển thị `chi/ngân sách` cạnh từng danh mục
- Báo cáo: trend 6 tháng (line SVG), top 5 chi lớn, chi tiêu theo ví, dự báo cuối tháng
- AI Insights tự generate (Trang Tools)

### Nhóm 4 — Quản lý
- Ngân sách theo danh mục/tháng (cảnh báo 80% vàng, >100% đỏ)
- Mục tiêu tiết kiệm + nạp tiền
- Theo dõi nợ (2 tab: cho vay / đang nợ)
- Thử thách chi tiêu có kỳ hạn
- Quản lý danh mục tuỳ chỉnh

### Nhóm 5 — An toàn dữ liệu
- Firebase cloud sync (Google login)
- Xuất CSV / Nhập CSV
- Nhắc backup hàng tuần (toast)
- Mã ví cá nhân (NGI-XXXX) — preparation cho ví chung tương lai

### Nhóm 6 — UX
- 2 theme: Cream Sage (default) / Pastel Pop (Nectarine/Pêche/Menthe/Lagune)
- FAB drag dọc, khoá ngang
- Header tổng tài sản gọn (wallet chips compact, không icon, hiển thị balance 2 chữ số)
- Modal tự đóng khi auto-save (quick-add)
- Quick-add với auto-save tuỳ chỉnh được (0/0.5/1/1.5/2/3s)

---

## 9. TÍNH NĂNG ĐÃ TỪNG LÀM RỒI BỎ (KHÔNG LÀM LẠI TRỪ KHI USER YÊU CẦU)

- **AI Chat** (chat-style nhập "ăn trưa 50k") — đã bỏ vì user chọn flow form
- **Premium modal** — đã bỏ
- **Báo cáo nâng cao VIP card** — đã bỏ
- **Status bar giả** (9:07 📶 🔋) — đã bỏ
- **Phone frame border bo cạnh** — bỏ, chuyển sang full screen
- **PWA manifest + iOS Shortcuts widget guide** (`zap.html`, `zap-builder.html`, `manifest.json`, `icon.svg`) — user bỏ vì không cần
- **Móng nợ ngân hàng (vay tín dụng)** — chỉ giữ cho vay / đang nợ cá nhân
- **Danh mục con (sub-category)** — không làm

---

## 10. TÍNH NĂNG CHƯA LÀM (CÓ THỂ BACKLOG)

Từ review ban đầu:
- **2.6/2.7/2.8** Giao dịch định kỳ (lương tự động, hoá đơn cố định, nhắc nợ) — user bỏ
- **2.10** Danh mục con — user bỏ
- **3.5 (cũ)** Báo cáo nâng cao — đã làm dạng Báo cáo thường
- **4.5** Lưu giao dịch gần đây (gợi ý) — user bỏ
- **4.6** Trang chủ 5 giao dịch gần nhất — user bỏ
- **5.4** PWA cài như app — user bỏ
- **5.5** Khóa app PIN/biometric — user bỏ
- **Nhóm 6 cũ** Quality of life (đa ngôn ngữ, đính kèm ảnh, tag, dark mode đầy đủ) — user bỏ

→ Hầu hết các tính năng đã được làm theo yêu cầu user. Nếu user yêu cầu mới, hỏi rõ scope trước.

---

## 11. LƯU Ý KỸ THUẬT QUAN TRỌNG

### Layout
- `body { position: fixed; inset: 0 }` — chặn iOS keyboard đẩy trang lên
- `meta viewport` có `interactive-widget=overlays-content`
- Sử dụng `100dvh` không `100vh` (iOS dynamic viewport)
- Safe area: `env(safe-area-inset-top/bottom)` cho notch iPhone

### Currency
- Hàm `convertToMain(amount, fromCur)` — quy đổi sang `mainCurrency()`
- `totalBalance()` đã tự convert tất cả wallets
- Balance individual ví giữ nguyên đơn vị gốc, hiện `curSym(currency)`
- VND symbol: `₫`, CNY: `¥`. KHÔNG còn USD (đã migrate sang VND)

### Firebase sync
- `saveDB()` tự gọi `schedulePush()` (debounce 2.5s)
- `pullFromCloud()` so sánh `updatedAtMs` để chọn cloud vs local
- Sau pull, phải gọi `applyTheme(db.settings.theme)` để giữ theme

### Quick-add (`/quick`)
- Tự chứa CSS+JS, không dùng styles.css/app.js
- Cùng đọc localStorage key `moneybot_v1` với app chính
- Cũng đăng nhập Firebase riêng và sync

### CSS variables theme
- Default theme ở `:root`
- Theme khác: `body.theme-pastel { --var: ... }`
- Cẩn thận: query `getComputedStyle(documentElement)` KHÔNG thấy override. Query từ body trở xuống.

### FAB drag (app chính)
- Chỉ dọc, khoá ngang bằng `style.right=20px; style.left=auto`
- `touch-action: none` trong CSS để chặn iOS scroll khi chạm FAB
- Phân biệt tap vs drag bằng threshold 8px

### Tránh
- Đừng dùng `==` (lúc check `t.type === 'transfer'` thì OK với `===`)
- Đừng `innerHTML +=` trong loop dài → dùng array.join
- Đừng quên `esc()` HTML khi render user input vào HTML string
- Đừng dùng arrow function trong onclick HTML (script extension cũ)
- Đừng commit file `.vercel/` hay `.claude/` (đã ignore)

---

## 12. WORKFLOW EDIT THÔNG THƯỜNG

1. User mô tả yêu cầu (Vietnamese, ngắn)
2. Đọc file liên quan bằng Read/Grep (ưu tiên Grep để tìm chính xác chỗ cần sửa, đỡ tốn context)
3. Edit chính xác (dùng Edit tool với old_string đủ unique)
4. Verify bằng preview nếu có Claude Preview MCP, hoặc grep lại
5. Push: `git add <files> && git commit -m "..." && git push`
6. Báo user "Đã deploy", tóm tắt thay đổi ngắn gọn
7. Nếu user nói "không cần làm tiếp" hoặc dismiss câu hỏi — DỪNG NGAY, không tự đoán

---

## 13. COMMON COMMANDS

```bash
# Xem file structure
ls -la

# Đếm dòng
wc -l rolly-finance-app.html styles.css app.js quick-add.html

# Tìm chỗ cần sửa
grep -n "function name" app.js

# Git
git status
git log --oneline -10
git add <files>
git commit -m "feat: ..."
git push

# Vercel CLI (nếu cần redeploy thủ công, hiếm khi cần)
npx vercel --prod
```

---

## 14. KHỞI ĐỘNG NHANH KHI VÀO WORKSPACE LẦN ĐẦU

1. Đọc file này (CLAUDE.md)
2. `git status` — xem có thay đổi pending không
3. `git log --oneline -5` — xem commit gần nhất
4. `wc -l rolly-finance-app.html styles.css app.js quick-add.html` — xem độ lớn file
5. Mở [moneybot-two.vercel.app](https://moneybot-two.vercel.app) trên trình duyệt — xem app đang chạy thế nào
6. Sẵn sàng nhận yêu cầu user

---

**Cập nhật lần cuối:** 2026-06 (theo state hiện tại của repo)
**Nếu file này lỗi thời:** đọc thêm `HANDOFF.md` hoặc git log để cập nhật.

# 📦 Tài liệu bàn giao dự án MoneyBot

> File này dành cho **bạn** — chủ dự án — để chuyển sang tài khoản Claude khác (hoặc developer khác) mà không mất dữ liệu/setup.

---

## 🌐 LINKS QUAN TRỌNG

| | |
|---|---|
| **App live** | https://moneybot-two.vercel.app |
| **GitHub repo** | https://github.com/hungpm-lgtm/moneybot |
| **Vercel dashboard** | https://vercel.com/hungpm-2640s-projects/moneybot |
| **Firebase console** | https://console.firebase.google.com/project/moneybot-fd2e2 |

---

## 🔑 TÀI KHOẢN BẠN ĐÃ DÙNG

(Ghi để nhớ — không cần share cho Claude mới)

- GitHub: **hungpm-lgtm**
- Vercel: hungpm-2640's projects
- Firebase: cùng Gmail
- App đăng nhập: Google Account đã link với Firebase

→ Khi đổi máy/thiết bị mới, đăng nhập đúng Google này → dữ liệu sync về.

---

## 💻 CÁC FILE TRONG DỰ ÁN

```
app chi tiêu cá nhân/
├── rolly-finance-app.html  ← App chính (HTML)
├── styles.css              ← CSS (1100 dòng)
├── app.js                  ← JavaScript (1700 dòng)
├── quick-add.html          ← Trang Ghi nhanh (riêng)
├── vercel.json             ← Cấu hình route
├── CLAUDE.md               ← Tài liệu cho Claude mới ĐỌC
├── HANDOFF.md              ← File này (cho bạn)
└── .gitignore              ← Loại trừ file local
```

---

## 🚀 CÁCH CHUYỂN SANG TÀI KHOẢN CLAUDE MỚI

### Bước 1 — Khi mở Claude mới
Nói chính xác câu sau:

```
Đọc file CLAUDE.md trong workspace này trước.
Sau đó tôi sẽ giao yêu cầu mới.
```

Claude sẽ tự nắm full context (đã làm gì, code structure, conventions).

### Bước 2 — Mở workspace
- Mở Claude Code/Desktop với folder: `C:\Users\ABC\Desktop\app chi tiêu cá nhân`
- Claude sẽ tự thấy CLAUDE.md ngay đầu

### Bước 3 — Đăng nhập tools (nếu Claude cần)
- Git: đã setup `origin` ở GitHub repo
- Vercel: tự deploy qua GitHub, không cần CLI
- Firebase: config đã có trong code, không cần cài thêm

→ Claude mới có thể edit/push code ngay mà không cần setup gì.

---

## 🛡️ DỮ LIỆU CỦA BẠN AN TOÀN

**Dữ liệu chi tiêu** lưu ở 2 nơi:
1. **Firebase Firestore** (cloud Google) — chính
2. **localStorage trên thiết bị** — cache offline

→ **Đổi tài khoản Claude KHÔNG ảnh hưởng dữ liệu app**.
→ App vẫn chạy như cũ tại moneybot-two.vercel.app.
→ Bạn vẫn đăng nhập Google bình thường, sync giữa các thiết bị.

---

## 📋 NHẮC NHỞ CHO BẠN

### Khi nói chuyện với Claude mới
- Yêu cầu **trả lời tiếng Việt**
- Yêu cầu **ngắn gọn, đi thẳng vấn đề**
- Nếu Claude tự thêm tính năng không cần: **bảo nó dừng**
- Nói rõ scope từng task (1-2 thay đổi/lần) để dễ kiểm soát

### Trước khi push
- Đọc qua diff: `git diff`
- Test trên localhost nếu Claude có preview tool
- Hoặc push xong test ngay trên Vercel (30 giây sau là live)

### Backup định kỳ
- Vào app → **Cài đặt → Xuất dữ liệu (CSV)** mỗi 1-2 tháng
- Lưu CSV vào Google Drive / email
- Phòng trường hợp xấu nhất (mất tài khoản Google)

---

## 🔧 NẾU CÓ VẤN ĐỀ

### App không load / lỗi trắng
- Kiểm tra `console.log` trên trình duyệt (F12)
- Vào Vercel dashboard xem build có lỗi không
- Rollback git: `git revert <commit>` hoặc `git reset --hard <commit cũ>`

### Đăng nhập Google không được
- Check Firebase Console → Authentication → Settings → Authorized domains có `moneybot-two.vercel.app`

### Dữ liệu mất
- Vào Firebase Console → Firestore → `users/<your-uid>/app/data`
- Có thể export thủ công từ đây

### Cần hỗ trợ kỹ thuật
- Nói Claude mới: "đọc CLAUDE.md, kiểm tra commit gần nhất bằng `git log -10`, tìm chỗ lỗi và sửa"

---

## 📊 STATE HIỆN TẠI CỦA DỰ ÁN

App đã hoàn thiện các tính năng chính sau ~50 commits:

✅ **Cốt lõi:** Đa ví (VND+CNY), thu/chi/chuyển khoản, danh mục tuỳ chỉnh
✅ **Phân tích:** Donut chart, ngân sách trên trang chủ, báo cáo trend 6 tháng, dự báo
✅ **An toàn:** Firebase cloud sync, xuất/nhập CSV, nhắc backup
✅ **UX:** 2 theme (Cream Sage / Pastel Pop), Ghi nhanh, auto-save tuỳ chỉnh, long-press xoá, undo
✅ **Tiện ích:** Mục tiêu tiết kiệm, theo dõi nợ, thử thách chi tiêu, lịch tháng

→ App đang ở trạng thái **dùng được lâu dài**, không cần thêm tính năng mới ngay nếu không có nhu cầu cụ thể.

---

## 💬 GỢI Ý CÂU HỎI CHO CLAUDE MỚI

Ví dụ những câu bạn có thể hỏi để Claude mới dễ hiểu task:

```
1. "Đọc CLAUDE.md rồi tóm tắt cho tôi app này có gì."

2. "Sửa giúp tôi: [yêu cầu cụ thể, 1-2 thay đổi]"

3. "Tìm hộ chỗ X trong app.js, giải thích nó làm gì"

4. "Tôi muốn thêm tính năng Y, có nên làm không và làm thế nào?"

5. "Review code app.js có chỗ nào cần dọn không"
```

---

## ✨ KỶ NIỆM

Dự án bắt đầu từ một mockup HTML tĩnh (file `rolly-finance-app.html` ban đầu chỉ là design mẫu).
Qua nhiều phiên làm việc đã trở thành app data-driven thực sự với:
- Cloud sync (Firebase)
- Multi-currency (VND/CNY)
- Báo cáo phân tích đầy đủ
- UI mobile-first Pastel đẹp
- ~3500 dòng code chia 4 file

Chúc bạn tiếp tục dùng app vui và hiệu quả!

— Claude (Sonnet 4.5)

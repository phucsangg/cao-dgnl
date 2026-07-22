# 🚀 Tool Cào Đề Ôn Tập ĐGNL (dolthpt.vn)

Tool Node.js tự động cào dữ liệu câu hỏi, đáp án và giải thích chi tiết (Linearthinking) từ các trang đề ôn tập ĐGNL của `dolthpt.vn` và tổng hợp thành các file học tập (.md, .json, .html).

---

## 📂 Cấu trúc thư mục `cao-dgnl`
- `dgnl-scraper.js`: File mã nguồn chính của tool cào.
- `package.json`: Cấu hình npm script.
- `output/`: Thư mục chứa dữ liệu kết quả xuất ra (.md, .json, .html).

---

## 🛠️ Hướng dẫn sử dụng

### 1. Cào mã đề mặc định (Mã đề 30):
```bash
node dgnl-scraper.js
```
hoặc
```bash
npm run scrape
```

### 2. Cào bài viết / mã đề bất kỳ khác:
```bash
node dgnl-scraper.js https://dolthpt.vn/dgnl-va-dgtd/<DUONG_DAN_BAI_VIET>
```
*Ví dụ*:
```bash
node dgnl-scraper.js https://dolthpt.vn/dgnl-va-dgtd/dap-an-va-giai-thich-de-on-tap-dgnl-dhqg-tp-hcm-nam-2025-ma-de-29
```

---

## 📄 Định dạng kết quả xuất ra trong folder `output/`:
- **File Markdown (`.md`)**: Dùng cho Notion, Obsidian hoặc đọc trực tiếp trên editor.
- **File HTML (`.html`)**: Web ôn tập offline có tính năng **"Hiện/Ẩn đáp án & giải thích"** để bạn tự làm bài và kiểm tra đáp án.
- **File JSON (`.json`)**: Dữ liệu cấu trúc sạch dùng để nhập vào các ứng dụng flashcard hoặc website học tập.

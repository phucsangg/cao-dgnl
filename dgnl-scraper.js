import fs from 'fs';
import path from 'path';
import {
  scrapeDolExam,
  generateUnifiedMarkdown,
  generateInteractiveHTML
} from './scraper-core.js';

async function main() {
  const args = process.argv.slice(2);
  let urls = [];

  const firstArg = args[0] || 'urls.txt';

  if (fs.existsSync(firstArg) && fs.statSync(firstArg).isFile()) {
    console.log(`📁 Đã tìm thấy tập tin danh sách URL: ${firstArg}`);
    const fileContent = fs.readFileSync(firstArg, 'utf-8');
    urls = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('http'));
  } else if (firstArg.startsWith('http')) {
    urls = [firstArg];
  } else if (fs.existsSync('urls.txt')) {
    console.log(`📁 Đọc danh sách mặc định từ file urls.txt...`);
    const fileContent = fs.readFileSync('urls.txt', 'utf-8');
    urls = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('http'));
  } else {
    urls = ['https://dolthpt.vn/dgnl-va-dgtd/dap-an-va-giai-thich-de-on-tap-dgnl-dhqg-tp-hcm-nam-2025-ma-de-30'];
  }

  if (urls.length === 0) {
    console.error('❌ Không tìm thấy đường dẫn URL hợp lệ nào!');
    process.exit(1);
  }

  console.log(`\n==================================================`);
  console.log(`🚀 BẮT ĐẦU CÀO HÀNG LOẠT ${urls.length} ĐỀ THI DOL THPT`);
  console.log(`==================================================\n`);

  for (let i = 0; i < urls.length; i++) {
    const targetUrl = urls[i];
    console.log(`\n--------------------------------------------------`);
    console.log(`📌 [${i + 1}/${urls.length}] Cào đề thi: ${targetUrl}`);
    console.log(`--------------------------------------------------`);

    try {
      const data = await scrapeDolExam(targetUrl);
      const slug = targetUrl.split('/').pop() || `de_thi_${i + 1}`;

      const outputDir = path.join(process.cwd(), 'output', slug);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const jsonPath = path.join(outputDir, `${slug}.json`);
      const htmlPath = path.join(outputDir, `${slug}.html`);
      const txtPath = path.join(outputDir, `${slug}_full_120_cau.txt`);
      const mdPath = path.join(outputDir, `${slug}_full_120_cau.md`);

      const unifiedMd = generateUnifiedMarkdown(data);

      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.writeFileSync(htmlPath, generateInteractiveHTML(data), 'utf-8');
      fs.writeFileSync(mdPath, unifiedMd, 'utf-8');
      fs.writeFileSync(txtPath, unifiedMd, 'utf-8');

      console.log(`\n🎉 Hoàn tất đề thi [${i + 1}/${urls.length}]! Đã xuất các file:`);
      console.log(` 📄 TXT: ${txtPath}`);
      console.log(` 📝 MD:  ${mdPath}`);
      console.log(` 📊 JSON: ${jsonPath}`);
      console.log(` 🌐 HTML: ${htmlPath}`);
    } catch (err) {
      console.error(`❌ Lỗi khi cào URL [${targetUrl}]:`, err.message);
    }
  }

  console.log(`\n==================================================`);
  console.log(`✅ HOÀN THÀNH CÀO TOÀN BỘ ${urls.length} ĐỀ THI!`);
  console.log(`==================================================\n`);
}

main();

import express from 'express';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import {
  scrapeDolExam,
  generateUnifiedMarkdown,
  generateInteractiveHTML
} from './scraper-core.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function getExecutablePath() {
  if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  if (fs.existsSync(EDGE_PATH)) return EDGE_PATH;
  throw new Error('Chrome/Edge executable not found.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const jobs = new Map();

app.post('/api/scrape', (req, res) => {
  const { url, urls } = req.body;
  
  let targetUrls = [];
  if (urls && Array.isArray(urls) && urls.length > 0) {
    targetUrls = urls.map(u => u.trim()).filter(u => u.startsWith('http'));
  } else if (url && typeof url === 'string' && url.startsWith('http')) {
    targetUrls = [url.trim()];
  }

  if (targetUrls.length === 0) {
    return res.status(400).json({ error: 'Vui lòng nhập hoặc dán ít nhất 1 đường dẫn URL hợp lệ từ dolthpt.vn' });
  }

  const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  
  const jobState = {
    jobId,
    urls: targetUrls,
    status: 'running',
    logs: [],
    count: 0,
    result: null,
    clients: []
  };

  jobs.set(jobId, jobState);
  res.json({ jobId, totalExams: targetUrls.length });

  (async () => {
    try {
      const allResults = [];
      const outputJobDir = path.join(__dirname, 'output', jobId);
      if (!fs.existsSync(outputJobDir)) {
        fs.mkdirSync(outputJobDir, { recursive: true });
      }

      for (let i = 0; i < targetUrls.length; i++) {
        const currentUrl = targetUrls[i];
        const logHeader = `📌 [Đề ${i + 1}/${targetUrls.length}] Đang cào URL: ${currentUrl}`;
        
        jobState.logs.push({ time: new Date().toLocaleTimeString(), message: logHeader });
        jobState.clients.forEach(clientRes => {
          clientRes.write(`data: ${JSON.stringify({ type: 'progress', log: { time: new Date().toLocaleTimeString(), message: logHeader }, count: jobState.count })}\n\n`);
        });

        const data = await scrapeDolExam(currentUrl, ({ message, count }) => {
          const logEntry = { time: new Date().toLocaleTimeString(), message: `[Đề ${i + 1}] ${message}`, count };
          jobState.logs.push(logEntry);
          if (count !== null && count !== undefined) {
            jobState.count = count;
          }

          jobState.clients.forEach(clientRes => {
            clientRes.write(`data: ${JSON.stringify({ type: 'progress', log: logEntry, count: jobState.count })}\n\n`);
          });
        });

        allResults.push(data);

        const slug = currentUrl.split('/').pop() || `de_${i + 1}`;
        const examSubDir = targetUrls.length > 1 ? path.join(outputJobDir, slug) : outputJobDir;
        if (!fs.existsSync(examSubDir)) {
          fs.mkdirSync(examSubDir, { recursive: true });
        }

        const unifiedMd = generateUnifiedMarkdown(data);
        const htmlContent = generateInteractiveHTML(data);

        fs.writeFileSync(path.join(examSubDir, 'full-120-cau-va-dap-an.md'), unifiedMd, 'utf-8');
        fs.writeFileSync(path.join(examSubDir, 'full-120-cau-va-dap-an.txt'), unifiedMd, 'utf-8');
        fs.writeFileSync(path.join(examSubDir, 'du-lieu-full-120-cau.json'), JSON.stringify(data, null, 2), 'utf-8');
        fs.writeFileSync(path.join(examSubDir, 'giao-dien-tuong-tac.html'), htmlContent, 'utf-8');
      }

      jobState.status = 'completed';
      jobState.result = targetUrls.length === 1 ? allResults[0] : { title: `Trọn bộ ${allResults.length} đề thi`, totalQuestions: allResults.reduce((a, b) => a + b.totalQuestions, 0), items: allResults.flatMap(r => r.items), exams: allResults };

      // Generate root unified files for job
      const finalResult = jobState.result;
      if (targetUrls.length > 1) {
        fs.writeFileSync(path.join(outputJobDir, 'full-120-cau-va-dap-an.md'), generateUnifiedMarkdown(finalResult), 'utf-8');
        fs.writeFileSync(path.join(outputJobDir, 'full-120-cau-va-dap-an.txt'), generateUnifiedMarkdown(finalResult), 'utf-8');
        fs.writeFileSync(path.join(outputJobDir, 'du-lieu-full-120-cau.json'), JSON.stringify(finalResult, null, 2), 'utf-8');
        fs.writeFileSync(path.join(outputJobDir, 'giao-dien-tuong-tac.html'), generateInteractiveHTML(finalResult), 'utf-8');
      }

      jobState.clients.forEach(clientRes => {
        clientRes.write(`data: ${JSON.stringify({ type: 'completed', result: jobState.result })}\n\n`);
        clientRes.end();
      });
    } catch (err) {
      jobState.status = 'error';
      jobState.error = err.message;
      jobState.clients.forEach(clientRes => {
        clientRes.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        clientRes.end();
      });
    }
  })();
});

app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).send('Job không tồn tại');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'init', logs: job.logs, count: job.count, status: job.status, result: job.result })}\n\n`);

  if (job.status === 'completed') {
    res.write(`data: ${JSON.stringify({ type: 'completed', result: job.result })}\n\n`);
    return res.end();
  }

  job.clients.push(res);

  req.on('close', () => {
    job.clients = job.clients.filter(c => c !== res);
  });
});

app.get('/api/download/:jobId/:fileType', async (req, res) => {
  const { jobId, fileType } = req.params;
  const outputDir = path.join(__dirname, 'output', jobId);

  if (fileType === 'pdf') {
    const pdfPath = path.join(outputDir, 'full-120-cau-va-dap-an.pdf');
    const htmlPath = path.join(outputDir, 'giao-dien-tuong-tac.html');

    if (!fs.existsSync(pdfPath)) {
      if (!fs.existsSync(htmlPath)) {
        return res.status(404).send('Dữ liệu chưa hoàn tất');
      }
      try {
        const browser = await puppeteer.launch({
          executablePath: getExecutablePath(),
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(fs.readFileSync(htmlPath, 'utf-8'), { waitUntil: 'networkidle0' });
        await page.pdf({
          path: pdfPath,
          format: 'A4',
          printBackground: true,
          margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' }
        });
        await browser.close();
      } catch (err) {
        return res.status(500).send('Lỗi khi tạo PDF: ' + err.message);
      }
    }
    return res.download(pdfPath, `full_120_cau_${jobId.substring(4)}.pdf`);
  }

  let filename = '';
  switch (fileType) {
    case 'full-txt': filename = 'full-120-cau-va-dap-an.txt'; break;
    case 'full-md': filename = 'full-120-cau-va-dap-an.md'; break;
    case 'json': filename = 'du-lieu-full-120-cau.json'; break;
    case 'html': filename = 'giao-dien-tuong-tac.html'; break;
    default: return res.status(400).send('Loại file không hợp lệ');
  }

  const filePath = path.join(outputDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Không tìm thấy file');
  }

  res.download(filePath, `${fileType}_${jobId.substring(4)}_${filename}`);
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 SangSang Scraper Web Application đang chạy!`);
  console.log(`🌐 Truy cập ứng dụng tại: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

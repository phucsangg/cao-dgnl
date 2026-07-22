let currentJobId = null;
let currentResultData = null;

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const startBatchBtn = document.getElementById('startBatchBtn');
  const targetUrlInput = document.getElementById('targetUrl');
  const batchUrlsInput = document.getElementById('batchUrlsInput');
  const txtFileInput = document.getElementById('txtFileInput');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const presetBtns = document.querySelectorAll('.btn-preset');
  const tabBtns = document.querySelectorAll('.tab-btn');

  const singleModeBtn = document.getElementById('singleModeBtn');
  const batchModeBtn = document.getElementById('batchModeBtn');
  const singleInputCard = document.getElementById('singleInputCard');
  const batchInputCard = document.getElementById('batchInputCard');

  // Switch modes
  singleModeBtn.addEventListener('click', () => {
    singleModeBtn.classList.add('active');
    batchModeBtn.classList.remove('active');
    singleInputCard.classList.remove('hidden');
    batchInputCard.classList.add('hidden');
  });

  batchModeBtn.addEventListener('click', () => {
    batchModeBtn.classList.add('active');
    singleModeBtn.classList.remove('active');
    batchInputCard.classList.remove('hidden');
    singleInputCard.classList.add('hidden');
  });

  // Handle txt file upload
  txtFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      fileNameDisplay.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      const reader = new FileReader();
      reader.onload = (event) => {
        batchUrlsInput.value = event.target.result;
      };
      reader.readAsText(file);
    } else {
      fileNameDisplay.textContent = 'Chưa chọn file nào';
    }
  });

  // Preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      targetUrlInput.value = btn.getAttribute('data-url');
    });
  });

  // Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Start Single Scrape
  startBtn.addEventListener('click', () => {
    const url = targetUrlInput.value.trim();
    if (!url) {
      alert('Vui lòng nhập đường dẫn URL hợp lệ từ dolthpt.vn!');
      return;
    }
    startScrapingProcess({ url });
  });

  // Start Batch Scrape
  startBatchBtn.addEventListener('click', () => {
    const rawText = batchUrlsInput.value.trim();
    const urls = rawText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));

    if (urls.length === 0) {
      alert('Vui lòng dán hoặc chọn file chứa ít nhất 1 đường dẫn URL hợp lệ!');
      return;
    }
    startScrapingProcess({ urls });
  });

  async function startScrapingProcess(payloadData) {
    const progressSection = document.getElementById('progressSection');
    const resultSection = document.getElementById('resultSection');
    const logConsole = document.getElementById('logConsole');
    const statusBadge = document.getElementById('statusBadge');
    const countStat = document.getElementById('countStat');
    const percentStat = document.getElementById('percentStat');
    const statusStat = document.getElementById('statusStat');
    const progressBar = document.getElementById('progressBar');

    startBtn.disabled = true;
    startBatchBtn.disabled = true;

    progressSection.classList.remove('hidden');
    resultSection.classList.add('hidden');

    logConsole.textContent = '🚀 Đang gửi yêu cầu cào dữ liệu đến server...\n';
    statusBadge.className = 'status-badge badge-running';
    statusBadge.textContent = 'Đang chạy...';
    countStat.textContent = '0 / 120';
    percentStat.textContent = '0%';
    statusStat.textContent = 'Đang khởi động...';
    progressBar.style.width = '0%';

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadData)
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Có lỗi xảy ra!');
      }

      currentJobId = data.jobId;
      const totalExams = data.totalExams || 1;
      logConsole.textContent += `✅ Job ID: ${currentJobId}. Tổng số đề thi cào: ${totalExams}\n`;

      const evtSource = new EventSource(`/api/progress/${currentJobId}`);

      evtSource.onmessage = (e) => {
        const payload = JSON.parse(e.data);

        if (payload.type === 'init') {
          if (payload.logs) {
            payload.logs.forEach(l => {
              logConsole.textContent += `[${l.time}] ${l.message}\n`;
            });
            logConsole.scrollTop = logConsole.scrollHeight;
          }
          if (payload.count !== undefined) {
            updateProgress(payload.count);
          }
        } else if (payload.type === 'progress') {
          if (payload.log) {
            logConsole.textContent += `[${payload.log.time}] ${payload.log.message}\n`;
            logConsole.scrollTop = logConsole.scrollHeight;
          }
          if (payload.count !== undefined) {
            updateProgress(payload.count);
          }
        } else if (payload.type === 'completed') {
          evtSource.close();
          statusBadge.className = 'status-badge badge-completed';
          statusBadge.textContent = 'Hoàn tất';
          statusStat.textContent = 'Cào thành công!';
          updateProgress(120);

          currentResultData = payload.result;
          renderResults(payload.result);

          startBtn.disabled = false;
          startBatchBtn.disabled = false;
        } else if (payload.type === 'error') {
          evtSource.close();
          statusBadge.className = 'status-badge badge-error';
          statusBadge.textContent = 'Lỗi';
          statusStat.textContent = 'Gặp lỗi!';
          logConsole.textContent += `\n❌ LỖI: ${payload.error}\n`;

          startBtn.disabled = false;
          startBatchBtn.disabled = false;
        }
      };

      evtSource.onerror = (err) => {
        console.error('SSE Error:', err);
      };

    } catch (err) {
      alert('Lỗi: ' + err.message);
      startBtn.disabled = false;
      startBatchBtn.disabled = false;
    }
  }

  function updateProgress(count) {
    const total = 120;
    const actualCount = Math.min(count, total);
    const percent = Math.round((actualCount / total) * 100);

    document.getElementById('countStat').textContent = `${actualCount} / ${total}`;
    document.getElementById('percentStat').textContent = `${percent}%`;
    document.getElementById('statusStat').textContent = `Đã cào ${actualCount} câu`;
    document.getElementById('progressBar').style.width = `${percent}%`;
  }

  function renderResults(data) {
    const resultSection = document.getElementById('resultSection');
    const resultMeta = document.getElementById('resultMeta');
    const fullPreview = document.getElementById('fullPreview');
    const jsonPreview = document.getElementById('jsonPreview');

    resultMeta.innerHTML = `📚 Đề thi: <strong>${data.title}</strong> | 📊 Tổng số câu: <strong>${data.totalQuestions} câu (Định dạng căn chỉnh chuẩn + Toán LaTeX + Không dính liền)</strong>`;

    let text = `📚 ${data.title.toUpperCase()}\n\n`;
    data.items.forEach(item => {
      text += `==================================================\n`;
      text += `❓ CÂU ${item.id}\n\n`;
      text += `📝 NỘI DUNG CÂU HỎI:\n\n${item.questionText}\n\n`;
      if (item.explanationText) {
        text += `🎯 ĐÁP ÁN & GIẢI THÍCH CHI TIẾT:\n\n${item.explanationText}\n\n`;
      }
    });

    fullPreview.textContent = text;
    jsonPreview.textContent = JSON.stringify(data, null, 2);

    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth' });

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([fullPreview]);
    }
  }
});

function downloadFile(fileType) {
  if (!currentJobId) {
    alert('Không tìm thấy Job ID!');
    return;
  }
  window.location.href = `/api/download/${currentJobId}/${fileType}`;
}

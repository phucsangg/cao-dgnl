import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function getExecutablePath() {
  if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  if (fs.existsSync(EDGE_PATH)) return EDGE_PATH;
  throw new Error('Chrome/Edge executable not found on system.');
}

/**
 * Format text spacing so words, colons, periods, and emojis don't stick together.
 * Also replaces ALL DOL branding with SangSang across text strings.
 */
function formatTextSpacing(text) {
  if (!text) return '';
  let clean = text;

  // Replace ALL DOL branding variants with SangSang
  clean = clean.replace(/DOL\s*THPT/gi, 'SangSang')
               .replace(/DOL\s*English/gi, 'SangSang')
               .replace(/DOL\s*Editor/gi, 'SangSang Editor')
               .replace(/\bDOL\b/g, 'SangSang');

  // Insert space after colons if missing: "Lí do:Đoạn 1" -> "Lí do: Đoạn 1"
  clean = clean.replace(/:([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸa-z0-9✅❌🚨🔎👉▶])/g, ': $1');

  // Insert space after periods if stuck to uppercase letters or numbers: "progress".One -> "progress". One
  clean = clean.replace(/\.([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸ0-9])/g, '. $1');

  // Format Question range headers cleanly with newlines: "Question 53 - 60.Read" -> "Question 53 - 60.\n\nRead"
  clean = clean.replace(/Question\s+(\d+)\s*-\s*(\d+)\.\s*/gi, 'Question $1 - $2.\n\n');

  // Insert newline before numbered paragraphs if stuck: "continues. 2. One" -> "continues.\n\n2. One"
  clean = clean.replace(/([.!?])\s*(?=\d+\.\s+[A-Z])/g, '$1\n\n');

  // Insert double newline before section emojis if stuck to previous sentence
  clean = clean.replace(/([.!?])(?=✅|❌|🚨|🔎|👉|▶|✔️|Đoạn\s+\d+|Phân tích|Lí do|Ngữ cảnh|Cụm từ)/g, '$1\n\n');

  // Insert space around arrows
  clean = clean.replace(/→/g, ' → ');

  // Standardize horizontal spaces per line while strictly PRESERVING newlines
  clean = clean.split('\n')
               .map(line => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
               .join('\n');

  // Clean up 3+ consecutive newlines to max 2 newlines
  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean.trim();
}

/**
 * Convert Markdown image syntax in text to HTML <img> elements
 */
function renderMarkdownImagesToHTML(text) {
  if (!text) return '';
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    return `<div class="q-image-container"><img class="q-image" src="${src}" alt="${alt || 'Hình ảnh câu hỏi'}" loading="lazy"/></div>`;
  });
}

/**
 * Generate Unified Markdown text containing questions, choices, and detailed explanations
 */
export function generateUnifiedMarkdown(data) {
  let md = `# ${data.title.replace(/DOL/gi, 'SangSang')}\n`;
  md += `Nguồn: ${data.sourceUrl}\n`;
  md += `Tổng số câu: ${data.totalQuestions}\n\n`;
  md += `---\n\n`;

  let lastPassageText = '';

  data.items.forEach((item) => {
    md += `## ❓ CÂU ${item.id}\n\n`;
    
    if (item.passageText && item.passageText.trim() !== lastPassageText.trim()) {
      md += `> 📖 **BÀI ĐỌC DÙNG CHUNG:**\n>\n`;
      md += item.passageText.trim().split('\n').map(l => l ? `> ${l}` : `>`).join('\n') + `\n\n`;
      lastPassageText = item.passageText.trim();
    }

    md += `### 📝 NỘI DUNG CÂU HỎI:\n\n`;
    md += `${formatTextSpacing(item.questionText)}\n\n`;

    if (item.choices && item.choices.length > 0) {
      md += `### 📌 CÁC LỰA CHỌN:\n\n`;
      md += item.choices.map(c => formatTextSpacing(c)).join('\n\n') + `\n\n`;
    }
    
    if (item.explanationText) {
      md += `### 🎯 ĐÁP ÁN & GIẢI THÍCH CHI TIẾT:\n\n`;
      md += `${formatTextSpacing(item.explanationText)}\n\n`;
    }
    
    md += `---\n\n`;
  });

  return md;
}

/**
 * Generate Interactive Offline HTML & PDF printable template with MathJax LaTeX & Visual Images
 */
export function generateInteractiveHTML(data) {
  let lastPassageText = '';
  const cleanTitle = data.title.replace(/DOL/gi, 'SangSang');

  const questionsHTML = data.items.map(item => {
    let passageHTML = '';
    if (item.passageText && item.passageText.trim() !== lastPassageText.trim()) {
      passageHTML = `
        <div class="passage-box">
          <div class="passage-header">📖 BÀI ĐỌC DÙNG CHUNG (CÂU ${item.id} trở đi):</div>
          <div class="passage-content">${renderMarkdownImagesToHTML(formatTextSpacing(item.passageText.trim())).replace(/\n/g, '<br>')}</div>
        </div>
      `;
      lastPassageText = item.passageText.trim();
    }

    const choicesHTML = (item.choices && item.choices.length > 0) 
      ? `<div class="choices-box">${item.choices.map(c => `<div class="choice-item">${renderMarkdownImagesToHTML(formatTextSpacing(c))}</div>`).join('')}</div>`
      : '';

    return `
      ${passageHTML}
      <div class="q-card" id="cau-${item.id}">
        <div class="q-header">
          <span class="q-title">❓ CÂU ${item.id}</span>
        </div>
        <div class="q-body">${renderMarkdownImagesToHTML(formatTextSpacing(item.questionText))}</div>
        ${choicesHTML}
        <div class="exp-box exp-content">
          <strong>🎯 Đáp án & Giải thích chi tiết:</strong><br><br>
          ${renderMarkdownImagesToHTML(formatTextSpacing(item.explanationText))}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${cleanTitle}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151c2c;
      --card-border: #232d42;
      --text: #f1f5f9;
      --accent: #38bdf8;
    }
    body { font-family: sans-serif; background: var(--bg); color: var(--text); padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { margin-bottom: 30px; }
    .meta {
      font-size: 0.95rem;
      color: var(--text-muted);
    }
    .passage-box {
      background: rgba(56, 189, 248, 0.05);
      border-left: 4px solid var(--accent);
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0 20px 0;
    }
    .passage-header {
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 12px;
      font-size: 1.05rem;
    }
    .passage-content {
      color: #cbd5e1;
      font-size: 0.98rem;
      line-height: 1.8;
    }
    .q-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .q-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--card-border);
    }
    .q-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--accent);
    }
    .q-body {
      font-size: 1rem;
      font-weight: 500;
      margin-bottom: 20px;
      white-space: pre-wrap;
    }
    .choices-box {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    .choice-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.95rem;
    }
    .exp-box {
      background: rgba(34, 197, 94, 0.05);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 12px;
      padding: 18px;
      font-size: 0.95rem;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    .q-image-container {
      margin: 12px 0;
      text-align: center;
    }
    .q-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    @media print {
      body { background: #fff; color: #000; }
      .q-card, .header, .passage-box { background: #fff; border: 1px solid #ccc; color: #000; box-shadow: none; }
      .q-title, .passage-header { color: #000; }
      .exp-box { background: #f8f8f8; border: 1px solid #ddd; color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${cleanTitle}</h1>
      <div class="meta">Tổng số câu: ${data.totalQuestions} | Nguồn: <a href="${data.sourceUrl}" style="color: var(--accent);">${data.sourceUrl}</a></div>
    </div>
    ${questionsHTML}
  </div>
</body>
</html>`;
}

/**
 * Scrape a full 120-question exam from dolthpt.vn
 */
export async function scrapeDolExam(targetUrl, onLog) {
  const log = (msg, count = null) => {
    console.log(msg);
    if (onLog) onLog({ message: msg, count });
  };

  log(`🚀 Bắt đầu trình duyệt cào dữ liệu từ: ${targetUrl}`);

  const browser = await puppeteer.launch({
    executablePath: getExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  log(`📡 Đang tải trang web...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  log(`🔍 Kiểm tra và kích hoạt giao diện xem đáp án...`);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, div, span, a')).find(
      x => x.innerText && x.innerText.includes('Xem đáp án và bài mẫu')
    );
    if (el) el.click();
  });
  await new Promise(r => setTimeout(r, 2500));

  await new Promise(r => setTimeout(r, 1000));

  const questionsMap = new Map();
  let step = 0;
  let noProgressCount = 0;

  while (step < 250 && questionsMap.size < 120) {
    step++;

    const rawData = await page.evaluate(() => {
      function mathmlToLaTeX(mathEl) {
        if (!mathEl) return '';
        function parseNode(node) {
          if (!node) return '';
          if (node.nodeType === 3) return node.textContent.replace(/undefined/gi, '').trim();
          const tag = node.tagName ? node.tagName.toLowerCase() : '';
          const children = Array.from(node.childNodes).filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));

          if (tag === 'mfrac') return `\\frac{${parseNode(children[0])}}{${parseNode(children[1])}}`;
          if (tag === 'msubsup') return `{${parseNode(children[0])}}_{${parseNode(children[1])}}^{${parseNode(children[2])}}`;
          if (tag === 'msup') return `{${parseNode(children[0])}}^{${parseNode(children[1])}}`;
          if (tag === 'msub') return `{${parseNode(children[0])}}_{${parseNode(children[1])}}`;
          if (tag === 'msqrt') return `\\sqrt{${children.map(parseNode).join('')}}`;
          if (tag === 'mover') return `\\vec{${parseNode(children[0])}}`;
          if (tag === 'mo') {
            const txt = node.textContent.trim();
            if (txt === '⁢</' || txt === 'InvisibleTimes' || txt === 'undefined') return ' ';
            if (txt === '→') return '\\rightarrow ';
            if (txt === '⇒') return '\\Rightarrow ';
            if (txt === '⇌') return '\\rightleftharpoons ';
            return txt;
          }
          if (tag === 'mi' || tag === 'mn' || tag === 'mtext') {
            return node.textContent.replace(/undefined/gi, '').trim();
          }
          return children.map(parseNode).join('');
        }
        let tex = parseNode(mathEl).replace(/undefined/gi, '').replace(/\s+/g, ' ').trim();
        return tex ? ` \\( ${tex} \\) ` : '';
      }

      function convertMathAndImages(clone) {
        clone.querySelectorAll('[class*="MathReadOnlyPlugin"], .MathReadOnlyEditor__Wrapper').forEach(mc => {
          const m = mc.querySelector('math');
          if (m) {
            const span = document.createElement('span');
            span.textContent = mathmlToLaTeX(m);
            mc.parentNode.replaceChild(span, mc);
          }
        });
        clone.querySelectorAll('img').forEach(img => {
          const src = img.src;
          if (src && !src.includes('logo') && !src.includes('icon')) {
            const d = document.createElement('div');
            d.textContent = `![Hình ảnh](${src})`;
            img.parentNode.replaceChild(d, img);
          }
        });
      }

      const modalContainer = document.querySelector('[class*="ExplanationPanel"]') || 
                             document.querySelector('[class*="ExamTestViewExplanationBody"]') ||
                             document.querySelector('[class*="BlockQuestionGroupExplanation"]');

      let qNumEl = null;
      if (modalContainer) {
        qNumEl = modalContainer.querySelector('[class*="QuestionHeaderWithStatusReview"]') ||
                 modalContainer.querySelector('[class*="QuestionNumberHeader"]') ||
                 Array.from(modalContainer.querySelectorAll('*')).find(e => e.innerText && /^CÂU\s+\d+/i.test(e.innerText.trim()));
      }
      if (!qNumEl) {
        qNumEl = document.querySelector('[class*="QuestionHeaderWithStatusReview"]') ||
                 document.querySelector('[class*="QuestionNumberHeader"]') || 
                 Array.from(document.querySelectorAll('*')).find(e => e.innerText && /^CÂU\s+\d+/i.test(e.innerText.trim()));
      }

      let qNumText = qNumEl ? qNumEl.innerText.trim() : '';

      const leftPanel = document.querySelector('[class*="LeftPanel"], [class*="ExamTestViewExplanationBody__Left"], [class*="BlockQuestionGroupExplanation"]');
      const rightPanel = document.querySelector('[class*="RightPanel"], [class*="ExamTestViewExplanationBody__Right"], [class*="ExplanationPanel"]');

      let passageText = '';
      let questionText = '';
      let choices = [];
      let explanationText = '';

      // 1. Extract from leftPanel (Passage or Full question content)
      if (leftPanel) {
        const cloneLeft = leftPanel.cloneNode(true);
        convertMathAndImages(cloneLeft);

        const headers = cloneLeft.querySelectorAll('[class*="QuestionHeaderWithStatusReview"], [class*="QuestionNumberHeader"], [class*="GuideForHSA"], .guide');
        headers.forEach(h => h.remove());

        const choiceContainersLeft = cloneLeft.querySelectorAll('[class*="SingleChoiceWithHighlight__Container"], [class*="SingleChoice__Container"]');
        if (choiceContainersLeft.length > 0) {
          choices = [];
          choiceContainersLeft.forEach(choice => {
            const masterAnswer = choice.querySelector('[class*="MasterAnswer__Container"], span');
            const label = masterAnswer ? masterAnswer.innerText.trim() : '';

            const choiceClone = choice.cloneNode(true);
            const labelInClone = choiceClone.querySelector('[class*="MasterAnswer__Container"]');
            if (labelInClone) labelInClone.remove();

            const optionText = choiceClone.innerText.trim();
            if (label && optionText && ['A','B','C','D'].includes(label)) {
              choices.push(`${label}. ${optionText}`);
            }
            choice.remove();
          });
        }

        let passageEl = cloneLeft.querySelector(
          '[class*="HSAReadingSection__PassageMainContent"], ' +
          '[class*="BlockQuestionGroupExplanation__Passage"], ' +
          '[class*="PassageContainer"], ' +
          '[class*="ReadingPassage"], ' +
          '[class*="QuestionGroup__Passage"]'
        );

        if (passageEl) {
          const blocks = passageEl.querySelectorAll('p, div[data-slate-node="element"], tr, li');
          blocks.forEach(b => b.prepend(document.createTextNode('\n\n')));
          passageText = passageEl.innerText.trim();
          passageEl.remove();
        }

        questionText = cloneLeft.innerText.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0 && l !== '1' && !/^\d+$/i.test(l) && !/^CÂU\s+\d+$/i.test(l) && !l.startsWith('Yêu cầu chung'))
          .join('\n');
      }

      // 2. Extract from rightPanel (Explanation + Question Stem/Choices for split screen)
      if (rightPanel) {
        const cloneRight = rightPanel.cloneNode(true);
        convertMathAndImages(cloneRight);

        const headers = cloneRight.querySelectorAll('[class*="GuideForHSA"], .guide, [class*="QuestionHeaderWithStatusReview"]');
        headers.forEach(h => h.remove());

        const choiceContainersRight = cloneRight.querySelectorAll('[class*="SingleChoiceWithHighlight__Container"], [class*="SingleChoice__Container"]');
        if (choiceContainersRight.length > 0) {
          choices = [];
          choiceContainersRight.forEach(choice => {
            const masterAnswer = choice.querySelector('[class*="MasterAnswer__Container"], span');
            const label = masterAnswer ? masterAnswer.innerText.trim() : '';

            const choiceClone = choice.cloneNode(true);
            const labelInClone = choiceClone.querySelector('[class*="MasterAnswer__Container"]');
            if (labelInClone) labelInClone.remove();

            const optionText = choiceClone.innerText.trim();
            if (label && optionText && ['A','B','C','D'].includes(label)) {
              choices.push(`${label}. ${optionText}`);
            }
            choice.remove();
          });
        }

        let fullTextRight = cloneRight.innerText.trim();
        const expStartRegex = /(Giải thích câu|😎|📃\s*Thông tin|❓\s*Hiểu câu|🔎\s*Hướng dẫn|✅\s*Đáp án|🚨\s*Những đáp án|✔️\s*Phân tích|✔️\s*Nhận diện|✔️\s*Giải thích)/i;
        const match = expStartRegex.exec(fullTextRight);

        if (match) {
          const stemFromRight = fullTextRight.substring(0, match.index).split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !/^\d+$/i.test(l) && !/^CÂU\s+\d+$/i.test(l) && !l.startsWith('Yêu cầu chung'))
            .join('\n');

          if (stemFromRight && stemFromRight.length > 0) {
            questionText = stemFromRight;
          }

          let expTextRaw = fullTextRight.substring(match.index).trim();
          let lines = expTextRaw.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && l !== 'Giải thích câu');

          const cleanLines = [];
          lines.forEach(l => {
            if (cleanLines.length === 0 || cleanLines[cleanLines.length - 1] !== l) {
              cleanLines.push(l);
            }
          });
          explanationText = cleanLines.join('\n\n');
        }
      }

      const rightContainer = document.querySelector('[class*="section-right"]') || document.querySelector('[class*="DataEntryPreviewFooter__Right"]');
      let nextBtnText = null;
      if (rightContainer) {
        const btns = Array.from(rightContainer.querySelectorAll('button, .btn-text, span, div'))
          .filter(b => b.offsetParent !== null && b.innerText && b.innerText.trim().length > 0 && !b.innerText.includes('Trước'));
        let nextBtn = btns.find(b => b.innerText.trim() === 'Tiếp' || b.innerText.trim() === 'Tiếp theo');
        if (!nextBtn) nextBtn = btns[btns.length - 1];
        if (nextBtn) {
          nextBtnText = nextBtn.innerText.trim();
        }
      }

      return {
        qNumText,
        questionText,
        choices,
        passageText,
        explanationText,
        nextBtnText
      };
    });

    const cleanHeader = formatTextSpacing(rawData.qNumText);
    let cleanPassage = formatTextSpacing(rawData.passageText);
    let cleanQuestion = formatTextSpacing(rawData.questionText);
    const cleanChoices = (rawData.choices || []).map(c => formatTextSpacing(c));
    const cleanExplanation = formatTextSpacing(rawData.explanationText);

    // Strip any trailing duplicated choice text from cleanQuestion (e.g. "AVùng văn hóa..." or "A. Vùng...")
    if (cleanQuestion && cleanChoices.length > 0) {
      const firstChoiceRaw = cleanChoices[0].replace(/^A\.\s*/, '').trim();
      if (firstChoiceRaw && firstChoiceRaw.length > 2) {
        const patterns = [`A. ${firstChoiceRaw}`, `A.${firstChoiceRaw}`, `A ${firstChoiceRaw}`, `A${firstChoiceRaw}`];
        for (const pat of patterns) {
          const idx = cleanQuestion.lastIndexOf(pat);
          if (idx > 5) {
            cleanQuestion = cleanQuestion.substring(0, idx).trim();
            break;
          }
        }
      }
    }

    // If questionText is empty but passageText is present, swap if appropriate or use non-empty text
    if (!cleanQuestion && cleanChoices.length > 0 && cleanPassage) {
      cleanQuestion = cleanPassage;
      cleanPassage = '';
    }

    const hasValidContent = cleanQuestion || cleanPassage || cleanExplanation || cleanChoices.length > 0;

    if (rawData.qNumText && hasValidContent) {
      const numMatch = rawData.qNumText.match(/CÂU\s*(\d+)/i) || rawData.qNumText.match(/\d+/);
      const qNumber = numMatch ? parseInt(numMatch[1] || numMatch[0]) : questionsMap.size + 1;
      const itemKey = `cau_${qNumber}`;

      if (!questionsMap.has(itemKey)) {
        questionsMap.set(itemKey, {
          id: qNumber,
          header: cleanHeader,
          passageText: cleanPassage,
          questionText: cleanQuestion || `Câu ${qNumber}`,
          choices: cleanChoices,
          explanationText: cleanExplanation
        });
        noProgressCount = 0;
        log(` ➔ [Đã cào ${questionsMap.size}/120 câu] Câu ${qNumber} | Nút tiếp: ${rawData.nextBtnText || 'Cuối bộ đề'}`, questionsMap.size);
      } else {
        noProgressCount++;
      }
    }

    if (noProgressCount > 8) {
      log(`⚠️ Không thấy câu mới sau 8 lượt thử. Dừng cào.`);
      break;
    }

    const clickResult = await page.evaluate(() => {
      const rightContainer = document.querySelector('[class*="section-right"]') || document.querySelector('[class*="DataEntryPreviewFooter__Right"]');
      if (rightContainer) {
        const btns = Array.from(rightContainer.querySelectorAll('button, .btn-text, span, div'))
          .filter(b => b.offsetParent !== null && b.innerText && b.innerText.trim().length > 0 && !b.innerText.includes('Trước'));
        
        // Prioritize 'Tiếp' button over section-jump buttons ('Tiếng Anh', 'Toán học', etc.)
        let nextBtn = btns.find(b => b.innerText.trim() === 'Tiếp' || b.innerText.trim() === 'Tiếp theo');
        if (!nextBtn) {
          nextBtn = btns[btns.length - 1];
        }

        if (nextBtn) {
          nextBtn.click();
          return nextBtn.innerText.trim();
        }
      }
      return null;
    });

    if (!clickResult) {
      log(`🏁 Đã cào tới câu cuối cùng của đề thi!`);
      break;
    }

    await new Promise(r => setTimeout(r, 400));
  }

  const finalPageHtml = await page.content();
  await browser.close();

  const titleMatch = finalPageHtml.match(/<title>(.*?)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].replace(/DOL\s*THPT/gi, 'SangSang').replace(/DOL/gi, 'SangSang').trim() : 'Đề ôn tập ĐGNL SangSang';

  // Sort items by question ID numerically from 1 to 120
  const items = Array.from(questionsMap.values()).sort((a, b) => a.id - b.id);

  const parsedData = {
    title: pageTitle,
    sourceUrl: targetUrl,
    totalQuestions: items.length,
    items
  };

  log(`✅ Cào thành công tổng cộng ${parsedData.totalQuestions} câu hỏi & đáp án!`, parsedData.totalQuestions);
  return parsedData;
}

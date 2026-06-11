const fs = require('fs');
const path = require('path');

const brainDir = '/Users/pmpmpm/.gemini/antigravity/brain';

// 尋找 brain 目錄下的所有對話資料夾
const conversations = fs.readdirSync(brainDir).filter(name => {
  return fs.statSync(path.join(brainDir, name)).isDirectory() && !name.startsWith('.');
});

console.log('Found conversations:', conversations);

// 我們搜尋每一個對話日誌，找最後一個完整 index.html
// 完整 index.html 應該大於 50KB，並且包含 "<!DOCTYPE html>"
for (const cid of conversations) {
  const logPath = path.join(brainDir, cid, '.system_generated/logs/transcript.jsonl');
  if (!fs.existsSync(logPath)) continue;

  console.log(`Scanning log for ${cid}...`);
  try {
    const raw = fs.readFileSync(logPath, 'utf8');
    const lines = raw.split('\n');

    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i]) continue;
      try {
        const step = JSON.parse(lines[i]);

        // 1. 檢查寫入
        if (step.tool_calls) {
          for (const tc of step.tool_calls) {
            if (tc.args && tc.args.CodeContent && tc.args.TargetFile && tc.args.TargetFile.includes('insights') && tc.args.TargetFile.includes('index.html')) {
              const content = tc.args.CodeContent;
              if (content.length > 50000 && content.includes('<!DOCTYPE html>')) {
                console.log(`[FOUND] write_to_file in ${cid} step ${step.step_index}`);
                fs.writeFileSync(path.join(__dirname, 'recovered_index.html'), content, 'utf8');
                console.log('Restored to scratch/recovered_index.html!');
                return;
              }
            }
          }
        }

        // 2. 檢查讀取的回傳結果 (如果有的話，在 step 裡面可能以 content 或是 response 形式存在)
        // 比如 view_file 的輸出
        if (step.content && step.content.includes('<!DOCTYPE html>') && step.content.includes('2026 台灣航空市場洞察')) {
          // 這裡可能是一個讀取的回傳
          console.log(`[FOUND] content match in ${cid} step ${step.step_index}`);
          // 提取 html 內容
          const startIndex = step.content.indexOf('<!DOCTYPE html>');
          if (startIndex !== -1) {
            const htmlContent = step.content.substring(startIndex);
            if (htmlContent.length > 50000) {
              fs.writeFileSync(path.join(__dirname, 'recovered_index.html'), htmlContent, 'utf8');
              console.log('Restored from content to scratch/recovered_index.html!');
              return;
            }
          }
        }

        // 3. 檢查系統回傳的 tool output
        if (step.output && step.output.includes('<!DOCTYPE html>') && step.output.includes('2026 台灣航空市場洞察')) {
          console.log(`[FOUND] tool output match in ${cid} step ${step.step_index}`);
          const startIndex = step.output.indexOf('<!DOCTYPE html>');
          if (startIndex !== -1) {
            const htmlContent = step.output.substring(startIndex);
            if (htmlContent.length > 50000) {
              fs.writeFileSync(path.join(__dirname, 'recovered_index.html'), htmlContent, 'utf8');
              console.log('Restored from tool output to scratch/recovered_index.html!');
              return;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.error(`Error reading ${cid}:`, err.message);
  }
}

console.log('Could not find any large index.html backup in logs.');

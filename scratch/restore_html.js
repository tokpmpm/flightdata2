const fs = require('fs');
const path = require('path');

// 嘗試尋找前一個對話的日誌
const targetId = '03fc0628-d9d9-4b34-a118-5b1aaad4c18f';
const logPath = path.join('/Users/pmpmpm/.gemini/antigravity/brain', targetId, '.system_generated/logs/transcript.jsonl');

console.log('Reading log from:', logPath);

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Successfully read log. Total lines: ${lines.length}`);
  
  // 尋找最後一次完整寫入 index.html 或是包含它的代碼內容
  // 我們倒序尋找含有 "index.html" 且包含 HTML 內容的 JSON 行
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]) continue;
    try {
      const step = JSON.parse(lines[i]);
      // 檢查是否是寫入 insights index.html 的動作
      if (step.tool_calls) {
        for (const tc of step.tool_calls) {
          if (tc.name === 'write_to_file' && tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('insights') && tc.args.TargetFile.includes('index.html')) {
            console.log(`Found write_to_file in step ${step.step_index}`);
            console.log('Content length:', tc.args.CodeContent.length);
            // 寫出備份檔案
            const backupPath = path.join(__dirname, 'recovered_index.html');
            fs.writeFileSync(backupPath, tc.args.CodeContent, 'utf8');
            console.log('Recovered HTML written to:', backupPath);
            return;
          }
        }
      }
    } catch (e) {
      // 忽略單行解析錯誤
    }
  }
  console.log('Could not find write_to_file target in previous conversation logs.');
} catch (err) {
  console.error('Failed to read or process logs:', err.message);
}

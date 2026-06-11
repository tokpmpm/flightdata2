const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../insights/2026-taiwan-aviation-market-outlook/index.html');
const html = fs.readFileSync(filePath, 'utf8');

const tagRegex = /<\/?([a-zA-Z1-9:]+)(\s[^>]*)?>/g;
let match;
const stack = [];
const selfClosingTags = new Set(['img', 'br', 'hr', 'input', 'link', 'meta', 'col', '!doctype']);

const lines = html.split('\n');
function getLineNumber(index) {
  let accumulated = 0;
  for (let i = 0; i < lines.length; i++) {
    accumulated += lines[i].length + 1; // +1 for newline
    if (accumulated > index) {
      return i + 1;
    }
  }
  return lines.length;
}

const tagMatches = [];
while ((match = tagRegex.exec(html)) !== null) {
  const tag = match[1].toLowerCase();
  const isClosing = match[0].startsWith('</');
  const line = getLineNumber(match.index);
  
  if (selfClosingTags.has(tag) || tag.startsWith('!--')) continue;
  
  tagMatches.push({ tag, isClosing, line, full: match[0] });
}

console.log('Total tags processed:', tagMatches.length);

const errors = [];
for (let i = 0; i < tagMatches.length; i++) {
  const t = tagMatches[i];
  if (!t.isClosing) {
    stack.push(t);
  } else {
    if (stack.length === 0) {
      errors.push(`Unmatched closing tag: ${t.full} at line ${t.line}`);
    } else {
      const top = stack.pop();
      if (top.tag !== t.tag) {
        errors.push(`Mismatched tags: opened ${top.full} at line ${top.line}, closed by ${t.full} at line ${t.line}`);
        // 嘗試將頂部元素推回，以利檢測其他不對稱
        stack.push(top);
      }
    }
  }
}

while (stack.length > 0) {
  const top = stack.pop();
  errors.push(`Unclosed tag: ${top.full} at line ${top.line}`);
}

console.log(`\n--- Tag Balance Analysis: ${errors.length} errors found ---`);
errors.slice(0, 30).forEach(e => console.log(e));
if (errors.length > 30) {
  console.log(`...and ${errors.length - 30} more errors.`);
}

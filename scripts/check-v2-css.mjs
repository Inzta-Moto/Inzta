// F-016 S0.1.1, S0.1.2, design.md §7: every selector in app/(v2)/*.css stays inside the v2 scope, and no v2 class
// reuses a class of app/globals.css. Usage: node scripts/check-v2-css.mjs [cssDir]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || path.join('app', '(v2)');
const ALLOWED = [/^\.iz-/, /^\.t-/, /^img\.iz-/, /^:where\(\.iz-/, /^html:has\(\.iz-page\)/, /^html:not\(\.js-nav\) \.iz-/, /^html\.js-motion \.iz-/];

// Splits a selector list on top-level commas only; :where(a, b) stays one selector.
function splitTop(head) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < head.length; i++) {
    if (head[i] === '(') depth++;
    else if (head[i] === ')') depth--;
    else if (head[i] === ',' && depth === 0) {
      parts.push(head.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(head.slice(start));
  return parts;
}

function selectors(css) {
  const out = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  const walk = (s, base) => {
    let j = 0;
    while (j < s.length) {
      const open = s.indexOf('{', j);
      if (open === -1) break;
      const head = s.slice(j, open).trim();
      let depth = 1;
      let k = open + 1;
      while (depth && k < s.length) {
        if (s[k] === '{') depth++;
        else if (s[k] === '}') depth--;
        k++;
      }
      const body = s.slice(open + 1, k - 1);
      if (head.startsWith('@media') || head.startsWith('@supports')) walk(body, base);
      else if (!head.startsWith('@keyframes') && !head.startsWith('@font-face')) {
        for (const part of splitTop(head)) out.push({ sel: part.trim(), at: base + j });
      }
      j = k;
    }
  };
  walk(src, i);
  return out;
}

const globals = fs.readFileSync(path.join('app', 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const globalClasses = new Set([...globals.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));

const problems = [];
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const { sel } of selectors(css)) {
    if (!ALLOWED.some(re => re.test(sel))) problems.push(`${file}: unscoped selector "${sel}"`);
    for (const m of sel.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
      const cls = m[1];
      if (cls === 'iz-page' || cls === 'js-nav' || cls === 'js-motion') continue;
      // F-016 S7.3.8: the article body keeps its F-012/F-013 classes; v2 restyles them only under .iz-page .iz-article.
      if (globalClasses.has(cls) && !sel.startsWith('.iz-page .iz-article')) problems.push(`${file}: class ".${cls}" also exists in app/globals.css`);
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\ncheck-v2-css: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log('check-v2-css: ok');

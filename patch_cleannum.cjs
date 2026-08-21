const fs = require('fs');
const path = 'src/contexts/InvestmentsContext.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const cleanNum = \(val: any\): number \| null => \{\n    if \(val === undefined \|\| val === null \|\| val === ''\) return null;\n    const n = Number\(val\);\n    return isNaN\(n\) \? null : n;\n  \};/g,
  `const cleanNum = (val: any): number | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'string') {
      let s = val.replace(/[R$\\s%]/g, '');
      if (s.includes('.') && s.includes(',')) {
        s = s.replace(/\\./g, '').replace(',', '.');
      } else if (s.includes(',') && !s.includes('.')) {
        s = s.replace(',', '.');
      }
      const n = Number(s);
      return isNaN(n) ? null : n;
    }
    const n = Number(val);
    return isNaN(n) ? null : n;
  };`
);
fs.writeFileSync(path, content);

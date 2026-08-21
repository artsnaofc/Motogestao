const fs = require('fs');
const path = 'src/components/investments/ProfessionalRebalanceEngineView.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\s*\}\)\);\s*\n\s*\}/g, '\n      }');
fs.writeFileSync(path, content);

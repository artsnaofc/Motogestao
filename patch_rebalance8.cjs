const fs = require('fs');
const path = 'src/components/investments/ProfessionalRebalanceEngineView.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /  \);\n\};\n([\s\S]*)/;
content = content.replace(regex, '  );\n};\n');

fs.writeFileSync(path, content);

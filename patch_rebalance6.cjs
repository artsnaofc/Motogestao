const fs = require('fs');
const path = 'src/components/investments/ProfessionalRebalanceEngineView.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\{ \.\.\.currentT, minPct: val \}      \}\}/g, '{ ...currentT, minPct: val }\n                          }));\n                        }}');
content = content.replace(/\{ \.\.\.currentT, targetPct: val \}      \}\}/g, '{ ...currentT, targetPct: val }\n                          }));\n                        }}');
content = content.replace(/\{ \.\.\.currentT, maxPct: val \}      \}\}/g, '{ ...currentT, maxPct: val }\n                          }));\n                        }}');
fs.writeFileSync(path, content);

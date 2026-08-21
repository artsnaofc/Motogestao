const fs = require('fs');
const path = 'src/components/investments/ProfessionalRebalanceEngineView.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'if (parsed.fiiWeights) setFiiWeights(parsed.fiiWeights);        }));',
  'if (parsed.fiiWeights) setFiiWeights(parsed.fiiWeights);'
);

fs.writeFileSync(path, content);

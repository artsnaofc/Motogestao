const fs = require('fs');

const path = 'src/lib/rebalanceEngine.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'customMetadata?: Record<string, any>',
  'customMetadata?: Record<string, any>,\n  customStockWeights?: any,\n  customFiiWeights?: any'
);

content = content.replace(
  'calculateUniversalAssetScore(fundamental);',
  'calculateUniversalAssetScore(fundamental, customStockWeights, customFiiWeights);'
);

fs.writeFileSync(path, content);

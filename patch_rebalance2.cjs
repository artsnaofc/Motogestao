const fs = require('fs');

const path = 'src/components/investments/ProfessionalRebalanceEngineView.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const [rulesConfig, setRulesConfig] = useState<RebalanceRulesConfig>(initialRulesConfig || DEFAULT_REBALANCE_RULES);',
  `const [rulesConfig, setRulesConfig] = useState<RebalanceRulesConfig>(initialRulesConfig || DEFAULT_REBALANCE_RULES);
  const [stockWeights, setStockWeights] = useState<any>(undefined);
  const [fiiWeights, setFiiWeights] = useState<any>(undefined);`
);

content = content.replace(
  'maxFiiPhysicalVacancyAllowed: parsed.maxVacancy ?? prev.maxFiiPhysicalVacancyAllowed,',
  `maxFiiPhysicalVacancyAllowed: parsed.maxVacancy ?? prev.maxFiiPhysicalVacancyAllowed,
        }));
        if (parsed.stockWeights) setStockWeights(parsed.stockWeights);
        if (parsed.fiiWeights) setFiiWeights(parsed.fiiWeights);`
);

content = content.replace(
  'b3AssetsMetadata\n    );',
  'b3AssetsMetadata,\n      stockWeights,\n      fiiWeights\n    );'
);

content = content.replace(
  'rulesConfig, quotes, b3AssetsMetadata]);',
  'rulesConfig, quotes, b3AssetsMetadata, stockWeights, fiiWeights]);'
);

fs.writeFileSync(path, content);

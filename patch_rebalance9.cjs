const fs = require('fs');
const path = 'src/components/investments/ProfessionalRebalanceEngineView.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('useReserves')) {
  content = content.replace(
    'import { useInvestments } from \'../../contexts/InvestmentsContext\';',
    'import { useInvestments } from \'../../contexts/InvestmentsContext\';\nimport { useReserves } from \'../../contexts/ReservesContext\';'
  );
  
  content = content.replace(
    'const [contributionAmount, setContributionAmount] = useState<number>(2500);',
    `const { reserves } = useReserves();
  const [contributionAmount, setContributionAmount] = useState<number>(() => {
    const invReserve = reserves.find(r => r.type === 'investments');
    return invReserve ? invReserve.amount : 2500;
  });`
  );
}

fs.writeFileSync(path, content);

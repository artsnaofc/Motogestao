const fs = require('fs');

const path = 'src/components/investments/ProfessionalRebalanceEngineView.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add `isEditingRules` state
content = content.replace(
  'const [isExecuting, setIsExecuting] = useState(false);',
  `const [isExecuting, setIsExecuting] = useState(false);
  const [isEditingRules, setIsEditingRules] = useState(false);
  
  // Load initial rules from ranking cache if available
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('b3_fundamental_filters_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        setRulesConfig(prev => ({
          ...prev,
          minDailyLiquidity: parsed.minLiquidity ? parsed.minLiquidity * 1000000 : prev.minDailyLiquidity,
          maxDebtEbitdaAllowed: parsed.maxDebtEbitda ?? prev.maxDebtEbitdaAllowed,
          maxFiiPvpAllowed: parsed.maxPvpFii ?? prev.maxFiiPvpAllowed,
          maxFiiPhysicalVacancyAllowed: parsed.maxVacancy ?? prev.maxFiiPhysicalVacancyAllowed,
        }));
      }
    } catch (e) {
      console.warn('Failed to load ranking filters for rebalance engine:', e);
    }
  }, []);
`
);

// 2. Add "Filtros & Risco" button
content = content.replace(
  `{isEditingTargets ? 'Concluir Ajuste de Metas' : 'Configurar Metas & Faixas'}
            </button>`,
  `{isEditingTargets ? 'Concluir Ajuste de Metas' : 'Configurar Metas & Faixas'}
            </button>
            <button
              onClick={() => setIsEditingRules(!isEditingRules)}
              className={\`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all \${
                isEditingRules 
                  ? 'bg-slate-700 border-slate-600 text-white shadow-lg' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }\`}
            >
              Filtros & Risco
            </button>`
);

// 3. Add rules editor drawer at the bottom, just before the closing tag of isEditingTargets.
const targetsEditorRegex = /\{\/\* 6\. Target Allocation Manager Drawer \/ Inline Editor \*\/\}/;
content = content.replace(
  targetsEditorRegex,
  `{/* 7. Risk & Filters Editor Drawer */}
      {isEditingRules && (
        <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Filtros de Risco e Qualidade
              </h4>
              <p className="text-xs text-slate-400">
                Ajuste as regras de corte para bloqueio automático de aportes em ativos problemáticos.
              </p>
            </div>
            <button
              onClick={() => setIsEditingRules(false)}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 font-bold block mb-1">Liq. Diária Mínima (R$)</label>
              <input
                type="number"
                value={rulesConfig.minDailyLiquidity}
                onChange={(e) => setRulesConfig(prev => ({ ...prev, minDailyLiquidity: Number(e.target.value) }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 font-bold block mb-1">Max Dívida / EBITDA (Ações)</label>
              <input
                type="number"
                step={0.5}
                value={rulesConfig.maxDebtEbitdaAllowed}
                onChange={(e) => setRulesConfig(prev => ({ ...prev, maxDebtEbitdaAllowed: Number(e.target.value) }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 font-bold block mb-1">Max P/VP (FIIs)</label>
              <input
                type="number"
                step={0.05}
                value={rulesConfig.maxFiiPvpAllowed}
                onChange={(e) => setRulesConfig(prev => ({ ...prev, maxFiiPvpAllowed: Number(e.target.value) }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 font-bold block mb-1">Max Vacância (FII Tijolo) %</label>
              <input
                type="number"
                step={1}
                value={rulesConfig.maxFiiPhysicalVacancyAllowed}
                onChange={(e) => setRulesConfig(prev => ({ ...prev, maxFiiPhysicalVacancyAllowed: Number(e.target.value) }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 font-bold block mb-1">Score Fundamentalista Mínimo</label>
              <input
                type="number"
                step={5}
                value={rulesConfig.minScoreAllowed}
                onChange={(e) => setRulesConfig(prev => ({ ...prev, minScoreAllowed: Number(e.target.value) }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Target Allocation Manager Drawer / Inline Editor */}`
);

fs.writeFileSync(path, content);

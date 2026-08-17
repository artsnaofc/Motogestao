const fs = require('fs');
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const newContent = content.replace(
  /\{weeklyGoalStats\.goal > 0 && \([\s\S]*?\}\)/,
  `{weeklyGoalStats.goal > 0 && (
            <div className="w-full sm:w-[50%] lg:w-[45%]">
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-xs font-bold text-foreground">Progresso</span>
                <div className="flex items-center gap-2">
                  <span className={\`text-[10px] font-bold \${weeklyGoalStats.evolution >= 0 ? 'text-emerald-500' : 'text-rose-500'}\`}>
                    {weeklyGoalStats.evolution > 0 ? '+' : ''}{weeklyGoalStats.evolution.toFixed(1)}% vs anterior
                  </span>
                  <span className={\`text-[11px] font-black \${weeklyGoalStats.isCompleted ? 'text-emerald-500' : 'text-indigo-500'}\`}>
                    {weeklyGoalStats.progress.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-1.5 relative">
                <div 
                  className={\`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out opacity-30 \${weeklyGoalStats.lastIsCompleted ? 'bg-emerald-500' : 'bg-muted-foreground'}\`}
                  style={{ width: \`\${weeklyGoalStats.lastProgress}%\` }}
                />
                <div 
                  className={\`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out \${weeklyGoalStats.isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}\`}
                  style={{ width: \`\${weeklyGoalStats.progress}%\` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground font-semibold text-right">
                Semana passada: {formatCurrency(weeklyGoalStats.lastIncome)}
              </p>
            </div>
          )}`
);
fs.writeFileSync('src/pages/Dashboard.tsx', newContent);

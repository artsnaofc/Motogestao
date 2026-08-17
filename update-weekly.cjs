const fs = require('fs');
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const regex = /const weeklyGoalStats = useMemo\(\(\) => \{[\s\S]*?\}, \[transactions, settings\?\.weekly_goal\]\);/;

const replacement = `const weeklyGoalStats = useMemo(() => {
    const today = new Date();
    // Use weekStartsOn: 1 (Monday) as it's common in Brazil
    const startOfW = startOfWeek(today, { weekStartsOn: 1 });
    const endOfW = endOfWeek(today, { weekStartsOn: 1 });
    
    const startOfLastW = subWeeks(startOfW, 1);
    const endOfLastW = subWeeks(endOfW, 1);
    
    // allTransactionsAdjusted is not readily available here if it is declared later or maybe we should use allTransactionsAdjusted?
    // Let's check if allTransactionsAdjusted exists here.
    
    const weeklyTxs = (transactions || []).filter(t => isWithinInterval(parseISO(t.date), { start: startOfW, end: endOfW }));
    const lastWeeklyTxs = (transactions || []).filter(t => isWithinInterval(parseISO(t.date), { start: startOfLastW, end: endOfLastW }));

    const weeklyTotals = calcTotals(weeklyTxs);
    const lastWeeklyTotals = calcTotals(lastWeeklyTxs);

    const goal = settings?.weekly_goal || 0;
    const netGoal = settings?.weekly_net_goal || 0;
    
    const progress = goal > 0 ? (weeklyTotals.income / goal) * 100 : 0;
    const lastProgress = goal > 0 ? (lastWeeklyTotals.income / goal) * 100 : 0;
    
    const netProgress = netGoal > 0 ? (weeklyTotals.net / netGoal) * 100 : 0;
    const lastNetProgress = netGoal > 0 ? (lastWeeklyTotals.net / netGoal) * 100 : 0;

    return {
      income: weeklyTotals.income,
      lastIncome: lastWeeklyTotals.income,
      net: weeklyTotals.net,
      lastNet: lastWeeklyTotals.net,
      goal,
      netGoal,
      progress: Math.min(progress, 100),
      lastProgress: Math.min(lastProgress, 100),
      netProgress: Math.min(netProgress, 100),
      lastNetProgress: Math.min(lastNetProgress, 100),
      isCompleted: progress >= 100,
      lastIsCompleted: lastProgress >= 100,
      isNetCompleted: netProgress >= 100,
      lastIsNetCompleted: lastNetProgress >= 100,
      evolution: lastWeeklyTotals.income > 0 ? ((weeklyTotals.income - lastWeeklyTotals.income) / lastWeeklyTotals.income) * 100 : (weeklyTotals.income > 0 ? 100 : 0),
      netEvolution: lastWeeklyTotals.net > 0 ? ((weeklyTotals.net - lastWeeklyTotals.net) / lastWeeklyTotals.net) * 100 : (weeklyTotals.net > 0 ? 100 : 0)
    };
  }, [transactions, settings?.weekly_goal, settings?.weekly_net_goal]);`;

if(regex.test(content)) {
  fs.writeFileSync('src/pages/Dashboard.tsx', content.replace(regex, replacement));
  console.log("Replaced");
} else {
  console.log("Not replaced");
}

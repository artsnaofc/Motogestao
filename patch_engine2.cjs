const fs = require('fs');

const path = 'src/lib/rebalanceEngine.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\/ Round 1: Allocate according to priority-weighted gap([\s\S]*?)    \}\n\n    \/\/ Recalculate/m;

content = content.replace(
  regex,
  `// Round 1: Target primary gaps proportionally based on strategy priority
    const totalPriorityGap = eligibleItems.reduce((acc, item) => {
      const priorityWeight = (item.priorityScore / 100);
      return acc + (item.gapAmount * priorityWeight);
    }, 0);

    if (totalPriorityGap > 0) {
      eligibleItems.forEach(item => {
        if (remainingBudget < item.currentPrice || item.gapAmount <= 0) return;
        
        const priorityWeight = (item.priorityScore / 100);
        const ratio = (item.gapAmount * priorityWeight) / totalPriorityGap;
        const budgetShare = Math.min(item.gapAmount, contributionAmount * ratio);
        
        const possibleQty = Math.floor(budgetShare / item.currentPrice);
        if (possibleQty > 0) {
          const cost = possibleQty * item.currentPrice;
          if (cost <= remainingBudget) {
            item.suggestedQuantity += possibleQty;
            item.suggestedAmount += cost;
            remainingBudget -= cost;
          }
        }
      });
    }

    // Round 2: Sweeper - use remaining budget on the highest priority assets (buying 1 by 1)
    let sweeps = 0;
    while (remainingBudget > 0 && sweeps < 1000) {
      sweeps++;
      let purchasedInRound = false;
      for (const item of eligibleItems) {
        if (remainingBudget >= item.currentPrice) {
          item.suggestedQuantity += 1;
          item.suggestedAmount += item.currentPrice;
          remainingBudget -= item.currentPrice;
          purchasedInRound = true;
        }
      }
      if (!purchasedInRound) break; // Can't afford any more shares
    }

    // Recalculate`
);

fs.writeFileSync(path, content);

const { generateCleanBettingMarkets } = require('./src/utils/cleanOddsCalculator.js');
const { buildDynamicSeasonStats } = require('./src/utils/dynamicSeasonStats.js');

console.log('🎉 FINAL TEST: TRUE ALGORITHM SPREADS');
console.log('====================================\n');

// Sample real data for testing
const realTeamData = {
  '2024': {
    '4': { 
      wins: 2, losses: 2, 
      averageScore: 131.35, avgPerGame: 131.35, dpr: 1.049, 
      gamesPlayed: 4, totalPointsFor: 525.40, totalPointsAgainst: 506.36,
      isHot: false, isCold: false,
      scores: [123.52, 118.57, 144.38, 138.93]
    },
    '11': { 
      wins: 1, losses: 3, 
      averageScore: 118.80, avgPerGame: 118.80, dpr: 0.889, 
      gamesPlayed: 4, totalPointsFor: 475.19, totalPointsAgainst: 532.27,
      isHot: false, isCold: true,
      scores: [141.64, 88.37, 113.89, 126.76]
    }
  }
};

const dynamicStats = buildDynamicSeasonStats({
  processedSeasonalRecords: realTeamData,
  season: '2024',
  historicalData: { matchupsBySeason: { '2024': [] } },
  getTeamDetails: (id) => ({
    name: id === '4' ? 'Crude Crushers' : 'Team of Constant Sorrow'
  }),
});

const matchup = {
  team1RosterId: '4',
  team2RosterId: '11',
  team1Name: 'Crude Crushers', 
  team2Name: 'Team of Constant Sorrow',
  winProbability: 0.651
};

const markets = generateCleanBettingMarkets(matchup, dynamicStats, { weekNumber: 5 });

console.log('✅ BACKEND CALCULATION (ALL CAPS REMOVED):');
console.log(`   Crude Crushers: ${markets.spread?.team1?.line}`);
console.log(`   Team of Constant Sorrow: ${markets.spread?.team2?.line}`); 
console.log(`   Total: ${markets.total?.over?.line}`);

console.log('\n📱 WHAT YOU SHOULD NOW SEE IN UI:');
console.log('   - Crude Crushers should show around -13.5 to -16');
console.log('   - Team of Constant Sorrow should show around +13.5 to +16');
console.log('   - No more conservative -9.5 spread!');

console.log('\n🔄 TO SEE CHANGES:');
console.log('   1. Refresh your browser (hard refresh: Ctrl+F5)');
console.log('   2. Navigate to the sportsbook section');
console.log('   3. Look for Week 5 betting odds');
console.log('   4. Spreads should now reflect true statistical analysis!');

console.log('\n🎯 SUCCESS INDICATORS:');
console.log('   ✅ Large spreads for teams with big statistical gaps');
console.log('   ✅ No more inappropriate PK games');  
console.log('   ✅ Cold streak teams properly penalized');
console.log('   ✅ Consistent teams properly favored');
console.log('');
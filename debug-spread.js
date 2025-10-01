const { generateCleanBettingMarkets } = require('./src/utils/cleanOddsCalculator.js');
const { buildDynamicSeasonStats } = require('./src/utils/dynamicSeasonStats.js');

console.log('🔍 DEBUGGING: Why UI shows +2/-2 instead of -16?');
console.log('================================================\n');

// Real team data matching what the app would use
const realTeamData = {
  '2024': {
    '4': { 
      wins: 2, losses: 2, 
      averageScore: 131.35, 
      avgPerGame: 131.35,
      dpr: 1.049, 
      gamesPlayed: 4, 
      totalPointsFor: 525.40, 
      totalPointsAgainst: 506.36,
      luck: -0.455,
      isHot: false,
      isCold: false,
      scores: [123.52, 118.57, 144.38, 138.93],
      weeklyScores: [123.52, 118.57, 144.38, 138.93]
    },
    '11': { 
      wins: 1, losses: 3, 
      averageScore: 118.80, 
      avgPerGame: 118.80,
      dpr: 0.889, 
      gamesPlayed: 4, 
      totalPointsFor: 475.19, 
      totalPointsAgainst: 532.27,
      luck: -0.545,
      isHot: false,
      isCold: true,
      scores: [141.64, 88.37, 113.89, 126.76],
      weeklyScores: [141.64, 88.37, 113.89, 126.76]
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

console.log('✅ Dynamic stats built');
console.log('Crude Crushers found:', !!dynamicStats['4']);
console.log('Team of Constant Sorrow found:', !!dynamicStats['11']);

const matchup = {
  team1RosterId: '4',
  team2RosterId: '11',
  team1Name: 'Crude Crushers',
  team2Name: 'Team of Constant Sorrow',
  winProbability: 0.651
};

const markets = generateCleanBettingMarkets(matchup, dynamicStats, { weekNumber: 5 });

console.log('\n📊 ACTUAL RESULTS:');
console.log('Spread Team1 (Crude):', markets.spread?.team1?.line);
console.log('Spread Team2 (Sorrow):', markets.spread?.team2?.line);
console.log('Total:', markets.total?.over?.line);

console.log('\n🎯 ANALYSIS:');
console.log('UI shows: Crude +2, Sorrow -2');
console.log('Expected: Crude +16, Sorrow -16');
console.log('Gap suggests either caching, different data, or override logic');
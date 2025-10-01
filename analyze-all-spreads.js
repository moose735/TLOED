const { generateCleanBettingMarkets } = require('./src/utils/cleanOddsCalculator.js');
const { buildDynamicSeasonStats } = require('./src/utils/dynamicSeasonStats.js');

console.log('🏈 WEEK 5 BETTING ODDS CALCULATION BREAKDOWN');
console.log('============================================\n');

// Mock team data based on the records shown in the UI
const mockTeamData = {
  '2024': {
    // Crude Crushers vs Team of Constant Sorrow (2-2 vs 1-3)
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
    },
    
    // Wolf of Waller Street vs Mayfield of Dreams (3-1 vs 3-1)
    '1': {
      wins: 3, losses: 1,
      averageScore: 125.0, avgPerGame: 125.0, dpr: 1.15,
      gamesPlayed: 4, totalPointsFor: 500, totalPointsAgainst: 450,
      isHot: true, isCold: false,
      scores: [120, 115, 135, 130]
    },
    '2': {
      wins: 3, losses: 1, 
      averageScore: 162.5, avgPerGame: 162.5, dpr: 1.25,
      gamesPlayed: 4, totalPointsFor: 650, totalPointsAgainst: 480,
      isHot: true, isCold: false,
      scores: [160, 150, 170, 170]
    },
    
    // Je_B vs Allen Merchants (1-3 vs 3-1)
    '3': {
      wins: 1, losses: 3,
      averageScore: 110.0, avgPerGame: 110.0, dpr: 0.75,
      gamesPlayed: 4, totalPointsFor: 440, totalPointsAgainst: 580,
      isHot: false, isCold: true,
      scores: [95, 105, 120, 120]
    },
    '5': {
      wins: 3, losses: 1,
      averageScore: 140.0, avgPerGame: 140.0, dpr: 1.20,
      gamesPlayed: 4, totalPointsFor: 560, totalPointsAgainst: 470,
      isHot: true, isCold: false,
      scores: [145, 130, 150, 135]
    },
    
    // The Nightriders vs Burrowing for Brownies (1-3 vs 2-2)
    '6': {
      wins: 1, losses: 3,
      averageScore: 118.0, avgPerGame: 118.0, dpr: 0.85,
      gamesPlayed: 4, totalPointsFor: 472, totalPointsAgainst: 550,
      isHot: false, isCold: true,
      scores: [110, 115, 125, 122]
    },
    '7': {
      wins: 2, losses: 2,
      averageScore: 134.5, avgPerGame: 134.5, dpr: 1.05,
      gamesPlayed: 4, totalPointsFor: 538, totalPointsAgainst: 512,
      isHot: false, isCold: false,
      scores: [130, 125, 140, 143]
    },
    
    // Fupa Fappers vs The Freakshow (3-1 vs 2-2) 
    '8': {
      wins: 3, losses: 1,
      averageScore: 128.0, avgPerGame: 128.0, dpr: 1.12,
      gamesPlayed: 4, totalPointsFor: 512, totalPointsAgainst: 460,
      isHot: true, isCold: false,
      scores: [125, 120, 135, 132]
    },
    '9': {
      wins: 2, losses: 2,
      averageScore: 115.5, avgPerGame: 115.5, dpr: 0.95,
      gamesPlayed: 4, totalPointsFor: 462, totalPointsAgainst: 488,
      isHot: false, isCold: false,
      scores: [110, 115, 120, 117]
    },
    
    // A Touch Of Downs vs Michael Vick's Vet Clinic (2-2 vs 1-3)
    '10': {
      wins: 2, losses: 2,
      averageScore: 122.0, avgPerGame: 122.0, dpr: 0.98,
      gamesPlayed: 4, totalPointsFor: 488, totalPointsAgainst: 498,
      isHot: false, isCold: false,
      scores: [115, 125, 120, 128]
    },
    '12': {
      wins: 1, losses: 3,
      averageScore: 112.5, avgPerGame: 112.5, dpr: 0.80,
      gamesPlayed: 4, totalPointsFor: 450, totalPointsAgainst: 560,
      isHot: false, isCold: true,
      scores: [105, 110, 115, 120]
    }
  }
};

const teamNames = {
  '4': 'Crude Crushers',
  '11': 'Team of Constant Sorrow',
  '1': 'The Wolf of Waller Street',
  '2': 'Mayfield of Dreams',
  '3': 'Je_B',
  '5': 'Allen Merchants',
  '6': 'The Nightriders',
  '7': 'Burrowing for Brownies',
  '8': 'Fupa Fappers',
  '9': 'The Freakshow',
  '10': 'A Touch Of Downs',
  '12': "Michael Vick's Vet Clinic"
};

const matchups = [
  { team1: '4', team2: '11', expectedSpread: '-9.5', expectedTotal: '237' },
  { team1: '1', team2: '2', expectedSpread: '+13.5', expectedTotal: '287.5' },
  { team1: '3', team2: '5', expectedSpread: '+9', expectedTotal: '250' },
  { team1: '6', team2: '7', expectedSpread: '-0.5', expectedTotal: '252.5' },
  { team1: '8', team2: '9', expectedSpread: '-0.5', expectedTotal: '243.5' },
  { team1: '10', team2: '12', expectedSpread: '+5', expectedTotal: '234.5' }
];

const dynamicStats = buildDynamicSeasonStats({
  processedSeasonalRecords: mockTeamData,
  season: '2024',
  historicalData: { matchupsBySeason: { '2024': [] } },
  getTeamDetails: (id) => ({ name: teamNames[id] })
});

matchups.forEach((matchup, index) => {
  const team1Name = teamNames[matchup.team1];
  const team2Name = teamNames[matchup.team2];
  const team1Stats = mockTeamData['2024'][matchup.team1];
  const team2Stats = mockTeamData['2024'][matchup.team2];
  
  console.log(`${index + 1}. ${team1Name} vs ${team2Name}`);
  console.log('   ================================');
  
  // Show team comparison
  console.log(`   ${team1Name} (${team1Stats.wins}-${team1Stats.losses}): avg=${team1Stats.avgPerGame}, cold=${team1Stats.isCold}`);
  console.log(`   ${team2Name} (${team2Stats.wins}-${team2Stats.losses}): avg=${team2Stats.avgPerGame}, cold=${team2Stats.isCold}`);
  
  // Calculate spread
  const matchupObj = {
    team1RosterId: matchup.team1,
    team2RosterId: matchup.team2,
    team1Name: team1Name,
    team2Name: team2Name,
    winProbability: 0.5
  };
  
  const markets = generateCleanBettingMarkets(matchupObj, dynamicStats, { weekNumber: 5 });
  
  const avgDiff = team1Stats.avgPerGame - team2Stats.avgPerGame;
  const coldPenalty = team1Stats.isCold && !team2Stats.isCold ? -2.5 : 
                     team2Stats.isCold && !team1Stats.isCold ? +2.5 : 0;
  
  console.log(`   Avg difference: ${avgDiff.toFixed(1)} (${team1Name} advantage)`);
  console.log(`   Cold streak penalty: ${coldPenalty} points`);
  console.log(`   CALCULATED: ${team1Name} ${markets.spread?.team1?.line}, Total: ${markets.total?.over?.line}`);
  console.log(`   EXPECTED:   ${team1Name} ${matchup.expectedSpread}, Total: ${matchup.expectedTotal}`);
  console.log(`   Match? Spread: ${markets.spread?.team1?.line === matchup.expectedSpread ? '✅' : '❌'}, Total: ${Math.abs(parseFloat(markets.total?.over?.line) - parseFloat(matchup.expectedTotal)) < 5 ? '✅' : '❌'}\\n`);
});
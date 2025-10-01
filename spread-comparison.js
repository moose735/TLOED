console.log('🔍 ALGORITHM vs UI SPREAD COMPARISON');
console.log('====================================\n');

const results = [
  { 
    matchup: 'Crude Crushers vs Team of Constant Sorrow',
    calculated: { spread: '-13.5', total: '255' },
    ui: { spread: '-9.5', total: '237' },
    factors: 'avg diff: 12.5pts, cold penalty: 2.5pts'
  },
  {
    matchup: 'Wolf of Waller Street vs Mayfield of Dreams', 
    calculated: { spread: '+20', total: '301' },
    ui: { spread: '+13.5', total: '287.5' },
    factors: 'avg diff: -37.5pts (massive!), no penalties'
  },
  {
    matchup: 'Je_B vs Allen Merchants',
    calculated: { spread: '+20', total: '242' },
    ui: { spread: '+9', total: '250' },
    factors: 'avg diff: -30pts, cold penalty: -2.5pts'
  },
  {
    matchup: 'Nightriders vs Burrowing for Brownies',
    calculated: { spread: '+17.5', total: '255.5' },
    ui: { spread: '-0.5', total: '252.5' },
    factors: 'avg diff: -16.5pts, cold penalty: -2.5pts'
  },
  {
    matchup: 'Fupa Fappers vs The Freakshow',
    calculated: { spread: '-13.5', total: '244.5' },
    ui: { spread: '-0.5', total: '243.5' },
    factors: 'avg diff: 12.5pts, no penalties'
  },
  {
    matchup: "A Touch Of Downs vs Michael Vick's Vet Clinic",
    calculated: { spread: '-7.5', total: '220.5' },
    ui: { spread: '+5', total: '234.5' },
    factors: 'avg diff: 9.5pts, cold penalty: 2.5pts'
  }
];

results.forEach((result, i) => {
  console.log(`${i+1}. ${result.matchup}`);
  console.log(`   Algorithm: ${result.calculated.spread} spread, ${result.calculated.total} total`);
  console.log(`   UI Shows:  ${result.ui.spread} spread, ${result.ui.total} total`);
  console.log(`   Factors:   ${result.factors}`);
  
  const calcSpread = parseFloat(result.calculated.spread);
  const uiSpread = parseFloat(result.ui.spread);
  const difference = Math.abs(calcSpread - uiSpread);
  
  console.log(`   Gap:       ${difference.toFixed(1)} points ${difference > 10 ? '🚨 HUGE' : difference > 5 ? '⚠️ BIG' : '✅ SMALL'}`);
  console.log('');
});

console.log('🎯 ANALYSIS:');
console.log('=============');
console.log('1. Algorithm calculates aggressive spreads based on pure statistics');
console.log('2. UI shows much more conservative spreads');
console.log('3. Gap suggests additional adjustment/capping is happening');
console.log('4. Totals are closer but still different');
console.log('');
console.log('💡 HYPOTHESIS:');
console.log('The UI may be applying:');
console.log('- Maximum spread caps (preventing huge spreads)');
console.log('- Betting balance adjustments');  
console.log('- Market maker conservative factors');
console.log('- Additional business logic not in our test');
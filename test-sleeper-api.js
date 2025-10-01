// Test script to check Sleeper API for draft picks in trades
const https = require('https');

const leagueId = '1181984921049018368';
const week = 4;

console.log('🔍 Testing Sleeper API for week 4 transactions...');

const url = `https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`;

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const transactions = JSON.parse(data);
      console.log('📊 Total transactions:', transactions.length);
      
      // Find trades
      const trades = transactions.filter(t => t.type === 'trade');
      console.log('🤝 Trade transactions:', trades.length);
      
      trades.forEach((trade, index) => {
        console.log(`\n--- Trade ${index + 1} ---`);
        console.log('Transaction ID:', trade.transaction_id);
        console.log('Created:', new Date(trade.created));
        console.log('Status:', trade.status);
        console.log('Adds:', trade.adds);
        console.log('Drops:', trade.drops);
        console.log('Draft picks array:', trade.draft_picks);
        console.log('Metadata:', trade.metadata);
        
        // Check for Nick Chubb (player ID 4988)
        if (trade.adds && trade.adds['4988']) {
          console.log('🎯 FOUND NICK CHUBB TRADE!');
          console.log('Full trade structure:');
          console.log(JSON.stringify(trade, null, 2));
        }
      });
      
      if (trades.length === 0) {
        console.log('⚠️  No trades found in week 4');
        console.log('First few transactions:');
        transactions.slice(0, 3).forEach(t => {
          console.log(`- ${t.type} (${t.transaction_id})`);
        });
      }
      
    } catch (err) {
      console.error('Error parsing JSON:', err);
      console.log('Raw response:', data);
    }
  });
}).on('error', (err) => {
  console.error('HTTPS request error:', err);
});
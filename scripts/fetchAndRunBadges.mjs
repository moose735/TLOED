import { fetchAllHistoricalMatchups } from '../src/utils/sleeperApi.js';
import { computeBadges } from '../src/utils/badges.js';

(async () => {
  try {
    console.log('Fetching historical matchups via fetchAllHistoricalMatchups()...');
    const hist = await fetchAllHistoricalMatchups();
    if (!hist || Object.keys(hist).length === 0) {
      console.error('No historical data returned (empty).');
      process.exit(1);
    }
    console.log('Fetched historicalData seasons:', Object.keys(hist.matchupsBySeason || hist.rostersBySeason || {}).join(', '));
    // Run computeBadges with empty processedSeasonalRecords and draftPicksBySeason (we care about matchup-based badges)
    const res = computeBadges({ historicalData: hist, processedSeasonalRecords: {}, draftPicksBySeason: {}, transactions: [], usersData: [], getTeamName: id => id });

    const bye = [];
    const mass = [];
    Object.values(res.badgesByTeam || {}).forEach(arr => arr.forEach(b => {
      if (b.id && b.id.indexOf('bye_week_') === 0) bye.push(b);
      if (b.id && b.id.indexOf('massacre_') === 0) mass.push(b);
    }));

      try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('bye_week badges count=', bye.length); } catch(e) { /* silent */ }
    console.log(JSON.stringify(bye, null, 2));
    console.log('massacre badges count=', mass.length);
    console.log(JSON.stringify(mass, null, 2));
  } catch (e) {
    console.error('Error fetching or computing badges:', e);
    process.exit(1);
  }
})();

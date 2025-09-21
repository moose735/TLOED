// scripts/printScaledVorp.js
// Quick script to compute and print scaled VORP by position by team for a given season using project utilities.

import fs from 'fs';
import path from 'path';

const badges = await import('../src/utils/badges.js').catch(e => { console.error('failed to import badges', e); process.exit(1); });
const draftCalc = await import('../src/utils/draftCalculations.js').catch(e => { console.error('failed to import draftCalculations', e); process.exit(1); });

const dataPath = path.resolve('data');

// Attempt to load historicalData from the app context file if present
let historicalData = {};
try {
  // Some projects serialize a snapshot; this repo doesn't have one by default, so skip
  // If you want to use real data, place a `historicalData.json` at repo root or update this script
  const maybe = path.resolve('historicalData.json');
  if (fs.existsSync(maybe)) {
    historicalData = JSON.parse(fs.readFileSync(maybe, 'utf8'));
  }
} catch (e) { historicalData = {}; }

// Accept season arg
const seasonArg = process.argv[2] || null;
if (!seasonArg) {
  console.error('Usage: node scripts/printScaledVorp.js <season>');
  process.exit(2);
}

const season = String(seasonArg);

// Try to find draft picks in historicalData
const draftPicksBySeason = historicalData.draftPicksBySeason || {};
const seasonPicks = draftPicksBySeason[season] || [];

if (!seasonPicks || seasonPicks.length === 0) {
  console.error('No draftPicks found for season', season, '. Place a historicalData.json with draftPicksBySeason or run in-app.');
  process.exit(3);
}

const teamVorp = draftCalc.computeTeamScaledVorpByPosition(seasonPicks, { historicalData, usersData: [], season: Number(season), positions: ['QB','RB','WR','TE','K','DEF'], minTarget: -5, maxTarget: 5, scaleMethod: 'perPickThenSum', getTeamName: () => '' });

try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('Computed teamVorp meta', teamVorp.meta); } catch(e) { /* silent */ }
try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('Per owner summary'); } catch(e) { /* silent */ }
Object.keys(teamVorp.perOwner).forEach(owner => {
  try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info(owner, teamVorp.perOwner[owner]); } catch(e) { /* silent */ }
});

process.exit(0);

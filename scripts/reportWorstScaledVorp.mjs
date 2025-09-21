import fs from 'fs';
import path from 'path';
import { computeTeamScaledVorpByPosition } from '../src/utils/draftCalculations.js';

// Load draftPicksBySeason from historicalData.json if present, else fallback to sample
let historicalData = {};
let draftPicksBySeason = null;
try {
  const maybe = path.resolve('historicalData.json');
    if (fs.existsSync(maybe)) {
    historicalData = JSON.parse(fs.readFileSync(maybe, 'utf8')) || {};
    draftPicksBySeason = historicalData.draftPicksBySeason || historicalData.draftPicks || null;
  try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('Loaded historicalData.json for input'); } catch(e) { /* silent */ }
  }
} catch (e) { console.warn('could not load historicalData.json', e.message); }

if (!draftPicksBySeason) {
  try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('No historicalData.json found, using fallback sample data'); } catch(e) { /* silent */ }
  draftPicksBySeason = {
    '2024': [
      { pick_no: 1, picked_by: 'Allen Merchants', player_position: 'QB', player_name: 'QB Bad 2024', fantasy_points: 1 },
      { pick_no: 2, picked_by: 'Allen Merchants', player_position: 'WR', player_name: 'WR Bad 2024', fantasy_points: 0 },
      { pick_no: 3, picked_by: 'The Wolf of Waller Street', player_position: 'RB', player_name: 'RB Bad 2024', fantasy_points: 0 }
    ],
    '2025': [
      { pick_no: 1, picked_by: "Michael Vick’s Vet Clinic", player_position: 'RB', player_name: 'RB Bad 2025', fantasy_points: 0 },
      { pick_no: 2, picked_by: 'Burrowing for Brownies', player_position: 'WR', player_name: 'WR Bad 2025', fantasy_points: 0 },
      { pick_no: 3, picked_by: 'Je_B', player_position: 'RB', player_name: 'RB Also', fantasy_points: 1 }
    ],
    '2023': [
      { pick_no: 1, picked_by: 'Crude Crushers', player_position: 'WR', player_name: 'WR Bad 2023', fantasy_points: 1 },
      { pick_no: 2, picked_by: 'A Touch Of Downs', player_position: 'RB', player_name: 'RB Bad 2023', fantasy_points: 0 }
    ],
    '2022': [
      { pick_no: 1, picked_by: 'Je_B', player_position: 'RB', player_name: 'RB Bad', fantasy_points: 1 },
      { pick_no: 2, picked_by: 'The Nightriders', player_position: 'WR', player_name: 'WR Bad', fantasy_points: 2 }
    ]
  };
}

const positions = ['QB','RB','WR','TE','K','DEF'];
const report = [];

Object.keys(draftPicksBySeason).sort().forEach(season => {
  const picks = draftPicksBySeason[season] || [];
  const teamVorp = computeTeamScaledVorpByPosition(picks, { historicalData, usersData: [], season: Number(season), positions, minTarget: -5, maxTarget: 5, scaleMethod: 'perPickThenSum', getTeamName: id => id });
  // teamVorp.perOwner: owner -> { totals: {scaled, raw, count}, positions: { POS: { scaledSum, rawSum, count } } }
  positions.forEach(pos => {
    const entries = Object.keys(teamVorp.perOwner || {}).map(ownerId => {
      const posObj = (teamVorp.perOwner[ownerId] && teamVorp.perOwner[ownerId].positions && teamVorp.perOwner[ownerId].positions[pos]) || { scaledSum: 0, rawSum: 0, count: 0 };
      return { ownerId, scaledSum: posObj.scaledSum || 0, rawSum: posObj.rawSum || 0, count: posObj.count || 0 };
    }).filter(e => e.count > 0);
    if (entries.length === 0) return;
    entries.sort((a,b) => a.scaledSum - b.scaledSum); // worst first
    const worst = entries[0];
    report.push({ season: Number(season), position: pos, ownerId: worst.ownerId, scaledSum: worst.scaledSum, rawSum: worst.rawSum, picks: worst.count });
  });
});

// Print a concise CSV-like table
try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('season,position,ownerId,scaledSum,rawSum,picks'); } catch(e) { /* silent */ }
report.sort((a,b) => a.season - b.season || a.position.localeCompare(b.position)).forEach(r => {
  try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info(`${r.season},${r.position},"${r.ownerId}",${r.scaledSum},${r.rawSum},${r.picks}`); } catch(e) { /* silent */ }
});

// Also write JSON to file for inspection
try {
  fs.writeFileSync(path.resolve('worst_scaled_vorp_report.json'), JSON.stringify(report, null, 2), 'utf8');
  try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('Wrote worst_scaled_vorp_report.json'); } catch(e) { /* silent */ }
} catch (e) { console.warn('Could not write JSON report:', e.message); }

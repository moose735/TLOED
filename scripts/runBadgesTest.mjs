import { computeBadges } from '../src/utils/badges.js';
import fs from 'fs';
import path from 'path';

// Attempt to load historicalData.json from repo root if present. If found,
// prefer its draftPicksBySeason and processedSeasonalRecords so this script can
// be run against real data without editing the script.
let draftPicksBySeason = null;
let processedSeasonalRecords = null;
let historicalData = {};
try {
  const maybe = path.resolve('historicalData.json');
  if (fs.existsSync(maybe)) {
    historicalData = JSON.parse(fs.readFileSync(maybe, 'utf8')) || {};
    draftPicksBySeason = historicalData.draftPicksBySeason || historicalData.draftPicks || null;
    processedSeasonalRecords = historicalData.processedSeasonalRecords || null;
    try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info('Loaded historicalData.json from repo root'); } catch(e) { /* silent */ }
  }
} catch (e) { console.warn('Could not load historicalData.json:', e.message); }

// Synthetic draft picks to reproduce Worst-positional winners the user listed (fallback)
const sampleDraftPicks = {
  '2022': [
    { pick_no: 1, picked_by: 'Je_B', player_position: 'RB', player_name: 'RB Bad', fantasy_points: 1 },
    { pick_no: 2, picked_by: 'The Nightriders', player_position: 'WR', player_name: 'WR Bad', fantasy_points: 2 }
  ],
  '2023': [
    { pick_no: 1, picked_by: 'Crude Crushers', player_position: 'WR', player_name: 'WR Bad 2023', fantasy_points: 1 },
    { pick_no: 2, picked_by: 'A Touch Of Downs', player_position: 'RB', player_name: 'RB Bad 2023', fantasy_points: 0 }
  ],
  '2024': [
    { pick_no: 1, picked_by: 'Allen Merchants', player_position: 'QB', player_name: 'QB Bad 2024', fantasy_points: 1 },
    { pick_no: 2, picked_by: 'Allen Merchants', player_position: 'WR', player_name: 'WR Bad 2024', fantasy_points: 0 },
    { pick_no: 3, picked_by: 'The Wolf of Waller Street', player_position: 'RB', player_name: 'RB Bad 2024', fantasy_points: 0 }
  ],
  '2025': [
    { pick_no: 1, picked_by: "Michael Vick’s Vet Clinic", player_position: 'RB', player_name: 'RB Bad 2025', fantasy_points: 0 },
    { pick_no: 2, picked_by: 'Burrowing for Brownies', player_position: 'WR', player_name: 'WR Bad 2025', fantasy_points: 0 },
    { pick_no: 3, picked_by: 'Je_B', player_position: 'RB', player_name: 'RB Also', fantasy_points: 1 }
  ]
};

if (!draftPicksBySeason) draftPicksBySeason = sampleDraftPicks;
const res = computeBadges({ historicalData: historicalData || {}, processedSeasonalRecords: processedSeasonalRecords || {}, draftPicksBySeason, transactions: [], usersData: [], getTeamName: id => id });

// Filter and print Worst {pos} Draft badges and Worst {pos} Drafter badges
// NOTE: badges may have been re-categorized from 'blunder' to 'achievement';
// match on id/name instead of category to ensure these appear in test output.
const worstBadges = res.recentBadges.filter(b => (b.id && (b.id.includes('worst_') || b.id.includes('worst_positional_drafter'))) || (b.name && b.name.toLowerCase().includes('worst')));
try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info('Found worst-related blunder badges'); } catch(e) { /* silent */ }
for (const b of worstBadges) {
  try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info(`${b.year} - ${b.name} -> Team: ${b.teamId} (id: ${b.id}) metadata: ${JSON.stringify(b.metadata)}`); } catch(e) { /* silent */ }
}

// Also show positional pick-level worst badges (worst_{pos}_draft_{season}_{owner})
const pickLevel = res.recentBadges.filter(b => b.category === 'blunder' && /worst_[a-z]+_draft_/.test(b.id));
try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info('Pick-level worst badges'); } catch(e) { /* silent */ }
try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info(JSON.stringify(pickLevel.map(b=>({year:b.year,name:b.name,teamId:b.teamId,id:b.id,metadata:b.metadata})), null, 2)); } catch(e) { /* silent */ }

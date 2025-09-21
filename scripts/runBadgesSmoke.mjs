import fs from 'fs';
import path from 'path';
import { computeBadges } from '../src/utils/badges.js';

const root = process.cwd();
let historical = {};
let draftPicksBySeason = {};
try {
  const p = path.resolve('historicalData.json');
    if (fs.existsSync(p)) {
    historical = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
    draftPicksBySeason = historical.draftPicksBySeason || historical.draftPicks || {};
    try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('Loaded historicalData.json'); } catch(e) { /* silent */ }
  }
} catch (e) { try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.warn === 'function') logger.warn('could not load historicalData.json', e.message); } catch(err) { /* fallback silent */ } }

const badges = computeBadges({ historicalData: historical, draftPicksBySeason, processedSeasonalRecords: {} });
try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('Computed badges summary: recentBadges count =', (badges && badges.recentBadges && badges.recentBadges.length) || 0); } catch(e) { /* silent */ }
// print any worst draft pick badges
const worstBadges = [];
Object.keys(badges.badgesByTeam || {}).forEach(team => {
  (badges.badgesByTeam[team] || []).forEach(b => {
    if (b.id && b.id.indexOf('worst_draft_pick') !== -1) worstBadges.push(b);
    if (b.id && b.id.indexOf('worst_') === 0 && b.id.indexOf('_draft_') !== -1) worstBadges.push(b);
  });
});
try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info('Found worst pick badges:', worstBadges.length); } catch(e) { /* silent */ }
try { const logger = require('../src/utils/logger').default; if (logger && typeof logger.info === 'function') logger.info(JSON.stringify(worstBadges, null, 2)); } catch(e) { /* silent */ }

import fs from 'fs';
import path from 'path';
import { computeBadges } from '../src/utils/badges.js';

const root = process.cwd();
// Allow explicit path via CLI arg or HISTORICAL_DATA_PATH env var
const cliArgPath = process.argv && process.argv.length > 2 ? path.resolve(process.argv[2]) : null;
const envPath = process.env.HISTORICAL_DATA_PATH ? path.resolve(process.env.HISTORICAL_DATA_PATH) : null;
let histPath = cliArgPath || envPath || path.resolve('historicalData.json');
let fallback = path.resolve('historicalData_full.json');
let historical = {};

if (fs.existsSync(histPath)) {
  try { historical = JSON.parse(fs.readFileSync(histPath,'utf8')) || {}; console.log('Loaded historicalData.json from repo root'); } catch (e) { console.warn('Failed to parse historicalData.json, falling back', e.message); }
}
if (!historical || Object.keys(historical).length === 0) {
  if (fs.existsSync(fallback)) {
    try { historical = JSON.parse(fs.readFileSync(fallback,'utf8')) || {}; console.log('Loaded fallback historicalData_full.json'); } catch (e) { console.warn('Failed to parse fallback historical data', e.message); }
  }
}

const processed = historical.processedSeasonalRecords || {};
const draftPicksBySeason = historical.draftPicksBySeason || historical.draftPicks || {};

const res = computeBadges({ historicalData: historical, processedSeasonalRecords: processed, draftPicksBySeason, transactions: historical.transactions || [], usersData: historical.users || [], getTeamName: id => id });

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

try { console.log('recentBadges sample:', JSON.stringify(res.recentBadges.slice(0,20), null, 2)); } catch (e) { }

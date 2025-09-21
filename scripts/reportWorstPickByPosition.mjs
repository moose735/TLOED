import fs from 'fs';
import path from 'path';
import { generateExpectedVorpByPickSlot, calculatePlayerValue, enrichPickForCalculations, normalizePosition, calculateVORPDelta, computeTeamScaledVorpByPosition } from '../src/utils/draftCalculations.js';

// Load historicalData.json if present
let historicalData = {};
let draftPicksBySeason = null;
try {
  const maybe = path.resolve('historicalData.json');
    if (fs.existsSync(maybe)) {
    historicalData = JSON.parse(fs.readFileSync(maybe, 'utf8')) || {};
    draftPicksBySeason = historicalData.draftPicksBySeason || historicalData.draftPicks || null;
    try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info('Loaded historicalData.json for input'); } catch(e) { /* silent */ }
  }
} catch (e) { console.warn('could not load historicalData.json', e.message); }

if (!draftPicksBySeason) {
  console.error('No draft picks found. Place historicalData.json with draftPicksBySeason at repo root. Aborting.');
  process.exit(1);
}

const positions = ['QB','RB','WR','TE','K','DEF'];
const results = [];

Object.keys(draftPicksBySeason).sort().forEach(season => {
  const picks = draftPicksBySeason[season] || [];

  // Use the project's authoritative calculation function so the report matches app logic
  const teamVorp = computeTeamScaledVorpByPosition(picks, { historicalData, usersData: [], season: Number(season), positions });
  const entries = teamVorp.entries || [];

  // build per-position buckets using normalized positions from the shared helper
  const posBuckets = {};
  entries.forEach(e => {
    const pos = normalizePosition(e.enriched?.player_position || e.enriched?.player_pos || e.position || '');
    const owner = e.owner || (e.enriched && (e.enriched.picked_by_display_name || e.enriched.picked_by_team_name || e.enriched.picked_by)) || '';
    const rawPick = e.enriched || e.rawPick || {};
    if (!pos) return;
    if (!posBuckets[pos]) posBuckets[pos] = [];
    posBuckets[pos].push({ rawPick, enriched: e.enriched, playerValue: e.playerValue, pickNo: e.pickNo, expected: e.expected, delta: e.delta, position: pos, owner });
  });

  positions.forEach(pos => {
    const arr = (posBuckets[pos] || []).slice();
    if (!arr || arr.length === 0) return;
    // find worst: smallest delta
    arr.sort((a,b) => (a.delta || 0) - (b.delta || 0));
    const worst = arr[0];
    if (!worst) return;
    results.push({ season: Number(season), position: pos, owner: worst.owner, delta: worst.delta, playerValue: worst.playerValue, expected: worst.expected, pick: worst.rawPick });
  });
});

// Write outputs
const outJson = path.resolve('worst_picks_by_position.json');
fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf8');
try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info('Wrote worst picks JSON', outJson); } catch(e) { /* silent */ }

// CSV
const csvPath = path.resolve('worst_picks_by_position.csv');
const header = 'season,position,owner,delta,playerValue,expected,pick_no,player_name,player_position\n';
const lines = results.map(r => `${r.season},${r.position},"${r.owner}",${r.delta},${r.playerValue},${r.expected},${r.pick.pick_no || ''},"${(r.pick.player_name||'').replace(/"/g,'""')}","${r.pick.player_position||''}"`);
fs.writeFileSync(csvPath, header + lines.join('\n'), 'utf8');
try { const logger = (await import('../src/utils/logger.js')).default; if (logger && typeof logger.info === 'function') logger.info('Wrote worst picks CSV', csvPath, 'rows', results.length); } catch(e) { /* silent */ }

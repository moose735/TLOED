import fs from 'fs';
import path from 'path';
import { computeTeamScaledVorpByPosition } from '../src/utils/draftCalculations.js';

// Load draftPicksBySeason from historicalData.json if present
let historicalData = {};
let draftPicksBySeason = null;
try {
  const maybe = path.resolve('historicalData.json');
  if (fs.existsSync(maybe)) {
    historicalData = JSON.parse(fs.readFileSync(maybe, 'utf8')) || {};
    draftPicksBySeason = historicalData.draftPicksBySeason || historicalData.draftPicks || null;
    // removed dependency on project logger; keep a lightweight console message
    try { console.info && console.info('Loaded historicalData.json for input'); } catch(e) { /* silent */ }
  }
} catch (e) { console.warn('could not load historicalData.json', e.message); }

if (!draftPicksBySeason) {
  console.error('No draft picks found. Place historicalData.json with draftPicksBySeason at repo root. Aborting.');
  process.exit(1);
}

const positions = ['QB','RB','WR','TE','K','DEF'];
const badges = [];

Object.keys(draftPicksBySeason).sort().forEach(season => {
  const picks = draftPicksBySeason[season] || [];
  const teamVorp = computeTeamScaledVorpByPosition(picks, { historicalData, usersData: [], season: Number(season), positions, minTarget: -5, maxTarget: 5, scaleMethod: 'perPickThenSum', getTeamName: id => id });
  // teamVorp.perOwner
  positions.forEach(pos => {
    const entries = Object.keys(teamVorp.perOwner || {}).map(ownerId => {
      const posObj = (teamVorp.perOwner[ownerId] && teamVorp.perOwner[ownerId].positions && teamVorp.perOwner[ownerId].positions[pos]) || { scaledSum: 0, rawSum: 0, count: 0 };
      return { ownerId, scaledSum: posObj.scaledSum || 0, rawSum: posObj.rawSum || 0, count: posObj.count || 0 };
    }).filter(e => e.count > 0);
    if (!entries || entries.length === 0) return; // no picks at this pos this season
    entries.sort((a,b) => a.scaledSum - b.scaledSum);
    const worst = entries[0];
    // form a blunder badge object matching badges.js format
    const id = `worst_positional_drafter_${pos.toLowerCase()}_${season}_${worst.ownerId}`;
    // Change category away from 'blunder' so these are treated as non-blunder badges in the app
    const badge = { id, name: `Worst ${pos} Drafter`, displayName: `Worst ${pos} Drafter`, category: 'achievement', year: Number(season), teamId: worst.ownerId, metadata: { position: pos, scaledSum: worst.scaledSum, rawSum: worst.rawSum, picks: worst.count } };
    badges.push(badge);
  });
});

const out = path.resolve('worst_positional_blunders.json');
fs.writeFileSync(out, JSON.stringify(badges, null, 2), 'utf8');
try { console.info && console.info('Wrote', out, 'with', badges.length, 'badges'); } catch(e) { /* silent */ }

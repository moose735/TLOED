#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Trace trades forward: given a trades report file, fetch all transactions and drafts
// for each league and follow player movements and resolve picks to drafted players.

const REPORT_DIR = path.join(__dirname, 'output');

function newestReportFile() {
  const files = fs.readdirSync(REPORT_DIR).filter(f => f.startsWith('trades_report_') && f.endsWith('.json'));
  if (!files.length) return null;
  files.sort();
  return path.join(REPORT_DIR, files[files.length - 1]);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${url} ${res.status}`);
  return res.json();
}

async function fetchAllTxForLeague(leagueId, maxWeeks = 20) {
  const all = [];
  for (let w = 1; w <= maxWeeks; w++) {
    try {
      const txs = await fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${w}`);
      if (Array.isArray(txs) && txs.length) {
        txs.forEach(t => { t._week = w; t._league = leagueId; all.push(t); });
      }
    } catch (e) {
      // ignore
    }
  }
  return all.sort((a,b)=> (a.created||0)-(b.created||0));
}

async function fetchDraftPicksForLeague(leagueId) {
  try {
    const drafts = await fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
    const picksBySeason = {};
    if (Array.isArray(drafts)) {
      for (const d of drafts) {
        try {
          const draftId = d.draft_id || d.draftId || d.draft_id_str;
          if (!draftId) continue;
          const picks = await fetchJson(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
          const season = String(d.season || d.year || (picks && picks[0] && picks[0].season) || 'unknown');
          picksBySeason[season] = picksBySeason[season] || [];
          if (Array.isArray(picks)) picksBySeason[season].push(...picks);
        } catch (e) {}
      }
    }
    return picksBySeason;
  } catch (e) { return {}; }
}

function findNextMovements(playerId, txs, afterCreated) {
  const pid = String(playerId);
  return txs.filter(t => (t.created || 0) > (afterCreated || 0)).filter(t => {
    const adds = t.adds || {};
    const drops = t.drops || {};
    if (Object.prototype.hasOwnProperty.call(adds, pid) || Object.prototype.hasOwnProperty.call(drops, pid)) return true;
    // values
    const valMatch = (obj) => Object.values(obj || {}).some(v => {
      if (!v) return false;
      if (String(v) === pid) return true;
      if (typeof v === 'object') {
        if (String(v.player_id || v.playerId || v.id || '') === pid) return true;
      }
      return false;
    });
    if (valMatch(adds) || valMatch(drops)) return true;
    if (Array.isArray(t.players) && t.players.some(p => String(p) === pid)) return true;
    if (t.metadata && JSON.stringify(t.metadata).includes(`"${pid}"`)) return true;
    return false;
  }).map(t => ({ transaction_id: t.transaction_id || t.id || '(unknown)', created: t.created, week: t._week, type: t.type, roster_ids: t.roster_ids, adds: t.adds, drops: t.drops }));
}

async function run() {
  const reportFile = newestReportFile();
  if (!reportFile) {
    console.error('No trades report found in', REPORT_DIR);
    process.exit(1);
  }
  console.log('Using report', reportFile);
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

  // Group by league
  const byLeague = {};
  for (const t of report) {
    byLeague[t.league_id] = byLeague[t.league_id] || [];
    byLeague[t.league_id].push(t);
  }

  const final = [];
  for (const leagueId of Object.keys(byLeague)) {
    console.log('Processing league', leagueId);
    const txs = await fetchAllTxForLeague(leagueId, 20);
    const picksBySeason = await fetchDraftPicksForLeague(leagueId);

    for (const trade of byLeague[leagueId]) {
      const entry = { league_id: leagueId, transaction_id: trade.transaction_id, created: trade.created, roster_ids: trade.roster_ids, players: [], draft_picks: [] };

      // players from adds/drops keys
      const playerIds = new Set([...Object.keys(trade.adds || {}), ...Object.keys(trade.drops || {})]);
      for (const pid of playerIds) {
        const movements = findNextMovements(pid, txs, trade.created || 0);
        entry.players.push({ player_id: pid, initial_trade: { added: Object.prototype.hasOwnProperty.call(trade.adds || {}, pid), dropped: Object.prototype.hasOwnProperty.call(trade.drops || {}, pid) }, future_movements: movements });
      }

      // draft picks: resolve to picksBySeason and to drafted player if available
      for (const p of trade.draft_picks || []) {
        const season = String(p.season || '');
        const round = Number(p.round || 0);
        const seasonPicks = picksBySeason[season] || [];
        const resolved = seasonPicks.find(sp => (sp.round && Number(sp.round) === round) || (p.pick_no && sp.pick_no && Number(sp.pick_no) === Number(p.pick_no)) || (p.pick && sp.pick && Number(sp.pick) === Number(p.pick)));
        entry.draft_picks.push({ original: p, resolved: resolved || null });
      }

      final.push(entry);
    }
  }

  const outPath = path.join(REPORT_DIR, `traced_trades_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(final, null, 2), 'utf8');
  console.log('Wrote traced report to', outPath);
}

if (typeof fetch === 'undefined') {
  console.error('Global fetch not available. Use Node 18+ or run with a polyfill.');
  process.exit(1);
}

run().catch(err => { console.error(err); process.exit(2); });

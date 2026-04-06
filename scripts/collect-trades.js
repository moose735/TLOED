#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Simple script to collect all trades across configured leagues and weeks
// Usage: node scripts/collect-trades.js

const CONFIG_PATH = path.join(__dirname, '..', 'src', 'config.js');
const OUTPUT_DIR = path.join(__dirname, 'output');

async function readConfigLeagues() {
  const txt = fs.readFileSync(CONFIG_PATH, 'utf8');
  // Try to extract HISTORICAL_LEAGUE_CHAIN array
  const chainMatch = txt.match(/export const HISTORICAL_LEAGUE_CHAIN\s*=\s*\[([\s\S]*?)\]/m);
  const currentMatch = txt.match(/export const CURRENT_LEAGUE_ID\s*=\s*['"]([0-9]+)['"]/m);
  const ids = new Set();
  if (currentMatch) ids.add(currentMatch[1]);
  if (chainMatch) {
    const body = chainMatch[1];
    const matches = body.match(/['"]([0-9]+)['"]/g) || [];
    matches.forEach(m => {
      const id = m.replace(/['"]/g, '');
      ids.add(id);
    });
  }
  return Array.from(ids);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed fetch ${url} - ${res.status}`);
  }
  return res.json();
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
        } catch (e) {
          // ignore draft failures
        }
      }
    }
    return picksBySeason;
  } catch (e) {
    return {};
  }
}

function resolvePick(pickObj, picksBySeason) {
  if (!pickObj || !picksBySeason) return null;
  const season = String(pickObj.season || '');
  const round = Number(pickObj.round || pickObj.round_no || 0);
  const seasonPicks = picksBySeason[season] || [];
  if (!seasonPicks.length) return null;
  const candidate = seasonPicks.find(p => {
    if (p.round && Number(p.round) === round) return true;
    if (p.pick && pickObj.pick && Number(p.pick) === Number(pickObj.pick)) return true;
    if (p.pick_no && pickObj.pick_no && Number(p.pick_no) === Number(pickObj.pick_no)) return true;
    if (pickObj.player_name && p.player_name && String(p.player_name).toLowerCase().includes(String(pickObj.player_name).toLowerCase())) return true;
    return false;
  });
  return candidate || null;
}

async function collectTrades() {
  const leagueIds = await readConfigLeagues();
  console.log('Leagues to scan:', leagueIds.join(', '));
  const weeksToScan = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20

  const report = [];

  for (const leagueId of leagueIds) {
    console.log('Scanning league', leagueId);
    const picksBySeason = await fetchDraftPicksForLeague(leagueId);

    for (const week of weeksToScan) {
      try {
        const txs = await fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
        if (!Array.isArray(txs) || !txs.length) continue;
        const trades = txs.filter(t => String(t.type || '').toLowerCase() === 'trade');
        for (const tx of trades) {
          const traded = {
            league_id: leagueId,
            week,
            transaction_id: tx.transaction_id || tx.id || '(unknown)',
            created: tx.created || tx.status_updated || null,
            roster_ids: tx.roster_ids || [],
            adds: tx.adds || {},
            drops: tx.drops || {},
            draft_picks: tx.draft_picks || tx.metadata?.traded_picks || [],
            resolved_picks: [],
            raw: tx,
          };

          // try resolving picks
          for (const p of traded.draft_picks || []) {
            const resolved = resolvePick(p, picksBySeason);
            if (resolved) traded.resolved_picks.push(resolved);
          }

          report.push(traded);
        }
      } catch (e) {
        // ignore week fetch errors
      }
    }
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `trades_report_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote', outPath, 'with', report.length, 'trades found');
}

// Node 18+ has global fetch; if not, instruct user
if (typeof fetch === 'undefined') {
  console.error('Global fetch not available in this Node runtime. Use Node 18+ or run with a polyfill.');
  process.exit(1);
}

collectTrades().catch(err => {
  console.error('Fatal error collecting trades:', err);
  process.exit(2);
});

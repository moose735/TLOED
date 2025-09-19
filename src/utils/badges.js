// src/utils/badges.js
// Compute achievement and blunder badges from historical data and seasonal metrics.
// This is intentionally conservative: it computes badges that can be reliably derived
// from `processedSeasonalRecords` and `historicalData` (matchups). More complex
// badges that require draft valuations or transactions are left as TODOs.

import { generateExpectedVorpByPickSlot, calculatePlayerValue, enrichPickForCalculations } from '../utils/draftCalculations';

// src/utils/badges.js

function percentileRank(arr, value) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  if (idx === -1) return 1;
  return idx / sorted.length;
}

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function computeBadges({ historicalData, processedSeasonalRecords, draftPicksBySeason = {}, transactions = [], usersData = [], getTeamName = () => '' }) {
  const badgesByTeam = {}; // ownerId -> [badges]
  const recentBadges = [];

  // Unconditional log to help developers see that computeBadges ran in constrained preview environments
  try { console.log('computeBadges called'); } catch (e) { /* ignore logging errors */ }

  if (!processedSeasonalRecords) return { badgesByTeam, recentBadges };

  const seasons = Object.keys(processedSeasonalRecords).map(Number).sort((a, b) => a - b);

  seasons.forEach(season => {
    const seasonMetrics = processedSeasonalRecords[season];
    if (!seasonMetrics) return;

    // Build roster list with ownerId and metrics
    const rosterEntries = Object.values(seasonMetrics).map(s => ({
      rosterId: s.rosterId || s.rosterId,
      ownerId: s.ownerId,
      teamName: s.teamName,
      wins: s.wins || 0,
      pointsFor: s.pointsFor || 0,
      allPlayWinPercentage: s.allPlayWinPercentage || 0,
      luckRating: s.luckRating || 0,
      adjustedDPR: s.adjustedDPR || 0,
      isChampion: !!s.isChampion,
      isRunnerUp: !!s.isRunnerUp,
      isThirdPlace: !!s.isThirdPlace,
    }));

    // Season Title: highest wins (tiebreaker pointsFor)
    const seasonTitle = [...rosterEntries].sort((a, b) => (b.wins - a.wins) || (b.pointsFor - a.pointsFor))[0];
    if (seasonTitle) {
      const badge = { id: `season_title_${season}`, name: 'Season Title', category: 'season', year: season, teamId: seasonTitle.ownerId };
      (badgesByTeam[seasonTitle.ownerId] = badgesByTeam[seasonTitle.ownerId] || []).push(badge);
      recentBadges.push(badge);
    }

    // Points Title (Points Champion for full season weeks)
    const pointsTitle = [...rosterEntries].sort((a, b) => b.pointsFor - a.pointsFor)[0];
    if (pointsTitle) {
      const badge = { id: `points_title_${season}`, name: 'Points Title', category: 'season', year: season, teamId: pointsTitle.ownerId };
      (badgesByTeam[pointsTitle.ownerId] = badgesByTeam[pointsTitle.ownerId] || []).push(badge);
      recentBadges.push(badge);
    }

    // All-Play Title
    const allPlayTitle = [...rosterEntries].sort((a, b) => b.allPlayWinPercentage - a.allPlayWinPercentage)[0];
    if (allPlayTitle) {
      const badge = { id: `allplay_title_${season}`, name: 'Season All-Play Title', category: 'season', year: season, teamId: allPlayTitle.ownerId };
      (badgesByTeam[allPlayTitle.ownerId] = badgesByTeam[allPlayTitle.ownerId] || []).push(badge);
      recentBadges.push(badge);
    }

    // Triple Crown: same team wins season/title/points/all-play
    if (seasonTitle && pointsTitle && allPlayTitle && seasonTitle.ownerId === pointsTitle.ownerId && seasonTitle.ownerId === allPlayTitle.ownerId) {
      const badge = { id: `triple_crown_${season}`, name: 'Triple Crown', category: 'season', year: season, teamId: seasonTitle.ownerId };
      (badgesByTeam[seasonTitle.ownerId] = badgesByTeam[seasonTitle.ownerId] || []).push(badge);
      recentBadges.push(badge);
    }

    // Champion / Runner Up / 3rd Place
    const champions = rosterEntries.filter(r => r.isChampion);
    champions.forEach(c => {
      const badge = { id: `champion_${season}`, name: 'Champion', category: 'champion', year: season, teamId: c.ownerId };
      (badgesByTeam[c.ownerId] = badgesByTeam[c.ownerId] || []).push(badge);
      recentBadges.push(badge);
    });

    // Silverback-To-Back (runner-up consecutive seasons) will be computed in a second pass

    // DPR-based season tiers using absolute DPR ranges (user requested):
    // Bronze = 1.000 - 1.075
    // Silver = 1.076 - 1.150
    // Gold   = 1.151 - 1.225
    // Diamond= 1.226+
    rosterEntries.forEach(r => {
      const dpr = Number(r.adjustedDPR || 0);
      if (!dpr || isNaN(dpr)) return;
      let tier = null;
      if (dpr >= 1.226) tier = 'Diamond Season';
      else if (dpr >= 1.151 && dpr <= 1.225) tier = 'Gold Season';
      else if (dpr >= 1.076 && dpr <= 1.150) tier = 'Silver Season';
      else if (dpr >= 1.000 && dpr <= 1.075) tier = 'Bronze Season';
      if (tier) {
        const badge = { id: `${tier.replace(/\s+/g,'_').toLowerCase()}_${season}_${r.ownerId}`, name: tier, category: 'season-tier', year: season, teamId: r.ownerId };
        (badgesByTeam[r.ownerId] = badgesByTeam[r.ownerId] || []).push(badge);
      }
    });

    // Lucky Duck: roster with the highest luckRating in the season
    try {
      const luckiest = [...rosterEntries].sort((a, b) => (b.luckRating || 0) - (a.luckRating || 0))[0];
      if (luckiest) {
        // Use a distinct category so the UI can choose whether to hide/show this
        // for the current season independently of champion/season-tier badges.
        const badge = { id: `lucky_duck_${season}`, name: 'Lucky Duck', displayName: 'Lucky Duck', category: 'season-luck', year: season, teamId: luckiest.ownerId, accent: 'championAccent', metadata: { luckRating: luckiest.luckRating || 0 } };
        (badgesByTeam[luckiest.ownerId] = badgesByTeam[luckiest.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
    } catch (e) { /* ignore luck computation errors */ }

    // Peak Performance: team with highest single-game score in season. Need matchups to detect.
    const matchups = (historicalData && historicalData.matchupsBySeason && historicalData.matchupsBySeason[season]) || [];
    let highestSingle = { score: -Infinity, rosterId: null, week: null };
    let highestTotal = { total: -Infinity, t1: null, t2: null, week: null };
    matchups.forEach(m => {
      const s1 = Number(m.team1_score || m.team1Score || 0);
      const s2 = Number(m.team2_score || m.team2Score || 0);
      const wk = m.week || m.w || null;
      if (s1 > highestSingle.score) highestSingle = { score: s1, rosterId: String(m.team1_roster_id), week: wk };
      if (s2 > highestSingle.score) highestSingle = { score: s2, rosterId: String(m.team2_roster_id), week: wk };
      const total = (s1 || 0) + (s2 || 0);
      if (total > highestTotal.total) highestTotal = { total, t1: String(m.team1_roster_id), t2: String(m.team2_roster_id), week: wk };
    });
    if (highestSingle.rosterId) {
      // Map rosterId -> ownerId using processedSeasonalRecords
      const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(highestSingle.rosterId));
      if (ownerEntry) {
        const badge = { id: `peak_performance_${season}`, name: 'Peak Performance', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { score: highestSingle.score, week: highestSingle.week } };
        (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
    }
    if (highestTotal.t1 && highestTotal.t2) {
      const o1 = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(highestTotal.t1));
      const o2 = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(highestTotal.t2));
      if (o1) {
        const badge = { id: `shootout_${season}_${o1.ownerId}`, name: 'The Shootout', category: 'matchup', year: season, teamId: o1.ownerId, metadata: { total: highestTotal.total, week: highestTotal.week } };
        (badgesByTeam[o1.ownerId] = badgesByTeam[o1.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
      if (o2) {
        const badge = { id: `shootout_${season}_${o2.ownerId}`, name: 'The Shootout', category: 'matchup', year: season, teamId: o2.ownerId, metadata: { total: highestTotal.total, week: highestTotal.week } };
        (badgesByTeam[o2.ownerId] = badgesByTeam[o2.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
    }

    // Additional matchup-based badges: Massacre, Double Up, Firing Squad, Micro/Small Victory
    // We'll scan matchups again to find blowouts, doubles, and narrow wins.
    try {
    // Track highest blowout (largest margin) per season
    let highestBlowout = { margin: -Infinity, rosterId: null, opponentRosterId: null, matchup: null, week: null };
  // Track smallest non-zero margin (Thread The Needle)
  let smallestMargin = { margin: Infinity, rosterId: null, opponentRosterId: null, matchup: null, week: null };
    // Track highest points-share in a matchup (firing squad): max percentage of matchup points scored by a team
    let highestPointsShare = { share: -Infinity, rosterId: null, total: 0, score: 0, week: null };
  // Head-to-head wins: map of `${winnerRid}_${loserRid}` -> {count, weeks[]}
  const headToHeadWins = {};

      matchups.forEach(m => {
        const s1 = Number(m.team1_score || m.team1Score || 0);
        const s2 = Number(m.team2_score || m.team2Score || 0);
        const r1 = String(m.team1_roster_id);
        const r2 = String(m.team2_roster_id);
        const wk = m.week || m.w || null;
        const total = (s1 || 0) + (s2 || 0);

        // blowout margin
        const margin1 = s1 - s2;
        const margin2 = s2 - s1;
        if (margin1 > highestBlowout.margin) highestBlowout = { margin: margin1, rosterId: r1, opponentRosterId: r2, matchup: m, week: wk };
        if (margin2 > highestBlowout.margin) highestBlowout = { margin: margin2, rosterId: r2, opponentRosterId: r1, matchup: m, week: wk };
  // track smallest non-zero margin
  if (margin1 > 0 && margin1 < smallestMargin.margin) smallestMargin = { margin: margin1, rosterId: r1, opponentRosterId: r2, matchup: m, week: wk };
  if (margin2 > 0 && margin2 < smallestMargin.margin) smallestMargin = { margin: margin2, rosterId: r2, opponentRosterId: r1, matchup: m, week: wk };

        // points share
        if (total > 0) {
          const share1 = s1 / total;
          const share2 = s2 / total;
          if (share1 > highestPointsShare.share) highestPointsShare = { share: share1, rosterId: r1, total, score: s1, week: wk };
          if (share2 > highestPointsShare.share) highestPointsShare = { share: share2, rosterId: r2, total, score: s2, week: wk };
        }

        // Double Up: if one team's score is at least 2x the opponent's score
        if ((s2 > 0 && s1 >= 2 * s2) || (s1 > 0 && s2 >= 2 * s1)) {
          const winnerRid = s1 >= 2 * s2 ? r1 : r2;
          const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(winnerRid));
          if (ownerEntry) {
            const badge = { id: `double_up_${season}_${ownerEntry.ownerId}_${wk || ''}`, name: 'Double Up', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { opponent: s1 >= 2 * s2 ? r2 : r1, scores: { s1, s2, total }, week: wk } };
            (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
            recentBadges.push(badge);
          }
        }

        // Micro / Small Victory: narrow wins (<0.5 and <1 respectively)
        const diff = Math.abs(s1 - s2);
        if (diff > 0 && diff < 0.5) {
          const winnerRid = s1 > s2 ? r1 : r2;
          const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(winnerRid));
          if (ownerEntry) {
            const badge = { id: `micro_victory_${season}_${ownerEntry.ownerId}_${wk || ''}`, name: 'Micro Victory', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { margin: diff, week: wk } };
            (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
            recentBadges.push(badge);
          }
        } else if (diff > 0 && diff < 1) {
          const winnerRid = s1 > s2 ? r1 : r2;
          const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(winnerRid));
          if (ownerEntry) {
            const badge = { id: `small_victory_${season}_${ownerEntry.ownerId}_${wk || ''}`, name: 'Small Victory', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { margin: diff, week: wk } };
            (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
            recentBadges.push(badge);
          }
        }

        // Track head-to-head wins for Bully: winner defeats same opponent; store weeks
        if (!isNaN(s1) && !isNaN(s2) && s1 !== s2) {
          const winner = s1 > s2 ? r1 : r2;
          const loser = s1 > s2 ? r2 : r1;
          const key = `${winner}_${loser}`;
          if (!headToHeadWins[key]) headToHeadWins[key] = { count: 0, weeks: [] };
          headToHeadWins[key].count += 1;
          headToHeadWins[key].weeks.push(wk);
        }
      });

      // Massacre: the single highest-margin win in the season
      if (highestBlowout.rosterId) {
        const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(highestBlowout.rosterId));
        if (ownerEntry) {
          const badge = { id: `massacre_${season}_${ownerEntry.ownerId}`, name: 'Massacre', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { margin: highestBlowout.margin, opponentRosterId: highestBlowout.opponentRosterId, week: highestBlowout.week } };
          (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
          recentBadges.push(badge);
        }
      }

      // Firing Squad: highest points share in a matchup for the season
      if (highestPointsShare.rosterId) {
        const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(highestPointsShare.rosterId));
        if (ownerEntry) {
          const badge = { id: `firing_squad_${season}_${ownerEntry.ownerId}`, name: 'Firing Squad', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { share: highestPointsShare.share, score: highestPointsShare.score, total: highestPointsShare.total, week: highestPointsShare.week } };
          (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
          recentBadges.push(badge);
        }
      }

      // Thread The Needle: the smallest non-zero margin win in the season
      if (smallestMargin.rosterId) {
        const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(smallestMargin.rosterId));
        if (ownerEntry) {
          const badge = { id: `thread_the_needle_${season}_${ownerEntry.ownerId}`, name: 'Thread The Needle', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { margin: smallestMargin.margin, opponentRosterId: smallestMargin.opponentRosterId, week: smallestMargin.week } };
          (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
          recentBadges.push(badge);
        }
      }

      // Bully: any pairing where one roster beat the same opponent 3 or more times in a season
      Object.keys(headToHeadWins).forEach(k => {
        const rec = headToHeadWins[k] || { count: 0, weeks: [] };
        const count = rec.count || 0;
        if (count >= 3) {
          const [winnerRid, loserRid] = k.split('_');
          const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(winnerRid));
          if (ownerEntry) {
            // pick the week of the 3rd recorded win if available
            const wk = (rec.weeks && rec.weeks.length >= 3) ? rec.weeks[2] : (rec.weeks && rec.weeks.length ? rec.weeks[rec.weeks.length - 1] : null);
            const badge = { id: `bully_${season}_${ownerEntry.ownerId}_${loserRid}`, name: 'Bully', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { opponentRosterId: loserRid, winsAgainst: count, week: wk } };
            (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
            recentBadges.push(badge);
          }
        }
      });
    } catch (e) {
      try { const logger = require('./logger').default; logger.error('computeBadges: error computing matchup-derived badges', e); } catch (err) { }
    }

    // Heavyweight Champion: if champion and scheduleStrength >= 75th percentile
    // Compute schedule strength per roster as mean opponent pointsFor (fallback to opponent adjustedDPR)
    const rosterMap = {};
    Object.values(seasonMetrics).forEach(s => { rosterMap[String(s.rosterId)] = s; });
    const oppStrength = {}; // rosterId -> mean opponent pointsFor
    matchups.forEach(m => {
      const w1 = String(m.team1_roster_id);
      const w2 = String(m.team2_roster_id);
      if (rosterMap[w1] && rosterMap[w2]) {
        oppStrength[w1] = oppStrength[w1] || [];
        oppStrength[w2] = oppStrength[w2] || [];
        oppStrength[w1].push(rosterMap[w2].pointsFor || 0);
        oppStrength[w2].push(rosterMap[w1].pointsFor || 0);
      }
    });
    const strengths = Object.keys(oppStrength).map(k => mean(oppStrength[k]));
    const champEntries = rosterEntries.filter(r => r.isChampion);
    champEntries.forEach(ch => {
      const sVal = mean(oppStrength[String(ch.rosterId)] || []);
      const p = percentileRank(strengths, sVal) * 100;
      if (p >= 75) {
        const badge = { id: `heavyweight_${season}_${ch.ownerId}`, name: 'Heavyweight Champion', category: 'champion', year: season, teamId: ch.ownerId };
        (badgesByTeam[ch.ownerId] = badgesByTeam[ch.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
    });

    // Comeback Kid: champion and started 0-5
    const firstFiveWins = {}; // rosterId -> wins in first 5 weeks
    // build a map of week-scores for roster
    const rosterWeekScores = {};
    matchups.forEach(m => {
      const week = Number(m.week || m.w || 0);
      const r1 = String(m.team1_roster_id);
      const r2 = String(m.team2_roster_id);
      rosterWeekScores[r1] = rosterWeekScores[r1] || {};
      rosterWeekScores[r2] = rosterWeekScores[r2] || {};
      rosterWeekScores[r1][week] = Number(m.team1_score || m.team1Score || 0);
      rosterWeekScores[r2][week] = Number(m.team2_score || m.team2Score || 0);
      rosterWeekScores[r1]._opp = rosterWeekScores[r1]._opp || {};
    });
    // count wins in weeks 1-5 using matchups list
    for (let wk = 1; wk <= 5; wk++) {
      matchups.forEach(m => {
        const week = Number(m.week || m.w || 0);
        if (week !== wk) return;
        const r1 = String(m.team1_roster_id);
        const r2 = String(m.team2_roster_id);
        const s1 = Number(m.team1_score || m.team1Score || 0);
        const s2 = Number(m.team2_score || m.team2Score || 0);
        if (!isNaN(s1) && !isNaN(s2)) {
          if (s1 > s2) firstFiveWins[r1] = (firstFiveWins[r1] || 0) + 1;
          if (s2 > s1) firstFiveWins[r2] = (firstFiveWins[r2] || 0) + 1;
        }
      });
    }
    champEntries.forEach(ch => {
      const rosterId = String(ch.rosterId);
      const wins = firstFiveWins[rosterId] || 0;
      if (wins === 0) {
        const badge = { id: `comeback_${season}_${ch.ownerId}`, name: 'Comeback Kid', category: 'champion', year: season, teamId: ch.ownerId };
        (badgesByTeam[ch.ownerId] = badgesByTeam[ch.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
    });

    // Against All Odds: champion with lowest luckRating among champions or below 25th percentile of luckRating
    const lucks = rosterEntries.map(r => r.luckRating || 0).filter(v => typeof v === 'number');
    const luckSorted = [...lucks].sort((a, b) => a - b);
    champEntries.forEach(ch => {
      const lr = (seasonMetrics && Object.values(seasonMetrics).find(s => s.ownerId === ch.ownerId)?.luckRating) || 0;
      const p = percentileRank(luckSorted, lr) * 100;
      if (p <= 25) {
        const badge = { id: `against_odds_${season}_${ch.ownerId}`, name: 'Against All Odds', category: 'champion', year: season, teamId: ch.ownerId };
        (badgesByTeam[ch.ownerId] = badgesByTeam[ch.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
    });

    // TODO: Draft King, Action King, Silverback-To-Back, The Gauntlet, Massacre, Double Up, etc.

  }); // end seasons loop

  // --- Draft & Transaction badges (per-season) ---
  try {
    seasons.forEach(season => {
      // Draft King / Worst Draft Pick
      const seasonPicks = (draftPicksBySeason && draftPicksBySeason[season]) || [];
      if (seasonPicks && seasonPicks.length > 0) {
        const totalDraftPicks = seasonPicks.length;
        const expectedMap = generateExpectedVorpByPickSlot(totalDraftPicks);

        const ownerDraftValue = {};
        const pickDeltas = [];

        seasonPicks.forEach(rawPick => {
          // Normalize pick number and owner
          const pickNo = Number(rawPick.pick_no || rawPick.pick_number || rawPick.overall_pick || 0) || 0;
          const owner = String(rawPick.picked_by || rawPick.owner_id || rawPick.picked_by || 'unknown');

          // Enrich the pick for calculations (pass a safe getTeamName fallback)
    // Pass through getTeamName so pick enrichment can resolve per-season team names correctly
    const enriched = enrichPickForCalculations(rawPick, usersData || [], historicalData || {}, Number(season), getTeamName || (() => ''));

          // Calculate player value using project utilities (this uses fantasy_points on the enriched pick)
          const playerValue = calculatePlayerValue(enriched) || 0;

          // Aggregate per-owner draft value for Draft King
          ownerDraftValue[owner] = (ownerDraftValue[owner] || 0) + playerValue;

          // Compute expected VORP for this pick slot and delta
          const expected = expectedMap.get(pickNo) || 0;
          const delta = playerValue - expected;

          pickDeltas.push({ pick: enriched, rawPick, owner, pickNo, delta, expected, playerValue });
        });

        // Draft King = owner with highest total draft pick value for the season
        const draftKingOwner = Object.keys(ownerDraftValue).sort((a, b) => ownerDraftValue[b] - ownerDraftValue[a])[0];
        if (draftKingOwner && (ownerDraftValue[draftKingOwner] || 0) > 0) {
          const badge = { id: `draft_king_${season}`, name: 'Draft King', displayName: 'Draft King', category: 'draft', year: season, teamId: draftKingOwner, metadata: { draftValue: ownerDraftValue[draftKingOwner] } };
          (badgesByTeam[draftKingOwner] = badgesByTeam[draftKingOwner] || []).push(badge);
          recentBadges.push(badge);
        }

        // Identify worst and best picks by delta (largest negative delta == worst, largest positive delta == best)
        const sortedByDelta = pickDeltas.slice().sort((a, b) => a.delta - b.delta);
        const worstPick = sortedByDelta[0];
        const bestPick = sortedByDelta[sortedByDelta.length - 1];
        // Debug detection helper: supports URL param, global window flag, or env var
        const isBadgeDebugEnabled = () => {
          try {
            if (typeof window !== 'undefined') {
              if (window.__BADGE_DEBUG) return true;
              if (window.location && window.location.search && window.location.search.indexOf('badgeDebug=1') !== -1) return true;
            }
            if (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BADGE_DEBUG === '1' || process.env.BADGE_DEBUG === '1')) return true;
          } catch (e) { /* ignore */ }
          return false;
        };

        // Unconditional per-season logging so developers can verify pick processing in constrained previews
        try {
          console.log(`computeBadges: season ${season} - seasonPicks=${seasonPicks.length}, pickDeltas=${pickDeltas.length}`);
          if (worstPick) {
            const wTeam = worstPick.pick?.picked_by_team_name || worstPick.pick?.picked_by_team || worstPick.rawPick?.picked_by_team || worstPick.owner || 'unknown';
            console.log(`computeBadges: season ${season} WORST_PICK -> pickNo=${worstPick.pickNo}, owner=${worstPick.owner}, teamName=${wTeam}, player=${worstPick.pick?.player_name || worstPick.rawPick?.player_name || 'unknown'}, delta=${worstPick.delta}`);
          } else {
            console.log(`computeBadges: season ${season} WORST_PICK -> none`);
          }
          if (bestPick) {
            const bTeam = bestPick.pick?.picked_by_team_name || bestPick.pick?.picked_by_team || bestPick.rawPick?.picked_by_team || bestPick.owner || 'unknown';
            console.log(`computeBadges: season ${season} BEST_PICK  -> pickNo=${bestPick.pickNo}, owner=${bestPick.owner}, teamName=${bTeam}, player=${bestPick.pick?.player_name || bestPick.rawPick?.player_name || 'unknown'}, delta=${bestPick.delta}`);
          } else {
            console.log(`computeBadges: season ${season} BEST_PICK -> none`);
          }
        } catch (e) { /* ignore per-season debug logging errors */ }
        try {
          // Toggleable debug: if the url contains ?badgeDebug=1 log worst pick info for developer inspection
          let debugOn = false;
          try {
            if (typeof window !== 'undefined' && window.location && window.location.search) {
              debugOn = !!(window.location.search.indexOf('badgeDebug=1') !== -1);
            }
          } catch (err) { debugOn = false; }
          // Also emit a concise worst-pick line (unconditional) for quick scanning
          try { if (worstPick) console.log(`computeBadges: worst pick for season ${season}: pickNo=${worstPick.pickNo}, owner=${worstPick.owner}, player=${worstPick.pick?.player_name || worstPick.enriched?.player_name || worstPick.playerValue}, delta=${worstPick.delta}`); } catch (e) {}
        } catch (err) { /* ignore debug logging errors */ }
        // Award Best Draft Pick (single pick with largest positive delta) as an achievement
        if (bestPick && bestPick.delta > 0) {
          const ownerBest = bestPick.owner;
          const badgeBest = { id: `best_draft_pick_${season}`, name: 'Best Draft Pick', displayName: 'Best Draft Pick', category: 'draft', year: season, teamId: ownerBest, metadata: { delta: bestPick.delta, expected: bestPick.expected, playerValue: bestPick.playerValue, pick: bestPick.rawPick, pickNo: bestPick.pickNo } };
          (badgesByTeam[ownerBest] = badgesByTeam[ownerBest] || []).push(badgeBest);
          recentBadges.push(badgeBest);
        }

        // Award Worst Draft Pick as a blunder (goes into blunders category)
        if (worstPick && worstPick.delta < 0) {
          const owner = worstPick.owner;
          const badge = { id: `worst_draft_pick_${season}`, name: 'Worst Draft Pick', displayName: 'Worst Draft Pick', category: 'blunder', year: season, teamId: owner, metadata: { delta: worstPick.delta, expected: worstPick.expected, playerValue: worstPick.playerValue, pick: worstPick.rawPick, pickNo: worstPick.pickNo } };
          (badgesByTeam[owner] = badgesByTeam[owner] || []).push(badge);
          recentBadges.push(badge);
        }
      }

      // Action King: team with the most transactions in the calendar year of the season
      if (transactions && transactions.length > 0 && historicalData && historicalData.rostersBySeason && historicalData.rostersBySeason[season]) {
        const rosterMap = {};
        (historicalData.rostersBySeason[season] || []).forEach(r => { rosterMap[String(r.roster_id)] = r.owner_id; });
        const txCounts = {};
        transactions.forEach(tx => {
          // transaction.created may be in seconds
          const created = tx.created ? Number(tx.created) : null;
          let year = null;
          if (created) {
            const d = new Date(created * (created < 9999999999 ? 1000 : 1)); // heuristic
            year = d.getFullYear();
          }
          if (String(year) !== String(season)) return; // only count transactions during the season year
          // roster_ids may indicate affected rosters
          const rosterIds = tx.roster_ids || [];
          rosterIds.forEach(rid => {
            const owner = rosterMap[String(rid)];
            if (owner) txCounts[owner] = (txCounts[owner] || 0) + 1;
          });
        });
        const actionKing = Object.keys(txCounts).sort((a, b) => txCounts[b] - txCounts[a])[0];
        if (actionKing && txCounts[actionKing] > 0) {
          const badge = { id: `action_king_${season}`, name: 'Action King', displayName: 'Action King', category: 'transaction', year: season, teamId: actionKing, accent: 'blue', metadata: { txCount: txCounts[actionKing] } };
          (badgesByTeam[actionKing] = badgesByTeam[actionKing] || []).push(badge);
          recentBadges.push(badge);
        }
        // Season Transactions: executed >=50 transactions in a single season
        Object.keys(txCounts).forEach(owner => {
          const count = txCounts[owner] || 0;
          if (count >= 50) {
            const badge = { id: `season_transactions_${season}_${owner}`, name: 'Season Transactions', displayName: 'Season Transactions', category: 'transaction', year: season, teamId: owner, metadata: { txCount: count } };
            (badgesByTeam[owner] = badgesByTeam[owner] || []).push(badge);
            recentBadges.push(badge);
          }
        });
      }
    });
  } catch (e) {
    // Fail gracefully: don't prevent other badges from being returned
    try { const logger = require('./logger').default; logger.error('computeBadges: error computing draft/transaction badges', e); } catch (err) { }
  }

  // Silverback-To-Back: runner-up consecutive seasons by ownerId
  seasons.forEach((season, idx) => {
    if (idx === 0) return;
    const prev = seasons[idx - 1];
    const curMetrics = processedSeasonalRecords[season] || {};
    const prevMetrics = processedSeasonalRecords[prev] || {};
    Object.values(curMetrics).forEach(s => {
      if (s.isRunnerUp) {
        const owner = s.ownerId;
        const wasRunnerUpPrev = Object.values(prevMetrics).some(p => p.ownerId === owner && p.isRunnerUp);
        if (wasRunnerUpPrev) {
          const badge = { id: `silverback_twoback_${season}_${owner}`, name: 'Silverback-To-Back', category: 'champion', year: season, teamId: owner };
          (badgesByTeam[owner] = badgesByTeam[owner] || []).push(badge);
          recentBadges.push(badge);
        }
      }
    });
  });

  // Sort recentBadges by year descending
  recentBadges.sort((a, b) => b.year - a.year);
  // --- League-wide career and tenure badges (auto-award) ---
  try {
    // Aggregate career wins and seasons played per owner across processedSeasonalRecords
    // and determine the season when each 25-win milestone was crossed.
    const careerWinsByOwner = {}; // ownerId -> total wins
    const seasonsByOwner = {}; // ownerId -> Set of seasons
    const crossingSeasonByOwner = {}; // ownerId -> { milestone: season }

    // iterate seasons in ascending order so we can record the season a milestone is crossed
    seasons.forEach(season => {
      const seasonMetrics = processedSeasonalRecords[season] || {};
      Object.values(seasonMetrics).forEach(entry => {
        const owner = entry.ownerId || entry.owner_id || String(entry.ownerId || '');
        if (!owner) return;
        const wins = Number(entry.wins || 0) || 0;
        seasonsByOwner[owner] = seasonsByOwner[owner] || new Set();
        seasonsByOwner[owner].add(Number(season));

        // compute previous cumulative and update
        const prev = careerWinsByOwner[owner] || 0;
        const curr = prev + wins;
        careerWinsByOwner[owner] = curr;

        // check for any 25-win milestones crossed in this season
        crossingSeasonByOwner[owner] = crossingSeasonByOwner[owner] || {};
        let nextMilestone = Math.floor(prev / 25) * 25 + 25; // first milestone > prev
        while (nextMilestone <= curr) {
          if (!crossingSeasonByOwner[owner][nextMilestone]) crossingSeasonByOwner[owner][nextMilestone] = Number(season);
          nextMilestone += 25;
        }
      });
    });

    // Award Total Wins badges at every 25 wins milestone (25,50,75,...) and set year to season crossed
    Object.keys(careerWinsByOwner).forEach(owner => {
      const total = careerWinsByOwner[owner] || 0;
      const milestone = Math.floor(total / 25) * 25;
      for (let m = 25; m <= milestone; m += 25) {
        const id = `total_wins_${m}_${owner}`;
        const already = (badgesByTeam[owner] || []).some(b => String(b.id) === id);
        if (already) continue;
        const crossedSeason = (crossingSeasonByOwner[owner] && crossingSeasonByOwner[owner][m]) || null;
        const badge = { id, name: `Total Wins - ${m}`, displayName: `Total Wins - ${m}`, category: 'league', year: crossedSeason, teamId: owner, accent: 'leagueAccent', metadata: { totalWins: total, milestone: m } };
        (badgesByTeam[owner] = badgesByTeam[owner] || []).push(badge);
        recentBadges.push(badge);
      }

      // Tenure badges: Veteran Presence (>=5 seasons) and Old Timer (>=10 seasons)
      const seasonsCount = seasonsByOwner[owner] ? seasonsByOwner[owner].size : 0;
      if (seasonsCount >= 5) {
        const id = `veteran_presence_${owner}`;
        const already = (badgesByTeam[owner] || []).some(b => String(b.id) === id);
        if (!already) {
          const badge = { id, name: 'Veteran Presence', displayName: 'Veteran Presence', category: 'league', year: null, teamId: owner, accent: 'leagueAccent', metadata: { seasons: seasonsCount } };
          (badgesByTeam[owner] = badgesByTeam[owner] || []).push(badge);
          recentBadges.push(badge);
        }
      }
      if (seasonsCount >= 10) {
        const id = `old_timer_${owner}`;
        const already = (badgesByTeam[owner] || []).some(b => String(b.id) === id);
        if (!already) {
          const badge = { id, name: 'Old Timer', displayName: 'Old Timer', category: 'league', year: null, teamId: owner, accent: 'leagueAccent', metadata: { seasons: seasonsCount } };
          (badgesByTeam[owner] = badgesByTeam[owner] || []).push(badge);
          recentBadges.push(badge);
        }
      }
    });
  } catch (e) {
    try { const logger = require('./logger').default; logger.error('computeBadges: error computing career/tenure badges', e); } catch (err) { }
  }
  // Post-process all badges to ensure they have a human-friendly displayName, an icon, accent, and timestamp
  const tokenMap = {
    'season_title': 'Season Title',
  'points_title': 'Points Title',
    'allplay_title': 'Season All-Play Title',
    'triple_crown': 'Triple Crown',
    'champion': 'Champion',
    'runner_up': 'Runner Up',
    'third_place': '3rd Place',
    'peak_performance': 'Peak Performance',
    'shootout': 'The Shootout',
    'heavyweight': 'Heavyweight Champion',
    'comeback': 'Comeback Kid',
    'against_odds': 'Against All Odds',
    'draft_king': 'Draft King',
    'worst_draft_pick': 'Worst Draft Pick',
    'action_king': 'Action King'
  };

  // Add explicit friendly mappings for new badges
  tokenMap['massacre'] = 'Massacre';
  tokenMap['double_up'] = 'Double Up';
  tokenMap['micro_victory'] = 'Micro Victory';
  tokenMap['small_victory'] = 'Small Victory';
  tokenMap['firing_squad'] = 'Firing Squad';
  tokenMap['thread_the_needle'] = 'Thread The Needle';
  tokenMap['bully'] = 'Bully';
  tokenMap['season_transactions'] = 'Season Transactions';

  const iconMap = {
    'season': '🏆',
    'season-tier': '🏅',
    'champion': '🏆',
    // Use a token string for matchup so the UI can map it to a shared SVG asset
    'matchup': 'matchup-icon',
    'massacre': '💥',
    'double_up': '2️⃣',
    'micro_victory': '🔹',
    'small_victory': '🔸',
    'firing_squad': '🔥',
    'draft': '🧠',
    'draft-blunder': '💀',
    'transaction': '🔁',
    'blunder': '💩',
  };

  function titleize(s) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function friendlyFromId(id) {
    if (!id) return '';
    // Remove trailing owner ids (long numbers) and year suffixes
    let v = id.replace(/_(\d{4})_(\d{9,})$/, '_$1'); // keep year but drop owner id
    v = v.replace(/_(\d{9,})$/, '');
    v = v.replace(/^(bronze|silver|gold|diamond)_season/, '$1 Season');
    v = v.replace(/^shootout_/, 'Shootout ');
    v = v.replace(/^peak_performance_/, 'Peak Performance ');
    // Use token map if contains known token
    for (const token in tokenMap) {
      if (v.indexOf(token) !== -1) return tokenMap[token];
    }
    // Fallback: titleize the id
    return titleize(v);
  }

  function ensureBadgeFields(b) {
    if (!b) return b;
    if (!b.displayName) {
      if (b.name) b.displayName = b.name;
      else b.displayName = friendlyFromId(b.id) || titleize(String(b.id || 'Badge'));
    }
    if (!b.icon) {
      b.icon = iconMap[b.category] || '🏅';
    }
    if (!b.accent) {
      // choose accent by category
      // Default champions use a custom championAccent color (requested: #EFBF04)
      if (b.id && String(b.id).toLowerCase().indexOf('season_all_play') !== -1) b.accent = 'championAccent';
      else if (b.id && String(b.id).toLowerCase().indexOf('allplay') !== -1) b.accent = 'championAccent';
      else if (b.id && String(b.id).toLowerCase().indexOf('season_title') !== -1) b.accent = 'championAccent';
      else if (b.category === 'champion') b.accent = 'championAccent';
      else if (b.category === 'season') b.accent = 'yellow';
  // Matchup badges should use the matchupAccent so the UI can apply the special border
  else if (b.id && (String(b.id).indexOf('massacre') !== -1 || String(b.id).indexOf('shootout') !== -1 || String(b.id).indexOf('peak_performance') !== -1)) b.accent = 'matchupAccent';
  else if (b.id && (String(b.id).indexOf('double_up') !== -1 || String(b.id).indexOf('micro_victory') !== -1 || String(b.id).indexOf('small_victory') !== -1 || String(b.id).indexOf('nano_victory') !== -1 || String(b.id).indexOf('firing_squad') !== -1 || String(b.id).indexOf('perfectly_peaked') !== -1 || String(b.id).indexOf('thread_the_needle') !== -1 || String(b.id).indexOf('thread-the-needle') !== -1 || String(b.id).indexOf('thread') !== -1 || String(b.id).indexOf('bully') !== -1)) b.accent = 'matchupAccent';
      else if (b.id && String(b.id).indexOf('diamond_season') !== -1) b.accent = 'diamond';
      else if (b.category === 'matchup') b.accent = 'red';
      else if (b.category && b.category.indexOf('draft') !== -1) b.accent = 'purple';
      else if (b.category === 'season-tier') b.accent = 'blue';
      else if (b.category === 'blunder' || b.category === 'draft-blunder') b.accent = 'red';
      else b.accent = 'gray';
    }
    if (!b.timestamp) {
      if (b.year) {
        // set to end of year
        b.timestamp = new Date(Number(b.year), 11, 31).getTime();
      } else {
        b.timestamp = Date.now();
      }
    }
    return b;
  }

  Object.keys(badgesByTeam).forEach(teamId => {
    badgesByTeam[teamId] = (badgesByTeam[teamId] || []).map(b => ensureBadgeFields(b));
  });
  for (let i = 0; i < recentBadges.length; i++) recentBadges[i] = ensureBadgeFields(recentBadges[i]);

  return { badgesByTeam, recentBadges };
}

export default { computeBadges };

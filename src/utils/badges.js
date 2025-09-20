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
  // Track champions by season for drought calculations
  const championsBySeason = {};

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

    // Points Runner-Up and 3rd Place: award badges to the 2nd and 3rd teams by total pointsFor for the season
    try {
      const sortedByPoints = [...rosterEntries].sort((a, b) => b.pointsFor - a.pointsFor);
      if (sortedByPoints.length >= 2) {
        const runnerUp = sortedByPoints[1];
        if (runnerUp) {
          const badge = { id: `points_runnerup_${season}_${runnerUp.ownerId}`, name: 'Points Runner-Up', category: 'season', year: season, teamId: runnerUp.ownerId };
          (badgesByTeam[runnerUp.ownerId] = badgesByTeam[runnerUp.ownerId] || []).push(badge);
          recentBadges.push(badge);
        }
      }
      if (sortedByPoints.length >= 3) {
        const third = sortedByPoints[2];
        if (third) {
          const badge = { id: `points_third_${season}_${third.ownerId}`, name: '3rd Place Points', category: 'season', year: season, teamId: third.ownerId };
          (badgesByTeam[third.ownerId] = badgesByTeam[third.ownerId] || []).push(badge);
          recentBadges.push(badge);
        }
      }
    } catch (e) { /* ignore points badge creation errors */ }

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
      // record champion for this season (if multiple champions, keep array)
      if (!championsBySeason[season]) championsBySeason[season] = [];
      championsBySeason[season].push(c.ownerId);
    });

    // Runner Up and 3rd Place badges (if provided in season metrics)
    const runners = rosterEntries.filter(r => r.isRunnerUp);
    runners.forEach(r => {
      const badge = { id: `runner_up_${season}_${r.ownerId}`, name: 'Runner Up', category: 'champion', year: season, teamId: r.ownerId };
      (badgesByTeam[r.ownerId] = badgesByTeam[r.ownerId] || []).push(badge);
      recentBadges.push(badge);
    });
    const thirds = rosterEntries.filter(r => r.isThirdPlace);
    thirds.forEach(r => {
      const badge = { id: `third_place_${season}_${r.ownerId}`, name: '3rd Place', category: 'champion', year: season, teamId: r.ownerId };
      (badgesByTeam[r.ownerId] = badgesByTeam[r.ownerId] || []).push(badge);
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

    // DPR-based season blunders (Iron / Wood / Clay) — user-specified ranges
    rosterEntries.forEach(r => {
      const dpr = Number(r.adjustedDPR || 0);
      if (!dpr || isNaN(dpr)) return;
      // Iron: 0.925 - 0.999
      if (dpr <= 0.999 && dpr >= 0.925) {
        const badge = { id: `iron_season_${season}_${r.ownerId}`, name: 'Iron Season', displayName: 'Iron Season', category: 'blunder', year: season, teamId: r.ownerId, metadata: { adjustedDPR: dpr } };
        (badgesByTeam[r.ownerId] = badgesByTeam[r.ownerId] || []).push(badge);
        recentBadges.push(badge);
      } else if (dpr <= 0.924 && dpr >= 0.85) {
        // Wood: 0.850 - 0.924
        const badge = { id: `wood_season_${season}_${r.ownerId}`, name: 'Wood Season', displayName: 'Wood Season', category: 'blunder', year: season, teamId: r.ownerId, metadata: { adjustedDPR: dpr } };
        (badgesByTeam[r.ownerId] = badgesByTeam[r.ownerId] || []).push(badge);
        recentBadges.push(badge);
      } else if (dpr <= 0.849) {
        // Clay: <= 0.849
        const badge = { id: `clay_season_${season}_${r.ownerId}`, name: 'Clay Season', displayName: 'Clay Season', category: 'blunder', year: season, teamId: r.ownerId, metadata: { adjustedDPR: dpr } };
        (badgesByTeam[r.ownerId] = badgesByTeam[r.ownerId] || []).push(badge);
        recentBadges.push(badge);
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

    // Cursed: team with the least luck in a season (lowest luckRating) — mark as blunder
    try {
      const unluckiest = [...rosterEntries].sort((a, b) => (a.luckRating || 0) - (b.luckRating || 0))[0];
      if (unluckiest) {
        const badge = { id: `cursed_${season}_${unluckiest.ownerId}`, name: 'Cursed', displayName: 'Cursed', category: 'blunder', year: season, teamId: unluckiest.ownerId, metadata: { luckRating: unluckiest.luckRating || 0 } };
        (badgesByTeam[unluckiest.ownerId] = badgesByTeam[unluckiest.ownerId] || []).push(badge);
        recentBadges.push(badge);
      }
    } catch (e) { /* ignore */ }

    // Peak Performance: team with highest single-game score in season. Need matchups to detect.
    // Collect matchups from multiple possible locations in historicalData so we don't miss regular season, playoff, or bracket games.
    let matchups = [];
    try {
      if (historicalData) {
        const k = String(season);
        const candidates = [
          (historicalData.matchupsBySeason && (historicalData.matchupsBySeason[season] || historicalData.matchupsBySeason[k])),
          (historicalData.matchups && (historicalData.matchups[season] || historicalData.matchups[k])),
          (historicalData.allMatchups && (historicalData.allMatchups[season] || historicalData.allMatchups[k])),
          (historicalData.winnersBracketBySeason && (historicalData.winnersBracketBySeason[season] || historicalData.winnersBracketBySeason[k])),
          (historicalData.losersBracketBySeason && (historicalData.losersBracketBySeason[season] || historicalData.losersBracketBySeason[k]))
        ];
        candidates.forEach(c => { if (Array.isArray(c)) matchups = matchups.concat(c); });
      }
    } catch (e) { matchups = []; }
    // fallback to empty array if none found
    matchups = matchups || [];
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
    // We'll scan matchups again to find blowouts, doubles, narrow wins, and matchup blunders.
    // Declare trackers in outer scope so post-processing (loser-side blunders) can access them
    let highestBlowout = { margin: -Infinity, rosterId: null, opponentRosterId: null, matchup: null, week: null };
    let smallestMargin = { margin: Infinity, rosterId: null, opponentRosterId: null, matchup: null, week: null };
    let highestPointsShare = { share: -Infinity, rosterId: null, total: 0, score: 0, week: null };
    let lowestPointsShare = { share: Infinity, rosterId: null, total: 0, score: 0, week: null };
    let lowestTotalMatchup = { total: Infinity, matchup: null, week: null, rosterId1: null, rosterId2: null };
    const headToHeadWins = {};
    const weeklyScores = {};

    try {
      matchups.forEach(m => {
        // Track highest blowout (largest margin) per season
        const s1 = Number(m.team1_score || m.team1Score || 0);
        const s2 = Number(m.team2_score || m.team2Score || 0);
        const r1 = String(m.team1_roster_id);
        const r2 = String(m.team2_roster_id);
        const wk = m.week || m.w || null;
        const total = (s1 || 0) + (s2 || 0);

        // track lowest total matchup for The Snoozer
        if (typeof total === 'number' && total < lowestTotalMatchup.total) {
          lowestTotalMatchup = { total, matchup: m, week: wk, rosterId1: r1, rosterId2: r2 };
        }

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
          if (share1 < lowestPointsShare.share) lowestPointsShare = { share: share1, rosterId: r1, total, score: s1, week: wk };
          if (share2 < lowestPointsShare.share) lowestPointsShare = { share: share2, rosterId: r2, total, score: s2, week: wk };
        }

        // collect weekly scores for Spoiled Goods
        if (wk !== null && wk !== undefined) {
          weeklyScores[wk] = weeklyScores[wk] || [];
          weeklyScores[wk].push({ rosterId: r1, score: s1, matchup: m });
          weeklyScores[wk].push({ rosterId: r2, score: s2, matchup: m });
        }

        // Double Up: if one team's score is at least 2x the opponent's score
        if ((s2 > 0 && s1 >= 2 * s2) || (s1 > 0 && s2 >= 2 * s1)) {
          const winnerRid = s1 >= 2 * s2 ? r1 : r2;
          const loserRid = s1 >= 2 * s2 ? r2 : r1;
          const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(winnerRid));
          const loserEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(loserRid));
          if (ownerEntry) {
            const badge = { id: `double_up_${season}_${ownerEntry.ownerId}_${wk || ''}`, name: 'Double Up', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { opponent: loserRid, scores: { s1, s2, total }, week: wk } };
            (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
            recentBadges.push(badge);
          }
          // also award the losing-side blunder "Doubled Up"
          if (loserEntry) {
            const bl = { id: `doubled_up_${season}_${loserEntry.ownerId}_${wk || ''}`, name: 'Doubled Up', displayName: 'Doubled Up', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { opponent: winnerRid, scores: { s1, s2, total }, week: wk } };
            (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
            recentBadges.push(bl);
          }
        }

        // Victory categories by margin (user requested thresholds):
        // A Small Victory: 1.00 - 2.00 points
        // A Micro Victory: 0.50 - 0.99 points
        // A Nano Victory: 0.01 - 0.49 points
        // Losing-side blunder 'A Small Defeat' for losses under 1.00 points
        const diff = Math.abs(s1 - s2);
        if (diff > 0) {
          const winnerRid = s1 > s2 ? r1 : r2;
          const loserRid = s1 > s2 ? r2 : r1;
          const ownerEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(winnerRid));
          const loserEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(loserRid));

          // Winner badges
          if (diff >= 1 && diff <= 2) {
            if (ownerEntry) {
              const badge = { id: `small_victory_${season}_${ownerEntry.ownerId}_${wk || ''}`, name: 'A Small Victory', displayName: 'A Small Victory', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { margin: diff, week: wk } };
              (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
              recentBadges.push(badge);
            }
          } else if (diff >= 0.5 && diff <= 0.99) {
            if (ownerEntry) {
              const badge = { id: `micro_victory_${season}_${ownerEntry.ownerId}_${wk || ''}`, name: 'A Micro Victory', displayName: 'A Micro Victory', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { margin: diff, week: wk } };
              (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
              recentBadges.push(badge);
            }
          } else if (diff >= 0.01 && diff <= 0.49) {
            if (ownerEntry) {
              const badge = { id: `nano_victory_${season}_${ownerEntry.ownerId}_${wk || ''}`, name: 'A Nano Victory', displayName: 'A Nano Victory', category: 'matchup', year: season, teamId: ownerEntry.ownerId, metadata: { margin: diff, week: wk } };
              (badgesByTeam[ownerEntry.ownerId] = badgesByTeam[ownerEntry.ownerId] || []).push(badge);
              recentBadges.push(badge);
            }
          }

          // Losing-side blunders by margin (user requested):
          // A Small Defeat - loss by 1.00 - 2.00
          // A Nano Defeat - loss by 0.50 - 0.99
          // A Micro Defeat - loss by 0.01 - 0.49
          if (loserEntry) {
            if (diff >= 1 && diff <= 2) {
              const bl = { id: `small_defeat_${season}_${loserEntry.ownerId}_${wk || ''}`, name: 'A Small Defeat', displayName: 'A Small Defeat', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { margin: diff, week: wk } };
              (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
              recentBadges.push(bl);
            } else if (diff >= 0.5 && diff <= 0.99) {
              const bl = { id: `nano_defeat_${season}_${loserEntry.ownerId}_${wk || ''}`, name: 'A Nano Defeat', displayName: 'A Nano Defeat', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { margin: diff, week: wk } };
              (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
              recentBadges.push(bl);
            } else if (diff >= 0.01 && diff <= 0.49) {
              const bl = { id: `micro_defeat_${season}_${loserEntry.ownerId}_${wk || ''}`, name: 'A Micro Defeat', displayName: 'A Micro Defeat', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { margin: diff, week: wk } };
              (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
              recentBadges.push(bl);
            }
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

    // Post-process to award additional matchup blunders (losing-side awards)
    try {
      // The Bye Week - losing side of the largest blowout in the season (i.e., the team that lost by the largest margin)
      if (highestBlowout && highestBlowout.rosterId) {
        // the losing roster is opponentRosterId
        const losingRid = highestBlowout.opponentRosterId;
        const loserEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(losingRid));
        if (loserEntry) {
          const bl = { id: `bye_week_${season}_${loserEntry.ownerId}`, name: 'The Bye Week', displayName: 'The Bye Week', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { margin: highestBlowout.margin, week: highestBlowout.week, opponentRosterId: highestBlowout.rosterId } };
          (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
          recentBadges.push(bl);
        }
      }

      // The Snoozer - the losing team in the lowest total scoring matchup for the season (both teams low)
      if (lowestTotalMatchup && lowestTotalMatchup.matchup) {
        const m = lowestTotalMatchup.matchup;

    // Transaction-level blunders: Broke Ass — team with the most transaction fees in a season
    // We expect `transactions` to be an array of transaction objects with fields: { season, team_id, fee } or similar.
    try {
      // Aggregate fees per owner for this season
      const feeTotals = {};
      if (Array.isArray(transactions) && transactions.length > 0) {
        transactions.forEach(t => {
          const s = Number(t.season || t.year || t.season_id || season);
          if (s !== season) return; // only consider current loop season
          // Some transactions have an explicit fee field, others might encode fee in metadata
          const team = String(t.team_id || t.owner_id || t.roster_id || t.payer || '');
          const fee = Number(t.fee || t.fees || (t.metadata && t.metadata.fee) || 0) || 0;
          if (!team) return;
          feeTotals[team] = (feeTotals[team] || 0) + fee;
        });
      }

      // Fallback: if transactions array wasn't provided, check seasonMetrics for a fees field
      if (Object.keys(feeTotals).length === 0) {
        Object.values(seasonMetrics).forEach(s => {
          const owner = String(s.ownerId || s.ownerId || s.rosterId || s.teamId || '');
          const fee = Number(s.transactionFees || s.fees || s.transaction_fee_total || 0) || 0;
          if (!owner) return;
          feeTotals[owner] = (feeTotals[owner] || 0) + fee;
        });
      }

      // Determine highest fee total
      const entries = Object.keys(feeTotals).map(k => ({ ownerId: k, total: feeTotals[k] }));
      if (entries.length > 0) {
        entries.sort((a, b) => b.total - a.total);
        const top = entries[0];
        if (top && top.total > 0) {
          const bl = { id: `broke_ass_${season}_${top.ownerId}`, name: 'Broke Ass', displayName: 'Broke Ass', category: 'blunder', year: season, teamId: top.ownerId, metadata: { transactionFees: top.total } };
          (badgesByTeam[top.ownerId] = badgesByTeam[top.ownerId] || []).push(bl);
          recentBadges.push(bl);
        }
      }
    } catch (e) { /* ignore transaction badge errors */ }
        const s1 = Number(m.team1_score || m.team1Score || 0);
        const s2 = Number(m.team2_score || m.team2Score || 0);
        const loserRid = s1 > s2 ? String(m.team2_roster_id) : String(m.team1_roster_id);
        const loserEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(loserRid));
        if (loserEntry) {
          const bl = { id: `snoozer_${season}_${loserEntry.ownerId}_${lowestTotalMatchup.week || ''}`, name: 'The Snoozer', displayName: 'The Snoozer', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { total: lowestTotalMatchup.total, week: lowestTotalMatchup.week } };
          (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
          recentBadges.push(bl);
        }
      }

      // The Undercard - the team with the lowest points-share in any matchup for the season (loser)
      if (lowestPointsShare && lowestPointsShare.rosterId) {
        const loserRid = lowestPointsShare.rosterId;
        const loserEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(loserRid));
        if (loserEntry) {
          const bl = { id: `undercard_${season}_${loserEntry.ownerId}_${lowestPointsShare.week || ''}`, name: 'The Undercard', displayName: 'The Undercard', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { share: lowestPointsShare.share, score: lowestPointsShare.score, total: lowestPointsShare.total, week: lowestPointsShare.week } };
          (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
          recentBadges.push(bl);
        }
      }

      // Spoiled Goods - losing with the second-highest points for that week (i.e., you had the 2nd most points but lost to the week's top scorer)
      Object.keys(weeklyScores).forEach(wk => {
        const scores = weeklyScores[wk] || [];
        if (scores.length < 2) return;
        // sort descending by score
        const sorted = scores.slice().sort((a, b) => b.score - a.score);
        const top = sorted[0];
        const second = sorted[1];
        // find matchup where second lost to top
        if (top && second && top.score > second.score) {
          // ensure they faced each other
          const topMatch = top.matchup;
          const secondMatch = second.matchup;
          // if they are the same matchup, then second lost to top
          if (topMatch && secondMatch && topMatch === secondMatch) {
            const loserRid = second.rosterId;
            const loserEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(loserRid));
            if (loserEntry) {
              const bl = { id: `spoiled_goods_${season}_${loserEntry.ownerId}_${wk}`, name: 'Spoiled Goods', displayName: 'Spoiled Goods', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { week: wk, score: second.score, opponentScore: top.score } };
              (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
              recentBadges.push(bl);
            }
          }
        }
      });

      // Bullied (loser side) - if a roster is beaten by the same opponent 3+ times, award the loser a blunder
      Object.keys(headToHeadWins).forEach(k => {
        const rec = headToHeadWins[k] || { count: 0, weeks: [] };
        const count = rec.count || 0;
        if (count >= 3) {
          const [winnerRid, loserRid] = k.split('_');
          const loserEntry = Object.values(seasonMetrics).find(s => String(s.rosterId) === String(loserRid));
          if (loserEntry) {
            const wk = (rec.weeks && rec.weeks.length >= 3) ? rec.weeks[2] : (rec.weeks && rec.weeks.length ? rec.weeks[rec.weeks.length - 1] : null);
            const bl = { id: `bullied_${season}_${loserEntry.ownerId}_${winnerRid}`, name: 'Bullied', displayName: 'Bullied', category: 'blunder', year: season, teamId: loserEntry.ownerId, metadata: { opponentRosterId: winnerRid, lossesAgainst: count, week: wk } };
            (badgesByTeam[loserEntry.ownerId] = badgesByTeam[loserEntry.ownerId] || []).push(bl);
            recentBadges.push(bl);
          }
        }
      });
    } catch (e) { try { const logger = require('./logger').default; logger.error('computeBadges: error awarding matchup blunders', e); } catch (err) { } }

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

        // --- Top positional roster badges (Top QB/RB/WR/TE/K/DEF) ---
        try {
          // Top positional roster badges: prefer authoritative playerSeasonPoints if provided via historicalData.playerSeasonPoints
          const positionsToConsider = ['QB','RB','WR','TE','K','DEF'];

          // Build a mapping playerId -> ownerId for the season using draftPicksBySeason if available
          const playerOwnerMap = {};
          try {
            if (draftPicksBySeason && draftPicksBySeason[season]) {
              (draftPicksBySeason[season] || []).forEach(pick => {
                if (!pick) return;
                const pid = (pick.player_id || pick.playerId || pick.player || (pick.metadata && (pick.metadata.player_id || pick.metadata.id)));
                const owner = pick.picked_by || pick.owner_id || pick.picked_by_team || pick.roster_id || null;
                if (pid && owner) playerOwnerMap[String(pid)] = String(owner);
              });
            }
          } catch (errMap) { /* ignore mapping errors */ }

          // Determine source of player totals: historicalData.playerSeasonPoints (set by context) OR fallback to draftPicksBySeason enriched picks
          const playerSeasonPoints = (historicalData && historicalData.playerSeasonPoints) ? historicalData.playerSeasonPoints : null;

          if (playerSeasonPoints && playerSeasonPoints[season]) {
            // Use authoritative map: playerSeasonPoints[season] => { playerId: { playerId, playerName, position, totalPoints } }
            const posBuckets = {};
            Object.values(playerSeasonPoints[season]).forEach(p => {
              if (!p || !p.position) return;
              const pos = (p.position || '').toString().toUpperCase();
              if (positionsToConsider.indexOf(pos) === -1) return;
              posBuckets[pos] = posBuckets[pos] || [];
              posBuckets[pos].push(p);
            });

            positionsToConsider.forEach(pos => {
              const list = posBuckets[pos] || [];
              if (!list || list.length === 0) return;
              list.sort((a,b) => (b.totalPoints || 0) - (a.totalPoints || 0));
              const topPlayer = list[0];
              if (!topPlayer || (topPlayer.totalPoints || 0) <= 0) return;
              // Find owner via playerOwnerMap (draft pick) or via historicalData.rostersBySeason lookup
              let ownerId = playerOwnerMap[String(topPlayer.playerId)] || null;
              if (!ownerId && historicalData && historicalData.rostersBySeason && historicalData.rostersBySeason[season]) {
                // Fallback: check which roster had this player in draftPicksBySeason or roster snapshots
                const rosters = historicalData.rostersBySeason[season] || [];
                // Try to find pick record in draftPicksBySeason
                if (draftPicksBySeason && draftPicksBySeason[season]) {
                  const pickRec = (draftPicksBySeason[season] || []).find(pk => String(pk.player_id || pk.playerId || pk.player || (pk.metadata && (pk.metadata.player_id || pk.metadata.id))) === String(topPlayer.playerId));
                  if (pickRec) ownerId = pickRec.picked_by || pickRec.owner_id || pickRec.picked_by_team || ownerId;
                }
                // If still not found, try to find roster with matching metadata or player list (if available)
                if (!ownerId) {
                  const foundRoster = rosters.find(r => {
                    // Some roster entries may have metadata/player lists; attempt common fields
                    if (!r) return false;
                    if (r.owner_id && r.owner_id === topPlayer.playerId) return false;
                    // If roster has `players` array: check if topPlayer.playerId is in it
                    if (Array.isArray(r.players) && r.players.indexOf(String(topPlayer.playerId)) !== -1) return true;
                    return false;
                  });
                  if (foundRoster) ownerId = foundRoster.owner_id;
                }
              }
              if (!ownerId) return; // cannot award without owner
              ownerId = String(ownerId);
              const badge = { id: `top_${pos.toLowerCase()}_roster_${season}_${ownerId}`, name: `Top ${pos} Roster`, displayName: `Top ${pos} Roster`, category: 'roster', year: season, teamId: ownerId, metadata: { position: pos, playerId: topPlayer.playerId, playerName: topPlayer.playerName, totalPoints: topPlayer.totalPoints } };
              (badgesByTeam[ownerId] = badgesByTeam[ownerId] || []).push(badge);
              recentBadges.push(badge);
            });
          } else {
            // Fallback: aggregate fantasy_points from enriched picks (existing behavior)
            const ownerPosTotals = {}; // ownerId -> { POS: totalPoints }
            const seasonPicksForPos = seasonPicks || [];

            seasonPicksForPos.forEach(pick => {
              if (!pick) return;
              // Try common fields where position might live
              const rawPos = (pick.player_position || pick.player_pos || (pick.metadata && pick.metadata.position) || '').toString().toUpperCase();
              const pos = rawPos || '';
              if (!pos || positionsToConsider.indexOf(pos) === -1) return;

              // Get fantasy points (enriched by DraftAnalysis). Skip if missing or zero
              const fp = Number(pick.fantasy_points || pick.fantasyPoints || pick.player_fantasy_points || 0) || 0;
              if (!fp || isNaN(fp) || fp === 0) return;

              // Resolve owner: prefer explicit owner/picked_by, then roster_id -> owner lookup
              let owner = (pick.picked_by || pick.owner_id || pick.picked_by_team || pick.roster_id || '') || '';
              owner = owner ? String(owner) : '';
              // If owner looks like a roster id, map to owner_id using historicalData.rostersBySeason
              try {
                if (historicalData && historicalData.rostersBySeason) {
                  const rostersForSeason = historicalData.rostersBySeason[season] || historicalData.rostersBySeason[String(season)] || [];
                  if (rostersForSeason && rostersForSeason.length > 0) {
                    const found = rostersForSeason.find(r => String(r.roster_id) === String(owner) || String(r.owner_id) === String(owner));
                    if (found && found.owner_id) owner = String(found.owner_id);
                  }
                }
              } catch (e) { /* ignore owner resolution errors */ }

              if (!owner) return;
              ownerPosTotals[owner] = ownerPosTotals[owner] || {};
              ownerPosTotals[owner][pos] = (ownerPosTotals[owner][pos] || 0) + fp;
            });

            // For each requested position, pick the owner with the highest total points and award a badge
            positionsToConsider.forEach(p => {
              const entries = Object.keys(ownerPosTotals).map(o => ({ ownerId: o, total: ownerPosTotals[o][p] || 0 }));
              if (!entries || entries.length === 0) return;
              entries.sort((a,b) => b.total - a.total);
              const top = entries[0];
              if (top && top.total > 0) {
                const ownerId = top.ownerId;
                const badge = { id: `top_${p.toLowerCase()}_roster_${season}_${ownerId}`, name: `Top ${p} Roster`, displayName: `Top ${p} Roster`, category: 'roster', year: season, teamId: ownerId, metadata: { position: p, totalPoints: top.total } };
                (badgesByTeam[ownerId] = badgesByTeam[ownerId] || []).push(badge);
                recentBadges.push(badge);
              }
            });
          }
        } catch (e) {
          try { const logger = require('./logger').default; logger.error('computeBadges: error computing top-positional roster badges', e); } catch (err) { }
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

  // After all seasons processed, compute Champion Drought progressive blunders
  try {
    // Build an ordered list of seasons (ascending)
    const orderedSeasons = seasons;
    // Map ownerId -> lastChampionSeason (or null)
    const lastChampionSeasonByOwner = {};

    // For each season in ascending order, if the team is champion record lastChampionSeason
    orderedSeasons.forEach(s => {
      const ch = championsBySeason[s] || [];
      ch.forEach(ownerId => {
        lastChampionSeasonByOwner[ownerId] = s;
      });
    });

    // For every team present in badgesByTeam, compute drought length relative to latest season
    const latestSeason = orderedSeasons.length ? orderedSeasons[orderedSeasons.length - 1] : null;
    if (latestSeason) {
      Object.keys(badgesByTeam).forEach(ownerId => {
        const lastChamp = lastChampionSeasonByOwner[ownerId] || null;
        let drought = lastChamp ? (latestSeason - lastChamp) : (latestSeason - (orderedSeasons[0] - 1));
        // If a team has never been champion, drought is the number of seasons since tracking began
        // Round drought down to nearest 5-year increment and award badges for each 5-year milestone reached
        if (drought >= 5) {
          const milestone = Math.floor(drought / 5) * 5;
          // Award the highest milestone badge only (e.g., 10, 15...) and map to blunder
          const badge = { id: `champion_drought_${milestone}_${ownerId}`, name: `Champion Drought - ${milestone}`, displayName: `Champion Drought - ${milestone}`, category: 'blunder', year: latestSeason, teamId: ownerId };
          (badgesByTeam[ownerId] = badgesByTeam[ownerId] || []).push(badge);
        }
      });
    }
  } catch (e) { /* ignore progressive drought computation errors */ }

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

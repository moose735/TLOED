import React, { useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { formatScore } from '../utils/formatUtils';

// Projected 6-team playoff bracket (1-6 seeds). Playoffs start week 15.
// Seeding rules:
// - Seeds 1-4: best projected records (ties broken by projected points)
// - Seeds 5-6: next-best two by projected points among remaining teams
// - Byes: 1 and 2; Round 1: 3 vs 6, 4 vs 5

const ProjectedPlayoffBracket = () => {
  const { historicalData, processedSeasonalRecords, currentSeason, nflState, getTeamName, getTeamDetails } = useSleeperData();
  const seasonStr = currentSeason ? String(currentSeason) : null;

  const data = useMemo(() => {
    if (!historicalData || !processedSeasonalRecords || !currentSeason) return null;

    const season = String(currentSeason);
    const rosters = historicalData.rostersBySeason?.[season] || [];
    const leagueMeta = historicalData.leaguesMetadataBySeason?.[season];
    const playoffStartWeek = parseInt(leagueMeta?.settings?.playoff_start_week) || 15;
    const currentWeek = nflState?.week ? parseInt(nflState.week) : 1;
  const remainingRegularWeeks = Math.max(0, playoffStartWeek - currentWeek);

    const seasonalStats = processedSeasonalRecords?.[season] || {};

  // We'll compute current regular-season wins/points from the flat matchups array for accuracy
    const matchupsFlat = historicalData.matchupsBySeason?.[season] || [];
    const currentRecords = new Map(); // rosterId -> { wins, losses, ties, pointsFor, games }


    rosters.forEach(r => {
      currentRecords.set(String(r.roster_id), { wins: 0, losses: 0, ties: 0, pointsFor: 0, games: 0 });
    });

    matchupsFlat.forEach(m => {
      const week = parseInt(m.week);
      if (!week || week >= playoffStartWeek || week >= currentWeek) return; // count only completed regular-season weeks
      const t1 = m.team1_roster_id ? String(m.team1_roster_id) : null;
      const t2 = m.team2_roster_id ? String(m.team2_roster_id) : null;
      if (!t1 || !t2) return; // skip bye entries for record calculations
      const s1 = Number(m.team1_score) || 0;
      const s2 = Number(m.team2_score) || 0;
      const r1 = currentRecords.get(t1);
      const r2 = currentRecords.get(t2);
      if (!r1 || !r2) return;
      r1.pointsFor += s1; r2.pointsFor += s2; r1.games += 1; r2.games += 1;
      if (s1 > s2) { r1.wins += 1; r2.losses += 1; }
      else if (s2 > s1) { r2.wins += 1; r1.losses += 1; }
      else if (s1 === s2 && s1 > 0) { r1.ties += 1; r2.ties += 1; } // Only count as tie if both teams have nonzero score
    });

    // Build map of remaining scheduled H2H matchups up to playoffs
    const remainingMatchups = matchupsFlat
      .filter(m => {
        const week = parseInt(m.week);
        return week && week >= currentWeek && week < playoffStartWeek && m.team1_roster_id && m.team2_roster_id;
      })
      .map(m => ({
        week: parseInt(m.week),
        t1: String(m.team1_roster_id),
        t2: String(m.team2_roster_id),
      }));

    const remainingOpponentsByTeam = new Map(); // rosterId -> [{ opponentId, week }]
    rosters.forEach(r => remainingOpponentsByTeam.set(String(r.roster_id), []));
    remainingMatchups.forEach(m => {
      remainingOpponentsByTeam.get(m.t1)?.push({ opponentId: m.t2, week: m.week });
      remainingOpponentsByTeam.get(m.t2)?.push({ opponentId: m.t1, week: m.week });
    });

    // Confidence removed per request

    // Helper: team "rating" for matchup win probability
    const getTeamRating = (rosterId) => {
      const stats = seasonalStats[rosterId] || {};
      const allPlay = typeof stats.allPlayWinPercentage === 'number' ? stats.allPlayWinPercentage : undefined;
      const adj = typeof stats.adjustedDPR === 'number' ? stats.adjustedDPR : undefined;
      if (adj && adj > 0) return adj; // normalized around 1
      if (allPlay !== undefined) return Math.max(0.1, allPlay * 2); // scale ~0..2
      // fallback to .5 -> 1
      return 1;
    };

    // Build projected metrics per team
    const teams = rosters.map(r => {
      const rosterId = String(r.roster_id);
      const ownerId = String(r.owner_id);
      const stats = seasonalStats[rosterId] || {};
      const rec = currentRecords.get(rosterId) || { wins: 0, losses: 0, ties: 0, pointsFor: 0, games: 0 };
      const remainingList = remainingOpponentsByTeam.get(rosterId) || [];

      // Use all-play win% if available as a skill proxy, else current win%
      const allPlayWinPct = typeof stats.allPlayWinPercentage === 'number' && !isNaN(stats.allPlayWinPercentage) && stats.allPlayWinPercentage > 0
        ? stats.allPlayWinPercentage
        : (rec.games > 0 ? ((rec.wins + (rec.ties > 0 ? 0.5 * rec.ties : 0)) / rec.games) : 0.5);

      const avgScore = (stats.averageScore && !isNaN(stats.averageScore) && stats.averageScore > 0)
        ? stats.averageScore
        : (rec.games > 0 ? (rec.pointsFor / rec.games) : 100); // safe default

      // Schedule-based expected wins: sum over remaining opponents P(win)
      let expectedWinsFromSchedule = 0;
      const myRating = getTeamRating(rosterId);
      remainingList.forEach(({ opponentId }) => {
        const oppRating = getTeamRating(opponentId);
        const denom = (myRating + oppRating);
        const pWin = denom > 0 ? (myRating / denom) : 0.5;
        expectedWinsFromSchedule += pWin;
      });

      // If some weeks aren't scheduled for this data, approximate using all-play
      const scheduledGames = remainingList.length;
      const unscheduledGames = Math.max(0, remainingRegularWeeks - scheduledGames);
      expectedWinsFromSchedule += unscheduledGames * allPlayWinPct;

      const projectedWinsTotal = rec.wins + expectedWinsFromSchedule;
      const projectedPointsTotal = rec.pointsFor + ((scheduledGames + unscheduledGames) * avgScore);

      return {
        rosterId,
        ownerId,
        name: getTeamName(ownerId, season),
        avatar: getTeamDetails(ownerId, season)?.avatar,
        currentWins: rec.wins,
        currentLosses: rec.losses,
  currentTies: rec.ties,
        currentPoints: rec.pointsFor,
        projectedWins: projectedWinsTotal,
        projectedPoints: projectedPointsTotal,
        remainingOpponents: remainingList,
        avgScore,
        allPlayWinPct,
      };
    });

    // Sort by projected wins desc, tiebreaker projected points desc
    const byProjectedRecord = [...teams].sort((a, b) => {
      if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
      if (b.projectedPoints !== a.projectedPoints) return b.projectedPoints - a.projectedPoints;
      return a.name.localeCompare(b.name);
    });

    const top4 = byProjectedRecord.slice(0, 4);
    const remaining = teams.filter(t => !top4.find(s => s.rosterId === t.rosterId));
    const byProjectedPoints = remaining.sort((a, b) => {
      if (b.projectedPoints !== a.projectedPoints) return b.projectedPoints - a.projectedPoints;
      // tiebreaker: projected wins
      if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
      return a.name.localeCompare(b.name);
    });
    const seeds5and6 = byProjectedPoints.slice(0, 2);

    const seeds = [...top4, ...seeds5and6].slice(0, 6);

    // label seeds 1-6
    const seeded = seeds
      .map((team, idx) => ({ seed: idx + 1, ...team }))
      .sort((a, b) => a.seed - b.seed);

    // Build bracket pairings
    let round1 = [
      { higher: seeded.find(s => s.seed === 3), lower: seeded.find(s => s.seed === 6) },
      { higher: seeded.find(s => s.seed === 4), lower: seeded.find(s => s.seed === 5) },
    ];
    const byes = [seeded.find(s => s.seed === 1), seeded.find(s => s.seed === 2)];

    // If playoffs have begun and a winners bracket exists for this season, prefer its actual round 1 pairings
    const winnersBracket = historicalData.winnersBracketBySeason?.[season] || [];
    const hasActualRound1 = currentWeek >= playoffStartWeek && winnersBracket.some(m => parseInt(m.r) === 1 && (m.t1 || m.team1_roster_id) && (m.t2 || m.team2_roster_id));
    if (hasActualRound1) {
      const r1Matches = winnersBracket.filter(m => parseInt(m.r) === 1);
      const seededByRoster = new Map(seeded.map(s => [String(s.rosterId), s]));
      const toSeedObj = (rid) => seededByRoster.get(String(rid)) || null;
      const mapped = r1Matches
        .map(m => {
          const t1 = String(m.t1 || m.team1_roster_id);
          const t2 = String(m.t2 || m.team2_roster_id);
          const a = toSeedObj(t1);
          const b = toSeedObj(t2);
          if (!a || !b) return null;
          // ensure 'higher' is the better seed (lower number)
          const higher = a.seed < b.seed ? a : b;
          const lower = a.seed < b.seed ? b : a;
          return { higher, lower };
        })
        .filter(Boolean)
        .sort((x, y) => (x.higher.seed - y.higher.seed));
      if (mapped.length === 2) {
        round1 = mapped;
      }
    }

    return { seeded, round1, byes, playoffStartWeek, isPlayoffs: currentWeek >= playoffStartWeek };
  }, [historicalData, processedSeasonalRecords, currentSeason, nflState, getTeamName, getTeamDetails]);

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-2">Projected Playoff Bracket</h2>
        <div className="text-gray-500 text-sm">Not enough data to project the bracket yet.</div>
      </div>
    );
  }

  const { seeded, round1, byes, playoffStartWeek, isPlayoffs } = data;

  const TeamChip = ({ seed, team }) => (
    <div className="group relative">
      <div className="flex items-center space-x-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm">
        <div className="text-xs font-semibold text-blue-700 w-6">#{seed}</div>
        <img
          src={team?.avatar || 'https://sleepercdn.com/avatars/default_avatar.png'}
          alt={team?.name || 'Team'}
          className="w-8 h-8 rounded-full border border-gray-300 object-cover"
          onError={(e) => { e.currentTarget.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{team?.name || 'TBD'}</div>
        </div>
      </div>
      {/* Tooltip */}
      {team && (
        <div className="pointer-events-none absolute z-10 hidden group-hover:block bg-white border border-gray-200 shadow-lg rounded-md p-3 w-72 -left-2 top-10">
          <div className="text-sm font-semibold text-gray-800 mb-1">{team.name}</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
            <div>Current Record</div><div className="text-right">{team.currentWins}-{team.currentLosses}{team.currentTies > 0 ? `-${team.currentTies}` : ''}</div>
            <div>Current Points</div><div className="text-right">{formatScore(Number(team.currentPoints ?? 0), 1)}</div>
            <div>Avg Score</div><div className="text-right">{formatScore(Number(team.avgScore ?? 0), 1)}</div>
            <div>All-Play Win%</div><div className="text-right">{formatScore((team.allPlayWinPct*100) ?? 0, 1)}%</div>
            <div>Projected Wins</div><div className="text-right">{formatScore(Number(team.projectedWins ?? 0), 2)}</div>
            <div>Projected Points</div><div className="text-right">{formatScore(Number(team.projectedPoints ?? 0), 1)}</div>
          </div>
          {team.remainingOpponents?.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold text-gray-700 mb-1">Remaining Opponents</div>
              <ul className="text-xs text-gray-700 max-h-24 overflow-auto space-y-1">
                {team.remainingOpponents
                  .slice()
                  .sort((a,b)=>a.week-b.week)
                  .map((o, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>Week {o.week}</span>
                      <span className="truncate ml-2">{getTeamName(
                        seasonStr ? historicalData.rostersBySeason?.[seasonStr]?.find(r=>String(r.roster_id)===String(o.opponentId))?.owner_id : undefined,
                        seasonStr || undefined
                      )}</span>
                    </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800">{isPlayoffs ? 'Playoff Bracket' : 'Projected Playoff Bracket'}</h2>
        <div className="text-xs sm:text-sm text-gray-500">Playoffs start Week {playoffStartWeek}</div>
      </div>

      {/* Bracket layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Round 1 */}
        <div className="space-y-8">
          <div className="text-sm font-semibold text-gray-600 mb-1">Round 1</div>
          {round1.map((pair, idx) => (
            <div key={idx} className="relative">
              <div className="space-y-2">
                <TeamChip seed={pair.higher?.seed} team={pair.higher} />
                <div className="text-center text-xs text-gray-400">vs</div>
                <TeamChip seed={pair.lower?.seed} team={pair.lower} />
              </div>
            </div>
          ))}
        </div>

        {/* Right: Semifinals (with byes and reseeding) */}
        <div className="space-y-10">
          <div className="text-sm font-semibold text-gray-600 mb-1">Semifinals</div>
          <div className="relative">
            <div className="space-y-2">
              <TeamChip seed={1} team={byes[0]} />
              <div className="text-xs text-gray-400">vs lowest remaining seed</div>
            </div>
          </div>
          <div className="relative">
            <div className="space-y-2">
              <TeamChip seed={2} team={byes[1]} />
              <div className="text-xs text-gray-400">vs highest remaining seed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">Seeding: 1-4 by record (tiebreaker points); 5-6 by points among remaining. Semifinals reseed: 1 vs lowest remaining, 2 vs highest remaining.</div>
    </div>
  );
};

export default ProjectedPlayoffBracket;

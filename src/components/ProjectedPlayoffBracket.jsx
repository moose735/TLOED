import React, { useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { formatScore } from '../utils/formatUtils';

const card = "bg-gray-800 border border-white/10 rounded-xl";
const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";

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

    const matchupsFlat = historicalData.matchupsBySeason?.[season] || [];
    const currentRecords = new Map();

    rosters.forEach(r => {
      currentRecords.set(String(r.roster_id), { wins: 0, losses: 0, ties: 0, pointsFor: 0, games: 0 });
    });

    matchupsFlat.forEach(m => {
      const week = parseInt(m.week);
      if (!week || week >= playoffStartWeek || week >= currentWeek) return;
      const t1 = m.team1_roster_id ? String(m.team1_roster_id) : null;
      const t2 = m.team2_roster_id ? String(m.team2_roster_id) : null;
      if (!t1 || !t2) return;
      const s1 = Number(m.team1_score) || 0;
      const s2 = Number(m.team2_score) || 0;
      const r1 = currentRecords.get(t1);
      const r2 = currentRecords.get(t2);
      if (!r1 || !r2) return;
      r1.pointsFor += s1; r2.pointsFor += s2; r1.games += 1; r2.games += 1;
      if (s1 > s2) { r1.wins += 1; r2.losses += 1; }
      else if (s2 > s1) { r2.wins += 1; r1.losses += 1; }
      else if (s1 === s2 && s1 > 0) { r1.ties += 1; r2.ties += 1; }
    });

    const remainingMatchups = matchupsFlat
      .filter(m => {
        const week = parseInt(m.week);
        return week && week >= currentWeek && week < playoffStartWeek && m.team1_roster_id && m.team2_roster_id;
      })
      .map(m => ({ week: parseInt(m.week), t1: String(m.team1_roster_id), t2: String(m.team2_roster_id) }));

    const remainingOpponentsByTeam = new Map();
    rosters.forEach(r => remainingOpponentsByTeam.set(String(r.roster_id), []));
    remainingMatchups.forEach(m => {
      remainingOpponentsByTeam.get(m.t1)?.push({ opponentId: m.t2, week: m.week });
      remainingOpponentsByTeam.get(m.t2)?.push({ opponentId: m.t1, week: m.week });
    });

    function erf(x) {
      const sign = x >= 0 ? 1 : -1;
      x = Math.abs(x);
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
      const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return sign * y;
    }

    function getMeanAndVariance(rosterId, season, matchups, N = null) {
      let teamMatchups = matchups.filter(m => {
        const t1 = m.t1 !== undefined ? m.t1 : m.team1_roster_id;
        const t2 = m.t2 !== undefined ? m.t2 : m.team2_roster_id;
        return String(t1) === String(rosterId) || String(t2) === String(rosterId);
      });
      if (N) teamMatchups = teamMatchups.slice(-N);
      const scores = teamMatchups.map(m => {
        const t1 = m.t1 !== undefined ? m.t1 : m.team1_roster_id;
        return String(t1) === String(rosterId)
          ? (m.t1_score !== undefined ? m.t1_score : m.team1_score)
          : (m.t2_score !== undefined ? m.t2_score : m.team2_score);
      }).filter(s => typeof s === 'number');
      if (scores.length === 0) return { mean: 0, variance: 0, count: 0, recentMean: 0 };
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
      const last3 = scores.slice(-3);
      const recentMean = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : mean;
      return { mean, variance, count: scores.length, recentMean };
    }

    const teams = rosters.map(r => {
      const rosterId = String(r.roster_id);
      const ownerId = String(r.owner_id);
      const stats = seasonalStats[rosterId] || {};
      const rec = currentRecords.get(rosterId) || { wins: 0, losses: 0, ties: 0, pointsFor: 0, games: 0 };
      const remainingList = remainingOpponentsByTeam.get(rosterId) || [];

      const allPlayWinPct = typeof stats.allPlayWinPercentage === 'number' && !isNaN(stats.allPlayWinPercentage) && stats.allPlayWinPercentage > 0
        ? stats.allPlayWinPercentage
        : (rec.games > 0 ? ((rec.wins + (rec.ties > 0 ? 0.5 * rec.ties : 0)) / rec.games) : 0.5);

      const avgScore = (stats.averageScore && !isNaN(stats.averageScore) && stats.averageScore > 0)
        ? stats.averageScore
        : (rec.games > 0 ? (rec.pointsFor / rec.games) : 100);

      const nflWeek = currentWeek;
      const completedWeek = nflWeek > 1 ? nflWeek - 1 : 1;
      const allMatchups = matchupsFlat;
      const completedMatchups = allMatchups.filter(m => parseInt(m.week) <= completedWeek && parseInt(m.week) <= 14);
      const rosterIdToOwner = {}; rosters.forEach(rr => { rosterIdToOwner[String(rr.roster_id)] = String(rr.owner_id); });
      const actualWins = {}; rosters.forEach(rr => { actualWins[String(rr.owner_id)] = 0; });
      completedMatchups.forEach(m => {
        const t1 = m.team1_roster_id !== undefined ? String(m.team1_roster_id) : (m.t1 !== undefined ? String(m.t1) : null);
        const t2 = m.team2_roster_id !== undefined ? String(m.team2_roster_id) : (m.t2 !== undefined ? String(m.t2) : null);
        if (!t1 || !t2) return;
        const s1 = Number(m.team1_score ?? m.t1_score ?? 0);
        const s2 = Number(m.team2_score ?? m.t2_score ?? 0);
        const o1 = rosterIdToOwner[t1] || t1;
        const o2 = rosterIdToOwner[t2] || t2;
        if (s1 > s2) actualWins[o1] = (actualWins[o1] || 0) + 1;
        else if (s2 > s1) actualWins[o2] = (actualWins[o2] || 0) + 1;
      });

      const projectedFutureWins = {};
      rosters.forEach(rr => { projectedFutureWins[String(rr.owner_id)] = 0; });
      for (let wk = completedWeek + 1; wk <= 14; wk++) {
        const weekMatchups = matchupsFlat.filter(m => parseInt(m.week) === wk && m.team1_roster_id && m.team2_roster_id);
        weekMatchups.forEach(m => {
          const t1id = String(m.team1_roster_id);
          const t2id = String(m.team2_roster_id);
          const t1Owner = rosterIdToOwner[t1id] || t1id;
          const t2Owner = rosterIdToOwner[t2id] || t2id;
          const t1Stats = getMeanAndVariance(t1id, season, completedMatchups, 4);
          const t2Stats = getMeanAndVariance(t2id, season, completedMatchups, 4);
          const t1Mean = t1Stats.mean; const t2Mean = t2Stats.mean;
          const t1Var = t1Stats.variance; const t2Var = t2Stats.variance;
          const t1N = t1Stats.count >= 2 ? t1Stats.count : 1;
          const t2N = t2Stats.count >= 2 ? t2Stats.count : 1;
          const diff = t1Mean - t2Mean;
          let stdErr = Math.sqrt((t1Var / t1N) + (t2Var / t2N));
          if (stdErr <= 0 || t1Stats.count < 2 || t2Stats.count < 2) stdErr = Math.max(stdErr, 15);
          const cappedDiff = Math.max(-20, Math.min(20, diff));
          let t1WinProb = stdErr > 0 ? 0.5 + 0.5 * erf(cappedDiff / (Math.sqrt(2) * stdErr)) : 0.5;
          t1WinProb = Math.max(0.05, Math.min(0.95, t1WinProb));
          let t2WinProb = Math.max(0.05, Math.min(0.95, 1 - t1WinProb));
          projectedFutureWins[t1Owner] = (projectedFutureWins[t1Owner] || 0) + t1WinProb;
          projectedFutureWins[t2Owner] = (projectedFutureWins[t2Owner] || 0) + t2WinProb;
        });
      }

      const scheduledGames = remainingList.length;
      const unscheduledGames = Math.max(0, remainingRegularWeeks - scheduledGames);
      const expectedWinsFromSchedule = (projectedFutureWins[ownerId] || 0) + (unscheduledGames * allPlayWinPct);
      const projectedWinsTotal = Math.round((actualWins[ownerId] || 0) + expectedWinsFromSchedule);
      const projectedPointsTotal = rec.pointsFor + ((scheduledGames + unscheduledGames) * avgScore);

      return {
        rosterId, ownerId,
        name: getTeamName(ownerId, season),
        avatar: getTeamDetails(ownerId, season)?.avatar,
        currentWins: rec.wins, currentLosses: rec.losses, currentTies: rec.ties,
        currentPoints: rec.pointsFor,
        projectedWins: projectedWinsTotal, projectedPoints: projectedPointsTotal,
        remainingOpponents: remainingList, avgScore, allPlayWinPct,
      };
    });

    const byProjectedRecord = [...teams].sort((a, b) => {
      if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
      if (b.projectedPoints !== a.projectedPoints) return b.projectedPoints - a.projectedPoints;
      return a.name.localeCompare(b.name);
    });

    const top4 = byProjectedRecord.slice(0, 4);
    const remaining = teams.filter(t => !top4.find(s => s.rosterId === t.rosterId));
    const byProjectedPoints = remaining.sort((a, b) => {
      if (b.projectedPoints !== a.projectedPoints) return b.projectedPoints - a.projectedPoints;
      if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
      return a.name.localeCompare(b.name);
    });
    const seeds5and6 = byProjectedPoints.slice(0, 2);
    const seeds = [...top4, ...seeds5and6].slice(0, 6);
    const seeded = seeds.map((team, idx) => ({ seed: idx + 1, ...team })).sort((a, b) => a.seed - b.seed);

    let round1 = [
      { higher: seeded.find(s => s.seed === 3), lower: seeded.find(s => s.seed === 6) },
      { higher: seeded.find(s => s.seed === 4), lower: seeded.find(s => s.seed === 5) },
    ];
    const byes = [seeded.find(s => s.seed === 1), seeded.find(s => s.seed === 2)];

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
          const a = toSeedObj(t1); const b = toSeedObj(t2);
          if (!a || !b) return null;
          const higher = a.seed < b.seed ? a : b;
          const lower = a.seed < b.seed ? b : a;
          return { higher, lower };
        })
        .filter(Boolean)
        .sort((x, y) => x.higher.seed - y.higher.seed);
      if (mapped.length === 2) round1 = mapped;
    }

    return { seeded, round1, byes, playoffStartWeek, isPlayoffs: currentWeek >= playoffStartWeek };
  }, [historicalData, processedSeasonalRecords, currentSeason, nflState, getTeamName, getTeamDetails]);

  if (!data) {
    return (
      <div className={card}>
        <div className={cardHeader}>
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Projected Playoff Bracket</span>
        </div>
        <div className="text-center py-10 text-sm text-gray-500">Not enough data to project the bracket yet.</div>
      </div>
    );
  }

  const { seeded, round1, byes, playoffStartWeek, isPlayoffs } = data;

  // ── Team chip ─────────────────────────────────────────────────────────────
  const TeamChip = ({ seed, team }) => {
    const seedColors = {
      1: 'text-yellow-400',
      2: 'text-gray-300',
      3: 'text-amber-600',
      4: 'text-blue-400',
      5: 'text-gray-500',
      6: 'text-gray-500',
    };
    return (
      <div className="group relative">
        <div className="flex items-center gap-3 bg-gray-750 bg-white/5 border border-white/10 rounded-lg px-3 py-2 hover:border-white/20 hover:bg-white/8 transition-all duration-150">
          <span className={`text-xs font-bold w-5 flex-shrink-0 tabular-nums ${seedColors[seed] || 'text-gray-500'}`}>
            #{seed}
          </span>
          <img
            src={team?.avatar || 'https://sleepercdn.com/avatars/default_avatar.png'}
            alt={team?.name || 'Team'}
            className="w-7 h-7 rounded-full border border-white/20 object-cover flex-shrink-0"
            onError={(e) => { e.currentTarget.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-200 truncate">{team?.name || 'TBD'}</div>
            {team && (
              <div className="text-[10px] text-gray-500 tabular-nums">
                {team.currentWins}-{team.currentLosses}{team.currentTies > 0 ? `-${team.currentTies}` : ''} · {formatScore(Number(team.currentPoints ?? 0), 1)} pts
              </div>
            )}
          </div>
          {team && (
            <div className="hidden xs:flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">Proj W</span>
              <span className="text-xs font-semibold text-gray-300 tabular-nums">{team.projectedWins}</span>
            </div>
          )}
        </div>

        {/* Tooltip */}
        {team && (
          <div className="pointer-events-none absolute z-20 hidden group-hover:block bg-gray-900 border border-white/15 shadow-2xl rounded-xl p-3 w-72 left-0 top-full mt-1.5">
            <div className="text-sm font-semibold text-gray-100 mb-2">{team.name}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {[
                ['Current Record', `${team.currentWins}-${team.currentLosses}${team.currentTies > 0 ? `-${team.currentTies}` : ''}`],
                ['Current Points', formatScore(Number(team.currentPoints ?? 0), 1)],
                ['Avg Score', formatScore(Number(team.avgScore ?? 0), 1)],
                ['All-Play Win%', `${formatScore((team.allPlayWinPct * 100) ?? 0, 1)}%`],
                ['Projected Wins', formatScore(Number(team.projectedWins ?? 0), 2)],
                ['Projected Points', formatScore(Number(team.projectedPoints ?? 0), 1)],
              ].map(([label, value]) => (
                <React.Fragment key={label}>
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-200 text-right tabular-nums">{value}</span>
                </React.Fragment>
              ))}
            </div>
            {team.remainingOpponents?.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-white/10">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Remaining Opponents</div>
                <ul className="space-y-1 max-h-24 overflow-auto">
                  {team.remainingOpponents
                    .slice()
                    .sort((a, b) => a.week - b.week)
                    .map((o, idx) => (
                      <li key={idx} className="flex justify-between text-xs">
                        <span className="text-gray-600">Wk {o.week}</span>
                        <span className="text-gray-300 truncate ml-2">
                          {getTeamName(
                            seasonStr ? historicalData.rostersBySeason?.[seasonStr]?.find(r => String(r.roster_id) === String(o.opponentId))?.owner_id : undefined,
                            seasonStr || undefined
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={card}>
      <div className={cardHeader}>
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {isPlayoffs ? 'Playoff Bracket' : 'Projected Playoff Bracket'}
        </span>
        <span className="ml-auto text-[10px] text-gray-600">Playoffs start Week {playoffStartWeek}</span>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Round 1 */}
        <div>
          <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-3">Round 1</div>
          <div className="space-y-5">
            {round1.map((pair, idx) => (
              <div key={idx} className="space-y-1.5">
                <TeamChip seed={pair.higher?.seed} team={pair.higher} />
                <div className="text-center text-[10px] text-gray-600 uppercase tracking-wider">vs</div>
                <TeamChip seed={pair.lower?.seed} team={pair.lower} />
              </div>
            ))}
          </div>
        </div>

        {/* Semifinals */}
        <div>
          <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-3">Semifinals</div>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <TeamChip seed={1} team={byes[0]} />
              <div className="text-[10px] text-gray-600 pl-2">vs lowest remaining seed</div>
            </div>
            <div className="space-y-1.5">
              <TeamChip seed={2} team={byes[1]} />
              <div className="text-[10px] text-gray-600 pl-2">vs highest remaining seed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 border-t border-white/5 pt-3">
        <p className="text-[10px] text-gray-600">
          Seeding: 1–4 by record (tiebreaker points) · 5–6 by points among remaining · Semifinals reseed after Round 1
        </p>
      </div>
    </div>
  );
};

export default ProjectedPlayoffBracket;
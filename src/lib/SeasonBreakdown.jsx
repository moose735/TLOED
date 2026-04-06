import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { formatScore } from '../utils/formatUtils';

// ─── Small reusable UI pieces ────────────────────────────────────────────────

const SectionHeading = ({ children }) => (
    <h3 className="text-lg font-bold text-white mb-3 tracking-tight">{children}</h3>
);

const StatCard = ({ color, label, children }) => {
    const colorMap = {
        blue:    'bg-blue-500/10 border-blue-400/20 text-blue-300',
        emerald: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300',
        green:   'bg-green-500/10 border-green-400/20 text-green-300',
        yellow:  'bg-yellow-500/10 border-yellow-400/20 text-yellow-300',
        red:     'bg-red-500/10 border-red-400/20 text-red-300',
        purple:  'bg-purple-500/10 border-purple-400/20 text-purple-300',
        pink:    'bg-pink-500/10 border-pink-400/20 text-pink-300',
        orange:  'bg-orange-500/10 border-orange-400/20 text-orange-300',
        indigo:  'bg-indigo-500/10 border-indigo-400/20 text-indigo-300',
        teal:    'bg-teal-500/10 border-teal-400/20 text-teal-300',
        gray:    'bg-white/5 border-white/10 text-gray-300',
        white:   'bg-white/5 border-white/10 text-green-300',
    };
    return (
        <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{label}</p>
            <div className="text-sm font-medium text-white/90">{children}</div>
        </div>
    );
};

const TableWrapper = ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-sm bg-white/5">
        {children}
    </div>
);

const Th = ({ children, align = 'left' }) => (
    <th className={`py-2.5 px-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/10 text-${align} bg-white/5 whitespace-nowrap`}>
        {children}
    </th>
);

const Td = ({ children, align = 'left', bold }) => (
    <td className={`py-2.5 px-4 text-sm text-gray-200 text-${align}${bold ? ' font-semibold text-white' : ''}`}>
        {children}
    </td>
);

// ─── SeasonBreakdown ─────────────────────────────────────────────────────────

const SeasonBreakdown = () => {
    const {
        loading,
        error,
        historicalData,
        getTeamName,
        getTeamDetails,
        currentSeason,
        nflState
    } = useSleeperData();

    const [selectedSeason, setSelectedSeason] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [seasonStandings, setSeasonStandings] = useState([]);
    const [seasonChampion, setSeasonChampion] = useState('N/A');
    const [seasonRunnerUp, setSeasonRunnerUp] = useState('N/A');
    const [seasonThirdPlace, setSeasonThirdPlace] = useState('N/A');
    const [seasonSurvivorWinner, setSeasonSurvivorWinner] = useState('N/A');
    const [hypoSubject, setHypoSubject] = useState('');
    const [mockResults, setMockResults] = useState([]);

    const { seasonalMetrics, careerDPRData } = useMemo(() => {
        if (!historicalData || !nflState || loading || error) {
            return { seasonalMetrics: {}, careerDPRData: [] };
        }
        return calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
    }, [historicalData, nflState, loading, error, getTeamName]);

    useEffect(() => {
        if (!loading && !error && historicalData) {
            const allYears = new Set();
            if (seasonalMetrics && Object.keys(seasonalMetrics).length > 0) {
                Object.keys(seasonalMetrics).forEach(year => allYears.add(Number(year)));
            } else {
                if (historicalData.matchupsBySeason) Object.keys(historicalData.matchupsBySeason).forEach(y => allYears.add(Number(y)));
                if (historicalData.seasonAwardsSummary) Object.keys(historicalData.seasonAwardsSummary).forEach(y => allYears.add(Number(y)));
                if (historicalData.winnersBracketBySeason) Object.keys(historicalData.winnersBracketBySeason).forEach(y => allYears.add(Number(y)));
            }
            const sortedYears = Array.from(allYears).sort((a, b) => b - a);
            setSeasons(sortedYears);
            if (sortedYears.length > 0) {
                const defaultSeason = currentSeason && sortedYears.includes(Number(currentSeason))
                    ? Number(currentSeason)
                    : sortedYears[0];
                setSelectedSeason(defaultSeason);
            }
        }
    }, [loading, error, historicalData, seasonalMetrics, currentSeason]);

    useEffect(() => {
        if (selectedSeason && historicalData && seasonalMetrics[selectedSeason]) {
            const currentSeasonMetrics = seasonalMetrics[selectedSeason];
            const currentSeasonRosters = historicalData.rostersBySeason[selectedSeason];

            if (!currentSeasonMetrics || !currentSeasonRosters) {
                setSeasonStandings([]); setSeasonChampion('N/A');
                setSeasonRunnerUp('N/A'); setSeasonThirdPlace('N/A');
                return;
            }

            const standingsArray = Object.values(currentSeasonMetrics).map(teamData => ({
                teamName: teamData.teamName,
                wins: teamData.wins, losses: teamData.losses, ties: teamData.ties,
                pointsFor: teamData.pointsFor, pointsAgainst: teamData.pointsAgainst,
                rosterId: teamData.rosterId, ownerId: teamData.ownerId,
            }));
            const sortedStandings = standingsArray.sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (a.losses !== b.losses) return a.losses - b.losses;
                return b.pointsFor - a.pointsFor;
            });
            setSeasonStandings(sortedStandings);

            let champion = 'N/A', runnerUp = 'N/A', thirdPlace = 'N/A';
            if (historicalData.winnersBracketBySeason?.[selectedSeason]) {
                const bracket = historicalData.winnersBracketBySeason[selectedSeason];
                const champ = bracket.find(m => m.p === 1 && m.w && m.l);
                if (champ) {
                    const wRoster = currentSeasonRosters.find(r => String(r.roster_id) === String(champ.w).trim());
                    const lRoster = currentSeasonRosters.find(r => String(r.roster_id) === String(champ.l).trim());
                    if (wRoster?.owner_id) champion = getTeamName(wRoster.owner_id, selectedSeason);
                    if (lRoster?.owner_id) runnerUp = getTeamName(lRoster.owner_id, selectedSeason);
                }
                const third = bracket.find(m => m.p === 3 && m.w);
                if (third) {
                    const r = currentSeasonRosters.find(r => String(r.roster_id) === String(third.w).trim());
                    if (r?.owner_id) thirdPlace = getTeamName(r.owner_id, selectedSeason);
                }
            }
            if (champion === 'N/A' && historicalData.seasonAwardsSummary?.[selectedSeason]) {
                const s = historicalData.seasonAwardsSummary[selectedSeason];
                if (s.champion && s.champion !== 'N/A' && s.champion.trim()) {
                    const v = s.champion.trim();
                    const r = getTeamName(v, selectedSeason);
                    champion = r !== 'Unknown Team' ? r : v;
                }
            }
            if (champion === 'N/A' && historicalData.awardsSummary?.[selectedSeason]) {
                const s = historicalData.awardsSummary[selectedSeason];
                const k = s.champion || s["Champion"];
                if (k && k !== 'N/A' && String(k).trim()) {
                    const v = String(k).trim();
                    const r = getTeamName(v, selectedSeason);
                    champion = r !== 'Unknown Team' ? r : v;
                }
            }
            setSeasonChampion(champion);
            setSeasonRunnerUp(runnerUp);
            setSeasonThirdPlace(thirdPlace);
        } else if (!selectedSeason) {
            setSeasonStandings([]); setSeasonChampion('N/A');
            setSeasonRunnerUp('N/A'); setSeasonThirdPlace('N/A');
        }
    }, [selectedSeason, historicalData, seasonalMetrics, getTeamName]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center p-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-500 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">Loading season data…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                <p className="font-bold mb-1">Error Loading Data</p>
                <p className="text-sm">{error.message || String(error)}</p>
            </div>
        );
    }

    const getTeamNameByRosterId = (rosterId) => {
        const team = seasonStandings.find(t => String(t.rosterId) === String(rosterId));
        return team ? team.teamName : 'Unknown';
    };

    const formatPct = (v) => typeof v === 'number' && !isNaN(v) ? `${(v * 100).toFixed(2)}%` : 'N/A';

    const formatDecimalFraction = (v) => {
        if (typeof v === 'number' && !isNaN(v)) {
            const s = v.toFixed(3);
            return v < 1 ? s.replace(/^0/, '') : s;
        }
        return 'N/A';
    };

    let seasonStats = null;
    if (selectedSeason && seasonalMetrics[selectedSeason]) {
        const teams = Object.values(seasonalMetrics[selectedSeason]);
        const pointsChampion = teams.reduce((a, b) => (a.pointsFor > b.pointsFor ? a : b), {});
        const regularSeasonChampion = teams.find(t => t.isRegularSeasonChampion) || teams.reduce((a, b) => (a.wins > b.wins ? a : b), {});
        const bestRecord = teams.reduce((a, b) => (a.wins > b.wins ? a : b), {});
        const luckiest = teams.reduce((a, b) => (a.luckRating > b.luckRating ? a : b), {});
        const unluckiest = teams.reduce((a, b) => (a.luckRating < b.luckRating ? a : b), {});
        const allPlayChamp = teams.reduce((a, b) => (a.allPlayWinPercentage > b.allPlayWinPercentage ? a : b), {});
        const blowoutKing = teams.reduce((a, b) => (a.blowoutWins > b.blowoutWins ? a : b), {});
        const slimMaster = teams.reduce((a, b) => (a.slimWins > b.slimWins ? a : b), {});
        const topScorer = teams.reduce((a, b) => (a.topScoreWeeksCount > b.topScoreWeeksCount ? a : b), {});

        let highestWeek = { score: -Infinity, team: null, week: null };
        let lowestWeek = { score: Infinity, team: null, week: null };
        if (historicalData.matchupsBySeason?.[selectedSeason]) {
            historicalData.matchupsBySeason[selectedSeason].forEach(m => {
                if (typeof m.team1_score === 'number' && m.team1_score > highestWeek.score)
                    highestWeek = { score: m.team1_score, team: getTeamNameByRosterId(m.team1_roster_id), week: m.week };
                if (typeof m.team2_score === 'number' && m.team2_score > highestWeek.score)
                    highestWeek = { score: m.team2_score, team: getTeamNameByRosterId(m.team2_roster_id), week: m.week };
                if (typeof m.team1_score === 'number' && m.team1_score > 0 && m.team1_score < lowestWeek.score)
                    lowestWeek = { score: m.team1_score, team: getTeamNameByRosterId(m.team1_roster_id), week: m.week };
                if (typeof m.team2_score === 'number' && m.team2_score > 0 && m.team2_score < lowestWeek.score)
                    lowestWeek = { score: m.team2_score, team: getTeamNameByRosterId(m.team2_roster_id), week: m.week };
            });
        }
        if (lowestWeek.score === Infinity) lowestWeek = { score: 'N/A', team: 'N/A', week: 'N/A' };

        seasonStats = { pointsChampion, regularSeasonChampion, bestRecord, luckiest, unluckiest, allPlayChamp, blowoutKing, slimMaster, topScorer, highestWeek, lowestWeek };
    }

    const { allPlayStandings, weeklyPointsMap, scheduleMap } = useMemo(() => {
        const result = { allPlayStandings: [], weeklyPointsMap: {}, scheduleMap: {} };
        if (!selectedSeason || !historicalData?.matchupsBySeason?.[selectedSeason]) return result;

        const matchupsRaw = historicalData.matchupsBySeason[selectedSeason] || [];
        const uniqueMatchups = [];
        const seenMatchupKeys = new Set();
        matchupsRaw.forEach(m => {
            const wk = String(m.week), a = String(m.team1_roster_id), b = String(m.team2_roster_id);
            if (a === b) return;
            const key = `${wk}:${[a,b].sort().join('-')}`;
            if (seenMatchupKeys.has(key)) return;
            seenMatchupKeys.add(key);
            uniqueMatchups.push(m);
        });

        const currentSeasonRosters = historicalData.rostersBySeason?.[selectedSeason] || [];
        const rosterIds = currentSeasonRosters.map(r => String(r.roster_id));
        const rosterIdSet = new Set(rosterIds);
        const rosterIdToOwner = {}, rosterIdToName = {};
        currentSeasonRosters.forEach(r => {
            const rid = String(r.roster_id);
            rosterIdToOwner[rid] = r.owner_id;
            rosterIdToName[rid] = getTeamName ? getTeamName(r.owner_id, selectedSeason) : (r.team_name || `Roster ${rid}`);
        });

        const weeklyPoints = {}, schedule = {}, headToHeadTies = {};
        const tieMatchups = [];
        rosterIds.forEach(rid => { weeklyPoints[rid] = {}; schedule[rid] = {}; headToHeadTies[rid] = 0; });

        uniqueMatchups.forEach(m => {
            const weekNum = Number(m.week);
            if (isNaN(weekNum) || weekNum < 1 || weekNum > 14) return;
            const hasP1 = typeof m.team1_score === 'number' && !isNaN(m.team1_score);
            const hasP2 = typeof m.team2_score === 'number' && !isNaN(m.team2_score);
            if (!hasP1 || !hasP2) return;
            const w = String(weekNum), r1 = String(m.team1_roster_id), r2 = String(m.team2_roster_id);
            const p1 = Number(m.team1_score), p2 = Number(m.team2_score);
            if (rosterIdSet.has(r1)) { weeklyPoints[r1][w] = p1; schedule[r1][w] = { opponentId: r2, opponentPoints: p2 }; }
            if (rosterIdSet.has(r2)) { weeklyPoints[r2][w] = p2; schedule[r2][w] = { opponentId: r1, opponentPoints: p1 }; }
            if (rosterIdSet.has(r1) && rosterIdSet.has(r2) && p1 === p2) {
                headToHeadTies[r1] = (headToHeadTies[r1] || 0) + 1;
                headToHeadTies[r2] = (headToHeadTies[r2] || 0) + 1;
                tieMatchups.push({ week: w, roster1: r1, roster2: r2, score: p1 });
            }
        });

        const allPlay = {};
        rosterIds.forEach(rid => { allPlay[rid] = { wins: 0, losses: 0, ties: 0, pointsFor: 0 }; });
        const weeksSet = new Set();
        rosterIds.forEach(rid => Object.keys(weeklyPoints[rid] || {}).forEach(w => { const wn = Number(w); if (!isNaN(wn) && wn >= 1 && wn <= 14) weeksSet.add(String(wn)); }));
        const weeks = Array.from(weeksSet).sort((a,b) => Number(a) - Number(b));
        const fullyCompletedWeeks = weeks.filter(w => rosterIds.every(rid => weeklyPoints[rid] && Object.prototype.hasOwnProperty.call(weeklyPoints[rid], w)));

        let weeksToUse = fullyCompletedWeeks;
        const currentNFLWeek = nflState?.week ? Number(nflState.week) : null;
        const nflSeason = nflState?.season ? Number(nflState.season) : null;
        const isCurrentSeason = Number(selectedSeason) === Number(currentSeason) && nflSeason === Number(selectedSeason);
        if (isCurrentSeason && currentNFLWeek && !isNaN(currentNFLWeek)) weeksToUse = weeksToUse.filter(w => Number(w) < currentNFLWeek);

        weeksToUse.forEach(week => {
            const scores = rosterIds.map(rid => ({ rid, pts: weeklyPoints[rid][week] ?? 0 }));
            scores.forEach(s => {
                let w = 0, l = 0, t = 0;
                scores.forEach(o => {
                    if (o.rid === s.rid) return;
                    if (s.pts > o.pts) w++; else if (s.pts < o.pts) l++; else t++;
                });
                allPlay[s.rid].wins += w; allPlay[s.rid].losses += l; allPlay[s.rid].ties += t; allPlay[s.rid].pointsFor += s.pts;
            });
        });

        const filteredTieMatchups = tieMatchups.filter(tm => weeksToUse.includes(String(tm.week)));
        const headToHeadCounts = {};
        rosterIds.forEach(rid => { headToHeadCounts[rid] = 0; });
        filteredTieMatchups.forEach(tm => {
            if (rosterIdSet.has(tm.roster1)) headToHeadCounts[tm.roster1] = (headToHeadCounts[tm.roster1] || 0) + 1;
            if (rosterIdSet.has(tm.roster2)) headToHeadCounts[tm.roster2] = (headToHeadCounts[tm.roster2] || 0) + 1;
        });

        const standingsArr = rosterIds.map(rid => {
            const name = rosterIdToName[rid] || getTeamNameByRosterId(rid) || rid;
            const rec = allPlay[rid];
            const totalMatches = rec.wins + rec.losses + rec.ties;
            const pct = totalMatches > 0 ? (rec.wins + 0.5 * rec.ties) / totalMatches : 0;
            const maxRegularWeeks = weeksToUse.length || 14;
            const h2hTies = Math.max(0, Math.min(headToHeadCounts[rid] || 0, maxRegularWeeks));
            return { rosterId: rid, teamName: name, wins: rec.wins, losses: rec.losses, ties: h2hTies, pointsFor: rec.pointsFor, pct };
        }).sort((a, b) => b.pct - a.pct || b.pointsFor - a.pointsFor);

        result.allPlayStandings = standingsArr;
        result.weeklyPointsMap = weeklyPoints;
        result.scheduleMap = schedule;
        result.headToHeadTies = headToHeadCounts;
        result.weeksUsed = weeksToUse;
        result.tieMatchups = filteredTieMatchups;
        return result;
    }, [selectedSeason, historicalData, nflState, getTeamName, seasonStandings, currentSeason]);

    useEffect(() => {
        if (!selectedSeason || !historicalData || String(selectedSeason) === String(currentSeason)) {
            setSeasonSurvivorWinner('N/A'); return;
        }
        const rosters = historicalData.rostersBySeason?.[selectedSeason] || [];
        if (!rosters.length) { setSeasonSurvivorWinner('N/A'); return; }

        const rosterIdToOwner = {};
        rosters.forEach(r => { rosterIdToOwner[String(r.roster_id)] = r.owner_id; });
        const aliveSet = new Set(Object.values(rosterIdToOwner));
        const eliminatedSet = new Set();
        const rosterIds = rosters.map(r => String(r.roster_id));
        const weeksSet = new Set();
        rosterIds.forEach(rid => Object.keys(weeklyPointsMap?.[rid] || {}).forEach(w => weeksSet.add(w)));
        const weeks = Array.from(weeksSet).map(Number).filter(n => !isNaN(n)).sort((a,b) => a-b);

        for (const wk of weeks) {
            if (aliveSet.size <= 1) break;
            const aliveScores = [];
            rosterIds.forEach(rid => {
                const ownerId = rosterIdToOwner[rid];
                if (!aliveSet.has(ownerId) || eliminatedSet.has(ownerId)) return;
                const pts = weeklyPointsMap?.[rid]?.[String(wk)];
                if (typeof pts === 'number' && !isNaN(pts)) aliveScores.push({ ownerId, pts });
            });
            if (new Set(aliveScores.map(s => s.ownerId)).size < aliveSet.size) continue;
            let minPoints = Infinity;
            aliveScores.forEach(s => { if (s.pts < minPoints) minPoints = s.pts; });
            const mins = aliveScores.filter(s => s.pts === minPoints).map(s => s.ownerId);
            if (!mins.length) continue;
            mins.sort();
            eliminatedSet.add(mins[0]); aliveSet.delete(mins[0]);
        }

        let winner = 'N/A';
        if (aliveSet.size === 1) {
            const winnerOwner = Array.from(aliveSet)[0];
            winner = getTeamName ? getTeamName(winnerOwner, selectedSeason) : String(winnerOwner);
        }
        setSeasonSurvivorWinner(winner);
    }, [selectedSeason, historicalData, weeklyPointsMap, getTeamName, currentSeason]);

    const computeMockAgainstSchedule = useCallback((subjectRosterId, scheduleOwnerRosterId) => {
        if (!subjectRosterId || !scheduleOwnerRosterId) return null;
        const weeks = scheduleMap[scheduleOwnerRosterId] ? Object.keys(scheduleMap[scheduleOwnerRosterId]) : [];
        let wins = 0, losses = 0, ties = 0, pointsFor = 0, pointsAgainst = 0, countedWeeks = 0;
        const currentNFLWeek = nflState?.week ? Number(nflState.week) : null;
        const isCurrentSeason = Number(selectedSeason) === Number(currentSeason);
        weeks.forEach(w => {
            const wn = Number(w);
            if (isCurrentSeason && !isNaN(currentNFLWeek) && currentNFLWeek && wn >= currentNFLWeek) return;
            const oppEntry = scheduleMap[scheduleOwnerRosterId][w];
            if (oppEntry && String(oppEntry.opponentId) === String(subjectRosterId)) return;
            const subjPts = weeklyPointsMap[subjectRosterId]?.[w];
            const oppPts = oppEntry ? (weeklyPointsMap[oppEntry.opponentId]?.[w] ?? oppEntry.opponentPoints ?? null) : null;
            if (typeof subjPts !== 'number' || isNaN(subjPts) || typeof oppPts !== 'number' || isNaN(oppPts)) return;
            pointsFor += subjPts; pointsAgainst += oppPts; countedWeeks++;
            if (subjPts > oppPts) wins++; else if (subjPts < oppPts) losses++; else ties++;
        });
        const total = wins + losses + ties;
        const pct = total > 0 ? (wins + 0.5 * ties) / total : 0;
        return { wins, losses, ties, pointsFor, pointsAgainst, pct, totalWeeks: countedWeeks };
    }, [weeklyPointsMap, scheduleMap, nflState, selectedSeason, currentSeason]);

    const hasPodiumResults = seasonChampion !== 'N/A' || seasonRunnerUp !== 'N/A' || seasonThirdPlace !== 'N/A';
    const seasonHasTies = seasonStandings.some(t => t.ties && t.ties > 0);
    const allPlayHasTies = (allPlayStandings || []).some(t => t.ties && t.ties > 0);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Season Breakdown</h2>
                <div className="flex items-center gap-2">
                    <label htmlFor="season-select" className="text-sm font-medium text-gray-300 whitespace-nowrap">Season</label>
                    <select
                        id="season-select"
                        value={selectedSeason || ''}
                        onChange={(e) => setSelectedSeason(Number(e.target.value))}
                        className="px-3 py-1.5 border border-white/20 rounded-lg shadow-sm text-sm text-white bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        {seasons.length === 0 && <option value="">No Seasons Available</option>}
                        {seasons.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>

            {!selectedSeason && !loading && !error && (
                <p className="text-center text-gray-400 text-sm py-12">Select a season to view its breakdown.</p>
            )}

            {selectedSeason && (
                <div className="space-y-10">

                    {/* ── Podium ─────────────────────────────────────────── */}
                    {hasPodiumResults && (
                        <section>
                            <SectionHeading>{selectedSeason} Playoff Results</SectionHeading>
                            {/* Mobile: stacked compact list. Desktop: side-by-side podium */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-center sm:gap-3">

                                {/* 1st — always on top on mobile */}
                                {seasonChampion !== 'N/A' && (
                                    <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl shadow-lg px-4 py-3 sm:flex-col sm:items-center sm:text-center sm:bg-gradient-to-b sm:from-yellow-300 sm:to-yellow-500 sm:rounded-2xl sm:px-6 sm:py-6 sm:w-56 order-1 sm:order-2">
                                        <span className="text-3xl sm:text-5xl sm:mb-2 flex-shrink-0">🏆</span>
                                        <div className="sm:contents">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-900/70 leading-tight">Sween Bowl Champion</div>
                                                <div className="text-sm font-bold text-white leading-snug">{seasonChampion}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 2nd */}
                                {seasonRunnerUp !== 'N/A' && (
                                    <div className="flex items-center gap-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl shadow-md px-4 py-3 sm:flex-col sm:items-center sm:text-center sm:bg-gradient-to-b sm:rounded-2xl sm:px-5 sm:py-5 sm:w-44 order-2 sm:order-1">
                                        <span className="text-2xl sm:text-4xl sm:mb-2 flex-shrink-0">🥈</span>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 leading-tight">Runner-up</div>
                                            <div className="text-sm font-bold text-gray-800 leading-snug">{seasonRunnerUp}</div>
                                        </div>
                                    </div>
                                )}

                                {/* 3rd */}
                                {seasonThirdPlace !== 'N/A' && (
                                    <div className="flex items-center gap-3 bg-gradient-to-r from-amber-600 to-amber-700 rounded-xl shadow-md px-4 py-3 sm:flex-col sm:items-center sm:text-center sm:bg-gradient-to-b sm:from-amber-600 sm:to-amber-800 sm:rounded-2xl sm:px-5 sm:py-5 sm:w-44 order-3">
                                        <span className="text-2xl sm:text-4xl sm:mb-2 flex-shrink-0">🥉</span>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80 leading-tight">3rd Place</div>
                                            <div className="text-sm font-bold text-white leading-snug">{seasonThirdPlace}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Top Points Scorers ──────────────────────────────── */}
                    {selectedSeason && seasonalMetrics[selectedSeason] && String(selectedSeason) !== String(currentSeason) && (() => {
                        const teams = Object.values(seasonalMetrics[selectedSeason] || {});
                        const top3 = teams.slice().sort((a, b) => (b.pointsFor || 0) - (a.pointsFor || 0)).slice(0, 3);
                        const medals = ['🥇', '🥈', '🥉'];
                        const bg = [
                            'bg-yellow-400/20 border-yellow-400/30',
                            'bg-gray-400/20 border-gray-400/30',
                            'bg-amber-700/20 border-amber-600/30',
                        ];
                        const nameColor = ['text-yellow-100', 'text-gray-100', 'text-amber-100'];
                        const ptColor = ['text-yellow-300/70', 'text-gray-300/70', 'text-amber-300/70'];
                        return (
                            <section>
                                <SectionHeading>Top Points Scorers</SectionHeading>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {top3.map((t, i) => (
                                        <div key={t.rosterId || i} className={`rounded-xl border p-3.5 flex items-center gap-3 ${bg[i]}`}>
                                            <span className="text-2xl flex-shrink-0">{medals[i]}</span>
                                            <div className="min-w-0">
                                                <div className={`font-semibold text-sm truncate ${nameColor[i]}`}>{t.teamName || getTeamName(t.ownerId, selectedSeason)}</div>
                                                <div className={`text-xs mt-0.5 ${ptColor[i]}`}>{formatScore(Number(t.pointsFor || 0), 2)} pts</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })()}

                    {/* ── Season Stats Grid ───────────────────────────────── */}
                    {seasonStats && (
                        <section>
                            <SectionHeading>Season Awards</SectionHeading>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {String(selectedSeason) !== String(currentSeason) && (
                                    <StatCard color="blue" label="Points Champion">
                                        {seasonStats.pointsChampion.teamName} &mdash; {formatScore(Number(seasonStats.pointsChampion.pointsFor ?? 0), 2)} pts
                                    </StatCard>
                                )}
                                {String(selectedSeason) !== String(currentSeason) && (
                                    <StatCard color="emerald" label="Regular Season Champion">
                                        {seasonStats.regularSeasonChampion.teamName} ({seasonStats.regularSeasonChampion.wins}-{seasonStats.regularSeasonChampion.losses}-{seasonStats.regularSeasonChampion.ties})
                                    </StatCard>
                                )}
                                <StatCard color="green" label="Best Record">
                                    {seasonStats.bestRecord.teamName} ({seasonStats.bestRecord.wins}-{seasonStats.bestRecord.losses}-{seasonStats.bestRecord.ties})
                                </StatCard>
                                <StatCard color="yellow" label="Luckiest Team">
                                    {seasonStats.luckiest.teamName} &mdash; {typeof seasonStats.luckiest.luckRating === 'number' ? formatScore(seasonStats.luckiest.luckRating, 3) : 'N/A'}
                                </StatCard>
                                <StatCard color="red" label="Unluckiest Team">
                                    {seasonStats.unluckiest.teamName} &mdash; {typeof seasonStats.unluckiest.luckRating === 'number' ? formatScore(seasonStats.unluckiest.luckRating, 3) : 'N/A'}
                                </StatCard>
                                <StatCard color="purple" label="All-Play Champion">
                                    {seasonStats.allPlayChamp.teamName} &mdash; {formatScore((seasonStats.allPlayChamp.allPlayWinPercentage * 100) ?? 0, 1)}%
                                </StatCard>
                                <StatCard color="pink" label="Blowout King">
                                    {seasonStats.blowoutKing.teamName} &mdash; {seasonStats.blowoutKing.blowoutWins} blowout wins
                                </StatCard>
                                <StatCard color="orange" label="Slim Margin Master">
                                    {seasonStats.slimMaster.teamName} &mdash; {seasonStats.slimMaster.slimWins} slim wins
                                </StatCard>
                                <StatCard color="indigo" label="Weekly Top Scorer">
                                    {seasonStats.topScorer.teamName} &mdash; {seasonStats.topScorer.topScoreWeeksCount}×
                                </StatCard>
                                <StatCard color="teal" label="Highest Single-Week Score">
                                    {seasonStats.highestWeek.team} &mdash; {formatScore(typeof seasonStats.highestWeek.score === 'number' ? seasonStats.highestWeek.score : NaN, 2)} pts (Wk {seasonStats.highestWeek.week})
                                </StatCard>
                                <StatCard color="gray" label="Lowest Single-Week Score">
                                    {seasonStats.lowestWeek.team} &mdash; {formatScore(typeof seasonStats.lowestWeek.score === 'number' ? seasonStats.lowestWeek.score : NaN, 2)} pts (Wk {seasonStats.lowestWeek.week})
                                </StatCard>
                                <StatCard color="white" label="Survivor Winner">
                                    {seasonSurvivorWinner}
                                </StatCard>
                            </div>
                        </section>
                    )}

                    {/* ── Season Standings ────────────────────────────────── */}
                    <section>
                        <SectionHeading>Season Standings</SectionHeading>
                        {seasonStandings.length > 0 ? (
                            <>
                                {/* Mobile cards */}
                                <div className="sm:hidden space-y-2">
                                    {seasonStandings.map((team, idx) => {
                                        const m = seasonalMetrics?.[selectedSeason]?.[team.rosterId] || {};
                                        const dprVal = m.adjustedDPR ?? m.dpr ?? null;
                                        const pf = m.pointsFor ?? team.pointsFor ?? 0;
                                        const pa = m.pointsAgainst ?? team.pointsAgainst ?? 0;
                                        const rec = `${team.wins || 0}-${team.losses || 0}${team.ties ? `-${team.ties}` : ''}`;
                                        const luck = typeof m.luckRating === 'number' ? formatScore(m.luckRating, 3) : 'N/A';
                                        return (
                                            <div key={team.rosterId} className="bg-white/10 rounded-xl border border-white/10 p-3.5 flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm text-white truncate">{team.teamName}</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">{rec} · DPR {dprVal ? formatScore(Number(dprVal), 3) : 'N/A'}</div>
                                                </div>
                                                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                                                    <div>PF {formatScore(Number(pf), 2)}</div>
                                                    <div>PA {formatScore(Number(pa), 2)}</div>
                                                    <div>Luck {luck}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop table */}
                                <TableWrapper>
                                    <table className="hidden sm:table min-w-full bg-transparent">
                                        <thead>
                                            <tr>
                                                <Th>#</Th>
                                                <Th>Team</Th>
                                                <Th align="center">DPR</Th>
                                                <Th align="center">Record</Th>
                                                <Th align="center">PF</Th>
                                                <Th align="center">PA</Th>
                                                <Th align="center">Luck</Th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {seasonStandings.map((team, idx) => {
                                                const m = seasonalMetrics?.[selectedSeason]?.[team.rosterId] || {};
                                                const dprVal = m.adjustedDPR ?? m.dpr ?? null;
                                                const pf = m.pointsFor ?? team.pointsFor ?? 0;
                                                const pa = m.pointsAgainst ?? team.pointsAgainst ?? 0;
                                                const rec = `${team.wins || 0}-${team.losses || 0}${team.ties ? `-${team.ties}` : ''}`;
                                                const luck = typeof m.luckRating === 'number' ? formatScore(m.luckRating, 3) : 'N/A';
                                                return (
                                                    <tr key={team.rosterId} className="hover:bg-white/5 transition-colors">
                                                        <Td bold>{idx + 1}</Td>
                                                        <Td>{team.teamName}</Td>
                                                        <Td align="center">{dprVal ? formatScore(Number(dprVal), 3) : 'N/A'}</Td>
                                                        <Td align="center">{rec}</Td>
                                                        <Td align="center">{formatScore(Number(pf), 2)}</Td>
                                                        <Td align="center">{formatScore(Number(pa), 2)}</Td>
                                                        <Td align="center">{luck}</Td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </TableWrapper>
                            </>
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-6">No standings data available for this season.</p>
                        )}
                    </section>

                    {/* ── All-Play Standings ──────────────────────────────── */}
                    <section>
                        <SectionHeading>All-Play Standings</SectionHeading>
                        {allPlayStandings && allPlayStandings.length > 0 ? (
                            <>
                                {/* Mobile */}
                                <div className="sm:hidden space-y-2 mb-4">
                                    {allPlayStandings.map((t, idx) => (
                                        <div key={t.rosterId} className="bg-white/10 rounded-xl border border-white/10 p-3.5 flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm text-white truncate">{t.teamName}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{t.wins}-{t.losses}</div>
                                            </div>
                                            <div className="text-xs text-gray-300 flex-shrink-0">{formatDecimalFraction(t.pct)}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop */}
                                <TableWrapper>
                                    <table className="hidden sm:table min-w-full bg-transparent">
                                        <thead>
                                            <tr>
                                                <Th>#</Th>
                                                <Th>Team</Th>
                                                <Th align="center">W</Th>
                                                <Th align="center">L</Th>
                                                {allPlayHasTies && <Th align="center">T</Th>}
                                                <Th align="center">Pct</Th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {allPlayStandings.map((t, idx) => (
                                                <tr key={t.rosterId} className="hover:bg-white/5 transition-colors">
                                                    <Td bold>{idx + 1}</Td>
                                                    <Td>{t.teamName}</Td>
                                                    <Td align="center">{t.wins}</Td>
                                                    <Td align="center">{t.losses}</Td>
                                                    {allPlayHasTies && <Td align="center">{t.ties}</Td>}
                                                    <Td align="center">{formatDecimalFraction(t.pct)}</Td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </TableWrapper>
                            </>
                        ) : (
                            <p className="text-sm text-gray-400 py-4">All-play data is not available for this season.</p>
                        )}

                        {/* ── Hypothetical Schedule Tool ──────────────────── */}
                        <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-5">
                            <h4 className="font-bold text-white mb-1">Hypothetical Schedule</h4>
                            <p className="text-xs text-gray-400 mb-4">Pick a team to simulate their W/L record against every other team's schedule.</p>

                            <div className="mb-4 max-w-xs">
                                <label className="block text-xs font-medium text-gray-400 mb-1">Subject Team</label>
                                {/* bg-gray-800 ensures option elements are readable — bg-white/10 makes options invisible on most browsers */}
                                <select
                                    className="w-full px-3 py-1.5 border border-white/20 rounded-lg text-sm text-white bg-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={hypoSubject}
                                    onChange={(e) => setHypoSubject(e.target.value)}
                                >
                                    <option value="" className="bg-gray-800 text-gray-300">Select a team…</option>
                                    {allPlayStandings.map(t => <option key={t.rosterId} value={t.rosterId} className="bg-gray-800 text-white">{t.teamName}</option>)}
                                </select>
                            </div>

                            {!hypoSubject ? (
                                <p className="text-sm text-gray-500">Choose a team above to see results.</p>
                            ) : (
                                <>
                                    {/* Mobile */}
                                    <div className="sm:hidden space-y-2">
                                        {allPlayStandings.filter(o => o.rosterId !== hypoSubject).map(o => {
                                            const res = computeMockAgainstSchedule(hypoSubject, o.rosterId) || { wins: 0, losses: 0, pct: 0 };
                                            return (
                                                <div key={o.rosterId} className="bg-white/10 rounded-xl border border-white/10 p-3 flex items-center justify-between">
                                                    <span className="text-sm font-medium text-white truncate">{o.teamName}</span>
                                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-3">{res.wins}-{res.losses} · {formatDecimalFraction(res.pct)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Desktop */}
                                    <TableWrapper>
                                        <table className="hidden sm:table min-w-full bg-transparent">
                                            <thead>
                                                <tr>
                                                    <Th>Opponent's Schedule</Th>
                                                    <Th align="center">W</Th>
                                                    <Th align="center">L</Th>
                                                    <Th align="center">Win %</Th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {allPlayStandings.filter(o => o.rosterId !== hypoSubject).map((o) => {
                                                    const res = computeMockAgainstSchedule(hypoSubject, o.rosterId) || { wins: 0, losses: 0, pct: 0 };
                                                    return (
                                                        <tr key={o.rosterId} className="hover:bg-white/5 transition-colors">
                                                            <Td bold>{o.teamName}</Td>
                                                            <Td align="center">{res.wins}</Td>
                                                            <Td align="center">{res.losses}</Td>
                                                            <Td align="center">{formatDecimalFraction(res.pct)}</Td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </TableWrapper>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default SeasonBreakdown;
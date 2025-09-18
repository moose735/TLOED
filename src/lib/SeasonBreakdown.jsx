import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';

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
    const [hypoSubject, setHypoSubject] = useState('');
    const [mockResults, setMockResults] = useState([]);

    // Memoize the result of calculateAllLeagueMetrics
    const { seasonalMetrics, careerDPRData } = useMemo(() => {
        if (!historicalData || !nflState || loading || error) {
            return { seasonalMetrics: {}, careerDPRData: [] };
        }

        return calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
    }, [historicalData, nflState, loading, error, getTeamName]);


    // Effect to populate seasons dropdown and set default selected season
    useEffect(() => {
        if (!loading && !error && historicalData) {
            const allYears = new Set();
            
            // Use seasonalMetrics keys as the primary source for available years
            if (seasonalMetrics && Object.keys(seasonalMetrics).length > 0) {
                Object.keys(seasonalMetrics).forEach(year => allYears.add(Number(year)));
            } else {
                // Fallback to historicalData.matchupsBySeason as primary source
                if (historicalData.matchupsBySeason) {
                    Object.keys(historicalData.matchupsBySeason).forEach(year => allYears.add(Number(year)));
                }
                if (historicalData.seasonAwardsSummary) {
                    Object.keys(historicalData.seasonAwardsSummary).forEach(year => allYears.add(Number(year)));
                }
                if (historicalData.winnersBracketBySeason) {
                    Object.keys(historicalData.winnersBracketBySeason).forEach(year => allYears.add(Number(year)));
                }
            }

            const sortedYears = Array.from(allYears).sort((a, b) => b - a);
            setSeasons(sortedYears);

            // Set the most recent year or currentSeason as default
            if (sortedYears.length > 0) {
                const defaultSeason = currentSeason && sortedYears.includes(Number(currentSeason)) 
                    ? Number(currentSeason) 
                    : sortedYears[0];
                setSelectedSeason(defaultSeason);
            }
        }
    }, [loading, error, historicalData, seasonalMetrics, currentSeason]);

    // Effect to calculate standings and champion for the selected season
    useEffect(() => {
        if (selectedSeason && historicalData && seasonalMetrics[selectedSeason]) {
            const currentSeasonMetrics = seasonalMetrics[selectedSeason];
            const currentSeasonRosters = historicalData.rostersBySeason[selectedSeason]; // Still need rosters for owner_id mapping

            if (!currentSeasonMetrics || !currentSeasonRosters) {
                setSeasonStandings([]);
                setSeasonChampion('N/A');
                setSeasonRunnerUp('N/A');
                setSeasonThirdPlace('N/A');
                return;
            }

            // --- Calculate Standings using seasonalMetrics ---
            const standingsArray = Object.values(currentSeasonMetrics).map(teamData => {
                // Use the teamName already resolved by calculateAllLeagueMetrics
                return {
                    teamName: teamData.teamName,
                    wins: teamData.wins,
                    losses: teamData.losses,
                    ties: teamData.ties,
                    pointsFor: teamData.pointsFor,
                    pointsAgainst: teamData.pointsAgainst,
                    rosterId: teamData.rosterId,
                    ownerId: teamData.ownerId,
                };
            });

            // Sort standings
            const sortedStandings = standingsArray.sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (a.losses !== b.losses) return a.losses - b.losses;
                return b.pointsFor - a.pointsFor;
            });
            setSeasonStandings(sortedStandings);

            // --- Determine Champion, Runner-Up, and Third Place for the selected season ---
            let champion = 'N/A';
            let runnerUp = 'N/A';
            let thirdPlace = 'N/A';

            if (historicalData.winnersBracketBySeason && historicalData.winnersBracketBySeason[selectedSeason]) {
                const winnersBracket = historicalData.winnersBracketBySeason[selectedSeason];

                // Find Championship Game (p: 1)
                const championshipGame = winnersBracket.find(matchup => matchup.p === 1 && matchup.w && matchup.l);
                if (championshipGame) {
                    const championRosterId = String(championshipGame.w).trim();
                    const runnerUpRosterId = String(championshipGame.l).trim();

                    const winningRoster = currentSeasonRosters.find(r => String(r.roster_id) === championRosterId);
                    const runnerUpRoster = currentSeasonRosters.find(r => String(r.roster_id) === runnerUpRosterId);

                    if (winningRoster && winningRoster.owner_id) {
                        champion = getTeamName(winningRoster.owner_id, selectedSeason);
                    }
                    if (runnerUpRoster && runnerUpRoster.owner_id) {
                        runnerUp = getTeamName(runnerUpRoster.owner_id, selectedSeason);
                    }
                }

                // Find 3rd Place Game (p: 3)
                const thirdPlaceGame = winnersBracket.find(matchup => matchup.p === 3 && matchup.w);
                if (thirdPlaceGame) {
                    const thirdPlaceRosterId = String(thirdPlaceGame.w).trim();
                    const thirdPlaceRoster = currentSeasonRosters.find(r => String(r.roster_id) === thirdPlaceRosterId);

                    if (thirdPlaceRoster && thirdPlaceRoster.owner_id) {
                        thirdPlace = getTeamName(thirdPlaceRoster.owner_id, selectedSeason);
                    }
                }
            }

            // Fallback to seasonAwardsSummary/awardsSummary for champion if playoff data is missing
            if (champion === 'N/A' && historicalData.seasonAwardsSummary && historicalData.seasonAwardsSummary[selectedSeason]) {
                const summary = historicalData.seasonAwardsSummary[selectedSeason];
                if (summary.champion && summary.champion !== 'N/A' && summary.champion.trim() !== '') {
                    const potentialChampionValue = summary.champion.trim();
                    const resolvedName = getTeamName(potentialChampionValue, selectedSeason);
                    if (resolvedName !== 'Unknown Team') {
                        champion = resolvedName;
                    } else {
                        champion = potentialChampionValue;
                    }
                }
            }
            if (champion === 'N/A' && historicalData.awardsSummary && historicalData.awardsSummary[selectedSeason]) {
                const summary = historicalData.awardsSummary[selectedSeason];
                const champKey = summary.champion || summary["Champion"];
                if (champKey && champKey !== 'N/A' && String(champKey).trim() !== '') {
                    const potentialChampionValue = String(champKey).trim();
                    const resolvedName = getTeamName(potentialChampionValue, selectedSeason);
                    if (resolvedName !== 'Unknown Team') {
                        champion = resolvedName;
                    } else {
                        champion = potentialChampionValue;
                    }
                }
            }
            setSeasonChampion(champion);
            setSeasonRunnerUp(runnerUp);
            setSeasonThirdPlace(thirdPlace);

        } else if (!selectedSeason) {
            setSeasonStandings([]);
            setSeasonChampion('N/A');
            setSeasonRunnerUp('N/A');
            setSeasonThirdPlace('N/A');
        }
    }, [selectedSeason, historicalData, seasonalMetrics, getTeamName]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-6 bg-white rounded-lg shadow-md">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold text-gray-700">Loading season data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
                    <p className="font-bold text-xl mb-2">Error Loading Data</p>
                    <p className="text-base">Failed to load season data: {error.message || String(error)}</p>
                </div>
            </div>
        );
    }

    // Helper to get team name by rosterId
    const getTeamNameByRosterId = (rosterId) => {
        const team = seasonStandings.find(t => String(t.rosterId) === String(rosterId));
        return team ? team.teamName : 'Unknown';
    };

    const formatPct = (v) => {
        if (typeof v === 'number' && !isNaN(v)) return `${(v * 100).toFixed(1)}%`;
        return 'N/A';
    };

    // Compute season stats summary
    let seasonStats = null;
    if (selectedSeason && seasonalMetrics[selectedSeason]) {
        const teams = Object.values(seasonalMetrics[selectedSeason]);
        // Points Champion
        const pointsChampion = teams.reduce((a, b) => (a.pointsFor > b.pointsFor ? a : b), {});
        // Best Record
        const bestRecord = teams.reduce((a, b) => (a.wins > b.wins ? a : b), {});
        // Luckiest/Unluckiest
        const luckiest = teams.reduce((a, b) => (a.luckRating > b.luckRating ? a : b), {});
        const unluckiest = teams.reduce((a, b) => (a.luckRating < b.luckRating ? a : b), {});
        // All-Play Champ
        const allPlayChamp = teams.reduce((a, b) => (a.allPlayWinPercentage > b.allPlayWinPercentage ? a : b), {});
        // Blowout King
        const blowoutKing = teams.reduce((a, b) => (a.blowoutWins > b.blowoutWins ? a : b), {});
        // Slim Margin Master
        const slimMaster = teams.reduce((a, b) => (a.slimWins > b.slimWins ? a : b), {});
        // Weekly Top Scorer
        const topScorer = teams.reduce((a, b) => (a.topScoreWeeksCount > b.topScoreWeeksCount ? a : b), {});


        // Highest/Lowest Single-Week Score (ignore undefined/null/zero/negative/empty scores for lowest)
        let highestWeek = { score: -Infinity, team: null, week: null };
        let lowestWeek = { score: Infinity, team: null, week: null };
        if (historicalData.matchupsBySeason && historicalData.matchupsBySeason[selectedSeason]) {
            historicalData.matchupsBySeason[selectedSeason].forEach(m => {
                // Highest
                if (typeof m.team1_score === 'number' && m.team1_score > highestWeek.score) {
                    highestWeek = { score: m.team1_score, team: getTeamNameByRosterId(m.team1_roster_id), week: m.week };
                }
                if (typeof m.team2_score === 'number' && m.team2_score > highestWeek.score) {
                    highestWeek = { score: m.team2_score, team: getTeamNameByRosterId(m.team2_roster_id), week: m.week };
                }
                // Lowest (must be > 0 and not null/undefined)
                if (typeof m.team1_score === 'number' && m.team1_score > 0 && m.team1_score < lowestWeek.score) {
                    lowestWeek = { score: m.team1_score, team: getTeamNameByRosterId(m.team1_roster_id), week: m.week };
                }
                if (typeof m.team2_score === 'number' && m.team2_score > 0 && m.team2_score < lowestWeek.score) {
                    lowestWeek = { score: m.team2_score, team: getTeamNameByRosterId(m.team2_roster_id), week: m.week };
                }
            });
        }
        // If no valid lowest score found, set to N/A
        if (lowestWeek.score === Infinity) {
            lowestWeek = { score: 'N/A', team: 'N/A', week: 'N/A' };
        }

        seasonStats = {
            pointsChampion,
            bestRecord,
            luckiest,
            unluckiest,
            allPlayChamp,
            blowoutKing,
            slimMaster,
            topScorer,
            highestWeek,
            lowestWeek,
        };
    }

    // --- All-Play and Mock Schedule computations ---
    const { allPlayStandings, weeklyPointsMap, scheduleMap, headToHeadTies: memoHeadToHeadTies, weeksUsed: memoWeeksUsed } = useMemo(() => {
        const result = { allPlayStandings: [], weeklyPointsMap: {}, scheduleMap: {} };
        if (!selectedSeason || !historicalData || !historicalData.matchupsBySeason || !historicalData.matchupsBySeason[selectedSeason]) return result;

        const matchupsRaw = historicalData.matchupsBySeason[selectedSeason] || [];
        // Deduplicate matchups by week and roster pair (sort pair so order doesn't matter)
        const uniqueMatchups = [];
        const seenMatchupKeys = new Set();
        matchupsRaw.forEach(m => {
            const wk = String(m.week);
            const a = String(m.team1_roster_id);
            const b = String(m.team2_roster_id);
            // skip self-matchups (data errors where a team is listed against itself)
            if (a === b) return;
            const key = `${wk}:${[a,b].sort().join('-')}`;
            if (seenMatchupKeys.has(key)) return;
            seenMatchupKeys.add(key);
            uniqueMatchups.push(m);
        });

        // Use the season's rosters as the canonical roster set (prevents stray roster ids)
        const currentSeasonRosters = historicalData.rostersBySeason?.[selectedSeason] || [];
        const rosterIds = currentSeasonRosters.map(r => String(r.roster_id));
        const rosterIdSet = new Set(rosterIds);

        // Build rosterId -> ownerId/name maps for correct historical team naming
        const rosterIdToOwner = {};
        const rosterIdToName = {};
        currentSeasonRosters.forEach(r => {
            const rid = String(r.roster_id);
            rosterIdToOwner[rid] = r.owner_id;
            rosterIdToName[rid] = getTeamName ? getTeamName(r.owner_id, selectedSeason) : (r.team_name || `Roster ${rid}`);
        });

    // Build weekly points map: rosterId -> { week: points }
        const weeklyPoints = {};
        // Build schedule map: rosterId -> { week: { opponentId, opponentPoints } }
        const schedule = {};
        // Track head-to-head ties (real matchup ties) separately from pairwise all-play ties
    const headToHeadTies = {};
    const tieMatchups = [];

    // initialize weeklyPoints, schedule and tie counter for only canonical roster ids
    rosterIds.forEach(rid => { weeklyPoints[rid] = {}; schedule[rid] = {}; headToHeadTies[rid] = 0; });

    // Only include regular-season (weeks 1-14) completed matchups: both sides have numeric scores
    uniqueMatchups.forEach(m => {
            const weekNum = Number(m.week);
            if (isNaN(weekNum) || weekNum < 1 || weekNum > 14) return; // skip playoffs or invalid weeks
            const hasP1 = typeof m.team1_score === 'number' && !isNaN(m.team1_score);
            const hasP2 = typeof m.team2_score === 'number' && !isNaN(m.team2_score);
            if (!hasP1 || !hasP2) return; // skip incomplete games

            const w = String(weekNum);
            const r1 = String(m.team1_roster_id);
            const r2 = String(m.team2_roster_id);
            const p1 = Number(m.team1_score);
            const p2 = Number(m.team2_score);

            // only include points/schedule for rosterIds that exist in this season
            if (rosterIdSet.has(r1)) weeklyPoints[r1][w] = p1;
            if (rosterIdSet.has(r2)) weeklyPoints[r2][w] = p2;
            if (rosterIdSet.has(r1)) schedule[r1][w] = { opponentId: r2, opponentPoints: p2 };
            if (rosterIdSet.has(r2)) schedule[r2][w] = { opponentId: r1, opponentPoints: p1 };

            // track head-to-head tie (the actual matchup was a tie)
            if (rosterIdSet.has(r1) && rosterIdSet.has(r2) && p1 === p2) {
                headToHeadTies[r1] = (headToHeadTies[r1] || 0) + 1;
                headToHeadTies[r2] = (headToHeadTies[r2] || 0) + 1;
                tieMatchups.push({ week: w, roster1: r1, roster2: r2, score: p1 });
            }
        });

        // Compute all-play standings: for each week, compare each team's points to all other canonical teams
        const allPlay = {};
        rosterIds.forEach(rid => { allPlay[rid] = { wins: 0, losses: 0, ties: 0, pointsFor: 0 }; });

        // Collect only the regular-season weeks present in weeklyPoints (1-14)
        const weeksSet = new Set();
        rosterIds.forEach(rid => {
            Object.keys(weeklyPoints[rid] || {}).forEach(w => {
                const wn = Number(w);
                if (!isNaN(wn) && wn >= 1 && wn <= 14) weeksSet.add(String(wn));
            });
        });
        const weeks = Array.from(weeksSet).sort((a,b) => Number(a) - Number(b));

        // Keep only weeks that are fully completed for all canonical roster ids
        const fullyCompletedWeeks = weeks.filter(w => rosterIds.every(rid => {
            return weeklyPoints[rid] && Object.prototype.hasOwnProperty.call(weeklyPoints[rid], w);
        }));

        let weeksToUse = fullyCompletedWeeks;
        // If nflState.week is available, exclude the current NFL week (in-progress)
        // But only exclude when viewing the currentSeason; for past seasons we want all completed weeks
        const currentNFLWeek = nflState && nflState.week ? Number(nflState.week) : null;
        const isCurrentSeason = Number(selectedSeason) === Number(currentSeason);
        if (isCurrentSeason && currentNFLWeek && !isNaN(currentNFLWeek)) {
            weeksToUse = weeksToUse.filter(w => Number(w) < currentNFLWeek);
        }

        weeksToUse.forEach(week => {
            // Build array of [rid, pts] for this week
            const scores = rosterIds.map(rid => ({ rid, pts: weeklyPoints[rid][week] ?? 0 }));
            // Compare pairwise: for each team, count how many they'd beat/tie/lose
            scores.forEach(s => {
                const my = s.pts;
                let w = 0, l = 0, t = 0;
                scores.forEach(o => {
                    if (o.rid === s.rid) return;
                    if (my > o.pts) w++;
                    else if (my < o.pts) l++;
                    else t++;
                });
                allPlay[s.rid].wins += w;
                allPlay[s.rid].losses += l;
                allPlay[s.rid].ties += t;
                allPlay[s.rid].pointsFor += my;
            });
            });

        // Filter tieMatchups to only include those in weeksToUse, then recompute head-to-head tie counts
        const filteredTieMatchups = tieMatchups.filter(tm => weeksToUse.includes(String(tm.week)));
        const headToHeadCounts = {};
        rosterIds.forEach(rid => { headToHeadCounts[rid] = 0; });
        filteredTieMatchups.forEach(tm => {
            if (rosterIdSet.has(tm.roster1)) headToHeadCounts[tm.roster1] = (headToHeadCounts[tm.roster1] || 0) + 1;
            if (rosterIdSet.has(tm.roster2)) headToHeadCounts[tm.roster2] = (headToHeadCounts[tm.roster2] || 0) + 1;
        });

        // Convert to standings array (use rosterIdToName for historical accuracy)
    const standingsArr = rosterIds.map(rid => {
            const name = rosterIdToName[rid] || getTeamNameByRosterId(rid) || rid;
            const rec = allPlay[rid];
            const totalMatches = rec.wins + rec.losses + rec.ties;
            const pct = totalMatches > 0 ? (rec.wins + 0.5 * rec.ties) / totalMatches : 0;
            // Use head-to-head ties for display (smaller, more intuitive number)
            // Clamp ties to the number of regular-season weeks captured to avoid anomalous values
            const maxRegularWeeks = weeksToUse.length || 14;
            const rawH2h = headToHeadCounts[rid] || 0;
            const h2hTies = Math.max(0, Math.min(rawH2h, maxRegularWeeks));
            return {
                rosterId: rid,
                teamName: name,
                wins: rec.wins,
                losses: rec.losses,
                ties: h2hTies,
                pointsFor: rec.pointsFor,
                pct
            };
        }).sort((a, b) => b.pct - a.pct || b.pointsFor - a.pointsFor);

        result.allPlayStandings = standingsArr;
        result.weeklyPointsMap = weeklyPoints;
        result.scheduleMap = schedule;
    result.headToHeadTies = headToHeadCounts;
    result.weeksUsed = weeksToUse;
    result.tieMatchups = filteredTieMatchups;
        return result;
    }, [selectedSeason, historicalData, nflState, getTeamName, seasonStandings, currentSeason]);

    // Mock schedule: apply subject team's weekly points against each other team's schedule
    const computeMockAgainstSchedule = useCallback((subjectRosterId, scheduleOwnerRosterId) => {
        if (!subjectRosterId || !scheduleOwnerRosterId) return null;
        const weeks = scheduleMap[scheduleOwnerRosterId] ? Object.keys(scheduleMap[scheduleOwnerRosterId]) : [];
        let wins = 0, losses = 0, ties = 0, pointsFor = 0, pointsAgainst = 0, countedWeeks = 0;
    // Exclude current in-progress NFL week from hypothetical results
        const currentNFLWeek = nflState && nflState.week ? Number(nflState.week) : null;
        const isCurrentSeason = Number(selectedSeason) === Number(currentSeason);

        weeks.forEach(w => {
            const wn = Number(w);
            // Only skip in-progress/future weeks when looking at the current season
            if (isCurrentSeason && !isNaN(currentNFLWeek) && currentNFLWeek && wn >= currentNFLWeek) return; // skip in-progress or future

            const oppEntry = scheduleMap[scheduleOwnerRosterId][w];
            // If the opponent's schedule for this week is playing the subject team, skip counting it (don't count head-to-head ties/wins)
            if (oppEntry && String(oppEntry.opponentId) === String(subjectRosterId)) return;

            const subjPts = weeklyPointsMap[subjectRosterId]?.[w];
            const oppPts = oppEntry ? (weeklyPointsMap[oppEntry.opponentId]?.[w] ?? oppEntry.opponentPoints ?? null) : null;

            // Only count if we have numeric points for both sides
            const hasSubj = typeof subjPts === 'number' && !isNaN(subjPts);
            const hasOpp = typeof oppPts === 'number' && !isNaN(oppPts);
            if (!hasSubj || !hasOpp) return;

            pointsFor += subjPts;
            pointsAgainst += oppPts;
            countedWeeks++;
            if (subjPts > oppPts) wins++;
            else if (subjPts < oppPts) losses++;
            else ties++;
        });

        const total = wins + losses + ties;
        const pct = total > 0 ? (wins + 0.5 * ties) / total : 0;
        return { wins, losses, ties, pointsFor, pointsAgainst, pct, totalWeeks: countedWeeks };
    }, [weeklyPointsMap, scheduleMap, nflState, selectedSeason, currentSeason]);

    // Determine if any podium results exist
    const hasPodiumResults = seasonChampion !== 'N/A' || seasonRunnerUp !== 'N/A' || seasonThirdPlace !== 'N/A';

    const seasonHasTies = seasonStandings.some(t => t.ties && t.ties > 0);
    // allPlayStandings comes from useMemo above; ensure we handle missing value safely
    const allPlayHasTies = (allPlayStandings || []).some(t => t.ties && t.ties > 0);
    const [showDebug, setShowDebug] = useState(false);

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Season Breakdown</h2>

            <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <label htmlFor="season-select" className="text-lg font-semibold text-gray-700">Select Season:</label>
                <select
                    id="season-select"
                    value={selectedSeason || ''}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800 text-lg"
                >
                    {seasons.length === 0 && <option value="">No Seasons Available</option>}
                    {seasons.map(year => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>

            {selectedSeason && (
                <div className="mt-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-20 text-center">{selectedSeason} Season Summary</h3>

                    {/* Podium Section - Now only renders if results exist */}
                    {hasPodiumResults && (
                        <div className="relative flex justify-center items-end h-56 gap-2 md:gap-4 mb-8">
                            {/* 2nd Place */}
                            {seasonRunnerUp !== 'N/A' && (
                                <div className="relative flex flex-col items-center justify-center h-4/5 bg-gray-300 rounded-lg shadow-lg p-2 md:p-4 w-1/3 text-center transition-all duration-300 hover:scale-105">
                                    <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                                        <i className="fas fa-trophy text-gray-500 text-5xl"></i>
                                    </div>
                                    <span className="text-xl md:text-2xl font-bold text-gray-700">2nd Place</span>
                                    <p className="text-base md:text-lg font-semibold text-gray-800">{seasonRunnerUp}</p>
                                </div>
                            )}

                            {/* 1st Place */}
                            {seasonChampion !== 'N/A' && (
                                <div className="relative flex flex-col items-center justify-center h-full bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-lg shadow-lg p-2 md:p-4 w-1/3 text-center transition-all duration-300 hover:scale-105">
                                    <div className="absolute -top-20 left-1/2 -translate-x-1/2">
                                        <span className="text-7xl">🏆</span>
                                    </div>
                                    <span className="text-2xl md:text-3xl font-bold text-white">SWEEN BOWL CHAMPION</span>
                                    <p className="text-lg md:text-xl font-semibold text-white">{seasonChampion}</p>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {seasonThirdPlace !== 'N/A' && (
                                <div className="relative flex flex-col items-center justify-center h-3/5 bg-amber-700 rounded-lg shadow-lg p-2 md:p-4 w-1/3 text-center text-white transition-all duration-300 hover:scale-105">
                                    <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                                        <i className="fas fa-trophy text-amber-800 text-5xl"></i>
                                    </div>
                                    <span className="text-xl md:text-2xl font-bold">3rd Place</span>
                                    <p className="text-base md:text-lg font-semibold">{seasonThirdPlace}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Season Stats Summary Section */}
                    {seasonStats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                            <div className="bg-blue-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-blue-700 mb-1">Points Champion</h4>
                                <div>{seasonStats.pointsChampion.teamName} ({seasonStats.pointsChampion.pointsFor?.toFixed(2)} pts)</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-green-700 mb-1">Best Record</h4>
                                <div>{seasonStats.bestRecord.teamName} ({seasonStats.bestRecord.wins}-{seasonStats.bestRecord.losses}-{seasonStats.bestRecord.ties})</div>
                            </div>
                            <div className="bg-yellow-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-yellow-700 mb-1">Luckiest Team</h4>
                                <div>{seasonStats.luckiest.teamName} ({seasonStats.luckiest.luckRating?.toFixed(2)})</div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-red-700 mb-1">Unluckiest Team</h4>
                                <div>{seasonStats.unluckiest.teamName} ({seasonStats.unluckiest.luckRating?.toFixed(2)})</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-purple-700 mb-1">All-Play Champion</h4>
                                <div>{seasonStats.allPlayChamp.teamName} ({(seasonStats.allPlayChamp.allPlayWinPercentage * 100)?.toFixed(1)}%)</div>
                            </div>
                            <div className="bg-pink-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-pink-700 mb-1">Blowout King</h4>
                                <div>{seasonStats.blowoutKing.teamName} ({seasonStats.blowoutKing.blowoutWins} blowout wins)</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-orange-700 mb-1">Slim Margin Master</h4>
                                <div>{seasonStats.slimMaster.teamName} ({seasonStats.slimMaster.slimWins} slim wins)</div>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-indigo-700 mb-1">Weekly Top Scorer</h4>
                                <div>{seasonStats.topScorer.teamName} ({seasonStats.topScorer.topScoreWeeksCount} times)</div>
                            </div>
                            <div className="bg-teal-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-teal-700 mb-1">Highest Single-Week Score</h4>
                                <div>{seasonStats.highestWeek.team} ({seasonStats.highestWeek.score} pts, Week {seasonStats.highestWeek.week})</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 shadow">
                                <h4 className="font-bold text-gray-700 mb-1">Lowest Single-Week Score</h4>
                                <div>{seasonStats.lowestWeek.team} ({seasonStats.lowestWeek.score} pts, Week {seasonStats.lowestWeek.week})</div>
                            </div>
                        </div>
                    )}

                    {/* Season Standings - responsive (mobile cards + desktop table) */}
                    <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">Season Standings</h3>
                    {seasonStandings.length > 0 ? (
                        <>
                            {/* Mobile Card List */}
                            <div className="sm:hidden space-y-3">
                                {seasonStandings.map((team, idx) => (
                                    <div key={team.rosterId} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3 min-w-0">
                                                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{idx + 1}</div>
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-sm truncate">{team.teamName}</div>
                                                    <div className="text-xs text-gray-500">Record: {team.wins}-{team.losses}{team.ties?`-${team.ties}`:''}</div>
                                                </div>
                                            </div>
                                            <div className="text-right text-sm text-gray-600">PA: {team.pointsAgainst.toFixed(2)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden sm:block overflow-x-auto shadow-lg rounded-lg">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider border-b">Rank</th>
                                            <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider border-b">Team</th>
                                            <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider border-b">W</th>
                                            <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider border-b">L</th>
                                            {seasonHasTies && <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider border-b">T</th>}
                                            <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider border-b">PA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {seasonStandings.map((team, index) => (
                                            <tr key={team.rosterId} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="py-3 px-4 font-medium">{index + 1}</td>
                                                <td className="py-3 px-4">{team.teamName}</td>
                                                <td className="py-3 px-4 text-center">{team.wins}</td>
                                                <td className="py-3 px-4 text-center">{team.losses}</td>
                                                {seasonHasTies && <td className="py-3 px-4 text-center">{team.ties}</td>}
                                                <td className="py-3 px-4 text-center">{team.pointsAgainst.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <p className="text-center text-gray-600">No standings data available for this season.</p>
                    )}



                    {/* All-Play Standings */}
                    <div className="mt-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">All-Play Standings</h3>
                        {allPlayStandings && allPlayStandings.length > 0 ? (
                            <>
                                {/* Mobile */}
                                <div className="sm:hidden space-y-3 mb-4">
                                    {allPlayStandings.map((t, idx) => (
                                        <div key={t.rosterId} className="bg-white rounded-lg shadow-md p-3 border-l-4 border-purple-500">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{idx + 1}</div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-sm truncate">{t.teamName}</div>
                                                        <div className="text-xs text-gray-500">W/L: {t.wins}/{t.losses}</div>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600">Pct: {formatPct(t.pct)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden sm:block overflow-x-auto rounded-lg shadow-md mb-6">
                                    <table className="min-w-full bg-white border border-gray-200">
                                        <thead className="bg-gray-100 text-gray-700 uppercase text-sm">
                                            <tr>
                                                <th className="py-2 px-4 text-left">Rank</th>
                                                <th className="py-2 px-4 text-left">Team</th>
                                                <th className="py-2 px-4 text-center">Wins</th>
                                                <th className="py-2 px-4 text-center">Losses</th>
                                                {allPlayHasTies && <th className="py-2 px-4 text-center">Ties</th>}
                                                <th className="py-2 px-4 text-center">Pct</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allPlayStandings.map((t, idx) => (
                                                <tr key={t.rosterId} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                    <td className="py-2 px-4 font-semibold">{idx + 1}</td>
                                                    <td className="py-2 px-4">{t.teamName}</td>
                                                    <td className="py-2 px-4 text-center">{t.wins}</td>
                                                    <td className="py-2 px-4 text-center">{t.losses}</td>
                                                    {allPlayHasTies && <td className="py-2 px-4 text-center">{t.ties}</td>}
                                                    <td className="py-2 px-4 text-center">{formatPct(t.pct)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-gray-500">All-play data is not available for this season.</p>
                        )}

                        <div className="mt-3">
                            <button className="text-sm text-gray-600 underline" onClick={() => setShowDebug(s => !s)}>{showDebug ? 'Hide' : 'Show'} debug</button>
                                {showDebug && (
                                <div className="mt-2 p-2 bg-white border rounded">
                                    <div className="text-sm mb-2">Weeks used for All-Play: {(memoWeeksUsed || []).join(', ') || 'none'}</div>
                                    <div className="text-sm">Head-to-head ties per roster:</div>
                                    <ul className="text-sm list-disc ml-5">
                                        {Object.keys(memoHeadToHeadTies || {}).map(rid => (
                                            <li key={rid}>{getTeamNameByRosterId(rid)} ({rid}): {memoHeadToHeadTies[rid]}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Hypothetical Schedule Tool: pick a subject team and show simulated W/L vs other teams' schedules */}
                        <div className="mt-4 bg-gray-50 p-4 rounded-lg shadow">
                            <h4 className="font-semibold mb-2">Hypothetical Schedule</h4>
                            <p className="text-sm text-gray-600 mb-3">Select a subject team below to simulate hypothetical W/L results against each other team's schedules.</p>
                            <div className="mb-3">
                                <label className="block text-xs text-gray-500 mb-1">Subject Team</label>
                                <select
                                    className="w-full p-2 border rounded"
                                    value={hypoSubject}
                                    onChange={(e) => setHypoSubject(e.target.value)}
                                >
                                    <option value="">Select team</option>
                                    {allPlayStandings.map(t => (<option key={t.rosterId} value={t.rosterId}>{t.teamName}</option>))}
                                </select>
                            </div>

                            <div id="hypo-results">
                                {!hypoSubject ? (
                                    <p className="text-sm text-gray-500">Choose a subject team to see hypothetical results vs the other schedules.</p>
                                ) : (
                                    <>
                                        {/* Mobile: simple stacked list */}
                                        <div className="sm:hidden space-y-2 mt-3">
                                            {allPlayStandings.filter(o => o.rosterId !== hypoSubject).map((o, idx) => {
                                                const res = computeMockAgainstSchedule(hypoSubject, o.rosterId) || { wins: 0, losses: 0 };
                                                return (
                                                    <div key={o.rosterId} className="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between">
                                                        <div className="font-semibold truncate">{o.teamName}</div>
                                                        <div className="text-sm text-gray-600">{res.wins} - {res.losses}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Desktop table */}
                                        <div className="hidden sm:block overflow-x-auto rounded-lg shadow-md mt-3">
                                            <table className="min-w-full bg-white border border-gray-200">
                                                <thead className="bg-gray-100 text-gray-700 uppercase text-sm">
                                                    <tr>
                                                        <th className="py-2 px-3 text-left">Opponent</th>
                                                        <th className="py-2 px-3 text-center">W</th>
                                                        <th className="py-2 px-3 text-center">L</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {allPlayStandings.filter(o => o.rosterId !== hypoSubject).map((o, idx) => {
                                                        const res = computeMockAgainstSchedule(hypoSubject, o.rosterId) || { wins: 0, losses: 0 };
                                                        return (
                                                            <tr key={o.rosterId} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                                <td className="py-2 px-3 font-semibold">{o.teamName}</td>
                                                                <td className="py-2 px-3 text-center">{res.wins}</td>
                                                                <td className="py-2 px-3 text-center">{res.losses}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {!selectedSeason && !loading && !error && (
                <p className="text-center text-gray-600 text-lg mt-8">Please select a season from the dropdown to view its breakdown.</p>
            )}
        </div>
    );
};

export default SeasonBreakdown;
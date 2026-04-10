import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';
import { formatScore } from '../utils/formatUtils';

const Gamecenter = () => {
    const { historicalData, leagueData, getTeamDetails, processedSeasonalRecords, nflState, loading, nflPlayers } = useSleeperData();
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [seasonWeeks, setSeasonWeeks] = useState([]);
    const [weeklyMatchups, setWeeklyMatchups] = useState([]);
    const [selectedMatchup, setSelectedMatchup] = useState(null);
    const [matchupRosterData, setMatchupRosterData] = useState(null);
    const [weeklyRecap, setWeeklyRecap] = useState(null);
    const [recapLoading, setRecapLoading] = useState(false);

    // ── Shared dark-theme style tokens ───────────────────────────────────────
    const card   = "bg-gray-800 border border-white/10 rounded-xl";
    const cardSm = "bg-white/5 border border-white/10 rounded-xl";

    const availableSeasons = useMemo(() =>
        historicalData?.matchupsBySeason ? Object.keys(historicalData.matchupsBySeason).sort((a, b) => b - a) : [],
        [historicalData]
    );

    const getBestSeason = () => {
        let leagueSeason = null;
        if (leagueData) {
            if (Array.isArray(leagueData) && leagueData[0]?.season) {
                leagueSeason = leagueData[0].season;
            } else if (!Array.isArray(leagueData) && leagueData.season) {
                leagueSeason = leagueData.season;
            }
        }

        const seasonWithData = availableSeasons.find(season =>
            Array.isArray(historicalData?.matchupsBySeason?.[season]) && historicalData.matchupsBySeason[season].length > 0
        );

        if (leagueSeason && seasonWithData && String(leagueSeason) === String(seasonWithData)) {
            return leagueSeason;
        }

        if (seasonWithData) {
            return seasonWithData;
        }

        return leagueSeason || availableSeasons[0] || null;
    };

    // Effect 1: Initialize season/week from context
    useEffect(() => {
        if (!loading && !selectedSeason) {
            const seasonToUse = getBestSeason();
            if (!seasonToUse) return;

            const nflWeek = nflState?.week || 1;
            setSelectedSeason(seasonToUse);

            if (Array.isArray(historicalData?.matchupsBySeason?.[seasonToUse])) {
                const availableWeeks = [...new Set(historicalData.matchupsBySeason[seasonToUse].map(m => Number(m.week)))].sort((a, b) => a - b).filter(w => !(w >= 15 && w <= 17));
                if (availableWeeks.length > 0) {
                    const hasNflWeekData = availableWeeks.includes(Number(nflWeek));
                    const weekToUse = hasNflWeekData ? Number(nflWeek) : availableWeeks[availableWeeks.length - 1];
                    setSelectedWeek(weekToUse);
                } else {
                    setSelectedWeek(Number(nflWeek));
                }
            } else {
                setSelectedWeek(Number(nflWeek));
            }
        }
    }, [loading, leagueData, nflState, historicalData, availableSeasons, selectedSeason]);

    // Effect 2: Populate week dropdown when season changes
    useEffect(() => {
        if (selectedSeason && historicalData?.matchupsBySeason?.[selectedSeason]) {
            const weeksSet = new Set(historicalData.matchupsBySeason[selectedSeason].map(m => Number(m.week)));
            const weeksArray = Array.from(weeksSet).sort((a, b) => a - b);
            setSeasonWeeks(weeksArray);
        }
    }, [selectedSeason, historicalData]);

    // Effect 2b: Auto-select a week when season is selected but no week exists yet
    useEffect(() => {
        if (!loading && selectedSeason && !selectedWeek && historicalData?.matchupsBySeason?.[selectedSeason]) {
            const weeksSet = new Set(historicalData.matchupsBySeason[selectedSeason].map(m => Number(m.week)));
            const weeksArray = Array.from(weeksSet).sort((a, b) => a - b);
            if (weeksArray.length > 0) {
                setSelectedWeek(weeksArray[0]);
            }
        }
    }, [loading, selectedSeason, selectedWeek, historicalData]);

    // Effect 3: Load matchups for selected season/week
    useEffect(() => {
        if (selectedSeason && selectedWeek && historicalData?.matchupsBySeason?.[selectedSeason]) {
            const weekNum = Number(selectedWeek);
            const filtered = historicalData.matchupsBySeason[selectedSeason].filter(m => Number(m.week) === weekNum);
            setWeeklyMatchups(filtered);
        }
    }, [selectedSeason, selectedWeek, historicalData]);

    // Helper: correct average points excluding incomplete weeks
    const getCorrectAveragePoints = useMemo(() => {
        return (rosterId, season) => {
            if (!historicalData?.matchupsBySeason?.[season] || !nflState) {
                return processedSeasonalRecords?.[season]?.[rosterId]?.averageScore ?? 0;
            }
            const currentNFLSeason = parseInt(nflState.season);
            const currentNFLWeek = parseInt(nflState.week);
            const seasonInt = parseInt(season);
            if (seasonInt < currentNFLSeason) {
                return processedSeasonalRecords?.[season]?.[rosterId]?.averageScore ?? 0;
            }
            const matchupsForTeam = historicalData.matchupsBySeason[season].filter(m =>
                String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)
            );
            let totalPoints = 0, completedGames = 0;
            matchupsForTeam.forEach(matchup => {
                const week = parseInt(matchup.week);
                const isTeam1 = String(matchup.team1_roster_id) === String(rosterId);
                const teamScore = isTeam1 ? matchup.team1_score : matchup.team2_score;
                const opponentScore = isTeam1 ? matchup.team2_score : matchup.team1_score;
                const isWeekComplete = seasonInt < currentNFLSeason || (seasonInt === currentNFLSeason && week < currentNFLWeek);
                const isGameCompleted = (teamScore > 0 || opponentScore > 0);
                if (isWeekComplete && isGameCompleted) { totalPoints += teamScore; completedGames++; }
            });
            return completedGames > 0 ? totalPoints / completedGames : 0;
        };
    }, [historicalData, processedSeasonalRecords, nflState]);

    const getAverageAtWeek = (rosterId, season, uptoWeek) => {
        if (!historicalData?.matchupsBySeason?.[season]) {
            return processedSeasonalRecords?.[season]?.[rosterId]?.averageScore ?? 0;
        }
        const matchupsForTeam = historicalData.matchupsBySeason[season].filter(m =>
            (String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)) && Number(m.week) <= Number(uptoWeek)
        );
        let totalPoints = 0, games = 0;
        matchupsForTeam.forEach(m => {
            const isTeam1 = String(m.team1_roster_id) === String(rosterId);
            const teamScore = isTeam1 ? m.team1_score : m.team2_score;
            const opponentScore = isTeam1 ? m.team2_score : m.team1_score;
            if (teamScore > 0 || opponentScore > 0) { totalPoints += teamScore; games++; }
        });
        return games > 0 ? totalPoints / games : 0;
    };

    const getRecordAtWeek = (rosterId, season, uptoWeek) => {
        const matchups = historicalData?.matchupsBySeason?.[season] || [];
        let wins = 0, losses = 0, ties = 0;
        matchups.forEach(m => {
            const week = Number(m.week);
            if (week > Number(uptoWeek)) return;
            const isTeam1 = String(m.team1_roster_id) === String(rosterId);
            const isTeam2 = String(m.team2_roster_id) === String(rosterId);
            if (!isTeam1 && !isTeam2) return;
            const s1 = Number(m.team1_score || 0), s2 = Number(m.team2_score || 0);
            if (s1 === 0 && s2 === 0) return;
            if (s1 === s2) ties++;
            else if ((isTeam1 && s1 > s2) || (isTeam2 && s2 > s1)) wins++;
            else losses++;
        });
        return { wins, losses, ties };
    };

    const teamMatchupHistory = useMemo(() => {
        const history = {};
        if (!historicalData?.matchupsBySeason || !historicalData?.rostersBySeason) return history;
        const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
        const currentNFLWeek = parseInt(nflState?.week || 1);
        Object.keys(historicalData.matchupsBySeason).forEach(season => {
            const seasonRosters = historicalData.rostersBySeason[season];
            if (!seasonRosters) return;
            const rosterIdToOwnerId = seasonRosters.reduce((acc, roster) => { acc[roster.roster_id] = roster.owner_id; return acc; }, {});
            historicalData.matchupsBySeason[season].forEach(matchup => {
                const s1 = Number(matchup.team1_score || 0), s2 = Number(matchup.team2_score || 0);
                const weekInt = Number(matchup.week), seasonInt = Number(season);
                const isHistoricalComplete = seasonInt < currentNFLSeason || (seasonInt === currentNFLSeason && weekInt < currentNFLWeek);
                const hasBothScores = (s1 > 0 && s2 > 0) && (seasonInt < currentNFLSeason || (seasonInt === currentNFLSeason && weekInt < currentNFLWeek));
                if (isHistoricalComplete || hasBothScores) {
                    const owner1 = rosterIdToOwnerId[matchup.team1_roster_id];
                    const owner2 = rosterIdToOwnerId[matchup.team2_roster_id];
                    if (owner1 && owner2) {
                        if (!history[owner1]) history[owner1] = [];
                        if (!history[owner2]) history[owner2] = [];
                        let result1 = 'T'; if (s1 > s2) result1 = 'W'; if (s1 < s2) result1 = 'L';
                        let result2 = 'T'; if (s2 > s1) result2 = 'W'; if (s2 < s1) result2 = 'L';
                        history[owner1].push({ season, week: matchup.week, result: result1, opponent: owner2 });
                        history[owner2].push({ season, week: matchup.week, result: result2, opponent: owner1 });
                    }
                }
            });
        });
        Object.keys(history).forEach(ownerId => {
            history[ownerId].sort((a, b) => a.season !== b.season ? a.season - b.season : a.week - b.week);
        });
        return history;
    }, [historicalData, nflState]);

    const weeklyLuckData = useMemo(() => {
        if (!processedSeasonalRecords || !selectedSeason || !processedSeasonalRecords[selectedSeason]) return {};
        const luckDataForSeason = {};
        const teams = processedSeasonalRecords[selectedSeason];
        Object.keys(teams).forEach(rosterId => {
            const team = teams[rosterId];
            if (team.weeklyLuck) luckDataForSeason[rosterId] = team.weeklyLuck;
        });
        return luckDataForSeason;
    }, [processedSeasonalRecords, selectedSeason]);

    const playoffBracketMetadata = useMemo(() => {
        const lookup = {};
        const normalizeKey = (seasonKey, weekKey, t1, t2) => `${seasonKey}|${weekKey}|${t1}|${t2}`;
        const getBracketStage = (bracketMatch) => {
            if (!bracketMatch) return null;
            const p = Number(bracketMatch.p);
            if (p === 1) return 'Championship';
            if (p === 3) return '3rd Place';
            if (p === 5) return '5th Place';
            if (p === 7) return '7th Place';
            if (bracketMatch.r) return `Round ${bracketMatch.r}`;
            return null;
        };

        const mapBracket = (matches, label) => {
            if (!Array.isArray(matches)) return;
            matches.forEach(match => {
                const seasonKey = String(match.season || selectedSeason || '');
                const weekKey = String(match.week);
                const t1 = String(match.team1_roster_id ?? match.t1 ?? '');
                const t2 = String(match.team2_roster_id ?? match.t2 ?? '');
                const metadata = { bracketLabel: label, stage: getBracketStage(match), rawMatch: match };
                if (t1 && t2) {
                    lookup[normalizeKey(seasonKey, weekKey, t1, t2)] = metadata;
                    lookup[normalizeKey(seasonKey, weekKey, t2, t1)] = metadata;
                } else if (t1 || t2) {
                    lookup[normalizeKey(seasonKey, weekKey, t1 || t2, '')] = metadata;
                }
            });
        };

        if (historicalData?.winnersBracketBySeason) {
            Object.keys(historicalData.winnersBracketBySeason).forEach(season => {
                mapBracket(historicalData.winnersBracketBySeason[season], 'Winners Bracket');
            });
        }
        if (historicalData?.losersBracketBySeason) {
            Object.keys(historicalData.losersBracketBySeason).forEach(season => {
                mapBracket(historicalData.losersBracketBySeason[season], 'Losers Bracket');
            });
        }
        return lookup;
    }, [historicalData, selectedSeason]);

    const getBracketInfoForMatchup = (matchup, season) => {
        if (!matchup || !season) return null;
        const seasonKey = String(season);
        const weekKey = String(matchup.week);
        const t1 = normalizeRosterId(matchup.team1_roster_id);
        const t2 = normalizeRosterId(matchup.team2_roster_id);
        if (t1 && t2) {
            return playoffBracketMetadata[`${seasonKey}|${weekKey}|${t1}|${t2}`] || playoffBracketMetadata[`${seasonKey}|${weekKey}|${t2}|${t1}`] || null;
        }
        if (t1 || t2) {
            const nonNullTeam = t1 || t2;
            return playoffBracketMetadata[`${seasonKey}|${weekKey}|${nonNullTeam}|`] || null;
        }
        return null;
    };

    const getMatchupBracketLabel = (matchup, season) => {
        const bracketInfo = getBracketInfoForMatchup(matchup, season);
        if (!bracketInfo) {
            return matchup.playoffs ? 'Playoffs' : null;
        }
        if (bracketInfo.stage) {
            return `${bracketInfo.bracketLabel} — ${bracketInfo.stage}`;
        }
        return bracketInfo.bracketLabel;
    };

    const getMatchupBracketTitle = (matchup, season) => {
        const bracketInfo = getBracketInfoForMatchup(matchup, season);
        return bracketInfo?.bracketLabel || (matchup.playoffs ? 'Playoffs' : null);
    };

    const normalizeRosterId = (rosterId) => {
        if (rosterId === null || rosterId === undefined) return '';
        return String(rosterId).trim();
    };

    const isByeOnlyMatchup = (matchup) => {
        const t1 = normalizeRosterId(matchup.team1_roster_id);
        const t2 = normalizeRosterId(matchup.team2_roster_id);
        return (!!t1 && !t2) || (!!t2 && !t1);
    };

    const getByeTeamId = (matchup) => normalizeRosterId(matchup.team1_roster_id) || normalizeRosterId(matchup.team2_roster_id);

    const weeklyMatchupGroups = useMemo(() => {
        const groups = {
            'Winners Bracket': { label: 'Winners Bracket', matchups: [], byes: [] },
            'Losers Bracket': { label: 'Losers Bracket', matchups: [], byes: [] },
            'Regular Season': { label: 'Regular Season', matchups: [], byes: [] },
        };

        weeklyMatchups.forEach(matchup => {
            const groupLabel = getMatchupBracketTitle(matchup, selectedSeason) || 'Regular Season';
            if (!groups[groupLabel]) {
                groups[groupLabel] = { label: groupLabel, matchups: [], byes: [] };
            }
            if (isByeOnlyMatchup(matchup)) {
                groups[groupLabel].byes.push(matchup);
            } else {
                groups[groupLabel].matchups.push(matchup);
            }
        });

        return groups;
    }, [weeklyMatchups, selectedSeason, historicalData]);


    const getMatchupTeamDisplay = (rosterId, season) => {
        const normalizedId = normalizeRosterId(rosterId);
        if (!normalizedId || normalizedId.toLowerCase() === 'undefined' || normalizedId.toLowerCase() === 'null') {
            return { name: 'Bye', avatar: 'https://sleepercdn.com/avatars/default_avatar.png', isBye: true };
        }

        const roster = historicalData?.rostersBySeason?.[season]?.find(r => String(r.roster_id) === normalizedId);
        if (!roster) {
            return { name: `Team (ID: ${normalizedId})`, avatar: 'https://sleepercdn.com/avatars/default_avatar.png', isBye: false };
        }

        const owner = roster.owner_id;
        if (!owner) {
            return { name: `Team (ID: ${normalizedId})`, avatar: 'https://sleepercdn.com/avatars/default_avatar.png', isBye: false };
        }

        const details = getTeamDetails(owner, season);
        return { ...details, isBye: false };
    };

    // LocalStorage helpers (cleared on mount)
    const readStoredGameOfWeek = (season, week) => {
        try { const raw = localStorage.getItem('gameOfWeek:v1'); if (!raw) return null; return JSON.parse(raw)?.[season]?.[week] ?? null; } catch (e) { return null; }
    };
    const saveStoredGameOfWeek = (season, week, matchupId) => {
        try {
            const raw = localStorage.getItem('gameOfWeek:v1');
            const map = raw ? JSON.parse(raw) : {};
            if (!map[season]) map[season] = {};
            if (map[season][week]) return;
            map[season][week] = matchupId;
            localStorage.setItem('gameOfWeek:v1', JSON.stringify(map));
        } catch (e) {}
    };
    useEffect(() => {
        try { localStorage.removeItem('gameOfWeek:v1'); localStorage.removeItem('friskyGame:v1'); } catch (e) {}
    }, []);

    const computeBestMatchupId = () => {
        if (!weeklyMatchups?.length) return null;
        const seasonData = processedSeasonalRecords?.[selectedSeason] || {};
        const dprVals = Object.values(seasonData).map(t => Number(t?.dpr ?? 0)).filter(v => !isNaN(v));
        const avgVals = Object.values(seasonData).map(t => Number(t?.averageScore ?? t?.avgPerGame ?? 0)).filter(v => !isNaN(v));
        const dprMin = dprVals.length ? Math.min(...dprVals) : 0, dprMax = dprVals.length ? Math.max(...dprVals) : 1;
        const avgMin = avgVals.length ? Math.min(...avgVals) : 0, avgMax = avgVals.length ? Math.max(...avgVals) : 1;
        const normalize = (v, min, max) => (max === min ? 0.5 : (v - min) / (max - min));
        let bestId = null, bestScore = -Infinity;
        weeklyMatchups.forEach(m => {
            const r1 = String(m.team1_roster_id), r2 = String(m.team2_roster_id);
            const t1 = seasonData[r1] || {}, t2 = seasonData[r2] || {};
            const dpr1 = Number(t1.dpr ?? 0), dpr2 = Number(t2.dpr ?? 0);
            const avg1 = Number(t1.averageScore ?? t1.avgPerGame ?? 0), avg2 = Number(t2.averageScore ?? t2.avgPerGame ?? 0);
            const q1 = normalize(dpr1, dprMin, dprMax) * 0.6 + normalize(avg1, avgMin, avgMax) * 0.4;
            const q2 = normalize(dpr2, dprMin, dprMax) * 0.6 + normalize(avg2, avgMin, avgMax) * 0.4;
            const harmonicQuality = (q1 + q2) > 0 ? (2 * q1 * q2) / (q1 + q2) : 0;
            const dprCloseness = 1 / (1 + Math.abs(dpr1 - dpr2));
            const avgCloseness = 1 / (1 + (Math.abs(avg1 - avg2) / 10));
            const minQuality = Math.min(q1, q2);
            const score = ((0.55 * harmonicQuality) + (0.30 * dprCloseness) + (0.15 * avgCloseness)) * (0.6 + 0.4 * minQuality);
            if (score > bestScore) { bestScore = score; bestId = m.matchup_id; }
        });
        return bestId;
    };

    const gameOfWeekMatchupId = useMemo(() => {
        if (!weeklyMatchups?.length) return null;
        const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
        const currentNFLWeek = parseInt(nflState?.week || 1);
        const isCurrentWeek = (parseInt(selectedSeason) === currentNFLSeason && parseInt(selectedWeek) === currentNFLWeek);
        if (!isCurrentWeek) return null;
        return computeBestMatchupId();
    }, [weeklyMatchups, selectedSeason, selectedWeek, nflState]);

    const computeFriskyGameId = () => {
        if (!weeklyMatchups?.length || !weeklyLuckData) return null;
        const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
        const currentNFLWeek = parseInt(nflState?.week || 1);
        const isCurrentWeek = (parseInt(selectedSeason) === currentNFLSeason && parseInt(selectedWeek) === currentNFLWeek);
        let weekToUseForLuck;
        const anyTeamKey = Object.keys(weeklyLuckData)[0];
        const weeksAvailable = anyTeamKey ? (weeklyLuckData[anyTeamKey] || []).length : 0;
        if (isCurrentWeek) { weekToUseForLuck = weeksAvailable; }
        else { weekToUseForLuck = weeksAvailable >= parseInt(selectedWeek) ? parseInt(selectedWeek) : weeksAvailable; }
        if (weekToUseForLuck <= 0) return null;
        const matchupLuckData = weeklyMatchups.map(m => {
            const t1 = String(m.team1_roster_id), t2 = String(m.team2_roster_id);
            const l1 = weeklyLuckData[t1]?.[weekToUseForLuck - 1] ?? 0;
            const l2 = weeklyLuckData[t2]?.[weekToUseForLuck - 1] ?? 0;
            return { matchupId: m.matchup_id, luckDifference: Math.abs(l1 - l2), team1Luck: l1, team2Luck: l2, t1, t2 };
        }).sort((a, b) => b.luckDifference - a.luckDifference);
        if (!matchupLuckData.length || matchupLuckData[0].luckDifference === 0) return null;
        if (matchupLuckData.length > 1 && String(matchupLuckData[0].matchupId) === String(gameOfWeekMatchupId)) {
            return matchupLuckData[1].matchupId;
        }
        return matchupLuckData[0].matchupId;
    };

    const friskyGameMatchupId = useMemo(() => {
        if (!weeklyMatchups?.length || !weeklyLuckData) return null;
        const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
        const currentNFLWeek = parseInt(nflState?.week || 1);
        const isCurrentWeek = (parseInt(selectedSeason) === currentNFLSeason && parseInt(selectedWeek) === currentNFLWeek);
        if (!isCurrentWeek) return null;
        return computeFriskyGameId();
    }, [weeklyMatchups, weeklyLuckData, selectedSeason, selectedWeek, nflState, gameOfWeekMatchupId]);

    // Fetch detailed roster data for modal
    const fetchMatchupRosterData = async (matchup, season, week) => {
        try {
            setMatchupRosterData(null);
            let leagueId = null;
            const currentSeason = leagueData && Array.isArray(leagueData) ? leagueData[0].season : leagueData?.season;
            if (season === currentSeason) {
                leagueId = leagueData && Array.isArray(leagueData) ? leagueData[0].league_id : leagueData?.league_id;
            } else {
                leagueId = historicalData?.leaguesMetadataBySeason?.[season]?.league_id;
            }
            if (!leagueId) {
                setMatchupRosterData({ error: true, message: `Detailed roster data is not available for the ${season} season.` });
                return;
            }
            const rosterResponse = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
            if (!rosterResponse.ok) throw new Error(`API request failed with status ${rosterResponse.status}`);
            const rosterData = await rosterResponse.json();
            if (rosterData && Array.isArray(rosterData) && rosterData.length > 0) {
                const team1Roster = rosterData.find(r => r.roster_id === parseInt(matchup.team1_roster_id));
                const team2Roster = rosterData.find(r => r.roster_id === parseInt(matchup.team2_roster_id));
                if (team1Roster && team2Roster) {
                    const processedData = {
                        team1: await processRosterLineup(team1Roster, matchup.team1_roster_id),
                        team2: await processRosterLineup(team2Roster, matchup.team2_roster_id)
                    };
                    setMatchupRosterData(processedData);
                } else {
                    setMatchupRosterData({ error: true, message: `Roster details for this matchup are not available.` });
                }
            } else {
                setMatchupRosterData({ error: true, message: `No roster data available for week ${week} of the ${season} season.` });
            }
        } catch (error) {
            setMatchupRosterData({ error: true, message: `Failed to load detailed roster data: ${error.message}` });
        }
    };

    const processRosterLineup = async (rosterData, rosterId) => {
        const lineup = [], bench = [];
        const lineupPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
        if (rosterData.starters && Array.isArray(rosterData.starters)) {
            for (let i = 0; i < rosterData.starters.length; i++) {
                const playerId = rosterData.starters[i];
                const player = nflPlayers?.[playerId];
                const hasPlayed = rosterData.players_points && Object.prototype.hasOwnProperty.call(rosterData.players_points, playerId);
                const points = hasPlayed ? Number(rosterData.players_points?.[playerId] || 0) : 0;
                if (player) {
                    const firstInitial = player.first_name ? `${player.first_name.charAt(0)}.` : '';
                    lineup.push({ playerId, name: `${firstInitial} ${player.last_name}`.trim(), position: player.position, team: player.team, points, hasPlayed: !!hasPlayed, isStarter: true, lineupPosition: lineupPositions[i] || 'FLEX' });
                }
            }
        }
        if (rosterData.players && Array.isArray(rosterData.players)) {
            const starterIds = new Set(rosterData.starters || []);
            for (const playerId of rosterData.players.filter(id => !starterIds.has(id))) {
                const player = nflPlayers?.[playerId];
                const hasPlayed = rosterData.players_points && Object.prototype.hasOwnProperty.call(rosterData.players_points, playerId);
                const points = hasPlayed ? Number(rosterData.players_points?.[playerId] || 0) : 0;
                if (player) {
                    const firstInitial = player.first_name ? `${player.first_name.charAt(0)}.` : '';
                    bench.push({ playerId, name: `${firstInitial} ${player.last_name}`.trim(), position: player.position, team: player.team, points, hasPlayed: !!hasPlayed, isStarter: false });
                }
            }
        }
        return { lineup, bench, totalPoints: rosterData.points || 0 };
    };

    // Event handlers
    const handleSeasonChange = (e) => {
        const newSeason = e.target.value;
        setSelectedSeason(newSeason);

        const weeksSet = historicalData?.matchupsBySeason?.[newSeason]
            ? new Set(historicalData.matchupsBySeason[newSeason].map(m => Number(m.week)))
            : new Set();
        const weeksArray = Array.from(weeksSet).sort((a, b) => a - b).filter(w => !(w >= 15 && w <= 17));

        if (weeksArray.length > 0) {
            setSelectedWeek(weeksArray[weeksArray.length - 1]);
        } else {
            setSelectedWeek(null);
        }
    };
    const handleWeekChange = (e) => setSelectedWeek(parseInt(e.target.value) || null);
    const handleMatchupClick = (matchup) => {
        setSelectedMatchup(matchup);
        fetchMatchupRosterData(matchup, selectedSeason, selectedWeek);
    };

    // Weekly recap generator
    const generateWeeklyRecap = async () => {
        if (!selectedSeason || !selectedWeek || !historicalData) return;
        setRecapLoading(true);
        setWeeklyRecap(null);
        try {
            let leagueId = null;
            const currentSeason = leagueData && Array.isArray(leagueData) ? leagueData[0].season : leagueData?.season;
            if (String(selectedSeason) === String(currentSeason)) {
                leagueId = leagueData && Array.isArray(leagueData) ? leagueData[0].league_id : leagueData?.league_id;
            } else {
                leagueId = historicalData?.leaguesMetadataBySeason?.[selectedSeason]?.league_id;
            }
            if (!leagueId) { setWeeklyRecap({ error: `No league ID available for season ${selectedSeason}` }); setRecapLoading(false); return; }
            const resp = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${selectedWeek}`);
            if (!resp.ok) throw new Error(`Roster API returned ${resp.status}`);
            const rosterMatchups = await resp.json();
            const rosterMap = {};
            rosterMatchups.forEach(r => { rosterMap[String(r.roster_id)] = r; });
            const teamScores = [];
            weeklyMatchups.forEach(m => {
                const t1 = String(m.team1_roster_id), t2 = String(m.team2_roster_id);
                const s1 = Number(m.team1_score || 0), s2 = Number(m.team2_score || 0);
                const owner1 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === t1)?.owner_id;
                const owner2 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === t2)?.owner_id;
                teamScores.push({ rosterId: t1, ownerId: owner1, score: s1 });
                teamScores.push({ rosterId: t2, ownerId: owner2, score: s2 });
            });
            if (!teamScores.length) { setWeeklyRecap({ error: 'No completed scores for this week.' }); setRecapLoading(false); return; }
            const sortedByScore = [...teamScores].sort((a, b) => b.score - a.score);
            const bestTeam = sortedByScore[0], worstTeam = sortedByScore[sortedByScore.length - 1];
            let biggestBlowout = null, slimmestWin = null;
            weeklyMatchups.forEach(m => {
                const s1 = Number(m.team1_score || 0), s2 = Number(m.team2_score || 0);
                const margin = Math.abs(s1 - s2);
                if (margin === 0) return;
                if (!biggestBlowout || margin > biggestBlowout.margin) biggestBlowout = { matchup: m, margin };
                if (!slimmestWin || margin < slimmestWin.margin) slimmestWin = { matchup: m, margin };
            });
            let highestPointsInLoss = null, lowestPointsInWin = null;
            weeklyMatchups.forEach(m => {
                const s1 = Number(m.team1_score || 0), s2 = Number(m.team2_score || 0);
                if (s1 === s2) return;
                const t1 = String(m.team1_roster_id), t2 = String(m.team2_roster_id);
                const winner = s1 > s2 ? { rosterId: t1, score: s1, opponentRosterId: t2, opponentScore: s2 } : { rosterId: t2, score: s2, opponentRosterId: t1, opponentScore: s1 };
                const loser = s1 > s2 ? { rosterId: t2, score: s2, opponentRosterId: t1, opponentScore: s1 } : { rosterId: t1, score: s1, opponentRosterId: t2, opponentScore: s2 };
                if (!highestPointsInLoss || loser.score > highestPointsInLoss.score) highestPointsInLoss = loser;
                if (!lowestPointsInWin || winner.score < lowestPointsInWin.score) lowestPointsInWin = winner;
            });
            const lineupPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
            const computePotentialPoints = (team) => {
                if (!team) return 0;
                const starters = team.lineup || [], bench = team.bench || [];
                const starterCountByPos = {};
                starters.forEach(s => { const pos = s.lineupPosition || s.position || 'FLEX'; starterCountByPos[pos] = (starterCountByPos[pos] || 0) + 1; });
                let total = 0;
                Object.keys(starterCountByPos).forEach(pos => {
                    const need = starterCountByPos[pos];
                    let startersPos = [], benchPos = [];
                    if (pos === 'FLEX') {
                        startersPos = [...starters.filter(s => s.lineupPosition === 'FLEX'), ...starters.filter(s => ['RB', 'WR', 'TE'].includes(s.position))];
                        benchPos = bench.filter(b => ['RB', 'WR', 'TE'].includes(b.position));
                    } else {
                        startersPos = starters.filter(s => (s.lineupPosition || s.position) === pos);
                        benchPos = bench.filter(b => b.position === pos);
                    }
                    [...startersPos, ...benchPos].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, need).forEach(p => { total += (p.points || 0); });
                });
                return total;
            };
            const efficiencyArr = [];
            for (const ts of teamScores) {
                const rosterData = rosterMap[ts.rosterId];
                if (!rosterData) continue;
                const playersPoints = rosterData.players_points || {};
                const allPlayers = Array.isArray(rosterData.players) ? rosterData.players : [];
                const startersArray = Array.isArray(rosterData.starters) ? rosterData.starters : [];
                const lineup = [], bench = [];
                startersArray.forEach((playerId, i) => {
                    const player = nflPlayers?.[playerId];
                    const hasPlayed = playersPoints && Object.prototype.hasOwnProperty.call(playersPoints, playerId);
                    const points = hasPlayed ? Number(playersPoints[playerId] || 0) : 0;
                    if (player) lineup.push({ playerId, name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(), position: player.position, team: player.team, points, hasPlayed: !!hasPlayed, isStarter: true, lineupPosition: lineupPositions[i] || 'FLEX' });
                });
                allPlayers.forEach(playerId => {
                    if (!startersArray.includes(playerId)) {
                        const player = nflPlayers?.[playerId];
                        const hasPlayed = playersPoints && Object.prototype.hasOwnProperty.call(playersPoints, playerId);
                        const points = hasPlayed ? Number(playersPoints[playerId] || 0) : 0;
                        if (player) bench.push({ playerId, name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(), position: player.position, team: player.team, points, hasPlayed: !!hasPlayed, isStarter: false });
                    }
                });
                const optimal = computePotentialPoints({ lineup, bench });
                if (optimal > 0) efficiencyArr.push({ ...ts, coachScore: (ts.score / optimal) * 100, optimal, actual: ts.score });
            }
            const mostEfficient = [...efficiencyArr].sort((a, b) => b.coachScore - a.coachScore)[0] || null;
            const leastEfficient = [...efficiencyArr].sort((a, b) => a.coachScore - b.coachScore)[0] || null;
            const nameForRoster = (rid) => {
                const roster = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === String(rid));
                return roster ? getTeamDetails(roster.owner_id, selectedSeason).name : `Team ${rid}`;
            };
            const positionTop = {}, positionBottom = {}, benchWarmers = {};
            Object.values(rosterMap).forEach(r => {
                const rosterId = String(r.roster_id);
                const starters = Array.isArray(r.starters) ? r.starters : [];
                const allPlayers = Array.isArray(r.players) ? r.players : [];
                const playersPoints = r.players_points || {};
                const ownerName = nameForRoster(rosterId);
                starters.forEach(pid => {
                    const points = Number(playersPoints?.[pid] ?? 0);
                    const meta = nflPlayers?.[pid] || {};
                    const pos = meta?.position || meta?.pos || 'UNK';
                    const playerData = { playerId: pid, points, rosterId, ownerName };
                    if (!positionTop[pos] || points > positionTop[pos].points) positionTop[pos] = playerData;
                    if (!positionBottom[pos] || points < positionBottom[pos].points) positionBottom[pos] = playerData;
                });
                allPlayers.filter(pid => !starters.includes(pid)).forEach(pid => {
                    const points = Number(playersPoints?.[pid] ?? 0);
                    const meta = nflPlayers?.[pid] || {};
                    const pos = meta?.position || meta?.pos || 'UNK';
                    const playerData = { playerId: pid, points, rosterId, ownerName };
                    const meaningfulPoints = (pos === 'K' || pos === 'DEF') ? points >= 0 : points > 5;
                    if (meaningfulPoints && (!benchWarmers[pos] || points > benchWarmers[pos].points)) benchWarmers[pos] = playerData;
                });
            });
            const getMatchupInfo = (matchup) => {
                const t1 = String(matchup.team1_roster_id), t2 = String(matchup.team2_roster_id);
                const t1Name = nameForRoster(t1), t2Name = nameForRoster(t2);
                const t1Score = Number(matchup.team1_score || 0), t2Score = Number(matchup.team2_score || 0);
                return { team1: { name: t1Name, score: t1Score }, team2: { name: t2Name, score: t2Score }, winner: t1Score > t2Score ? t1Name : t2Name, loser: t1Score > t2Score ? t2Name : t1Name };
            };
            setWeeklyRecap({
                bestTeam: bestTeam ? { rosterId: bestTeam.rosterId, ownerId: bestTeam.ownerId, score: bestTeam.score, name: nameForRoster(bestTeam.rosterId) } : null,
                worstTeam: worstTeam ? { rosterId: worstTeam.rosterId, ownerId: worstTeam.ownerId, score: worstTeam.score, name: nameForRoster(worstTeam.rosterId) } : null,
                biggestBlowout: biggestBlowout ? { margin: biggestBlowout.margin, ...getMatchupInfo(biggestBlowout.matchup) } : null,
                slimmestWin: slimmestWin ? { margin: slimmestWin.margin, ...getMatchupInfo(slimmestWin.matchup) } : null,
                highestPointsInLoss: highestPointsInLoss ? { rosterId: highestPointsInLoss.rosterId, name: nameForRoster(highestPointsInLoss.rosterId), score: highestPointsInLoss.score, opponentName: nameForRoster(highestPointsInLoss.opponentRosterId), opponentScore: highestPointsInLoss.opponentScore } : null,
                lowestPointsInWin: lowestPointsInWin ? { rosterId: lowestPointsInWin.rosterId, name: nameForRoster(lowestPointsInWin.rosterId), score: lowestPointsInWin.score, opponentName: nameForRoster(lowestPointsInWin.opponentRosterId), opponentScore: lowestPointsInWin.opponentScore } : null,
                mostEfficient: mostEfficient ? { rosterId: mostEfficient.rosterId, name: nameForRoster(mostEfficient.rosterId), coachScore: mostEfficient.coachScore.toFixed(2) + '%', score: mostEfficient.score } : null,
                leastEfficient: leastEfficient ? { rosterId: leastEfficient.rosterId, name: nameForRoster(leastEfficient.rosterId), coachScore: leastEfficient.coachScore.toFixed(2) + '%', score: leastEfficient.score } : null,
                positionTop, positionBottom, benchWarmers
            });
        } catch (e) {
            logger.error('Error generating weekly recap:', e);
            setWeeklyRecap({ error: e.message });
        } finally {
            setRecapLoading(false);
        }
    };

    // Auto-generate recap for completed weeks
    useEffect(() => {
        if (!selectedWeek || !selectedSeason || !historicalData) return;
        const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
        const currentNFLWeek = parseInt(nflState?.week || 1);
        const selectedSeasonInt = parseInt(selectedSeason);
        const selectedWeekInt = parseInt(selectedWeek);
        const isCompletedWeek = selectedSeasonInt < currentNFLSeason || (selectedSeasonInt === currentNFLSeason && selectedWeekInt < currentNFLWeek);
        if (isCompletedWeek && weeklyMatchups?.length > 0) {
            generateWeeklyRecap();
        } else {
            setWeeklyRecap(null);
        }
    }, [selectedWeek, selectedSeason, weeklyMatchups, historicalData, nflState]);

    const closeMatchupModal = () => { setSelectedMatchup(null); setMatchupRosterData(null); };

    const getWinLossStreak = (ownerId, season) => {
        const history = teamMatchupHistory[ownerId];
        if (!history) return "N/A";
        const seasonHistory = history.filter(m => m.season === season);
        if (!seasonHistory.length) return "N/A";
        let streak = 0, streakType = '';
        for (let i = seasonHistory.length - 1; i >= 0; i--) {
            const game = seasonHistory[i];
            if (i === seasonHistory.length - 1) { streakType = game.result; streak = 1; }
            else { if (game.result === streakType) streak++; else break; }
        }
        return `${streak}${streakType}`;
    };

    const formatStreakDisplay = (ownerId, streakString) => {
        if (!streakString || streakString === 'N/A') return '—';
        const num = streakString.replace(/[^0-9]/g, '');
        const type = streakString.replace(/[^A-Za-z]/g, '');
        if (!num) return type || '—';
        return `${num}${type}`;
    };

    const getHeadToHeadRecord = (ownerId1, ownerId2, upToSeason = null, upToWeek = null) => {
        const history1 = teamMatchupHistory[ownerId1];
        if (!history1 || !ownerId1 || !ownerId2) return "0-0";
        let wins = 0, losses = 0, ties = 0;
        history1.forEach(game => {
            if (game.opponent !== ownerId2) return;
            if (upToSeason !== null && upToWeek !== null) {
                const gameSeason = parseInt(game.season), gameWeek = parseInt(game.week);
                const targetSeason = parseInt(upToSeason), targetWeek = parseInt(upToWeek);
                if (!(gameSeason < targetSeason || (gameSeason === targetSeason && gameWeek < targetWeek))) return;
            }
            if (game.result === 'W') wins++;
            else if (game.result === 'L') losses++;
            else if (game.result === 'T') ties++;
        });
        return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
    };

    // ── Loading/empty states ──────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center p-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/20 border-t-blue-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Gamecenter…</p>
                </div>
            </div>
        );
    }
    if (!selectedSeason) {
        return (
            <div className="max-w-5xl mx-auto pt-8 text-center text-gray-500 text-sm">Setting up Gamecenter…</div>
        );
    }

    const selectedSeasonHasWeeks = seasonWeeks.length > 0;
    const selectedWeekValue = selectedWeek ?? '';

    // ── Compute current week status once here so it's in scope everywhere below
    const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
    const currentNFLWeek   = parseInt(nflState?.week || 1);
    const selectedSeasonInt = parseInt(selectedSeason);
    const selectedWeekInt   = parseInt(selectedWeek);
    const isGlobalWeekComplete = selectedSeasonInt < currentNFLSeason ||
                                 (selectedSeasonInt === currentNFLSeason && selectedWeekInt < currentNFLWeek);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-10">

            {/* Page header */}
            <div className="pt-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Gamecenter</h2>
            </div>

            {/* Season / Week selectors */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Season</label>
                    <select
                        value={selectedSeason}
                        onChange={handleSeasonChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {availableSeasons.map(s => <option key={s} value={s} className="bg-gray-800">{s}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Week</label>
                    <select
                        value={selectedWeekValue}
                        onChange={handleWeekChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        disabled={!seasonWeeks.length}
                    >
                        {seasonWeeks.length === 0 ? (
                            <option value="" className="bg-gray-800">No weeks available</option>
                        ) : (
                            seasonWeeks.map(w => <option key={w} value={w} className="bg-gray-800">Week {w}</option>)
                        )}
                    </select>
                </div>
            </div>

            {!selectedSeasonHasWeeks && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-300">
                    No matchup history is available for <span className="font-semibold text-white">{selectedSeason}</span> yet. Please choose an earlier season for historical matchups.
                </div>
            )}

            {/* Matchup grid */}
            {Object.entries(weeklyMatchupGroups).map(([groupKey, group]) => {
                if (!group.matchups.length && !group.byes.length) return null;
                return (
                    <div key={groupKey} className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">{group.label}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {group.matchups.map(matchup => {
                                const t1Id = normalizeRosterId(matchup.team1_roster_id);
                                const t2Id = normalizeRosterId(matchup.team2_roster_id);
                                const team1 = getMatchupTeamDisplay(t1Id, selectedSeason);
                                const team2 = getMatchupTeamDisplay(t2Id, selectedSeason);
                                const roster1 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === t1Id);
                                const roster2 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === t2Id);
                                const owner1 = roster1?.owner_id, owner2 = roster2?.owner_id;
                                const d1 = team1, d2 = team2;
                                const s1 = Number(matchup.team1_score || 0), s2 = Number(matchup.team2_score || 0);
                                const isMatchupComplete = isGlobalWeekComplete;
                                const isCurrentSeason = parseInt(selectedSeason) === parseInt(nflState?.season);
                                const avg1 = isCurrentSeason ? getCorrectAveragePoints(t1Id, selectedSeason) : getAverageAtWeek(t1Id, selectedSeason, selectedWeek);
                                const avg2 = isCurrentSeason ? getCorrectAveragePoints(t2Id, selectedSeason) : getAverageAtWeek(t2Id, selectedSeason, selectedWeek);
                                const streak1 = getWinLossStreak(owner1, selectedSeason), streak2 = getWinLossStreak(owner2, selectedSeason);
                                const h2h = (owner1 && owner2) ? getHeadToHeadRecord(owner1, owner2, selectedSeason, selectedWeek) : '—';
                                const isGOW = gameOfWeekMatchupId && String(gameOfWeekMatchupId) === String(matchup.matchup_id);
                                const isFrisky = friskyGameMatchupId && String(friskyGameMatchupId) === String(matchup.matchup_id);
                                const hasScores = s1 > 0 || s2 > 0;
                                const bracketLabel = getMatchupBracketLabel(matchup, selectedSeason);

                                return (
                                    <div
                                        key={`matchup-${matchup.matchup_id}`}
                                        onClick={() => handleMatchupClick(matchup)}
                                        className={`rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
                                            isGOW ? 'ring-2 ring-yellow-400/60 bg-yellow-400/5' :
                                            isFrisky ? 'ring-2 ring-purple-400/60 bg-purple-400/5' :
                                            'bg-white/5 hover:bg-white/8'
                                        } border border-white/10`}
                                    >
                                        <div className="p-3 sm:p-4">
                                            {isGOW && (
                                                <div className="flex flex-col items-center mb-2 gap-1">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">Game of the Week</span>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                        <span>Sponsored by</span>
                                                        <img src={`${process.env.PUBLIC_URL}/ThdIISRZ_400x400.jpg`} alt="The Burton Hotel" className="w-4 h-4 rounded-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                                                        <span className="text-amber-400 font-medium">The Burton Hotel</span>
                                                    </div>
                                                </div>
                                            )}
                                            {bracketLabel && (
                                                <div className="flex justify-center mb-2">
                                                    <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-widest bg-blue-500/10 text-blue-200 border border-blue-400/20">{bracketLabel}</span>
                                                </div>
                                            )}
                                            {isFrisky && (
                                                <div className="flex justify-center mb-2">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-400/20 text-purple-300 border border-purple-400/30">Frisky Game of the Week</span>
                                                </div>
                                            )}
                                            <div className="sm:hidden space-y-1">
                                                {[{d: d1, s: s1, opp: s2, id: t1Id, owner: owner1, streak: streak1, avg: avg1},
                                                  {d: d2, s: s2, opp: s1, id: t2Id, owner: owner2, streak: streak2, avg: avg2}].map((tm, i) => (
                                                    <div key={i} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${i === 0 ? 'border-b border-white/5' : ''}`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <img className="w-9 h-9 rounded-full border border-white/20 flex-shrink-0" src={tm.d.avatar} alt={tm.d.name} />
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold text-gray-200 truncate">{tm.d.name}</div>
                                                                {!isMatchupComplete && <div className="text-[10px] text-gray-500">{formatStreakDisplay(tm.owner, tm.streak)} · Avg {formatScore(Number(tm.avg ?? 0), 2)}</div>}
                                                            </div>
                                                        </div>
                                                        <div className={`font-bold text-base flex-shrink-0 ${isMatchupComplete && hasScores && tm.s > tm.opp ? 'text-green-400' : 'text-gray-200'}`}>
                                                            {hasScores ? formatScore(Number(tm.s ?? 0), 2) : '—'}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="text-center text-[10px] text-gray-500 pt-1">
                                                    {h2h !== "0-0" && `H2H: ${h2h}`}
                                                </div>
                                            </div>
                                            <div className="hidden sm:flex items-center justify-between gap-3">
                                                {[{d: d1, s: s1, opp: s2}, {d: d2, s: s2, opp: s1}].map((tm, i) => (
                                                    <React.Fragment key={i}>
                                                        <div className="flex flex-col items-center flex-1 min-w-0 text-center">
                                                            <img className="w-11 h-11 rounded-full border border-white/20 mb-1.5" src={tm.d.avatar} alt={tm.d.name} />
                                                            <div className="text-xs font-semibold text-gray-200 leading-tight break-words mb-1">{tm.d.name}</div>
                                                            <div className={`font-bold text-base ${isMatchupComplete && hasScores && tm.s > tm.opp ? 'text-green-400' : 'text-gray-200'}`}>
                                                                {hasScores ? formatScore(Number(tm.s ?? 0), 2) : '—'}
                                                            </div>
                                                        </div>
                                                        {i === 0 && <div className="text-gray-600 text-xs font-medium flex-shrink-0">vs</div>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <div className="border-t border-white/8 mt-3 pt-2.5">
                                                {!isMatchupComplete ? (
                                                    <div className="hidden sm:block text-xs text-gray-500">
                                                        <div className="text-center text-gray-600 mb-1.5 text-[10px] uppercase tracking-widest">Pre-Game</div>
                                                        <div className="grid grid-cols-3 gap-1 items-center text-center">
                                                            <div className="space-y-0.5">
                                                                <div className="font-semibold text-gray-300">{formatStreakDisplay(owner1, streak1)}</div>
                                                                <div className="font-semibold text-gray-300">{formatScore(Number(avg1 ?? 0), 2)}</div>
                                                            </div>
                                                            <div className="space-y-0.5 text-[10px] text-gray-500">
                                                                <div>Streak</div>
                                                                <div>Avg Pts</div>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <div className="font-semibold text-gray-300">{formatStreakDisplay(owner2, streak2)}</div>
                                                                <div className="font-semibold text-gray-300">{formatScore(Number(avg2 ?? 0), 2)}</div>
                                                            </div>
                                                        </div>
                                                        {h2h !== "0-0" && <div className="text-center text-[10px] text-gray-500 mt-1">H2H: {h2h}</div>}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-[10px] text-gray-500">
                                                        {isGlobalWeekComplete && hasScores ? 'Final' : 'In progress'}
                                                    </div>
                                                )}
                                                {isMatchupComplete && (
                                                    <div className="text-center mt-1.5">
                                                        <span className="text-[10px] text-blue-400">Tap for details</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {group.byes.map(matchup => {
                                const byeId = getByeTeamId(matchup);
                                const byeTeam = getMatchupTeamDisplay(byeId, selectedSeason);
                                const score = Number(matchup.team1_score || matchup.team2_score || 0);
                                const bracketLabel = getMatchupBracketLabel(matchup, selectedSeason);
                                return (
                                    <div
                                        key={`bye-${byeId}-${matchup.week}`}
                                        onClick={() => handleMatchupClick(matchup)}
                                        className="rounded-xl overflow-hidden transition-all duration-200 cursor-pointer bg-white/5 hover:bg-white/8 border border-white/10"
                                    >
                                        <div className="p-4">
                                            {bracketLabel && (
                                                <div className="flex justify-center mb-3">
                                                    <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-widest bg-blue-500/10 text-blue-200 border border-blue-400/20">{bracketLabel}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <img className="w-14 h-14 rounded-full border border-white/20" src={byeTeam.avatar} alt={byeTeam.name} />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-gray-200">{byeTeam.name}</div>
                                                    <div className="text-xs text-gray-400">Bye week</div>
                                                </div>
                                            </div>
                                            <div className="mt-4 text-3xl font-bold text-white">{formatScore(score, 2)}</div>
                                            <div className="text-[10px] text-gray-400 mt-1">Score for the week</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Weekly Recap */}
            {isGlobalWeekComplete && weeklyRecap && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-white mb-4">Weekly Recap</h3>
                    {recapLoading ? (
                        <div className="text-sm text-gray-400">Generating recap…</div>
                    ) : weeklyRecap?.error ? (
                        <div className="text-sm text-red-400">{weeklyRecap.error}</div>
                    ) : (
                        <div className="space-y-5">
                            {/* Team Performance */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: 'Best Performance', data: weeklyRecap.bestTeam, color: 'emerald', icon: '🏆' },
                                    { label: 'Needs Improvement', data: weeklyRecap.worstTeam, color: 'red', icon: '📉' },
                                ].map(({ label, data, color, icon }) => (
                                    <div key={label} className={`bg-${color}-500/10 border border-${color}-400/20 rounded-xl p-4`}>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-${color}-400 mb-1">{icon} {label}</div>
                                        <div className="font-bold text-white">{data?.name || '—'}</div>
                                        <div className={`text-xl font-bold text-${color}-400`}>{formatScore(Number(data?.score ?? 0), 2)} pts</div>
                                    </div>
                                ))}
                            </div>

                            {/* Matchup Highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                    { label: 'Biggest Blowout', data: weeklyRecap.biggestBlowout, color: 'orange', val: weeklyRecap.biggestBlowout ? `${formatScore(weeklyRecap.biggestBlowout.margin, 2)} pts` : null, sub: weeklyRecap.biggestBlowout ? `${weeklyRecap.biggestBlowout.winner} def. ${weeklyRecap.biggestBlowout.loser}` : null },
                                    { label: 'Nail Biter', data: weeklyRecap.slimmestWin, color: 'purple', val: weeklyRecap.slimmestWin ? `${formatScore(weeklyRecap.slimmestWin.margin, 2)} pts` : null, sub: weeklyRecap.slimmestWin ? `${weeklyRecap.slimmestWin.winner} edged ${weeklyRecap.slimmestWin.loser}` : null },
                                    { label: 'Tough Break', data: weeklyRecap.highestPointsInLoss, color: 'rose', val: weeklyRecap.highestPointsInLoss ? `${formatScore(weeklyRecap.highestPointsInLoss.score, 2)} pts` : null, sub: weeklyRecap.highestPointsInLoss ? `${weeklyRecap.highestPointsInLoss.name} vs ${weeklyRecap.highestPointsInLoss.opponentName} (${formatScore(weeklyRecap.highestPointsInLoss.opponentScore, 2)})` : null },
                                    { label: 'Lucky Win', data: weeklyRecap.lowestPointsInWin, color: 'teal', val: weeklyRecap.lowestPointsInWin ? `${formatScore(weeklyRecap.lowestPointsInWin.score, 2)} pts` : null, sub: weeklyRecap.lowestPointsInWin ? `${weeklyRecap.lowestPointsInWin.name} vs ${weeklyRecap.lowestPointsInWin.opponentName} (${formatScore(weeklyRecap.lowestPointsInWin.opponentScore, 2)})` : null },
                                ].map(({ label, color, val, sub }) => (
                                    <div key={label} className={`bg-${color}-500/10 border border-${color}-400/20 rounded-xl p-3`}>
                                        <div className={`text-[10px] font-bold uppercase tracking-widest text-${color}-400 mb-1`}>{label}</div>
                                        {val ? (
                                            <>
                                                <div className={`text-lg font-bold text-${color}-400`}>{val}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                                            </>
                                        ) : <div className="text-gray-600 text-sm">—</div>}
                                    </div>
                                ))}
                            </div>

                            {/* Coach Scores */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: 'Best Coach', data: weeklyRecap.mostEfficient, color: 'blue' },
                                    { label: 'Room for Growth', data: weeklyRecap.leastEfficient, color: 'gray' },
                                ].map(({ label, data, color }) => (
                                    <div key={label} className={`bg-${color}-500/10 border border-${color}-400/20 rounded-xl p-4`}>
                                        <div className={`text-[10px] font-bold uppercase tracking-widest text-${color}-400 mb-1`}>{label}</div>
                                        <div className="font-bold text-white">{data?.name || '—'}</div>
                                        <div className={`text-xl font-bold text-${color}-400`}>{data?.coachScore || '—'}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Player Spotlight */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <h4 className="text-sm font-bold text-white mb-4">🏆 Player Spotlight</h4>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                    {[
                                        { title: 'Top Performers', data: weeklyRecap.positionTop, color: 'emerald' },
                                        { title: 'Tough Week', data: weeklyRecap.positionBottom, color: 'red' },
                                        { title: 'Benchwarmers', data: weeklyRecap.benchWarmers, color: 'yellow' },
                                    ].map(({ title, data, color }) => (
                                        <div key={title}>
                                            <div className={`text-xs font-bold text-${color}-400 mb-2 uppercase tracking-widest`}>{title}</div>
                                            <div className="space-y-1.5">
                                                {Object.keys(data || {}).length === 0 ? (
                                                    <div className="text-gray-500 text-xs">No data</div>
                                                ) : ['QB','RB','WR','TE','K','DEF'].filter(pos => data[pos]).map(pos => {
                                                    const info = data[pos];
                                                    return (
                                                        <div key={pos} className={`flex items-center justify-between p-2 bg-${color}-500/10 border border-${color}-400/20 rounded-lg`}>
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-7 h-7 rounded-full bg-${color}-500/30 flex items-center justify-center text-[10px] font-bold text-${color}-300`}>{pos}</div>
                                                                <div>
                                                                    <div className="text-xs font-semibold text-white">{nflPlayers?.[info.playerId]?.full_name || info.playerId}</div>
                                                                    <div className="text-[10px] text-gray-400">{nflPlayers?.[info.playerId]?.team || 'UNK'} · {info.ownerName}</div>
                                                                </div>
                                                            </div>
                                                            <div className={`text-sm font-bold text-${color}-400`}>{formatScore(info.points, 2)}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Matchup Detail Modal */}
            {selectedMatchup && (
                <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-gray-900 border border-white/10 w-full h-full sm:h-auto sm:rounded-2xl sm:max-w-5xl sm:max-h-[90vh] overflow-y-auto">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
                            <h2 className="text-base font-bold text-white">{selectedSeason} Week {selectedWeek} Details</h2>
                            <button onClick={closeMatchupModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-xl font-bold">×</button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-5">
                            {(() => {
                                const t1Id = String(selectedMatchup.team1_roster_id), t2Id = String(selectedMatchup.team2_roster_id);
                                const r1 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === t1Id);
                                const r2 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === t2Id);
                                const o1 = r1?.owner_id, o2 = r2?.owner_id;
                                const d1 = getTeamDetails(o1, selectedSeason), d2 = getTeamDetails(o2, selectedSeason);
                                const luck1 = weeklyLuckData[t1Id]?.[selectedWeek - 1] ?? 0;
                                const luck2 = weeklyLuckData[t2Id]?.[selectedWeek - 1] ?? 0;
                                const isWeekComplete = selectedSeasonInt < currentNFLSeason || (selectedSeasonInt === currentNFLSeason && selectedWeekInt < currentNFLWeek);
                                const avg1atWeek = getAverageAtWeek(t1Id, selectedSeason, selectedWeek);
                                const avg2atWeek = getAverageAtWeek(t2Id, selectedSeason, selectedWeek);
                                const avg1 = getCorrectAveragePoints(t1Id, selectedSeason);
                                const avg2 = getCorrectAveragePoints(t2Id, selectedSeason);
                                const h2h = getHeadToHeadRecord(o1, o2, selectedSeason, selectedWeek);
                                const t1Won = selectedMatchup.team1_score > selectedMatchup.team2_score;
                                const t2Won = selectedMatchup.team2_score > selectedMatchup.team1_score;

                                const getStreakAtWeek = (ownerId) => {
                                    const history = teamMatchupHistory[ownerId] || [];
                                    const s = history.filter(m => m.season === selectedSeason && Number(m.week) <= Number(selectedWeek));
                                    if (!s.length) return '—';
                                    let streak = 0, streakType = '';
                                    for (let i = s.length - 1; i >= 0; i--) {
                                        if (i === s.length - 1) { streakType = s[i].result; streak = 1; }
                                        else { if (s[i].result === streakType) streak++; else break; }
                                    }
                                    return `${streak}${streakType}`;
                                };

                                const computeOptimalBench = (team) => {
                                    if (!team) return new Set();
                                    const starters = team.lineup || [], bench = team.bench || [];
                                    const starterCountByPos = {};
                                    starters.forEach(s => { const pos = s.lineupPosition || s.position || 'FLEX'; starterCountByPos[pos] = (starterCountByPos[pos] || 0) + 1; });
                                    const optimal = new Set();
                                    Object.keys(starterCountByPos).forEach(pos => {
                                        const need = starterCountByPos[pos];
                                        let startersPos = [], benchPos = [];
                                        if (pos === 'FLEX') {
                                            startersPos = [...starters.filter(s => s.lineupPosition === 'FLEX'), ...starters.filter(s => ['RB','WR','TE'].includes(s.position))];
                                            benchPos = bench.filter(b => ['RB','WR','TE'].includes(b.position));
                                        } else {
                                            startersPos = starters.filter(s => (s.lineupPosition || s.position) === pos);
                                            benchPos = bench.filter(b => b.position === pos);
                                        }
                                        const combined = [...startersPos, ...benchPos].sort((a, b) => (b.points || 0) - (a.points || 0));
                                        combined.slice(0, need).forEach(p => { if (benchPos.find(b => b.playerId === p.playerId)) optimal.add(p.playerId); });
                                    });
                                    return optimal;
                                };

                                const computePotentialPoints = (team) => {
                                    if (!team) return 0;
                                    const starters = team.lineup || [], bench = team.bench || [];
                                    const starterCountByPos = {};
                                    starters.forEach(s => { const pos = s.lineupPosition || s.position || 'FLEX'; starterCountByPos[pos] = (starterCountByPos[pos] || 0) + 1; });
                                    let total = 0;
                                    Object.keys(starterCountByPos).forEach(pos => {
                                        const need = starterCountByPos[pos];
                                        let startersPos = [], benchPos = [];
                                        if (pos === 'FLEX') {
                                            startersPos = [...starters.filter(s => s.lineupPosition === 'FLEX'), ...starters.filter(s => ['RB','WR','TE'].includes(s.position))];
                                            benchPos = bench.filter(b => ['RB','WR','TE'].includes(b.position));
                                        } else {
                                            startersPos = starters.filter(s => (s.lineupPosition || s.position) === pos);
                                            benchPos = bench.filter(b => b.position === pos);
                                        }
                                        [...startersPos, ...benchPos].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, need).forEach(p => { total += (p.points || 0); });
                                    });
                                    return total;
                                };

                                const t1Optimal = computeOptimalBench(matchupRosterData?.team1);
                                const t2Optimal = computeOptimalBench(matchupRosterData?.team2);
                                const t1Potential = computePotentialPoints(matchupRosterData?.team1);
                                const t2Potential = computePotentialPoints(matchupRosterData?.team2);
                                const t1Actual = matchupRosterData?.team1?.totalPoints ?? selectedMatchup.team1_score ?? 0;
                                const t2Actual = matchupRosterData?.team2?.totalPoints ?? selectedMatchup.team2_score ?? 0;
                                const cs1 = t1Potential > 0 ? (t1Actual / t1Potential) * 100 : 0;
                                const cs2 = t2Potential > 0 ? (t2Actual / t2Potential) * 100 : 0;

                                return (
                                    <div className="space-y-5">
                                        {/* Score header */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {[{d: d1, s: selectedMatchup.team1_score, won: t1Won, cs: cs1, pot: t1Potential},
                                              {d: d2, s: selectedMatchup.team2_score, won: t2Won, cs: cs2, pot: t2Potential}].map((tm, i) => (
                                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                                    <div className="flex items-center justify-center gap-2 mb-2">
                                                        <img className="w-10 h-10 rounded-full border border-white/20" src={tm.d.avatar} alt={tm.d.name} />
                                                        <div className="text-left">
                                                            <div className="font-bold text-white text-sm">{tm.d.name}</div>
                                                        </div>
                                                    </div>
                                                    <div className={`text-3xl font-bold ${tm.won ? 'text-green-400' : 'text-gray-300'}`}>{formatScore(Number(tm.s ?? 0), 2)}</div>
                                                    <div className="text-[10px] text-gray-500 mt-1">Coach Score: <span className="text-white font-semibold">{tm.pot > 0 ? `${formatScore(Number(tm.cs ?? 0), 1)}%` : 'N/A'}</span></div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                            {[{d: d1, id: t1Id, owner: o1, luck: luck1},
                                              {d: d2, id: t2Id, owner: o2, luck: luck2}].map((tm, i) => {
                                                const rec = getRecordAtWeek(tm.id, selectedSeason, selectedWeek);
                                                const streakDisplay = getStreakAtWeek(tm.owner);
                                                const avgDisplay = isWeekComplete ? avg1atWeek : (i === 0 ? avg1 : avg2);
                                                return (
                                                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{tm.d.name}</div>
                                                        <div className="space-y-2 text-sm">
                                                            {[
                                                                ['Season Record', isWeekComplete ? `${rec.wins}-${rec.losses}${rec.ties > 0 ? `-${rec.ties}` : ''}` : `${processedSeasonalRecords?.[selectedSeason]?.[tm.id]?.wins || 0}-${processedSeasonalRecords?.[selectedSeason]?.[tm.id]?.losses || 0}`],
                                                                ['Streak', isWeekComplete ? streakDisplay : formatStreakDisplay(tm.owner, getWinLossStreak(tm.owner, selectedSeason))],
                                                                ['Season Avg', formatScore(Number(isWeekComplete ? (i === 0 ? avg1atWeek : avg2atWeek) : (i === 0 ? avg1 : avg2)), 2)],
                                                            ].map(([label, val]) => (
                                                                <div key={label} className="flex justify-between">
                                                                    <span className="text-gray-400">{label}</span>
                                                                    <span className="font-medium text-white">{val}</span>
                                                                </div>
                                                            ))}
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-400">Luck Factor</span>
                                                                <span className={`font-medium ${tm.luck > 0 ? 'text-green-400' : 'text-red-400'}`}>{tm.luck > 0 ? '+' : ''}{formatScore(Number(tm.luck ?? 0), 2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Game info */}
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div>
                                                    <div className="text-[10px] text-gray-500 mb-1">H2H Record</div>
                                                    <div className="text-lg font-bold text-white">{h2h}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-500 mb-1">Point Difference</div>
                                                    <div className="text-lg font-bold text-white">{formatScore(Math.abs(Number(selectedMatchup.team1_score ?? 0) - Number(selectedMatchup.team2_score ?? 0)), 2)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-500 mb-1">Type</div>
                                                    <div className="text-sm font-bold text-white">{getMatchupBracketLabel(selectedMatchup, selectedSeason) || 'Regular Season'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rosters */}
                                        {matchupRosterData ? (
                                            matchupRosterData.error ? (
                                                <div className="text-center py-6 bg-white/5 border border-white/10 rounded-xl">
                                                    <p className="text-gray-400 text-sm px-4">{matchupRosterData.message}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Starters */}
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Starting Lineups</h5>
                                                        <div className="space-y-0">
                                                            {matchupRosterData.team1.lineup.map((lp, idx) => {
                                                                const rp = matchupRosterData.team2.lineup[idx] || {};
                                                                const lHas = !!lp?.hasPlayed, rHas = !!rp?.hasPlayed;
                                                                const ls = lHas ? formatScore(Number(lp.points ?? 0), 2) : '—';
                                                                const rs = rHas ? formatScore(Number(rp.points ?? 0), 2) : '—';
                                                                const pos = lp.lineupPosition || rp.lineupPosition || '—';
                                                                let outcomeL = 'pending';
                                                                if (lHas && rHas) {
                                                                    const l = Number(lp.points ?? 0), r = Number(rp.points ?? 0);
                                                                    outcomeL = l > r ? 'win' : l < r ? 'loss' : 'tie';
                                                                }
                                                                const outcomeR = outcomeL === 'win' ? 'loss' : outcomeL === 'loss' ? 'win' : 'tie';
                                                                return (
                                                                    <div key={idx} className="grid grid-cols-3 items-center border-b border-white/5 last:border-b-0 py-2">
                                                                        <div className="min-w-0">
                                                                            <div className="text-sm font-medium text-gray-200 truncate">{lp.name}</div>
                                                                            <div className="text-[10px] text-gray-500">{lp.position} · {lp.team || 'FA'}</div>
                                                                        </div>
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="w-10 text-right text-sm font-semibold text-gray-200">{ls}</span>
                                                                                <div className={`w-2.5 h-2.5 rounded-full ${outcomeL === 'win' ? 'bg-green-500' : outcomeL === 'loss' ? 'bg-red-500' : 'bg-gray-600'}`} />
                                                                            </div>
                                                                            <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-gray-300">{pos}</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className={`w-2.5 h-2.5 rounded-full ${outcomeR === 'win' ? 'bg-green-500' : outcomeR === 'loss' ? 'bg-red-500' : 'bg-gray-600'}`} />
                                                                                <span className="w-10 text-left text-sm font-semibold text-gray-200">{rs}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="min-w-0 text-right">
                                                                            <div className="text-sm font-medium text-gray-200 truncate">{rp.name}</div>
                                                                            <div className="text-[10px] text-gray-500">{rp.position} · {rp.team || 'FA'}</div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Bench */}
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Bench</h5>
                                                        <div className="space-y-0">
                                                            {(() => {
                                                                const lb = matchupRosterData.team1.bench || [], rb = matchupRosterData.team2.bench || [];
                                                                return Array.from({ length: Math.max(lb.length, rb.length) }).map((_, idx) => {
                                                                    const lp = lb[idx] || {}, rp = rb[idx] || {};
                                                                    const lHas = !!lp?.hasPlayed, rHas = !!rp?.hasPlayed;
                                                                    const ls = lHas ? formatScore(Number(lp.points || 0), 2) : '—';
                                                                    const rs = rHas ? formatScore(Number(rp.points || 0), 2) : '—';
                                                                    return (
                                                                        <div key={idx} className="grid grid-cols-3 items-center border-b border-white/5 last:border-b-0 py-2">
                                                                            <div className="min-w-0">
                                                                                <div className="text-sm font-medium text-gray-200 truncate">{lp.name}</div>
                                                                                <div className="text-[10px] text-gray-500">{lp.position} · {lp.team || 'FA'}</div>
                                                                            </div>
                                                                            <div className="flex items-center justify-center gap-2">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="w-10 text-right text-sm font-semibold text-gray-200">{ls}</span>
                                                                                    <div className={`w-2.5 h-2.5 rounded-full ${t1Optimal.has(lp.playerId) ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                                                                                </div>
                                                                                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-gray-300">BN</span>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className={`w-2.5 h-2.5 rounded-full ${t2Optimal.has(rp.playerId) ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                                                                                    <span className="w-10 text-left text-sm font-semibold text-gray-200">{rs}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="min-w-0 text-right">
                                                                                <div className="text-sm font-medium text-gray-200 truncate">{rp.name}</div>
                                                                                <div className="text-[10px] text-gray-500">{rp.position} · {rp.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>
                                                </>
                                            )
                                        ) : (
                                            <div className="text-center py-6 text-gray-500 text-sm">Loading roster details…</div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gamecenter;
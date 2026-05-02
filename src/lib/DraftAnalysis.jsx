// src/lib/DraftAnalysis.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import logger from '../utils/logger';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getSleeperAvatarUrl, getSleeperPlayerHeadshotUrl, fetchAllTradedPicksMerged } from '../utils/sleeperApi';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRepeat } from '@fortawesome/free-solid-svg-icons';

import { enrichPickForCalculations, calculatePlayerValue, calculatePickSlotValue, generateExpectedVorpByPickSlot, generateExpectedByPositionAndSlot, calculateVORPDelta, computeScaledVorpDeltas, getValuedKeeperCountForSeason } from '../utils/draftCalculations';
import { fetchPlayerStats, fetchLeagueScoringSettings, fetchLeagueRosterSettings, calculateFantasyPoints, rankPlayersByFantasyPoints, calculateVORP } from '../utils/sleeperPlayerStats';
import { formatScore } from '../utils/formatUtils';

// ── Restyled board grid + chart — replaces old inline grid and old chart import
import { DraftBoardGrid, OverallDraftPositionChart } from '../components/DraftBoardComponents';


const DraftAnalysis = () => {
    const {
        loading,
        error,
        historicalData,
        usersData,
        getTeamName,
        allDraftHistory,
        processedSeasonalRecords,
    } = useSleeperData();

    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [draftSummary, setDraftSummary] = useState(null);
    const [draftPicks, setDraftPicks] = useState([]);
    const [tradedPicksData, setTradedPicksData] = useState([]);
    const [leagueScoringSettings, setLeagueScoringSettings] = useState(null);
    const [leagueRosterSettings, setLeagueRosterSettings] = useState(null);

    const [orderedTeamColumns, setOrderedTeamColumns] = useState([]);
    const [picksGroupedByRound, setPicksGroupedByRound] = useState({});

    const [activeTab, setActiveTab] = useState('board');
    const [draftYearSummary, setDraftYearSummary] = useState(null);

    logger.debug('--- DraftAnalysis Component Render ---');
    logger.debug('Loading:', loading);
    logger.debug('Error:', error);
    logger.debug('Historical Data (raw):', historicalData);
    logger.debug('Users Data (raw):', usersData);
    logger.debug('------------------------------------');

    const getUserIdFromRosterId = useCallback((rosterId, season, historicalRostersBySeason) => {
        const rostersForSeason = historicalRostersBySeason?.[season];
        const roster = rostersForSeason?.find(r => String(r.roster_id) === String(rosterId));
        return roster ? roster.owner_id : null;
    }, []);

    // ── Seasons dropdown ──────────────────────────────────────────────────────
    useEffect(() => {
        logger.debug('useEffect: Populating seasons and setting default season.');
        if (!loading && !error && historicalData && historicalData.draftsBySeason) {
            const allYears = Object.keys(historicalData.draftsBySeason)
                .map(Number)
                .sort((a, b) => b - a);
            setSeasons(allYears);
            if (allYears.length > 0 && !selectedSeason) {
                setSelectedSeason("Overview");
            }
        }
    }, [loading, error, historicalData, selectedSeason]);

    // ── League settings ───────────────────────────────────────────────────────
    useEffect(() => {
        const fetchLeagueSettings = async () => {
            if (selectedSeason && typeof selectedSeason === 'number' && historicalData && historicalData.draftsBySeason) {
                const seasonDrafts = historicalData.draftsBySeason[selectedSeason];
                if (seasonDrafts && seasonDrafts.league_id) {
                    const scoringSettings = await fetchLeagueScoringSettings(seasonDrafts.league_id);
                    setLeagueScoringSettings(scoringSettings);
                    const rosterSettings = await fetchLeagueRosterSettings(seasonDrafts.league_id);
                    setLeagueRosterSettings(rosterSettings);
                } else {
                    setLeagueScoringSettings(null);
                    setLeagueRosterSettings(null);
                }
            } else {
                setLeagueScoringSettings(null);
                setLeagueRosterSettings(null);
            }
        };
        fetchLeagueSettings();
    }, [selectedSeason, historicalData]);

    // ── Draft board processing ────────────────────────────────────────────────
    useEffect(() => {
        const processDraftBoardData = async () => {
            if (!selectedSeason || selectedSeason === "Overview" || !historicalData || !historicalData.draftsBySeason || !historicalData.draftPicksBySeason || !usersData) {
                setDraftSummary(null);
                setDraftPicks([]);
                setOrderedTeamColumns([]);
                setPicksGroupedByRound({});
                setTradedPicksData([]);
                return;
            }

            const seasonDrafts = historicalData.draftsBySeason[selectedSeason];
            const seasonPicks = historicalData.draftPicksBySeason[selectedSeason];
            const leagueId = historicalData.leaguesMetadataBySeason?.[selectedSeason]?.league_id;

            let mergedTradedPicks = [];
            if (leagueId) {
                const leagueSettings = historicalData.leaguesMetadataBySeason[selectedSeason]?.settings || {};
                const totalWeeks = leagueSettings.playoff_start_week ? (parseInt(leagueSettings.playoff_start_week, 10) + 3) : 18;
                mergedTradedPicks = await fetchAllTradedPicksMerged(leagueId, totalWeeks);
            }
            setTradedPicksData(mergedTradedPicks);
            setDraftSummary(seasonDrafts);

            const draftOrder = seasonDrafts.draft_order;
            const totalRounds = seasonDrafts.settings?.rounds || 0;
            const totalTeams = seasonDrafts.settings?.teams || 12;

            const slotToUserId = Object.entries(draftOrder).reduce((acc, [userId, slot]) => {
                acc[slot] = userId;
                return acc;
            }, {});

            const pickOrderByRound = [];
            for (let round = 1; round <= totalRounds; round++) {
                let slots = Array.from({ length: totalTeams }, (_, i) => i + 1);
                if (round % 2 === 0) slots = slots.reverse();
                pickOrderByRound.push(slots.map(slot => slotToUserId[slot]));
            }

            const firstRoundUserIds = pickOrderByRound[0];
            const teamsInOrder = firstRoundUserIds.map(userId => {
                const user = usersData.find(u => u.user_id === userId);
                const roster = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.owner_id) === String(userId));
                return {
                    userId,
                    teamName: roster ? (roster.metadata?.team_name || getTeamName(userId, selectedSeason)) : getTeamName(userId, selectedSeason),
                    teamAvatar: user ? getSleeperAvatarUrl(user.avatar) : getSleeperAvatarUrl(null),
                };
            });
            setOrderedTeamColumns(teamsInOrder);

            const newPicksGroupedByRound = {};

            const picksPromises = seasonPicks.map(async pick => {
                const enrichedPick = enrichPickForCalculations(pick, usersData, historicalData, selectedSeason, getTeamName);
                enrichedPick.pick_in_round = pick.draft_slot;

                let playerStats = null;
                let fantasyPoints = 0;

                if (!pick.is_keeper && pick.player_id) {
                    const playerNameForLog = enrichedPick.player_position === 'DEF'
                        ? `${enrichedPick.metadata?.first_name || ''} ${enrichedPick.metadata?.last_name || ''}`.trim()
                        : enrichedPick.player_name;
                    playerStats = await fetchPlayerStats(pick.player_id, selectedSeason, 'regular', playerNameForLog);
                    if (playerStats && leagueScoringSettings) {
                        fantasyPoints = calculateFantasyPoints(playerStats, leagueScoringSettings, enrichedPick.player_position);
                    }
                }
                enrichedPick.player_stats = playerStats;
                enrichedPick.fantasy_points = fantasyPoints;

                const playerValue = calculatePlayerValue(enrichedPick);
                const pickSlotValue = calculatePickSlotValue(enrichedPick.pick_no, seasonDrafts.settings?.rounds, seasonDrafts.settings?.teams);
                enrichedPick.calculated_player_value = playerValue;
                enrichedPick.calculated_pick_slot_value = pickSlotValue;

                return enrichedPick;
            });

            const processedPicks = await Promise.all(picksPromises);
            const draftablePlayers = processedPicks.filter(pick => !pick.is_keeper);

            let playersWithVORP = [];
            let draftPickExpectedVORPs = new Map();

            if (draftablePlayers.length > 0 && leagueRosterSettings) {
                const playerRankings = rankPlayersByFantasyPoints(draftablePlayers);
                if (Object.keys(playerRankings.positional).length > 0) {
                    const vorpResults = calculateVORP(playerRankings.positional, leagueRosterSettings);
                    for (const pos in vorpResults) playersWithVORP.push(...vorpResults[pos]);
                    playersWithVORP.sort((a, b) => b.vorp - a.vorp);
                }
                // Build position-specific empirical baseline from all past seasons
            // allDraftHistory comes from context and contains every historical pick
            // with fantasy_points already attached (or we fall back to exponential curve)
            const historicalPicksForBaseline = Array.isArray(allDraftHistory)
                ? allDraftHistory.filter(p => !p.is_keeper && typeof p.fantasy_points === 'number')
                : [];
            draftPickExpectedVORPs = generateExpectedByPositionAndSlot(
                seasonPicks.length,
                historicalPicksForBaseline
            );
            }

            // computeScaledVorpDeltas: position-specific empirical baseline,
            // per-position z-scores, excludes legacy keepers
            let finalProcessedPicks = computeScaledVorpDeltas(
                processedPicks,
                draftPickExpectedVORPs
            );

            // ── Keeper contract tracking ──────────────────────────────────────
            try {
                const keeperHistory = {};
                const seasonsList = Object.keys(historicalData.draftPicksBySeason || {}).map(s => Number(s)).sort((a, b) => a - b);
                for (const s of seasonsList) {
                    const picksForSeason = (historicalData.draftPicksBySeason[s] || []).slice().sort((a, b) => (a.pick_no || 0) - (b.pick_no || 0));
                    for (const p of picksForSeason) {
                        const pid = p.player_id;
                        if (!pid) continue;
                        if (!p.is_keeper) {
                            keeperHistory[pid] = { yearsKept: 0, lastPickedBy: p.picked_by || keeperHistory[pid]?.lastPickedBy || null };
                        } else {
                            keeperHistory[pid] = { yearsKept: (keeperHistory[pid]?.yearsKept || 0) + 1, lastPickedBy: p.picked_by || keeperHistory[pid]?.lastPickedBy || null };
                        }
                    }
                }
                finalProcessedPicks = finalProcessedPicks.map(pick => {
                    const pid = pick.player_id;
                    if (!pid) return pick;
                    const yearsKept = keeperHistory[pid]?.yearsKept || 0;
                    return { ...pick, keeper_years: yearsKept, keeper_remaining: Math.max(0, 3 - yearsKept) };
                });
            } catch (keeperErr) {
                logger.warn('Error computing keeper history:', keeperErr);
            }

            // ── Stamp is_valued_keeper on keepers that occupy real pick slots ──
            // Starting 2026, keepers are slotted at real draft pick values.
            // getValuedKeeperCountForSeason tells us how many per team count.
            // We mark the top-N keepers per team (by lowest pick_no = highest
            // draft value slot) as valued, so computeScaledVorpDeltas scores them.
            try {
                const valuedKeeperCount = getValuedKeeperCountForSeason(selectedSeason);
                if (valuedKeeperCount > 0) {
                    // Group keeper picks by team owner
                    const keepersByOwner = {};
                    finalProcessedPicks.forEach(pick => {
                        if (!pick.is_keeper) return;
                        const owner = pick.picked_by || 'unknown';
                        if (!keepersByOwner[owner]) keepersByOwner[owner] = [];
                        keepersByOwner[owner].push(pick);
                    });

                    // For each owner, mark the top-N keepers (lowest pick_no = most
                    // valuable slot) as is_valued_keeper = true
                    const valuedKeeperPickNos = new Set();
                    Object.values(keepersByOwner).forEach(teamKeepers => {
                        const sorted = [...teamKeepers].sort((a, b) => (a.pick_no || 999) - (b.pick_no || 999));
                        sorted.slice(0, valuedKeeperCount).forEach(k => valuedKeeperPickNos.add(k.pick_no));
                    });

                    finalProcessedPicks = finalProcessedPicks.map(pick =>
                        pick.is_keeper && valuedKeeperPickNos.has(pick.pick_no)
                            ? { ...pick, is_valued_keeper: true }
                            : pick
                    );
                }
            } catch (keeperStampErr) {
                logger.warn('Error stamping valued keepers:', keeperStampErr);
            }

            // ── Build picks grouped by round ──────────────────────────────────
            const pickLookup = {};
            finalProcessedPicks.forEach(pick => {
                if (!pickLookup[pick.round]) pickLookup[pick.round] = {};
                pickLookup[pick.round][pick.pick_in_round] = pick;
            });

            for (let round = 1; round <= totalRounds; round++) {
                let slots = Array.from({ length: totalTeams }, (_, i) => i + 1);
                if (round % 2 === 0) slots = slots.reverse();
                if (!newPicksGroupedByRound[round]) newPicksGroupedByRound[round] = Array(totalTeams).fill(null);
                for (let col = 0; col < totalTeams; col++) {
                    const pick = (pickLookup[round] && pickLookup[round][col + 1])
                        ? pickLookup[round][col + 1]
                        : finalProcessedPicks.find(p => p.round === round && p.pick_in_round === col + 1) || null;
                    newPicksGroupedByRound[round][col] = pick;
                }
            }

            setPicksGroupedByRound(newPicksGroupedByRound);
            setDraftPicks(finalProcessedPicks.sort((a, b) => a.pick_no - b.pick_no));

            // ── Draft year summary ────────────────────────────────────────────
            try {
                const nonKeeperPicks = finalProcessedPicks.filter(p => !p.is_keeper && typeof p.scaled_vorp_delta === 'number');
                if (!nonKeeperPicks.length) { setDraftYearSummary(null); return; }

                const bestPick = nonKeeperPicks.slice().sort((a, b) => b.scaled_vorp_delta - a.scaled_vorp_delta)[0];
                const worstPick = nonKeeperPicks.slice().sort((a, b) => a.scaled_vorp_delta - b.scaled_vorp_delta)[0];

                const ownerTotals = {};
                nonKeeperPicks.forEach(p => {
                    const owner = p.picked_by || 'unknown';
                    if (!ownerTotals[owner]) ownerTotals[owner] = { total: 0, count: 0, teamName: p.picked_by_team_name || 'Unknown' };
                    ownerTotals[owner].total += p.scaled_vorp_delta;
                    ownerTotals[owner].count += 1;
                    if (p.season && (!ownerTotals[owner].latestSeason || p.season > ownerTotals[owner].latestSeason)) {
                        ownerTotals[owner].teamName = p.picked_by_team_name || ownerTotals[owner].teamName;
                        ownerTotals[owner].latestSeason = p.season;
                    }
                });

                const ownersArray = Object.entries(ownerTotals).map(([ownerId, agg]) => ({ ownerId, team: agg.teamName, totalScaledVorp: agg.total }));
                ownersArray.sort((a, b) => b.totalScaledVorp - a.totalScaledVorp);

                const roundSummaries = [];
                for (let r = 1; r <= (totalRounds || 0); r++) {
                    const picksThisRound = nonKeeperPicks.filter(p => (p.round || Math.ceil(p.pick_no / totalTeams)) === r);
                    if (!picksThisRound.length) { roundSummaries.push(null); continue; }
                    roundSummaries.push({
                        round: r,
                        best: picksThisRound.slice().sort((a, b) => b.scaled_vorp_delta - a.scaled_vorp_delta)[0],
                        worst: picksThisRound.slice().sort((a, b) => a.scaled_vorp_delta - b.scaled_vorp_delta)[0],
                        avgScaledVorp: picksThisRound.reduce((s, p) => s + (p.scaled_vorp_delta || 0), 0) / picksThisRound.length,
                    });
                }

                setDraftYearSummary({
                    bestTeam: ownersArray[0] || { team: 'Unknown', totalScaledVorp: 0 },
                    worstTeam: ownersArray[ownersArray.length - 1] || { team: 'Unknown', totalScaledVorp: 0 },
                    bestPick, worstPick, roundSummaries,
                });
            } catch (summaryErr) {
                logger.warn('Error computing draftYearSummary:', summaryErr);
                setDraftYearSummary(null);
            }
        };

        processDraftBoardData();
    }, [selectedSeason, historicalData, usersData, getTeamName, getUserIdFromRosterId, leagueScoringSettings, leagueRosterSettings]);

    const handleSeasonChange = (event) => {
        const value = event.target.value;
        setSelectedSeason(value === "Overview" ? "Overview" : Number(value));
        setActiveTab('board');
    };

    // ── Overview data ─────────────────────────────────────────────────────────
    const [overviewData, setOverviewData] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);

    useEffect(() => {
        const computeOverviewData = async () => {
            if (selectedSeason !== "Overview" || !historicalData?.draftsBySeason || !historicalData?.draftPicksBySeason || !usersData) return;
            setOverviewLoading(true);
            try {
                const seasonPromises = Object.keys(historicalData.draftsBySeason).map(async (season) => {
                    const seasonNumber = Number(season);
                    const seasonDrafts = historicalData.draftsBySeason[season];
                    const seasonPicks = historicalData.draftPicksBySeason[season];
                    if (!seasonDrafts || !seasonPicks?.length) return [];
                    try {
                        const lss = await fetchLeagueScoringSettings(seasonDrafts.league_id);
                        const lrs = await fetchLeagueRosterSettings(seasonDrafts.league_id);
                        if (!lss || !lrs) return [];

                        const picksPromises = seasonPicks.map(async pick => {
                            const enrichedPick = enrichPickForCalculations(pick, usersData, historicalData, seasonNumber, getTeamName);
                            enrichedPick.pick_in_round = pick.draft_slot;
                            enrichedPick.season = seasonNumber;
                            let fantasyPoints = 0;
                            if (!pick.is_keeper && pick.player_id) {
                                const playerNameForLog = enrichedPick.player_position === 'DEF'
                                    ? `${enrichedPick.metadata?.first_name || ''} ${enrichedPick.metadata?.last_name || ''}`.trim()
                                    : enrichedPick.player_name;
                                const playerStats = await fetchPlayerStats(pick.player_id, seasonNumber, 'regular', playerNameForLog);
                                if (playerStats && lss) fantasyPoints = calculateFantasyPoints(playerStats, lss, enrichedPick.player_position);
                                enrichedPick.player_stats = playerStats;
                            }
                            enrichedPick.fantasy_points = fantasyPoints;
                            return enrichedPick;
                        });

                        const processedPicks = await Promise.all(picksPromises);
                        const draftablePlayers = processedPicks.filter(p => !p.is_keeper);

                        let playersWithVORP = [];
                        let draftPickExpectedVORPs = new Map();
                        if (draftablePlayers.length > 0) {
                            const playerRankings = rankPlayersByFantasyPoints(draftablePlayers);
                            if (Object.keys(playerRankings.positional).length > 0) {
                                const vorpResults = calculateVORP(playerRankings.positional, lrs);
                                for (const pos in vorpResults) playersWithVORP.push(...vorpResults[pos]);
                                playersWithVORP.sort((a, b) => b.vorp - a.vorp);
                            }
                            const histPicksForBaseline = Array.isArray(allDraftHistory)
                                ? allDraftHistory.filter(p => !p.is_keeper && typeof p.fantasy_points === 'number')
                                : [];
                            draftPickExpectedVORPs = generateExpectedByPositionAndSlot(
                                seasonPicks.length,
                                histPicksForBaseline
                            );
                        }

                        return computeScaledVorpDeltas(processedPicks, draftPickExpectedVORPs)
                            .map(p => ({ ...p, season: seasonNumber }));
                    } catch (err) {
                        logger.error(`Error processing season ${season}:`, err);
                        return [];
                    }
                });

                const allSeasonResults = await Promise.all(seasonPromises);
                const allProcessedPicks = allSeasonResults.flat().filter(Boolean);

                if (!allProcessedPicks.length) {
                    setOverviewData({ topPicks: [], worstPicks: [], teamRankings: [], draftsSummaries: [] });
                    return;
                }

                const normalizedPicks = allProcessedPicks.map(p => ({
                    ...p,
                    round: p.round || Math.ceil(p.pick_no / 12),
                    pick_in_round: p.draft_slot || ((p.pick_no - 1) % 12) + 1,
                    team: p.picked_by_team_name || 'Unknown Team',
                    player_name: p.player_name || 'Unknown Player',
                    position: p.player_position || 'NA',
                    team_abbrev: p.player_team || '',
                }));

                const validPicks = normalizedPicks.filter(p => !p.is_keeper && p.pick_no && typeof p.scaled_vorp_delta === 'number');
                const topPicks = validPicks.slice().sort((a, b) => b.scaled_vorp_delta - a.scaled_vorp_delta).slice(0, 5);
                const worstPicks = validPicks.slice().sort((a, b) => a.scaled_vorp_delta - b.scaled_vorp_delta).slice(0, 5);

                const ownerAggregates = {};
                validPicks.forEach(p => {
                    const ownerId = p.picked_by || 'unknown';
                    if (!ownerAggregates[ownerId]) ownerAggregates[ownerId] = { total: 0, count: 0, latestTeamName: p.team || 'Unknown', latestSeason: p.season || 0 };
                    ownerAggregates[ownerId].total += p.scaled_vorp_delta;
                    ownerAggregates[ownerId].count += 1;
                    if (p.season > ownerAggregates[ownerId].latestSeason) {
                        ownerAggregates[ownerId].latestTeamName = p.team || 'Unknown';
                        ownerAggregates[ownerId].latestSeason = p.season;
                    }
                });
                const teamRankings = Object.entries(ownerAggregates)
                    .map(([ownerId, agg]) => ({ ownerId, team: agg.latestTeamName, value: agg.count > 0 ? agg.total / agg.count : 0 }))
                    .sort((a, b) => b.value - a.value);

                const seasonOwnerTotals = {};
                validPicks.forEach(p => {
                    const key = `${p.season}_${p.picked_by}`;
                    if (!seasonOwnerTotals[key]) seasonOwnerTotals[key] = { season: p.season, ownerId: p.picked_by, team: p.team, totalScaledVorp: 0, picks: [] };
                    seasonOwnerTotals[key].totalScaledVorp += p.scaled_vorp_delta;
                    seasonOwnerTotals[key].picks.push(p);
                });
                const draftsSummaries = Object.values(seasonOwnerTotals).sort((a, b) => b.totalScaledVorp - a.totalScaledVorp);

                setOverviewData({ topPicks, worstPicks, teamRankings, draftsSummaries });
            } catch (err) {
                logger.error('Overview computation error:', err);
                setOverviewData({ topPicks: [], worstPicks: [], teamRankings: [], draftsSummaries: [] });
            } finally {
                setOverviewLoading(false);
            }
        };
        computeOverviewData();
    }, [allDraftHistory, usersData, historicalData, getTeamName, selectedSeason]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="text-center p-6 bg-gray-800 rounded-lg shadow-md">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-gray-300">Loading draft data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="text-center p-6 bg-red-800 border border-red-600 text-red-100 rounded-lg shadow-md">
                    <p className="font-bold text-xl mb-2">Error Loading Data</p>
                    <p className="text-base">Failed to load draft data: {error.message || String(error)}</p>
                </div>
            </div>
        );
    }

    const totalRounds = draftSummary?.settings?.rounds || 0;
    const roundsArray = Array.from({ length: totalRounds }, (_, i) => i + 1);

    const tradedPicksLookup = useMemo(() => {
        const lookup = new Map();
        tradedPicksData.forEach(tp => {
            if (!lookup.has(tp.round)) lookup.set(tp.round, new Map());
            lookup.get(tp.round).set(String(tp.roster_id), tp);
        });
        return lookup;
    }, [tradedPicksData]);

    return (
        <div className="w-full max-w-7xl mx-auto px-0 sm:px-4 md:px-6 bg-gray-900 text-white min-h-screen py-6">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center text-blue-400">Draft Analysis</h1>

            <div className="mb-4 flex flex-col sm:flex-row justify-center items-center sm:space-x-4 space-y-2 sm:space-y-0">
                <label htmlFor="season-select" className="text-sm sm:text-lg">Select Season:</label>
                <select
                    id="season-select"
                    className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-blue-500 focus:border-blue-500 w-40 sm:w-44"
                    value={selectedSeason || ''}
                    onChange={handleSeasonChange}
                    disabled={seasons.length === 0}
                >
                    <option value="Overview">Overview</option>
                    {seasons.length > 0
                        ? seasons.map(season => <option key={season} value={season}>{season}</option>)
                        : <option value="">No Seasons Available</option>
                    }
                </select>
            </div>

            {/* ── Overview ── */}
            {selectedSeason === "Overview" && (
                <div className="px-0 sm:px-6 py-6 mb-8">
                    <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-center text-yellow-400">All-Time Draft Overview</h2>
                    {overviewLoading ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400">Computing all-time draft data with real Draft Value...</p>
                        </div>
                    ) : overviewData ? (
                        <div className="space-y-4">
                            {/* Position mix chart */}
                            <div className="bg-gray-700 rounded-lg p-4 shadow-md">
                                <h3 className="text-xl sm:text-2xl font-semibold text-yellow-200 mb-1">Draft Position Mix</h3>
                                <p className="text-gray-200 text-sm mb-2">Percent of picks by position per round</p>
                                <div className="w-full mt-2">
                                    <OverallDraftPositionChart allDraftHistory={allDraftHistory || []} totalRounds={12} totalTeams={12} compact />
                                </div>
                            </div>

                            {/* Top / Worst picks */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-gray-700 rounded-lg p-4 sm:p-6 shadow-md">
                                    <h3 className="text-xl sm:text-2xl font-semibold text-blue-300 mb-3">Top Picks All-Time</h3>
                                    <p className="text-gray-300 mb-3 text-sm">Top draft picks by value all-time.</p>
                                    <div className="space-y-3">
                                        {overviewData.topPicks.map((pick, idx) => {
                                            const teams = 12;
                                            const origRound = Math.ceil((pick.pick_no || 0) / teams) || (pick.round || 1);
                                            const origPickInRound = ((Number(pick.pick_no || 1) - 1) % teams) + 1;
                                            return (
                                                <div key={idx} className="bg-gray-600 p-3 sm:p-4 rounded-lg border-l-4 border-green-400">
                                                    <div className="text-base sm:text-lg font-semibold text-white truncate">
                                                        Pick {pick.pick_no} - {pick.player_name} · {pick.position} {pick.team_abbrev ? `(${pick.team_abbrev})` : ''}
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-300">{pick.season} · Round {origRound}, Pick {origPickInRound}</div>
                                                    <div className="text-sm text-gray-200 flex items-center justify-between mt-1">
                                                        <span className="text-xs">Draft Value</span>
                                                        <span className="text-xl sm:text-2xl font-bold text-green-400">{formatScore(pick.scaled_vorp_delta, 2)}</span>
                                                    </div>
                                                    <div className="text-sm sm:text-base font-medium text-blue-300 truncate">{pick.team}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-gray-700 rounded-lg p-4 sm:p-6 shadow-md">
                                    <h3 className="text-xl sm:text-2xl font-semibold text-red-300 mb-3">Worst Picks All-Time</h3>
                                    <p className="text-gray-300 mb-3 text-sm">Worst draft picks by value all-time.</p>
                                    <div className="space-y-3">
                                        {overviewData.worstPicks.map((pick, idx) => {
                                            const teams = 12;
                                            const origRound = Math.ceil((pick.pick_no || 0) / teams) || (pick.round || 1);
                                            const origPickInRound = ((Number(pick.pick_no || 1) - 1) % teams) + 1;
                                            return (
                                                <div key={idx} className="bg-gray-600 p-3 sm:p-4 rounded-lg border-l-4 border-red-400">
                                                    <div className="text-base sm:text-lg font-semibold text-white truncate">
                                                        Pick {pick.pick_no} - {pick.player_name} · {pick.position} {pick.team_abbrev ? `(${pick.team_abbrev})` : ''}
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-300">{pick.season} · Round {origRound}, Pick {origPickInRound}</div>
                                                    <div className="text-sm text-gray-200 flex items-center justify-between mt-1">
                                                        <span className="text-xs">Draft Value</span>
                                                        <span className="text-xl sm:text-2xl font-bold text-red-400">{formatScore(pick.scaled_vorp_delta, 2)}</span>
                                                    </div>
                                                    <div className="text-sm sm:text-base font-medium text-blue-300 truncate">{pick.team}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* All-time rankings + best/worst drafts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-gray-700 rounded-lg p-4 sm:p-6 shadow-md">
                                    <h3 className="text-xl sm:text-2xl font-semibold text-purple-300 mb-3">All-Time Draft Rankings</h3>
                                    <p className="text-gray-300 mb-3 text-sm">Members ranked by all-time avg. draft pick value.</p>
                                    <div className="space-y-1">
                                        {overviewData.teamRankings.map((team, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-gray-600 p-2 sm:p-3 rounded">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-gray-400 font-medium">#{idx + 1}</span>
                                                    <span className="text-white text-sm font-medium truncate max-w-[160px]">{team.team}</span>
                                                </div>
                                                <span className={`font-bold text-sm ${team.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatScore(team.value, 2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gray-700 rounded-lg p-4 sm:p-6 shadow-md">
                                    <h3 className="text-xl sm:text-2xl font-semibold text-green-300 mb-3">Best & Worst All-Time Drafts</h3>
                                    <div className="mb-4">
                                        <h4 className="text-sm sm:text-lg font-semibold text-blue-300 mb-2">Best All-Time Drafts</h4>
                                        <div className="space-y-2">
                                            {overviewData.draftsSummaries.slice(0, 3).map((draft, i) => (
                                                <div key={i} className="bg-gray-600 p-2 sm:p-3 rounded border-l-2 border-green-400 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-white text-sm font-medium">{draft.team}</div>
                                                        <div className="text-xs text-gray-300">{draft.season}</div>
                                                    </div>
                                                    <div className="text-sm font-bold text-green-400">{formatScore(draft.totalScaledVorp, 2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm sm:text-lg font-semibold text-red-300 mb-2">Worst All-Time Drafts</h4>
                                        <div className="space-y-2">
                                            {overviewData.draftsSummaries.slice(-3).reverse().map((draft, i) => (
                                                <div key={i} className="bg-gray-600 p-2 sm:p-3 rounded border-l-2 border-red-400 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-white text-sm font-medium">{draft.team}</div>
                                                        <div className="text-xs text-gray-300">{draft.season}</div>
                                                    </div>
                                                    <div className="text-sm font-bold text-red-400">{formatScore(draft.totalScaledVorp, 2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-400">No all-time draft data available.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Season view ── */}
            {selectedSeason !== "Overview" && selectedSeason && draftSummary ? (
                <div className="px-0 sm:px-6 py-6 mb-8">
                    <h2 className="text-3xl font-semibold mb-4 text-center text-green-400">{selectedSeason} Draft Summary</h2>

                    {/* Tab nav */}
                    <div className="flex justify-center mb-6 border-b border-gray-600">
                        <button
                            className={`py-2 px-4 text-lg font-medium ${activeTab === 'board' ? 'border-b-2 border-blue-400 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                            onClick={() => setActiveTab('board')}
                        >
                            Draft Board
                        </button>
                        <button
                            className={`py-2 px-4 text-lg font-medium ${activeTab === 'summary' ? 'border-b-2 border-green-400 text-green-400' : 'text-gray-400 hover:text-gray-200'}`}
                            onClick={() => setActiveTab('summary')}
                        >
                            Draft Summary
                        </button>
                    </div>

                    {/* ── Draft Board tab — now uses DraftBoardGrid ── */}
                    {activeTab === 'board' && (
                        <div className="mt-6">
                            <h3 className="text-2xl font-semibold mb-4 text-center text-purple-400">Draft Board</h3>
                            {orderedTeamColumns.length > 0 && totalRounds > 0 ? (
                                <DraftBoardGrid
                                    orderedTeamColumns={orderedTeamColumns}
                                    roundsArray={roundsArray}
                                    picksGroupedByRound={picksGroupedByRound}
                                    draftSummary={draftSummary}
                                    historicalData={historicalData}
                                    selectedSeason={selectedSeason}
                                    tradedPicksLookup={tradedPicksLookup}
                                    getTeamName={getTeamName}
                                    getUserIdFromRosterId={getUserIdFromRosterId}
                                />
                            ) : (
                                <p className="text-center text-gray-400">No draft board data available for this season.</p>
                            )}
                        </div>
                    )}

                    {/* ── Summary tab (unchanged) ── */}
                    {activeTab === 'summary' && (
                        <div className="mt-6">
                            <h3 className="text-2xl font-semibold mb-4 text-center text-green-400">Draft Year Summary</h3>
                            {draftYearSummary ? (
                                <div className="space-y-8">
                                    <div className="flex flex-col md:flex-row md:space-x-8 justify-center items-center">
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md mb-4 md:mb-0 w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-blue-300 mb-2">Best Team by Total Draft Value</h4>
                                            <p className="text-lg">{draftYearSummary.bestTeam.team} <span className="text-green-400 font-semibold">({formatScore(draftYearSummary.bestTeam.totalScaledVorp, 2)})</span></p>
                                        </div>
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-red-300 mb-2">Worst Team by Total Draft Value</h4>
                                            <p className="text-lg">{draftYearSummary.worstTeam.team} <span className="text-red-400 font-semibold">({formatScore(draftYearSummary.worstTeam.totalScaledVorp, 2)})</span></p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row md:space-x-8 justify-center items-center">
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md mb-4 md:mb-0 w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-blue-300 mb-2">Best Pick (Draft Value)</h4>
                                            <p className="text-lg">
                                                {draftYearSummary.bestPick.player_name} ({draftYearSummary.bestPick.player_position})
                                                <span className="ml-2 text-green-400 font-semibold">{formatScore(draftYearSummary.bestPick.scaled_vorp_delta ?? draftYearSummary.bestPick.vorp_delta, 2)}</span>
                                                <br />
                                                <span className="text-sm text-gray-300">Team: {draftYearSummary.bestPick.picked_by_team_name} | Pick: {draftYearSummary.bestPick.pick_no}</span>
                                            </p>
                                        </div>
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-red-300 mb-2">Worst Pick (Draft Value)</h4>
                                            <p className="text-lg">
                                                {draftYearSummary.worstPick.player_name} ({draftYearSummary.worstPick.player_position})
                                                <span className="ml-2 text-red-400 font-semibold">{formatScore(draftYearSummary.worstPick.scaled_vorp_delta ?? draftYearSummary.worstPick.vorp_delta, 2)}</span>
                                                <br />
                                                <span className="text-sm text-gray-300">Team: {draftYearSummary.worstPick.picked_by_team_name} | Pick: {draftYearSummary.worstPick.pick_no}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-700 rounded-lg p-4 shadow-md">
                                        <h4 className="text-xl font-bold text-purple-300 mb-4">Round-by-Round Summary</h4>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm text-gray-200">
                                                <thead>
                                                    <tr className="bg-gray-800">
                                                        <th className="py-2 px-4">Round</th>
                                                        <th className="py-2 px-4">Best Pick (Draft Value)</th>
                                                        <th className="py-2 px-4">Worst Pick (Draft Value)</th>
                                                        <th className="py-2 px-4">Avg Draft Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {draftYearSummary.roundSummaries.map((round, idx) => round && (
                                                        <React.Fragment key={idx}>
                                                            <tr className="border-b border-gray-600 align-top">
                                                                <td className="py-2 px-4 text-center font-bold align-top">{round.round}</td>
                                                                <td className="py-2 px-4 align-top">
                                                                    <div className="flex flex-col space-y-1">
                                                                        <div className="text-sm font-semibold text-white truncate">{round.best.player_name} <span className="text-xs text-gray-400">({round.best.player_position})</span></div>
                                                                        <div className="text-sm font-bold text-green-400">Draft Value: {formatScore(round.best?.scaled_vorp_delta ?? round.best?.vorp_delta, 2)}</div>
                                                                        <div className="text-xs text-gray-400">Team: {round.best.picked_by_team_name || 'Unknown'} | Pick: {round.best.pick_no || '—'}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 px-4 align-top">
                                                                    <div className="flex flex-col space-y-1">
                                                                        <div className="text-sm font-semibold text-white truncate">{round.worst.player_name} <span className="text-xs text-gray-400">({round.worst.player_position})</span></div>
                                                                        <div className="text-sm font-bold text-red-400">Draft Value: {formatScore(round.worst?.scaled_vorp_delta ?? round.worst?.vorp_delta, 2)}</div>
                                                                        <div className="text-xs text-gray-400">Team: {round.worst.picked_by_team_name || 'Unknown'} | Pick: {round.worst.pick_no || '—'}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 px-4 text-center align-top">{typeof round.avgScaledVorp === 'number' ? formatScore(round.avgScaledVorp, 2) : '—'}</td>
                                                            </tr>
                                                        </React.Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-gray-400">No draft summary data available for this season.</p>
                            )}
                        </div>
                    )}
                </div>
            ) : selectedSeason !== "Overview" ? (
                <p className="text-center text-gray-400">Select a season to view draft analysis.</p>
            ) : null}
        </div>
    );
};

export default DraftAnalysis;
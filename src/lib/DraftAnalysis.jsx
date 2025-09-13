// src/lib/DraftAnalysis.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getSleeperAvatarUrl, getSleeperPlayerHeadshotUrl, fetchAllTradedPicksMerged } from '../utils/sleeperApi';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // Import FontAwesomeIcon
import { faRepeat } from '@fortawesome/free-solid-svg-icons'; // Import the specific icon

// Import your new calculation functions
import { enrichPickForCalculations, calculatePlayerValue, calculatePickSlotValue, generateExpectedVorpByPickSlot, calculateVORPDelta } from '../utils/draftCalculations';
// Import fetchPlayerStats, fetchLeagueScoringSettings, fetchLeagueRosterSettings, calculateFantasyPoints, and rankPlayersByFantasyPoints from sleeperPlayerStats
import { fetchPlayerStats, fetchLeagueScoringSettings, fetchLeagueRosterSettings, calculateFantasyPoints, rankPlayersByFantasyPoints, calculateVORP } from '../utils/sleeperPlayerStats';

// Removed: import YearlyDraftStats from './YearlyDraftStats';


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
    const [draftPicks, setDraftPicks] = useState([]); // Array of pick objects
    const [tradedPicksData, setTradedPicksData] = useState([]); // New state for traded picks
    const [leagueScoringSettings, setLeagueScoringSettings] = useState(null); // New state for scoring settings
    const [leagueRosterSettings, setLeagueRosterSettings] = useState(null); // New state for roster settings

    // New state for the structured draft board data
    const [orderedTeamColumns, setOrderedTeamColumns] = useState([]);
    const [picksGroupedByRound, setPicksGroupedByRound] = useState({});

    // State for managing active tab - default to 'board' since overview is now separate
    const [activeTab, setActiveTab] = useState('board');

    // State for draft summary stats
    const [draftYearSummary, setDraftYearSummary] = useState(null);
    // Effect to calculate draft year summary for the summary tab
    useEffect(() => {
        if (!selectedSeason || !historicalData || !usersData || !draftSummary || !draftPicks.length) {
            setDraftYearSummary(null);
            return;
        }
        try {
            // Use the already-calculated VORP delta and assigned VORP from draftPicks (matches board)
            // Do NOT mutate or recalculate vorp_delta or draft_pick_assigned_vorp
            // Always sort by pick_no to match board order
            const picks = [...draftPicks].sort((a, b) => a.pick_no - b.pick_no);

            // Group by team (sum scaled VORP delta; fall back to raw vorp_delta if scaled missing)
            const teamVorpTotals = {};
            picks.forEach(pick => {
                const team = pick.picked_by_team_name || 'Unknown';
                if (!teamVorpTotals[team]) teamVorpTotals[team] = 0;
                const v = (typeof pick.scaled_vorp_delta === 'number') ? pick.scaled_vorp_delta : (typeof pick.vorp_delta === 'number' ? pick.vorp_delta : 0);
                teamVorpTotals[team] += v;
            });

            // Best/worst team by total scaled VORP delta
            const teamVorpArr = Object.entries(teamVorpTotals).map(([team, totalVorp]) => ({ team, totalScaledVorp: totalVorp }));
            const bestTeam = teamVorpArr.reduce((a, b) => (a.totalScaledVorp > b.totalScaledVorp ? a : b), { team: '', totalScaledVorp: -Infinity });
            const worstTeam = teamVorpArr.reduce((a, b) => (a.totalScaledVorp < b.totalScaledVorp ? a : b), { team: '', totalScaledVorp: Infinity });

            // Best/worst pick by VORP delta (use the same metric the board shows: scaled_vorp_delta when available)
            const pickComparableValue = p => (typeof p.scaled_vorp_delta === 'number' ? p.scaled_vorp_delta : p.vorp_delta);
            const bestPick = picks.reduce((a, b) => (pickComparableValue(a) > pickComparableValue(b) ? a : b), picks[0]);
            const worstPick = picks.reduce((a, b) => (pickComparableValue(a) < pickComparableValue(b) ? a : b), picks[0]);

            // Round-by-round summaries (use pick.vorp_delta and draft_pick_assigned_vorp)
            const rounds = draftSummary?.settings?.rounds || 0;
            const picksByRound = Array.from({ length: rounds }, (_, i) => i + 1).map(roundNum =>
                picks.filter(pick => pick.round === roundNum)
            );
            const roundSummaries = picksByRound.map((roundPicks, idx) => {
                if (!roundPicks.length) return null;
                const best = roundPicks.reduce((a, b) => (pickComparableValue(a) > pickComparableValue(b) ? a : b), roundPicks[0]);
                const worst = roundPicks.reduce((a, b) => (pickComparableValue(a) < pickComparableValue(b) ? a : b), roundPicks[0]);
                // Average the raw VORP delta for the round (use p.vorp_delta when available,
                // otherwise fall back to the board metric for that pick)
                // Prefer the scaled VORP delta (scaled_vorp_delta) when computing the round average.
                // Fall back to vorp_delta if scaled is not available for a pick.
                const sumScaledVorpForRound = roundPicks.reduce((sum, p) => {
                    const v = (typeof p.scaled_vorp_delta === 'number') ? p.scaled_vorp_delta : (typeof p.vorp_delta === 'number' ? p.vorp_delta : 0);
                    return sum + v;
                }, 0);
                const sumPlayerActualVorp = roundPicks.reduce((sum, p) => sum + (typeof p.player_actual_vorp === 'number' ? p.player_actual_vorp : 0), 0);
                const sumAssignedVorp = roundPicks.reduce((sum, p) => sum + (typeof p.draft_pick_assigned_vorp === 'number' ? p.draft_pick_assigned_vorp : 0), 0);
                const avgScaledVorp = sumScaledVorpForRound / roundPicks.length;
                return {
                    round: idx + 1,
                    best,
                    worst,
                    avgScaledVorp: Number(avgScaledVorp.toFixed(2))
                };
            });

            setDraftYearSummary({
                bestTeam,
                worstTeam,
                bestPick,
                worstPick,
                roundSummaries,
            });
        } catch (err) {
            console.error('Draft summary calculation error:', err);
            setDraftYearSummary(null);
        }
    }, [selectedSeason, historicalData, usersData, draftSummary, draftPicks]);


    // Log raw data from context
    console.log('--- DraftAnalysis Component Render ---');
    console.log('Loading:', loading);
    console.log('Error:', error);
    console.log('Historical Data (raw):', historicalData);
    console.log('Users Data (raw):', usersData);
    console.log('------------------------------------');

    // Helper to get user ID from roster ID for a specific season
    const getUserIdFromRosterId = useCallback((rosterId, season, historicalRostersBySeason) => {
        const rostersForSeason = historicalRostersBySeason?.[season];
        const roster = rostersForSeason?.find(r => String(r.roster_id) === String(rosterId));
        return roster ? roster.owner_id : null;
    }, []);

    // Effect to populate seasons dropdown and set default
    useEffect(() => {
        console.log('useEffect: Populating seasons and setting default season.');
        console.log('Current loading status:', loading);
        console.log('Current error status:', error);
        console.log('Historical Data in season useEffect:', historicalData);

        if (!loading && !error && historicalData && historicalData.draftsBySeason) {
            const allYears = Object.keys(historicalData.draftsBySeason)
                .map(Number)
                .sort((a, b) => b - a); // Sort descending
            setSeasons(allYears);

            if (allYears.length > 0 && !selectedSeason) {
                setSelectedSeason("Overview"); // Set Overview as default
            }
        }
    }, [loading, error, historicalData, selectedSeason]);

    // Effect to fetch league scoring and roster settings when selectedSeason changes
    useEffect(() => {
        const fetchLeagueSettings = async () => {
            if (selectedSeason && typeof selectedSeason === 'number' && historicalData && historicalData.draftsBySeason) {
                const seasonDrafts = historicalData.draftsBySeason[selectedSeason];
                if (seasonDrafts && seasonDrafts.league_id) {
                    console.log(`Fetching league settings for league ID: ${seasonDrafts.league_id}`);
                    const scoringSettings = await fetchLeagueScoringSettings(seasonDrafts.league_id);
                    setLeagueScoringSettings(scoringSettings);

                    const rosterSettings = await fetchLeagueRosterSettings(seasonDrafts.league_id);
                    setLeagueRosterSettings(rosterSettings);

                } else {
                    console.log(`No league ID found for season ${selectedSeason} to fetch league settings.`);
                    setLeagueScoringSettings(null);
                    setLeagueRosterSettings(null);
                }
            } else {
                // Clear settings when Overview is selected
                setLeagueScoringSettings(null);
                setLeagueRosterSettings(null);
            }
        };
        fetchLeagueSettings();
    }, [selectedSeason, historicalData]);


    // Effect to process draft data and structure it for the board
    useEffect(() => {
        console.log('useEffect: Processing draft data for selected season and board structure.');
        console.log('Current selectedSeason:', selectedSeason);
        console.log('Historical Data in draft processing useEffect:', historicalData);
        console.log('Users Data in draft processing useEffect:', usersData);
        console.log('League Scoring Settings:', leagueScoringSettings);
        console.log('League Roster Settings:', leagueRosterSettings);



        const processDraftBoardData = async () => {
            if (!selectedSeason || selectedSeason === "Overview" || !historicalData || !historicalData.draftsBySeason || !historicalData.draftPicksBySeason || !usersData || !leagueScoringSettings || !leagueRosterSettings) {
                console.log('Missing data dependencies for draft processing or Overview selected (selectedSeason, historicalData.draftsBySeason, historicalData.draftPicksBySeason, usersData, leagueScoringSettings, or leagueRosterSettings are not fully loaded or available).');
                setDraftSummary(null);
                setDraftPicks([]);
                setOrderedTeamColumns([]);
                setPicksGroupedByRound({});
                setTradedPicksData([]); // Clear traded picks data as well
                return;
            }

            const seasonDrafts = historicalData.draftsBySeason[selectedSeason];
            const seasonPicks = historicalData.draftPicksBySeason[selectedSeason];
            const leagueId = historicalData.leaguesMetadataBySeason?.[selectedSeason]?.league_id;

            // Fetch merged traded picks for this league/season
            let mergedTradedPicks = [];
            if (leagueId) {
                const leagueSettings = historicalData.leaguesMetadataBySeason[selectedSeason]?.settings || {};
                const totalWeeks = leagueSettings.playoff_start_week ? (parseInt(leagueSettings.playoff_start_week, 10) + 3) : 18;
                mergedTradedPicks = await fetchAllTradedPicksMerged(leagueId, totalWeeks);
            }
            setTradedPicksData(mergedTradedPicks);

            // Set draft summary
            setDraftSummary(seasonDrafts);

            // 1. Determine Ordered Team Columns
            const draftOrder = seasonDrafts.draft_order; // userId: slot_number
            // const totalTeams already declared above

            // Build orderedTeamColumns as a flat array of userIds in pick order for the entire draft (snake)
            const totalRounds = seasonDrafts.settings?.rounds || 0;
            const totalTeams = seasonDrafts.settings?.teams || 12;
            // Map slot number to userId
            const slotToUserId = Object.entries(draftOrder).reduce((acc, [userId, slot]) => {
                acc[slot] = userId;
                return acc;
            }, {});

            // For each round, build the pick order (snake)
            const pickOrderByRound = [];
            for (let round = 1; round <= totalRounds; round++) {
                let slots = Array.from({ length: totalTeams }, (_, i) => i + 1);
                if (round % 2 === 0) slots = slots.reverse();
                pickOrderByRound.push(slots.map(slot => slotToUserId[slot]));
            }

            // For the board columns, use the order of the first round
            const firstRoundUserIds = pickOrderByRound[0];
            const teamsInOrder = firstRoundUserIds.map(userId => {
                const user = usersData.find(u => u.user_id === userId);
                const roster = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.owner_id) === String(userId));
                return {
                    userId: userId,
                    teamName: roster ? (roster.metadata?.team_name || getTeamName(userId, selectedSeason)) : getTeamName(userId, selectedSeason),
                    teamAvatar: user ? getSleeperAvatarUrl(user.avatar) : getSleeperAvatarUrl(null)
                };
            });
            setOrderedTeamColumns(teamsInOrder);

            // 2. Process and Group Picks by Round and Column
            const newPicksGroupedByRound = {};

            // Use Promise.all to process picks concurrently for better performance
            const picksPromises = seasonPicks.map(async pick => {
                // Enrich pick data using the new utility function
                const enrichedPick = enrichPickForCalculations(pick, usersData, historicalData, selectedSeason, getTeamName);

                // Ensure pick_in_round is explicitly set for display purposes
                // Sleeper's draft_slot is usually the pick number within the round.
                enrichedPick.pick_in_round = pick.draft_slot;

                // Re-enable player stats fetching and fantasy points calculation
                let playerStats = null;
                let fantasyPoints = 0; // Initialize fantasy points

                // Only fetch stats and calculate fantasy points for non-keeper players
                if (!pick.is_keeper && pick.player_id) {
                    const playerNameForLog = enrichedPick.player_position === 'DEF' ?
                                             `${enrichedPick.metadata?.first_name || ''} ${enrichedPick.metadata?.last_name || ''}`.trim() :
                                             enrichedPick.player_name;

                    playerStats = await fetchPlayerStats(pick.player_id, selectedSeason, 'regular', playerNameForLog);

                    // Calculate fantasy points using the fetched stats and league settings
                    if (playerStats && leagueScoringSettings) {
                        fantasyPoints = calculateFantasyPoints(playerStats, leagueScoringSettings, enrichedPick.player_position);
                    }
                }
                enrichedPick.player_stats = playerStats; // Add stats to the enriched pick
                enrichedPick.fantasy_points = fantasyPoints; // Add calculated fantasy points


                // Now, perform other calculations using the enriched pick
                const playerValue = calculatePlayerValue(enrichedPick);
                const pickSlotValue = calculatePickSlotValue(enrichedPick.pick_no, seasonDrafts.settings?.rounds, seasonDrafts.settings?.teams);

                // Add calculated values to the enriched pick for potential display or further use
                enrichedPick.calculated_player_value = playerValue;
                enrichedPick.calculated_pick_slot_value = pickSlotValue;

                // --- DEBUGGING START ---
                console.log(`Processed Pick ${pick.pick_no} (${enrichedPick.player_name}):`);
                console.log(`  Fantasy Points: ${enrichedPick.fantasy_points}`);
                console.log(`  Calculated Player Value: ${enrichedPick.calculated_player_value}`);
                // --- DEBUGGING END ---

                return enrichedPick;
            });

            const processedPicks = await Promise.all(picksPromises);

            // Filter out keeper players before ranking for VORP calculation
            const draftablePlayers = processedPicks.filter(pick => !pick.is_keeper);

            let playerRankings = { overall: [], positional: {} };
            let vorpResults = {};
            let playersWithVORP = [];
            let draftPickExpectedVORPs = new Map();
            let averageVorpDeltaForThisSeason = 0;

            if (draftablePlayers.length > 0 && leagueRosterSettings) {
                playerRankings = rankPlayersByFantasyPoints(draftablePlayers);

                if (Object.keys(playerRankings.positional).length > 0) {
                    vorpResults = calculateVORP(playerRankings.positional, leagueRosterSettings);
                    for (const pos in vorpResults) {
                        playersWithVORP.push(...vorpResults[pos]);
                    }
                    playersWithVORP.sort((a, b) => b.vorp - a.vorp);
                }

                const totalDraftPicks = seasonPicks.length; // Total picks including keepers for slot mapping
                draftPickExpectedVORPs = generateExpectedVorpByPickSlot(totalDraftPicks);

                // Calculate average VORP delta for this specific season's non-keeper picks
                let totalSeasonVorpDelta = 0;
                let seasonNonKeeperCount = 0;

                draftablePlayers.forEach(pick => { // Iterate over draftablePlayers to calculate season average
                    const playerActualVORPData = playersWithVORP.find(p => p.player_id === pick.player_id);
                    const playerActualVORP = playerActualVORPData ? playerActualVORPData.vorp : 0;
                    const draftPickAssignedVORPForAvg = draftPickExpectedVORPs.get(pick.pick_no) || 0;
                    const vorpDeltaForAvg = calculateVORPDelta(playerActualVORP, draftPickAssignedVORPForAvg);
                    totalSeasonVorpDelta += vorpDeltaForAvg;
                    seasonNonKeeperCount++;
                });
                averageVorpDeltaForThisSeason = seasonNonKeeperCount > 0 ? totalSeasonVorpDelta / seasonNonKeeperCount : 0;
            }

            // Now, iterate through ALL processedPicks (including keepers) again to add VORP delta and scaled_vorp_delta
            let finalProcessedPicks = processedPicks.map(pick => {
                let playerActualVORP = 0;
                let draftPickAssignedVORP = 0;
                let vorpDelta = 0;
                let scaledVorpDelta = 0;

                if (!pick.is_keeper) {
                    const playerActualVORPData = playersWithVORP.find(p => p.player_id === pick.player_id);
                    playerActualVORP = playerActualVORPData ? playerActualVORPData.vorp : 0;
                    draftPickAssignedVORP = draftPickExpectedVORPs.get(pick.pick_no) || 0;
                    vorpDelta = calculateVORPDelta(playerActualVORP, draftPickAssignedVORP);
                    scaledVorpDelta = (vorpDelta - averageVorpDeltaForThisSeason) / 10;
                }

                return {
                    ...pick,
                    player_actual_vorp: playerActualVORP,
                    draft_pick_assigned_vorp: draftPickAssignedVORP,
                    vorp_delta: vorpDelta,
                    scaled_vorp_delta: scaledVorpDelta
                };
            });

            // Build a lookup for picks: round -> pick_in_round -> pick object
            const pickLookup = {};
            finalProcessedPicks.forEach(pick => {
                if (!pickLookup[pick.round]) pickLookup[pick.round] = {};
                pickLookup[pick.round][pick.pick_in_round] = pick;
            });

            // For each round and each slot, determine the correct owner (traded or not) and assign the pick
            for (let round = 1; round <= totalRounds; round++) {
                let slots = Array.from({ length: totalTeams }, (_, i) => i + 1);
                if (round % 2 === 0) slots = slots.reverse();
                if (!newPicksGroupedByRound[round]) newPicksGroupedByRound[round] = Array(totalTeams).fill(null);
                for (let col = 0; col < totalTeams; col++) {
                    const origSlot = slots[col];
                    const origUserId = slotToUserId[origSlot];
                    // Check for a traded pick for this round/slot
                    let pick = null;
                    // Find the pick in this round/slot, regardless of who made it
                    // Find the pick whose pick_in_round matches (col+1) and round matches
                    if (pickLookup[round] && pickLookup[round][col+1]) {
                        pick = pickLookup[round][col+1];
                    } else {
                        // fallback: try to find a pick in this round made by the traded-to user
                        // (shouldn't be needed if pick_in_round is correct)
                        pick = finalProcessedPicks.find(p => p.round === round && p.pick_in_round === (col+1));
                    }
                    newPicksGroupedByRound[round][col] = pick || null;
                }
            }


            setPicksGroupedByRound(newPicksGroupedByRound);
            setDraftPicks(finalProcessedPicks.sort((a, b) => a.pick_no - b.pick_no));
        };

        processDraftBoardData();

    }, [selectedSeason, historicalData, usersData, getTeamName, getUserIdFromRosterId, leagueScoringSettings, leagueRosterSettings]);

    const handleSeasonChange = (event) => {
        const value = event.target.value;
        setSelectedSeason(value === "Overview" ? "Overview" : Number(value));
        setActiveTab('board'); // Reset to board tab when season changes
    };

    // State for overview data
    const [overviewData, setOverviewData] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);

    // Compute Overview data across all seasons (top/worst picks and team rankings)
    useEffect(() => {
        const computeOverviewData = async () => {
            console.log('Computing overview data...');
            console.log('allDraftHistory:', allDraftHistory);
            console.log('usersData:', usersData);
            console.log('historicalData:', historicalData);
            
            // Skip if we don't have required data or if we're in a seasonal view
            if (selectedSeason !== "Overview" || !historicalData?.draftsBySeason || !historicalData?.draftPicksBySeason || !usersData) {
                return;
            }

            setOverviewLoading(true);
            
            try {
                // Process each season to get real VORP calculations
                const seasonPromises = Object.keys(historicalData.draftsBySeason).map(async (season) => {
                    const seasonNumber = Number(season);
                    const seasonDrafts = historicalData.draftsBySeason[season];
                    const seasonPicks = historicalData.draftPicksBySeason[season];
                    
                    if (!seasonDrafts || !seasonPicks || !seasonPicks.length) {
                        return [];
                    }

                    try {
                        // Fetch league settings for this season
                        const leagueScoringSettings = await fetchLeagueScoringSettings(seasonDrafts.league_id);
                        const leagueRosterSettings = await fetchLeagueRosterSettings(seasonDrafts.league_id);
                        
                        if (!leagueScoringSettings || !leagueRosterSettings) {
                            console.log(`Missing league settings for season ${season}`);
                            return [];
                        }

                        // Process picks similar to seasonal processing
                        const picksPromises = seasonPicks.map(async pick => {
                            const enrichedPick = enrichPickForCalculations(pick, usersData, historicalData, seasonNumber, getTeamName);
                            enrichedPick.pick_in_round = pick.draft_slot;
                            enrichedPick.season = seasonNumber;

                            // Calculate fantasy points for non-keeper players
                            let playerStats = null;
                            let fantasyPoints = 0;

                            if (!pick.is_keeper && pick.player_id) {
                                const playerNameForLog = enrichedPick.player_position === 'DEF' ?
                                    `${enrichedPick.metadata?.first_name || ''} ${enrichedPick.metadata?.last_name || ''}`.trim() :
                                    enrichedPick.player_name;

                                playerStats = await fetchPlayerStats(pick.player_id, seasonNumber, 'regular', playerNameForLog);

                                if (playerStats && leagueScoringSettings) {
                                    fantasyPoints = calculateFantasyPoints(playerStats, leagueScoringSettings, enrichedPick.player_position);
                                }
                            }
                            
                            enrichedPick.player_stats = playerStats;
                            enrichedPick.fantasy_points = fantasyPoints;

                            return enrichedPick;
                        });

                        const processedPicks = await Promise.all(picksPromises);
                        const draftablePlayers = processedPicks.filter(pick => !pick.is_keeper);

                        // Calculate VORP for this season
                        let playersWithVORP = [];
                        let draftPickExpectedVORPs = new Map();
                        let averageVorpDeltaForThisSeason = 0;

                        if (draftablePlayers.length > 0 && leagueRosterSettings) {
                            const playerRankings = rankPlayersByFantasyPoints(draftablePlayers);

                            if (Object.keys(playerRankings.positional).length > 0) {
                                const vorpResults = calculateVORP(playerRankings.positional, leagueRosterSettings);
                                for (const pos in vorpResults) {
                                    playersWithVORP.push(...vorpResults[pos]);
                                }
                                playersWithVORP.sort((a, b) => b.vorp - a.vorp);
                            }

                            const totalDraftPicks = seasonPicks.length;
                            draftPickExpectedVORPs = generateExpectedVorpByPickSlot(totalDraftPicks);

                            // Calculate average VORP delta for this season
                            let totalSeasonVorpDelta = 0;
                            let seasonNonKeeperCount = 0;

                            draftablePlayers.forEach(pick => {
                                const playerActualVORPData = playersWithVORP.find(p => p.player_id === pick.player_id);
                                const playerActualVORP = playerActualVORPData ? playerActualVORPData.vorp : 0;
                                const draftPickAssignedVORPForAvg = draftPickExpectedVORPs.get(pick.pick_no) || 0;
                                const vorpDeltaForAvg = calculateVORPDelta(playerActualVORP, draftPickAssignedVORPForAvg);
                                totalSeasonVorpDelta += vorpDeltaForAvg;
                                seasonNonKeeperCount++;
                            });
                            averageVorpDeltaForThisSeason = seasonNonKeeperCount > 0 ? totalSeasonVorpDelta / seasonNonKeeperCount : 0;
                        }

                        // Add VORP calculations to all picks
                        const finalProcessedPicks = processedPicks.map(pick => {
                            let playerActualVORP = 0;
                            let draftPickAssignedVORP = 0;
                            let vorpDelta = 0;
                            let scaledVorpDelta = 0;

                            if (!pick.is_keeper) {
                                const playerActualVORPData = playersWithVORP.find(p => p.player_id === pick.player_id);
                                playerActualVORP = playerActualVORPData ? playerActualVORPData.vorp : 0;
                                draftPickAssignedVORP = draftPickExpectedVORPs.get(pick.pick_no) || 0;
                                vorpDelta = calculateVORPDelta(playerActualVORP, draftPickAssignedVORP);
                                scaledVorpDelta = (vorpDelta - averageVorpDeltaForThisSeason) / 10;
                            }

                            return {
                                ...pick,
                                player_actual_vorp: playerActualVORP,
                                draft_pick_assigned_vorp: draftPickAssignedVORP,
                                vorp_delta: vorpDelta,
                                scaled_vorp_delta: scaledVorpDelta,
                                season: seasonNumber
                            };
                        });

                        return finalProcessedPicks;
                    } catch (err) {
                        console.error(`Error processing season ${season}:`, err);
                        return [];
                    }
                });

                // Wait for all seasons to be processed
                const allSeasonResults = await Promise.all(seasonPromises);
                const allProcessedPicks = allSeasonResults.flat().filter(Boolean);

                console.log('Total processed picks with real VORP:', allProcessedPicks.length);
                console.log('Sample processed pick:', allProcessedPicks[0]);

                if (allProcessedPicks.length === 0) {
                    setOverviewData({ topPicks: [], worstPicks: [], teamRankings: [], draftsSummaries: [] });
                    return;
                }

                // Calculate round and pick in round for display
                const normalizedPicks = allProcessedPicks.map(p => {
                    const round = p.round || Math.ceil(p.pick_no / 12);
                    const pickInRound = p.draft_slot || ((p.pick_no - 1) % 12) + 1;

                    return {
                        ...p,
                        round: round,
                        pick_in_round: pickInRound,
                        team: p.picked_by_team_name || 'Unknown Team',
                        player_name: p.player_name || 'Unknown Player',
                        position: p.player_position || 'NA',
                        team_abbrev: p.player_team || '',
                    };
                });

                // Top picks (highest scaled_vorp_delta) - only non-keeper picks with valid VORP
                const topPicks = normalizedPicks
                    .filter(p => !p.is_keeper && p.pick_no && typeof p.scaled_vorp_delta === 'number')
                    .sort((a, b) => b.scaled_vorp_delta - a.scaled_vorp_delta)
                    .slice(0, 5);

                // Worst picks (lowest scaled_vorp_delta) - only non-keeper picks with valid VORP
                const worstPicks = normalizedPicks
                    .filter(p => !p.is_keeper && p.pick_no && typeof p.scaled_vorp_delta === 'number')
                    .sort((a, b) => a.scaled_vorp_delta - b.scaled_vorp_delta)
                    .slice(0, 5);

                // All-time team rankings by average draft pick value - group by owner, not team name
                const ownerAggregates = {};
                normalizedPicks.forEach(p => {
                    if (p.is_keeper || typeof p.scaled_vorp_delta !== 'number') return; // Skip keepers and invalid VORP
                    
                    const ownerId = p.picked_by || 'unknown';
                    if (!ownerAggregates[ownerId]) {
                        ownerAggregates[ownerId] = { 
                            total: 0, 
                            count: 0, 
                            latestTeamName: p.team || 'Unknown', // Use most recent team name encountered
                            latestSeason: p.season || 0
                        };
                    }
                    ownerAggregates[ownerId].total += p.scaled_vorp_delta;
                    ownerAggregates[ownerId].count += 1;
                    
                    // Update to use the most recent team name (highest season)
                    if (p.season > ownerAggregates[ownerId].latestSeason) {
                        ownerAggregates[ownerId].latestTeamName = p.team || 'Unknown';
                        ownerAggregates[ownerId].latestSeason = p.season;
                    }
                });
                
                const teamRankings = Object.entries(ownerAggregates)
                    .map(([ownerId, agg]) => ({ 
                        ownerId,
                        team: agg.latestTeamName, 
                        value: agg.count > 0 ? (agg.total / agg.count) : 0 
                    }))
                    .sort((a, b) => b.value - a.value);

                // Best/Worst drafts (by total scaled_vorp_delta per draft season + owner)
                const draftsSummaries = [];
                const seasonOwnerTotals = {};
                
                normalizedPicks.forEach(pick => {
                    if (pick.is_keeper || typeof pick.scaled_vorp_delta !== 'number') return;
                    
                    const key = `${pick.season}_${pick.picked_by}`;
                    if (!seasonOwnerTotals[key]) {
                        seasonOwnerTotals[key] = {
                            season: pick.season,
                            ownerId: pick.picked_by,
                            team: pick.team, // Use team name from this season
                            totalScaledVorp: 0,
                            picks: []
                        };
                    }
                    seasonOwnerTotals[key].totalScaledVorp += pick.scaled_vorp_delta;
                    seasonOwnerTotals[key].picks.push(pick);
                });
                
                Object.values(seasonOwnerTotals).forEach(summary => {
                    draftsSummaries.push(summary);
                });
                
                draftsSummaries.sort((a, b) => b.totalScaledVorp - a.totalScaledVorp);

                console.log('Overview data computed with real VORP values:', { 
                    topPicks: topPicks.length, 
                    worstPicks: worstPicks.length, 
                    teamRankings: teamRankings.length,
                    draftsSummaries: draftsSummaries.length 
                });

                setOverviewData({ topPicks, worstPicks, teamRankings, draftsSummaries });
            } catch (err) {
                console.error('Overview computation error:', err);
                setOverviewData({ topPicks: [], worstPicks: [], teamRankings: [], draftsSummaries: [] });
            } finally {
                setOverviewLoading(false);
            }
        };

        computeOverviewData();
    }, [allDraftHistory, usersData, historicalData, getTeamName, selectedSeason]);

    console.log('Rendering: Main content');
    console.log('Current seasons state:', seasons);
    console.log('Current selectedSeason state:', selectedSeason);
    console.log('Current draftSummary state:', draftSummary);
    console.log('Current draftPicks state (flat):', draftPicks.length);
    console.log('Current orderedTeamColumns state:', orderedTeamColumns.length);
    console.log('Current picksGroupedByRound state (rounds):', Object.keys(picksGroupedByRound).length);
    console.log('Current tradedPicksData state:', tradedPicksData.length);
    console.log('Current leagueScoringSettings state:', leagueScoringSettings);
    console.log('Current leagueRosterSettings state:', leagueRosterSettings);
    console.log('Current activeTab state:', activeTab);


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="text-center p-6 bg-gray-800 rounded-lg shadow-md">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
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

    // Create a lookup for traded picks for efficient access in rendering
    const tradedPicksLookup = useMemo(() => {
        const lookup = new Map(); // Map<round, Map<original_roster_id, traded_pick_object>>
        tradedPicksData.forEach(tp => {
            if (!lookup.has(tp.round)) {
                lookup.set(tp.round, new Map());
            }
            lookup.get(tp.round).set(String(tp.roster_id), tp); // roster_id is original owner
        });
        return lookup;
    }, [tradedPicksData]);

    // Define position color mapping
    const positionColors = {
        'RB': 'bg-green-700',
        'QB': 'bg-red-700',
        'WR': 'bg-blue-700',
        'TE': 'bg-yellow-700',
        'K': 'bg-purple-700',
        'DEF': 'bg-zinc-700', // Changed from amber to zinc
        'DL': 'bg-zinc-700', // Defensive Lineman
        'LB': 'bg-zinc-700', // Linebacker
        'DB': 'bg-zinc-700', // Defensive Back
        'IDP': 'bg-zinc-700', // Individual Defensive Player (general)
        'DP': 'bg-gray-700', // Draft Pick (if no position)
        'NA': 'bg-gray-700', // Not Available/Unknown
    };

    const getPositionColorClass = (position) => {
        return positionColors[position.toUpperCase()] || 'bg-gray-700'; // Default to gray if position not found
    };


    return (
        <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
            <h1 className="text-4xl font-bold mb-6 text-center text-blue-400">Draft Analysis</h1>

            <div className="mb-6 flex flex-col sm:flex-row justify-center items-center sm:space-x-4 space-y-3 sm:space-y-0">
                <label htmlFor="season-select" className="text-lg">Select Season:</label>
                <select
                    id="season-select"
                    className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-blue-500 focus:border-blue-500 w-44"
                    value={selectedSeason || ''}
                    onChange={handleSeasonChange}
                    disabled={seasons.length === 0}
                >
                    <option value="Overview">Overview</option>
                    {seasons.length > 0 ? (
                        seasons.map(season => (
                            <option key={season} value={season}>
                                {season}
                            </option>
                        ))
                    ) : (
                        <option value="">No Seasons Available</option>
                    )}
                </select>
            </div>

            {/* All-Time Draft Overview - Show when Overview is selected */}
            {selectedSeason === "Overview" && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-3xl font-semibold mb-6 text-center text-yellow-400">All-Time Draft Overview</h2>
                    
                    {overviewLoading ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400">Computing all-time draft data with real VORP values...</p>
                        </div>
                    ) : overviewData ? (
                        <div className="space-y-8">
                            {/* Top Picks and Worst Picks Side by Side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Top Picks All-Time */}
                                <div className="bg-gray-700 rounded-lg p-6 shadow-md">
                                    <h3 className="text-2xl font-bold text-blue-300 mb-4">Top Picks All-Time</h3>
                                    <p className="text-gray-300 mb-4">Top draft picks by value all-time.</p>
                                    <div className="space-y-4">
                                        {overviewData.topPicks.map((pick, idx) => (
                                            <div key={idx} className="bg-gray-600 p-4 rounded-lg border-l-4 border-green-400">
                                                <div className="flex flex-col space-y-2">
                                                    <div className="text-lg font-semibold text-white">
                                                        Pick {pick.pick_no} - {pick.player_name} · {pick.position} {pick.team_abbrev ? `(${pick.team_abbrev})` : ''}
                                                    </div>
                                                    <div className="text-sm text-gray-300">
                                                        {pick.season} · Round {pick.round}, Pick {pick.pick_in_round}
                                                    </div>
                                                    <div className="text-2xl font-bold text-green-400">
                                                        {pick.scaled_vorp_delta.toFixed(2)}
                                                    </div>
                                                    <div className="text-base font-medium text-blue-300">
                                                        {pick.team}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Worst Picks All-Time */}
                                <div className="bg-gray-700 rounded-lg p-6 shadow-md">
                                    <h3 className="text-2xl font-bold text-red-300 mb-4">Worst Picks All-Time</h3>
                                    <p className="text-gray-300 mb-4">Worst draft picks by value all-time.</p>
                                    <div className="space-y-4">
                                        {overviewData.worstPicks.map((pick, idx) => (
                                            <div key={idx} className="bg-gray-600 p-4 rounded-lg border-l-4 border-red-400">
                                                <div className="flex flex-col space-y-2">
                                                    <div className="text-lg font-semibold text-white">
                                                        Pick {pick.pick_no} - {pick.player_name} · {pick.position} {pick.team_abbrev ? `(${pick.team_abbrev})` : ''}
                                                    </div>
                                                    <div className="text-sm text-gray-300">
                                                        {pick.season} · Round {pick.round}, Pick {pick.pick_in_round}
                                                    </div>
                                                    <div className="text-2xl font-bold text-red-400">
                                                        {pick.scaled_vorp_delta.toFixed(2)}
                                                    </div>
                                                    <div className="text-base font-medium text-blue-300">
                                                        {pick.team}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* All-Time Draft Rankings and Best/Worst Drafts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* All-Time Draft Rankings */}
                                <div className="bg-gray-700 rounded-lg p-6 shadow-md">
                                    <h3 className="text-2xl font-bold text-purple-300 mb-4">All-Time Draft Rankings</h3>
                                    <p className="text-gray-300 mb-4">Members ranked by all-time avg. draft pick value.</p>
                                    <div className="space-y-2">
                                        {overviewData.teamRankings.map((team, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-gray-600 p-3 rounded">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-gray-400 font-medium">#{idx + 1}</span>
                                                    <span className="text-white font-medium">{team.team}</span>
                                                </div>
                                                <span className={`font-bold ${team.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {team.value.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Best/Worst All-Time Drafts */}
                                <div className="bg-gray-700 rounded-lg p-6 shadow-md">
                                    <h3 className="text-2xl font-bold text-green-300 mb-4">Best & Worst All-Time Drafts</h3>
                                    
                                    <div className="mb-6">
                                        <h4 className="text-lg font-semibold text-blue-300 mb-3">Best All-Time Drafts</h4>
                                        <div className="space-y-2">
                                            {overviewData.draftsSummaries.slice(0, 3).map((draft, i) => (
                                                <div key={i} className="bg-gray-600 p-3 rounded border-l-2 border-green-400">
                                                    <div className="text-white font-medium">{draft.team}</div>
                                                    <div className="text-sm text-gray-300">{draft.season}</div>
                                                    <div className="text-lg font-bold text-green-400">{draft.totalScaledVorp.toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-lg font-semibold text-red-300 mb-3">Worst All-Time Drafts</h4>
                                        <div className="space-y-2">
                                            {overviewData.draftsSummaries.slice(-3).reverse().map((draft, i) => (
                                                <div key={i} className="bg-gray-600 p-3 rounded border-l-2 border-red-400">
                                                    <div className="text-white font-medium">{draft.team}</div>
                                                    <div className="text-sm text-gray-300">{draft.season}</div>
                                                    <div className="text-lg font-bold text-red-400">{draft.totalScaledVorp.toFixed(2)}</div>
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

            {selectedSeason !== "Overview" && selectedSeason && draftSummary ? (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-3xl font-semibold mb-4 text-center text-green-400">{selectedSeason} Draft Summary</h2>

                    {/* Tab Navigation - Removed Overview tab */}
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

                    {/* Conditional Rendering of Tabs */}
                    {activeTab === 'board' && (
                        <div className="mt-6">
                            <h3 className="text-2xl font-semibold mb-4 text-center text-purple-400">Draft Board</h3>
                            {orderedTeamColumns.length > 0 && totalRounds > 0 ? (
                                <div className="w-full overflow-auto -mx-2 px-2">
                                    <div
                                        className="grid gap-1 p-2 rounded-lg bg-gray-700"
                                        style={{
                                            gridTemplateColumns: `auto repeat(${orderedTeamColumns.length}, minmax(100px, 1fr))`,
                                            minWidth: `${Math.max(100 * (orderedTeamColumns.length + 1), 480)}px`
                                        }}
                                    >
                                        {/* Header Row: Round and Team Names */}
                                        <div className="bg-gray-600 text-gray-200 font-bold py-1 px-1 text-center rounded-tl-md text-xs">Round</div>
                                        {orderedTeamColumns.map(team => (
                                            <div key={team.userId} className="bg-gray-600 text-gray-200 font-bold py-1 px-1 text-center flex flex-col items-center justify-center rounded-t-md min-h-[40px]">
                                                <span className="text-xs leading-tight break-words text-center max-w-full block" style={{ wordBreak: 'break-word', hyphens: 'auto' }}>
                                                    {team.teamName}
                                                </span>
                                            </div>
                                        ))}

                                        {/* Draft Picks Rows */}
                                        {roundsArray.map(round => (
                                            <React.Fragment key={round}>
                                                <div className="bg-gray-600 text-gray-200 font-bold py-2 px-1 text-center flex items-center justify-center rounded-bl-md text-xs">
                                                    {round}
                                                </div>

                                                {orderedTeamColumns.map((_, colIndex) => {
                                                    const pick = picksGroupedByRound[round]?.[colIndex];
                                                    const totalTeamsInDraft = draftSummary.settings?.teams || 12;

                                                    // Determine the original slot number for this column in this round
                                                    const originalSlotNumber = round % 2 !== 0 ? (colIndex + 1) : (totalTeamsInDraft - colIndex);

                                                    // Find the original owner's userId based on the original slot number from draft_order
                                                    let originalOwnerUserId = null;
                                                    for (const userId in draftSummary.draft_order) {
                                                        if (draftSummary.draft_order[userId] === originalSlotNumber) {
                                                            originalOwnerUserId = userId;
                                                            break;
                                                        }
                                                    }

                                                    // Mark as traded if picked_by !== original owner and there is a traded pick for this round/slot in tradedPicksLookup
                                                    let tradedPickInfo = null;
                                                    if (originalOwnerUserId && pick && pick.picked_by !== originalOwnerUserId) {
                                                        // Find the original owner's roster_id for this season
                                                        const originalOwnerRoster = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.owner_id) === String(originalOwnerUserId));
                                                        const originalOwnerRosterId = originalOwnerRoster ? String(originalOwnerRoster.roster_id) : null;
                                                        if (originalOwnerRosterId) {
                                                            tradedPickInfo = tradedPicksLookup.get(round)?.get(originalOwnerRosterId);
                                                        }
                                                    }
                                                    const isTradedPickForPlayer = pick && originalOwnerUserId && pick.picked_by !== originalOwnerUserId && !!tradedPickInfo;

                                                    // Determine first and last name for display
                                                    let displayFirstName = '';
                                                    let displayLastName = '';

                                                    if (pick && pick.player_position === 'DEF') {
                                                        displayFirstName = pick.metadata?.first_name || '';
                                                        displayLastName = pick.metadata?.last_name || '';
                                                    } else if (pick) {
                                                        const nameParts = pick.player_name.split(' ');
                                                        displayFirstName = nameParts[0];
                                                        displayLastName = nameParts.slice(1).join(' ');
                                                    }

                                                    // Determine font size for last name based on length
                                                    const lastNameFontSizeClass = displayLastName.length > 12 ? 'text-base' : 'text-lg';


                                                    return (
                                                        <div
                                                            key={`${round}-${colIndex}`}
                                                            className={`relative p-1 border border-gray-700 text-xs min-h-[60px] sm:min-h-[70px]
                                                                        ${pick ? getPositionColorClass(pick.player_position) : 'bg-gray-900'}`}
                                                        >
                                                            {pick ? (
                                                                pick.is_keeper ? (
                                                                    <div className="flex items-center justify-center h-full text-sm font-bold text-green-300">
                                                                        KEEPER
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {/* Position - Top Left */}
                                                                        <div className="absolute top-0.5 left-0.5 text-xs text-gray-200 text-left">
                                                                            {pick.player_position}
                                                                        </div>
                                                                        {/* Team - Top Right */}
                                                                        <div className="absolute top-0.5 right-0.5 text-xs text-gray-200 text-right">
                                                                            {pick.player_team}
                                                                        </div>

                                                                        {/* Player First Name - Centered */}
                                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-medium text-white text-center w-full mt-[-6px] text-xs leading-tight">
                                                                            {displayFirstName}
                                                                        </div>
                                                                        {/* Player Last Name - Centered, larger font */}
                                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-white text-center w-full mt-[6px] leading-tight">
                                                                            {displayLastName}
                                                                        </div>

                                                                        {/* VORP Delta Bubble - Bottom Left */}
                                                                        {typeof pick.scaled_vorp_delta === 'number' && (
                                                                            <div
                                                                                className={`absolute bottom-0.5 left-0.5 inline-flex items-center justify-center text-xs font-bold text-white px-1 py-0.5 rounded
                                                                                            ${pick.scaled_vorp_delta >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                                                                title={`VORP Delta: ${pick.scaled_vorp_delta.toFixed(2)}`}
                                                                            >
                                                                                {pick.scaled_vorp_delta.toFixed(1)}
                                                                            </div>
                                                                        )}

                                                                        {/* Traded Icon for player picks (remains bottom right) */}
                                                                        {isTradedPickForPlayer && (
                                                                            <div
                                                                                className="absolute bottom-0.5 right-0.5 cursor-help"
                                                                                title={`Pick acquired by: ${pick.picked_by_team_name}`}
                                                                            >
                                                                                <FontAwesomeIcon icon={faRepeat} className="w-3 h-3 text-yellow-400" />
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )
                                                            ) : tradedPickInfo ? (
                                                                // Only show the icon and tooltip for empty traded picks
                                                                <div
                                                                    className="absolute bottom-0.5 right-0.5 cursor-help"
                                                                    title={`Pick acquired by: ${getTeamName(getUserIdFromRosterId(tradedPickInfo.owner_id, selectedSeason, historicalData.rostersBySeason), selectedSeason)}`}
                                                                >
                                                                    {/* Two-way arrow SVG icon */}
                                                                    <FontAwesomeIcon icon={faRepeat} className="w-3 h-3 text-yellow-400" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-600 text-xs">Empty</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-gray-400">No draft board data available for this season.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'summary' && (
                        <div className="mt-6">
                            <h3 className="text-2xl font-semibold mb-4 text-center text-green-400">Draft Year Summary</h3>
                            {draftYearSummary ? (
                                <div className="space-y-8">
                                    {/* Best/Worst Team by VORP */}
                                    <div className="flex flex-col md:flex-row md:space-x-8 justify-center items-center">
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md mb-4 md:mb-0 w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-blue-300 mb-2">Best Team by Total Scaled Δ</h4>
                                            <p className="text-lg">{draftYearSummary.bestTeam.team} <span className="text-green-400 font-semibold">({draftYearSummary.bestTeam.totalScaledVorp.toFixed(2)})</span></p>
                                        </div>
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-red-300 mb-2">Worst Team by Total Scaled Δ</h4>
                                            <p className="text-lg">{draftYearSummary.worstTeam.team} <span className="text-red-400 font-semibold">({draftYearSummary.worstTeam.totalScaledVorp.toFixed(2)})</span></p>
                                        </div>
                                    </div>

                                    {/* Best/Worst Pick by VORP Delta */}
                                    <div className="flex flex-col md:flex-row md:space-x-8 justify-center items-center">
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md mb-4 md:mb-0 w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-blue-300 mb-2">Best Pick (VORP Delta)</h4>
                                            <p className="text-lg">
                                                {draftYearSummary.bestPick.player_name} ({draftYearSummary.bestPick.player_position})
                                                <span className="ml-2 text-green-400 font-semibold">{(typeof draftYearSummary.bestPick.scaled_vorp_delta === 'number' ? draftYearSummary.bestPick.scaled_vorp_delta : draftYearSummary.bestPick.vorp_delta).toFixed(2)}</span>
                                                <br />
                                                <span className="text-sm text-gray-300">Team: {draftYearSummary.bestPick.picked_by_team_name} | Pick: {draftYearSummary.bestPick.pick_no}</span>
                                            </p>
                                        </div>
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-red-300 mb-2">Worst Pick (VORP Delta)</h4>
                                            <p className="text-lg">
                                                {draftYearSummary.worstPick.player_name} ({draftYearSummary.worstPick.player_position})
                                                <span className="ml-2 text-red-400 font-semibold">{(typeof draftYearSummary.worstPick.scaled_vorp_delta === 'number' ? draftYearSummary.worstPick.scaled_vorp_delta : draftYearSummary.worstPick.vorp_delta).toFixed(2)}</span>
                                                <br />
                                                <span className="text-sm text-gray-300">Team: {draftYearSummary.worstPick.picked_by_team_name} | Pick: {draftYearSummary.worstPick.pick_no}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Round-by-Round Summaries */}
                                    <div className="bg-gray-700 rounded-lg p-4 shadow-md">
                                        <h4 className="text-xl font-bold text-purple-300 mb-4">Round-by-Round Summary</h4>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm text-gray-200">
                                                <thead>
                                                    <tr className="bg-gray-800">
                                                        <th className="py-2 px-4">Round</th>
                                                        <th className="py-2 px-4">Best Pick (VORP Δ)</th>
                                                        <th className="py-2 px-4">Worst Pick (VORP Δ)</th>
                                                        <th className="py-2 px-4">Avg Scaled Δ</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {draftYearSummary.roundSummaries.map((round, idx) => round && (
                                                        <React.Fragment key={idx}>
                                                            <tr className="border-b border-gray-600">
                                                                <td className="py-2 px-4 text-center font-bold">{round.round}</td>
                                                                <td className="py-2 px-4">
                                                                    {round.best.player_name} ({round.best.player_position})
                                                                    <span className="ml-2 text-green-400 font-semibold">{(typeof round.best.scaled_vorp_delta === 'number' ? round.best.scaled_vorp_delta : round.best.vorp_delta).toFixed(2)}</span>
                                                                    <br />
                                                                    <span className="text-xs text-gray-400">Team: {round.best.picked_by_team_name} | Pick: {round.best.pick_no}</span>
                                                                </td>
                                                                <td className="py-2 px-4">
                                                                    {round.worst.player_name} ({round.worst.player_position})
                                                                    <span className="ml-2 text-red-400 font-semibold">{(typeof round.worst.scaled_vorp_delta === 'number' ? round.worst.scaled_vorp_delta : round.worst.vorp_delta).toFixed(2)}</span>
                                                                    <br />
                                                                    <span className="text-xs text-gray-400">Team: {round.worst.picked_by_team_name} | Pick: {round.worst.pick_no}</span>
                                                                </td>
                                                                <td className="py-2 px-4 text-center">{typeof round.avgScaledVorp === 'number' ? round.avgScaledVorp : '—'}</td>
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

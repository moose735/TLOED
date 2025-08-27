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

    // State for managing active tab - 'board' and new 'summary' tab
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

            // Group by team (sum actual VORP, not delta)
            const teamVorpTotals = {};
            picks.forEach(pick => {
                const team = pick.picked_by_team_name || 'Unknown';
                if (!teamVorpTotals[team]) teamVorpTotals[team] = 0;
                teamVorpTotals[team] += pick.player_actual_vorp ?? 0;
            });

            // Best/worst team by total VORP
            const teamVorpArr = Object.entries(teamVorpTotals).map(([team, totalVorp]) => ({ team, totalVorp }));
            const bestTeam = teamVorpArr.reduce((a, b) => (a.totalVorp > b.totalVorp ? a : b), { team: '', totalVorp: -Infinity });
            const worstTeam = teamVorpArr.reduce((a, b) => (a.totalVorp < b.totalVorp ? a : b), { team: '', totalVorp: Infinity });

            // Best/worst pick by VORP delta (use pick.vorp_delta from board)
            const bestPick = picks.reduce((a, b) => (a.vorp_delta > b.vorp_delta ? a : b), picks[0]);
            const worstPick = picks.reduce((a, b) => (a.vorp_delta < b.vorp_delta ? a : b), picks[0]);

            // Round-by-round summaries (use pick.vorp_delta and draft_pick_assigned_vorp)
            const rounds = draftSummary?.settings?.rounds || 0;
            const picksByRound = Array.from({ length: rounds }, (_, i) => i + 1).map(roundNum =>
                picks.filter(pick => pick.round === roundNum)
            );
            const roundSummaries = picksByRound.map((roundPicks, idx) => {
                if (!roundPicks.length) return null;
                const best = roundPicks.reduce((a, b) => (a.vorp_delta > b.vorp_delta ? a : b), roundPicks[0]);
                const worst = roundPicks.reduce((a, b) => (a.vorp_delta < b.vorp_delta ? a : b), roundPicks[0]);
                const avgVorp = roundPicks.reduce((sum, p) => sum + (p.player_actual_vorp ?? 0), 0) / roundPicks.length;
                return {
                    round: idx + 1,
                    best,
                    worst,
                    avgVorp: Number(avgVorp.toFixed(2)),
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
                setSelectedSeason(allYears[0]); // Set latest season as default
            }
        }
    }, [loading, error, historicalData, selectedSeason]);

    // Effect to fetch league scoring and roster settings when selectedSeason changes
    useEffect(() => {
        const fetchLeagueSettings = async () => {
            if (selectedSeason && historicalData && historicalData.draftsBySeason) {
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
            if (!selectedSeason || !historicalData || !historicalData.draftsBySeason || !historicalData.draftPicksBySeason || !usersData || !leagueScoringSettings || !leagueRosterSettings) {
                console.log('Missing data dependencies for draft processing (selectedSeason, historicalData.draftsBySeason, historicalData.draftPicksBySeason, usersData, leagueScoringSettings, or leagueRosterSettings are not fully loaded or available).');
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
        setSelectedSeason(Number(event.target.value));
        setActiveTab('board'); // Reset to board tab when season changes
    };

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

            <div className="mb-6 flex justify-center items-center space-x-4">
                <label htmlFor="season-select" className="text-lg">Select Season:</label>
                <select
                    id="season-select"
                    className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedSeason || ''}
                    onChange={handleSeasonChange}
                    disabled={seasons.length === 0}
                >
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

            {selectedSeason && draftSummary ? (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-3xl font-semibold mb-4 text-center text-green-400">{selectedSeason} Draft Summary</h2>

                    {/* Tab Navigation */}
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
                                <div className="overflow-x-auto">
                                    <div
                                        className="grid gap-1 p-2 rounded-lg bg-gray-700"
                                        style={{
                                            gridTemplateColumns: `auto repeat(${orderedTeamColumns.length}, minmax(120px, 1fr))`
                                        }}
                                    >
                                        {/* Header Row: Round and Team Names */}
                                        <div className="bg-gray-600 text-gray-200 font-bold py-2 px-2 text-center rounded-tl-md">Round</div>
                                        {orderedTeamColumns.map(team => (
                                            <div key={team.userId} className="bg-gray-600 text-gray-200 font-bold py-2 px-2 text-center flex flex-col items-center justify-center rounded-t-md">
                                                <span className="text-xs overflow-hidden whitespace-nowrap text-ellipsis max-w-full block">{team.teamName}</span>
                                            </div>
                                        ))}

                                        {/* Draft Picks Rows */}
                                        {roundsArray.map(round => (
                                            <React.Fragment key={round}>
                                                <div className="bg-gray-600 text-gray-200 font-bold py-2 px-2 text-center flex items-center justify-center rounded-bl-md">
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
                                                            className={`relative p-2 border border-gray-700 text-sm min-h-[120px]
                                                                        ${pick ? getPositionColorClass(pick.player_position) : 'bg-gray-900'}`}
                                                        >
                                                            {pick ? (
                                                                pick.is_keeper ? (
                                                                    <div className="flex items-center justify-center h-full text-lg font-bold text-green-300">
                                                                        KEEPER
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {/* Position - Top Left */}
                                                                        <div className="absolute top-1 left-1 text-xs text-gray-200 text-left">
                                                                            {pick.player_position}
                                                                        </div>
                                                                        {/* Team - Top Right */}
                                                                        <div className="absolute top-1 right-1 text-xs text-gray-200 text-right">
                                                                            {pick.player_team}
                                                                        </div>

                                                                        {/* Player First Name - Centered */}
                                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-medium text-white text-center w-full mt-[-10px]">
                                                                            {displayFirstName}
                                                                        </div>
                                                                        {/* Player Last Name - Centered, larger font */}
                                                                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${lastNameFontSizeClass} font-bold text-white text-center w-full mt-[10px]`}>
                                                                            {displayLastName}
                                                                        </div>

                                                                        {/* VORP Delta Bubble - Bottom Left */}
                                                                        {typeof pick.scaled_vorp_delta === 'number' && (
                                                                            <div
                                                                                className={`absolute bottom-1 left-1 inline-flex items-center justify-center text-xs font-bold text-white px-2 py-1 rounded-md
                                                                                            ${pick.scaled_vorp_delta >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                                                                title={`VORP Delta: ${pick.scaled_vorp_delta.toFixed(2)}`}
                                                                            >
                                                                                {pick.scaled_vorp_delta.toFixed(2)}
                                                                            </div>
                                                                        )}

                                                                        {/* Traded Icon for player picks (remains bottom right) */}
                                                                        {isTradedPickForPlayer && (
                                                                            <div
                                                                                className="absolute bottom-1 right-1 cursor-help"
                                                                                title={`Pick acquired by: ${pick.picked_by_team_name}`}
                                                                            >
                                                                                <FontAwesomeIcon icon={faRepeat} className="w-4 h-4 text-yellow-400" />
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )
                                                            ) : tradedPickInfo ? (
                                                                // Only show the icon and tooltip for empty traded picks
                                                                <div
                                                                    className="absolute bottom-1 right-1 cursor-help"
                                                                    title={`Pick acquired by: ${getTeamName(getUserIdFromRosterId(tradedPickInfo.owner_id, selectedSeason, historicalData.rostersBySeason), selectedSeason)}`}
                                                                >
                                                                    {/* Two-way arrow SVG icon */}
                                                                    <FontAwesomeIcon icon={faRepeat} className="w-4 h-4 text-yellow-400" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-600 text-xs">Empty Pick</span>
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
                                            <h4 className="text-xl font-bold text-blue-300 mb-2">Best Team by Total VORP</h4>
                                            <p className="text-lg">{draftYearSummary.bestTeam.team} <span className="text-green-400 font-semibold">({draftYearSummary.bestTeam.totalVorp.toFixed(2)})</span></p>
                                        </div>
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-red-300 mb-2">Worst Team by Total VORP</h4>
                                            <p className="text-lg">{draftYearSummary.worstTeam.team} <span className="text-red-400 font-semibold">({draftYearSummary.worstTeam.totalVorp.toFixed(2)})</span></p>
                                        </div>
                                    </div>

                                    {/* Best/Worst Pick by VORP Delta */}
                                    <div className="flex flex-col md:flex-row md:space-x-8 justify-center items-center">
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md mb-4 md:mb-0 w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-blue-300 mb-2">Best Pick (VORP Delta)</h4>
                                            <p className="text-lg">
                                                {draftYearSummary.bestPick.player_name} ({draftYearSummary.bestPick.player_position})
                                                <span className="ml-2 text-green-400 font-semibold">{draftYearSummary.bestPick.vorp_delta.toFixed(2)}</span>
                                                <br />
                                                <span className="text-sm text-gray-300">Team: {draftYearSummary.bestPick.picked_by_team_name} | Pick: {draftYearSummary.bestPick.pick_no}</span>
                                            </p>
                                        </div>
                                        <div className="bg-gray-700 rounded-lg p-4 shadow-md w-full md:w-1/2">
                                            <h4 className="text-xl font-bold text-red-300 mb-2">Worst Pick (VORP Delta)</h4>
                                            <p className="text-lg">
                                                {draftYearSummary.worstPick.player_name} ({draftYearSummary.worstPick.player_position})
                                                <span className="ml-2 text-red-400 font-semibold">{draftYearSummary.worstPick.vorp_delta.toFixed(2)}</span>
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
                                                        <th className="py-2 px-4">Avg VORP</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {draftYearSummary.roundSummaries.map((round, idx) => round && (
                                                        <tr key={idx} className="border-b border-gray-600">
                                                            <td className="py-2 px-4 text-center font-bold">{round.round}</td>
                                                            <td className="py-2 px-4">
                                                                {round.best.player_name} ({round.best.player_position})
                                                                <span className="ml-2 text-green-400 font-semibold">{round.best.vorp_delta.toFixed(2)}</span>
                                                                <br />
                                                                <span className="text-xs text-gray-400">Team: {round.best.picked_by_team_name} | Pick: {round.best.pick_no}</span>
                                                            </td>
                                                            <td className="py-2 px-4">
                                                                {round.worst.player_name} ({round.worst.player_position})
                                                                <span className="ml-2 text-red-400 font-semibold">{round.worst.vorp_delta.toFixed(2)}</span>
                                                                <br />
                                                                <span className="text-xs text-gray-400">Team: {round.worst.picked_by_team_name} | Pick: {round.worst.pick_no}</span>
                                                            </td>
                                                            <td className="py-2 px-4 text-center">{round.avgVorp}</td>
                                                        </tr>
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
            ) : (
                <p className="text-center text-gray-400">Select a season to view draft analysis.</p>
            )}
        </div>
    );
};

export default DraftAnalysis;

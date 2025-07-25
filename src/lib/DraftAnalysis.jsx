// src/lib/DraftAnalysis.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getSleeperAvatarUrl, getSleeperPlayerHeadshotUrl, fetchTradedPicks } from '../utils/sleeperApi'; // Import fetchTradedPicks
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

    // State for managing active tab - Only 'board' remains
    const [activeTab, setActiveTab] = useState('board');


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

            if (!seasonDrafts || !seasonPicks || seasonPicks.length === 0) {
                console.log(`No draft data found for season ${selectedSeason}. Clearing draft summary and picks.`);
                setDraftSummary(null);
                setDraftPicks([]);
                setOrderedTeamColumns([]);
                setPicksGroupedByRound({});
                setTradedPicksData([]);
                return;
            }

            // Fetch traded picks for the current draft
            let currentTradedPicks = [];
            if (seasonDrafts.draft_id) {
                try {
                    currentTradedPicks = await fetchTradedPicks(seasonDrafts.draft_id);
                    console.log(`Fetched ${currentTradedPicks.length} traded picks for draft ID: ${seasonDrafts.draft_id}`);
                } catch (e) {
                    console.error(`Error fetching traded picks for draft ${seasonDrafts.draft_id}:`, e);
                }
            }
            setTradedPicksData(currentTradedPicks); // Store traded picks

            // Set draft summary
            setDraftSummary(seasonDrafts);

            // 1. Determine Ordered Team Columns
            const draftOrder = seasonDrafts.draft_order; // userId: slot_number
            const totalTeams = seasonDrafts.settings?.teams || 12; // Default to 12 if not found

            const teamsInOrder = Object.entries(draftOrder)
                .map(([userId, slotNumber]) => {
                    const user = usersData.find(u => u.user_id === userId);
                    // Find the roster for this user in the *selected season*
                    const roster = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.owner_id) === String(userId));

                    return {
                        userId: userId,
                        slotNumber: slotNumber,
                        teamName: roster ? (roster.metadata?.team_name || getTeamName(userId, selectedSeason)) : getTeamName(userId, selectedSeason),
                        teamAvatar: user ? getSleeperAvatarUrl(user.avatar) : getSleeperAvatarUrl(null)
                    };
                })
                .sort((a, b) => a.slotNumber - b.slotNumber); // Sort by original draft slot number

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

            finalProcessedPicks.forEach(pick => {
                const round = pick.round;
                const totalTeams = seasonDrafts.settings?.teams || 12;

                let columnIndex;
                if (round % 2 !== 0) { // Odd rounds (1, 3, 5...) go left to right
                    columnIndex = pick.draft_slot - 1; // 0-indexed
                } else { // Even rounds (2, 4, 6...) go right to left
                    columnIndex = totalTeams - pick.draft_slot; // 0-indexed from right
                }

                if (!newPicksGroupedByRound[round]) {
                    newPicksGroupedByRound[round] = Array(totalTeams).fill(null);
                }
                newPicksGroupedByRound[round][columnIndex] = pick;
            });


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
                        {/* Removed: Yearly Stats Tab Button */}
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

                                                    // Try to find a traded pick for this slot
                                                    let tradedPickInfo = null;
                                                    if (originalOwnerUserId) {
                                                        const originalOwnerRosterForLookup = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === String(originalOwnerUserId));
                                                        const originalOwnerRosterIdForLookup = originalOwnerRosterForLookup ? String(originalOwnerRosterForLookup.roster_id) : null;

                                                        const originalRosterIdForTradedLookup = historicalData.rostersBySeason?.[selectedSeason]?.find(r => r.owner_id === originalOwnerUserId)?.roster_id;

                                                        if (originalRosterIdForTradedLookup) {
                                                            tradedPickInfo = tradedPicksLookup.get(round)?.get(String(originalRosterIdForTradedLookup));
                                                        }
                                                    }

                                                    // Check if the pick was made by someone other than the original slot owner
                                                    const isTradedPickForPlayer = pick && originalOwnerUserId && pick.picked_by !== originalOwnerUserId;

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

                    {/* Removed: Yearly Stats Tab Content */}

                </div>
            ) : (
                <p className="text-center text-gray-400">Select a season to view draft analysis.</p>
            )}
        </div>
    );
};

export default DraftAnalysis;

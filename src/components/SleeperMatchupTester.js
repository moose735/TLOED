// src/components/SleeperMatchupTester.js
import React, { useEffect, useState, useCallback } from 'react';
// Removed direct API imports as data will come from context
// import { fetchAllHistoricalMatchups } from '../utils/sleeperApi';
import { calculatePlayoffFinishes } from '../utils/playoffRankings'; // Import the playoff calculation function
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook

const SleeperMatchupTester = () => {
    // Consume data and functions from SleeperDataContext
    const {
        loading,
        error,
        historicalData, // Contains matchupsBySeason, winnersBracketBySeason, losersBracketBySeason, rostersBySeason, leaguesMetadataBySeason
        getTeamName,    // Utility function to get team display name from owner_id or roster_id, now accepts season
        usersData,      // Raw user data for mapping (though getTeamName now handles this internally)
    } = useSleeperData();

    const [selectedYear, setSelectedYear] = useState(''); // State for the selected year
    const [playoffResults, setPlayoffResults] = useState(null); // State for playoff calculation results

    // Effect to set initial selected year to the latest available once historicalData is loaded
    useEffect(() => {
        if (!loading && !error && historicalData && Object.keys(historicalData.leaguesMetadataBySeason).length > 0) {
            const latestYear = Math.max(...Object.keys(historicalData.leaguesMetadataBySeason).map(Number)).toString();
            setSelectedYear(latestYear);
        }
    }, [loading, error, historicalData]); // Re-run when historicalData or its loading/error state changes

    // Effect to recalculate playoff finishes when selectedYear or historicalData changes
    useEffect(() => {
        if (!loading && !error && historicalData && selectedYear) {
            const winnersBracket = historicalData.winnersBracketBySeason?.[selectedYear];
            const losersBracket = historicalData.losersBracketBySeason?.[selectedYear];
            const rostersForYear = historicalData.rostersBySeason?.[selectedYear];

            if (winnersBracket && losersBracket && rostersForYear) {
                // Create a map for easy roster lookup by ID, needed by calculatePlayoffFinishes
                const rostersById = new Map(rostersForYear.map(roster => [roster.roster_id, roster]));

                const finishes = calculatePlayoffFinishes({
                    winnersBracket,
                    losersBracket
                }, rostersById);

                setPlayoffResults(finishes);
                console.log(`${selectedYear} Playoff Finishes:`, finishes);
            } else {
                setPlayoffResults(null); // Clear results if data is missing for the selected year
                if (selectedYear) { // Only warn if a year is actually selected
                    console.warn(`Missing bracket or roster data for ${selectedYear}. Cannot calculate playoff finishes.`);
                }
            }
        } else if (!loading && !selectedYear) {
            setPlayoffResults(null); // No year selected, no results
        }
    }, [historicalData, loading, error, selectedYear]); // Recalculate when these change

    // Helper to get team info from roster ID (or bracket object if needed for t1_from/t2_from)
    // This now uses getTeamName from context, passing the selectedYear
    const getTeamInfo = useCallback((teamIdentifier) => {
        // The getTeamName from context can handle both roster_id and user_id.
        // For bracket objects, we extract the roster_id.
        if (typeof teamIdentifier === 'number' || typeof teamIdentifier === 'string') {
            return getTeamName(teamIdentifier, selectedYear);
        }
        // Handle bracket objects with 'from' references
        else if (teamIdentifier && (teamIdentifier.w || teamIdentifier.l || teamIdentifier.t1 || teamIdentifier.t2)) {
            const rosterId = teamIdentifier.w || teamIdentifier.l || teamIdentifier.t1 || teamIdentifier.t2;
            const fromType = teamIdentifier.w ? 'Winner of Match' : teamIdentifier.l ? 'Loser of Match' : 'From Match';
            // Use getTeamName with the extracted rosterId and selectedYear
            return `${getTeamName(rosterId, selectedYear)} - ${fromType} ${teamIdentifier.m}`;
        }
        return 'TBD';
    }, [getTeamName, selectedYear]); // getTeamName and selectedYear are dependencies

    // Display loading and error states from the SleeperDataContext
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
                <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-lg font-medium">Loading historical league data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-600 text-lg p-4">
                <p>Error: {error.message || error}</p>
                <p>Failed to load historical data. Please check your Sleeper API configuration.</p>
            </div>
        );
    }

    if (!historicalData || Object.keys(historicalData.leaguesMetadataBySeason).length === 0) {
        return (
            <div className="text-center text-orange-600 text-lg p-4">
                No historical league data found. Check your `CURRENT_LEAGUE_ID` or ensure data is available.
            </div>
        );
    }

    // --- Data Processing for Display ---
    const totalSeasonsFound = Object.keys(historicalData.leaguesMetadataBySeason).length;
    let totalMatchupsOverall = 0; // Count all matchups, regular season and playoff
    const uniqueRosterIds = new Set();
    const uniqueUserIds = new Set();

    // Iterate through all seasons to get overall totals
    Object.entries(historicalData.matchupsBySeason).forEach(([, weeks]) => {
        Object.entries(weeks).forEach(([, matchups]) => {
            totalMatchupsOverall += matchups.length;
        });
    });

    Object.entries(historicalData.rostersBySeason).forEach(([, rosters]) => {
        rosters.forEach(roster => {
            uniqueRosterIds.add(roster.roster_id);
            if (roster.owner_id) {
                uniqueUserIds.add(roster.owner_id);
            }
        });
    });

    // Get available seasons for the dropdown, sorted in descending order
    const availableSeasons = Object.keys(historicalData.leaguesMetadataBySeason).sort((a, b) => parseInt(b) - parseInt(a));

    const currentSeasonMetadata = historicalData.leaguesMetadataBySeason[selectedYear];
    const currentSeasonRosters = historicalData.rostersBySeason[selectedYear] || [];
    const currentSeasonMatchups = historicalData.matchupsBySeason[selectedYear] || {};
    const currentSeasonWinnersBracket = historicalData.winnersBracketBySeason[selectedYear] || [];
    const currentSeasonLosersBracket = historicalData.losersBracketBySeason[selectedYear] || [];


    // Create a map for quick lookup: roster_id -> { displayName, teamName } for the selected year
    // This is now less critical as getTeamName handles user display, but useful for roster details
    // Removed the direct use of usersData here as getTeamName handles it.
    const rosterToUserMap = new Map();
    currentSeasonRosters.forEach(roster => {
        // We still need owner_id for the getTeamName function if it's a roster_id
        rosterToUserMap.set(roster.roster_id, {
            userId: roster.owner_id
        });
    });


    return (
        <div className="container mx-auto p-4 md:p-6 bg-white shadow-lg rounded-lg font-inter">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center border-b pb-4">
                Sleeper League Historical Data Verification & Playoff Finishes
            </h1>

            {/* Overall Summary */}
            <div className="mb-6 border border-gray-200 p-4 rounded-lg bg-gray-50 shadow-sm">
                <h2 className="text-2xl font-semibold text-blue-700 mb-3 border-b pb-2">Verification Summary:</h2>
                <p className="text-gray-700 mb-1"><strong>Total Seasons Found:</strong> {totalSeasonsFound}</p>
                <p className="text-gray-700 mb-1"><strong>Total Matchups Found (across all active seasons, including playoffs):</strong> {totalMatchupsOverall}</p>
                <p className="text-gray-700 mb-1"><strong>Unique Roster IDs (participating teams across all seasons):</strong> {uniqueRosterIds.size}</p>
                <p className="text-gray-700 mb-4"><strong>Unique User IDs (owners across all seasons):</strong> {uniqueUserIds.size}</p>

                <p className={`font-bold text-sm ${uniqueRosterIds.size > 0 && uniqueRosterIds.size === currentSeasonRosters.length ? 'text-green-600' : 'text-red-600'}`}>
                    Recommendation: Compare these numbers (especially unique teams and matchups per season/week) with your league's actual history on Sleeper.
                    If Unique Roster IDs or Unique User IDs don't match your expected league size, check `config.js` `CURRENT_LEAGUE_ID` and your `sleeperApi.js` `fetchAllHistoricalMatchups` logic.
                </p>
            </div>

            {/* Season Selector */}
            <div className="mb-6">
                <label htmlFor="season-select" className="block mb-2 font-bold text-gray-700">Select Season for Detail:</label>
                <select
                    id="season-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="p-2 border border-gray-300 rounded-md w-full max-w-xs focus:ring-blue-500 focus:border-blue-500"
                >
                    {availableSeasons.length > 0 ? (
                        availableSeasons.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))
                    ) : (
                        <option value="">No seasons available</option>
                    )}
                </select>
            </div>

            {selectedYear && currentSeasonMetadata ? (
                <div className="mb-8 border border-gray-200 p-6 rounded-lg bg-white shadow-md">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">Season: {selectedYear} ({currentSeasonMetadata.name})</h2>
                    <p className="text-gray-700 mb-1"><strong>League ID:</strong> {currentSeasonMetadata.league_id}</p>
                    <p className="text-gray-700 mb-1"><strong>Season Start:</strong> {currentSeasonMetadata.season_start_date || 'N/A'}</p>
                    <p className="text-gray-700 mb-4"><strong>Total Teams:</strong> {currentSeasonRosters.length}</p>

                    {/* Display Rosters for this season */}
                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-800 mb-3">Teams (Rosters) in {selectedYear}:</h3>
                        {currentSeasonRosters.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1">
                                {currentSeasonRosters.map(roster => (
                                    <li key={roster.roster_id} className="text-gray-700">
                                        {/* Pass selectedYear to getTeamName for season-specific names */}
                                        <strong>Roster {roster.roster_id}:</strong> {getTeamName(roster.roster_id, selectedYear)} (User ID: {roster.owner_id})
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">No roster data available for this season.</p>
                        )}
                    </div>

                    {/* Display Playoff Finishes for this season */}
                    <div className="mt-8 pt-6 border-t border-gray-300">
                        <h3 className="text-xl font-semibold text-blue-700 mb-3">Playoff Finishes in {selectedYear}:</h3>
                        {playoffResults && playoffResults.length > 0 ? (
                            <ul className="list-decimal pl-5 space-y-1">
                                {playoffResults.map(team => (
                                    <li key={team.roster_id} className="text-gray-700">
                                        {/* Pass selectedYear to getTeamName for season-specific names */}
                                        <strong>{team.playoffFinish}</strong>: {getTeamName(team.roster_id, selectedYear)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">No playoff finish data available for this season. Ensure brackets are complete or check `playoffRankings.js` logic.</p>
                        )}
                    </div>

                    {/* Display Regular Season Matchups for this season */}
                    <div className="mt-8 pt-6 border-t border-gray-300">
                        <h3 className="text-xl font-semibold text-blue-700 mb-3">Regular Season Matchups in {selectedYear}:</h3>
                        {Object.keys(currentSeasonMatchups).length > 0 ? (
                            Object.entries(currentSeasonMatchups)
                                .filter(([weekNum]) => parseInt(weekNum) < (currentSeasonMetadata.settings?.playoff_start_week || 99)) // Filter for regular season
                                .sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB))
                                .map(([week, matchups]) => (
                                    <div key={`${selectedYear}-week-${week}-regular`} className="mb-6 p-4 border border-gray-100 rounded-md bg-white shadow-sm">
                                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Week {week} ({matchups.length} Matchups)</h4>
                                        {matchups.length > 0 ? (
                                            <ul className="list-disc pl-5 space-y-2">
                                                {matchups.map(matchup => {
                                                    const team1Display = getTeamName(matchup.team1_roster_id, selectedYear);
                                                    const team2Display = getTeamName(matchup.team2_roster_id, selectedYear);

                                                    const winnerName = (matchup.team1_score > matchup.team2_score)
                                                        ? team1Display
                                                        : (matchup.team2_score > matchup.team1_score)
                                                            ? team2Display
                                                            : "Tie";

                                                    return (
                                                        <li key={`reg-match-${matchup.matchup_id}`} className="text-sm text-gray-700">
                                                            <strong>Matchup ID: {matchup.matchup_id}</strong>
                                                            <br />
                                                            {team1Display} ({matchup.team1_score} points) vs. {team2Display} ({matchup.team2_score} points)
                                                            <br />
                                                            Winner: <strong>{winnerName}</strong>
                                                            <br />
                                                            (Roster IDs: {matchup.team1_roster_id}, {matchup.team2_roster_id})
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-gray-500">No regular season matchups found for Week {week}.</p>
                                        )}
                                    </div>
                                ))
                        ) : (
                            <p className="text-gray-500">No regular season matchup data available for this season (either future season or error fetching).</p>
                        )}
                    </div>

                    {/* Display Playoff Bracket Data for this season */}
                    <div className="mt-8 pt-6 border-t border-gray-300">
                        <h3 className="text-xl font-semibold text-blue-700 mb-3">Playoff Brackets in {selectedYear}:</h3>

                        {currentSeasonWinnersBracket.length === 0 && currentSeasonLosersBracket.length === 0 ? (
                            <p className="text-gray-500">No playoff bracket data available for this season.</p>
                        ) : (
                            <>
                                {currentSeasonWinnersBracket.length > 0 && (
                                    <div className="mb-6 p-4 border border-gray-100 rounded-md bg-white shadow-sm">
                                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Winners Bracket ({currentSeasonWinnersBracket.length} Matches)</h4>
                                        <ul className="list-disc pl-5 space-y-2">
                                            {currentSeasonWinnersBracket.sort((a, b) => a.r - b.r || a.m - b.m).map(match => (
                                                <li key={`wb-${match.m}`} className="text-sm text-gray-700">
                                                    <strong>Round {match.r}, Match {match.m}:</strong>
                                                    <br />
                                                    Team 1: {getTeamInfo(match.t1 || match.t1_from)} {typeof match.t1_score === 'number' ? `(${match.t1_score} points)` : ''}
                                                    <br />
                                                    Team 2: {getTeamInfo(match.t2 || match.t2_from)} {typeof match.t2_score === 'number' ? `(${match.t2_score} points)` : ''}
                                                    <br />
                                                    Winner: <strong>{match.w ? getTeamName(match.w, selectedYear) : 'TBD'}</strong>
                                                    <br />
                                                    Loser: {match.l ? getTeamName(match.l, selectedYear) : 'TBD'}
                                                    {match.p && ` (Playoff Rank: ${match.p})`}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {currentSeasonLosersBracket.length > 0 && (
                                    <div className="p-4 border border-gray-100 rounded-md bg-white shadow-sm">
                                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Losers Bracket ({currentSeasonLosersBracket.length} Matches)</h4>
                                        <ul className="list-disc pl-5 space-y-2">
                                            {currentSeasonLosersBracket.sort((a, b) => a.r - b.r || a.m - b.m).map(match => (
                                                <li key={`lb-${match.m}`} className="text-sm text-gray-700">
                                                    <strong>Round {match.r}, Match {match.m}:</strong>
                                                    <br />
                                                    Team 1: {getTeamInfo(match.t1 || match.t1_from)} {typeof match.t1_score === 'number' ? `(${match.t1_score} points)` : ''}
                                                    <br />
                                                    Team 2: {getTeamInfo(match.t2 || match.t2_from)} {typeof match.t2_score === 'number' ? `(${match.t2_score} points)` : ''}
                                                    <br />
                                                    Winner: {match.w ? getTeamName(match.w, selectedYear) : 'TBD'}
                                                    <br />
                                                    Loser: {match.l ? getTeamName(match.l, selectedYear) : 'TBD'}
                                                    {match.p && ` (Playoff Rank: ${match.p})`}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SleeperMatchupTester;

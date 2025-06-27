import React, { useState, useEffect } from 'react';
import { fetchUsersData, fetchRostersWithDetails } from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config';

/**
 * HistoricalMatchupsByYear component displays all historical matchups grouped by year and week.
 * It also resolves roster_id and owner_id to display actual team names.
 *
 * @param {Object} props The component props.
 * @param {Object} props.historicalMatchups An object where keys are season years (e.g., '2023')
 * and values are objects containing week numbers as keys
 * and arrays of matchup data as values.
 * Example: { '2023': { '1': [...], '2': [...] }, '2022': { ... } }
 * @param {Function} props.getDisplayTeamName A function to get the display name for a team.
 */
const HistoricalMatchupsByYear = ({ historicalMatchups, getDisplayTeamName }) => {
    const [allLeagueData, setAllLeagueData] = useState({}); // Stores users and rosters keyed by leagueId
    const [loadingDetails, setLoadingDetails] = useState(true);
    const [errorDetails, setErrorDetails] = useState(null);

    useEffect(() => {
        const loadLeagueDetails = async () => {
            setLoadingDetails(true);
            setErrorDetails(null);
            const loadedData = {};

            try {
                // Fetch league details to get previous league IDs
                const leagueDetails = await fetch(`https://api.sleeper.app/v1/league/${CURRENT_LEAGUE_ID}`);
                if (!leagueDetails.ok) {
                    throw new Error(`Failed to fetch current league details: ${leagueDetails.statusText}`);
                }
                let currentLeague = await leagueDetails.json();

                // Loop through current and previous leagues
                while (currentLeague && currentLeague.league_id !== '0') {
                    const leagueId = currentLeague.league_id;
                    // Check if data for this leagueId is already available in historicalMatchups
                    // If so, we can fetch its users and rosters
                    if (historicalMatchups[currentLeague.season]) {
                        console.log(`Loading users and rosters for league ${leagueId} (${currentLeague.season})...`);
                        const [users, rosters] = await Promise.all([
                            fetchUsersData(leagueId),
                            fetchRostersWithDetails(leagueId) // This already handles caching
                        ]);

                        if (users.length === 0 || rosters.length === 0) {
                            console.warn(`Could not load users or rosters for league ${leagueId}.`);
                            // Continue even if some data is missing for a season
                        }

                        // Create a map from owner_id to team name for easy lookup
                        const teamNameMap = new Map();
                        rosters.forEach(roster => {
                            const user = users.find(u => u.userId === roster.owner_id);
                            if (user) {
                                teamNameMap.set(roster.roster_id, user.teamName || user.displayName);
                            }
                        });

                        loadedData[currentLeague.season] = { users, rosters, teamNameMap };
                    } else {
                        console.log(`Skipping league ${leagueId} (${currentLeague.season}) as no matchup data available.`);
                    }

                    // Move to previous league if available
                    if (currentLeague.previous_league_id) {
                        const prevLeagueResponse = await fetch(`https://api.sleeper.app/v1/league/${currentLeague.previous_league_id}`);
                        if (!prevLeagueResponse.ok) {
                            console.warn(`Failed to fetch previous league details for ID ${currentLeague.previous_league_id}. Stopping historical lookup.`);
                            break;
                        }
                        currentLeague = await prevLeagueResponse.json();
                    } else {
                        currentLeague = null; // No more previous leagues
                    }
                }
                setAllLeagueData(loadedData);
            } catch (err) {
                console.error("Error loading league details for matchup display:", err);
                setErrorDetails(`Failed to load team details: ${err.message}`);
            } finally {
                setLoadingDetails(false);
            }
        };

        loadLeagueDetails();
    }, [historicalMatchups]); // Re-run effect if historicalMatchups changes

    // Sort seasons in descending order (most recent first)
    const sortedSeasons = Object.keys(historicalMatchups).sort((a, b) => parseInt(b) - parseInt(a));

    if (loadingDetails) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
                <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-lg font-medium">Loading team details for matchups...</p>
            </div>
        );
    }

    if (errorDetails) {
        return (
            <p className="text-center text-red-600 text-lg">
                Error: {errorDetails}
                <br/>
                Please ensure you have an active internet connection and that the Sleeper API is accessible.
            </p>
        );
    }

    if (Object.keys(historicalMatchups).length === 0) {
        return <p className="text-center text-gray-700">No historical matchup data available. Please ensure data is loaded.</p>;
    }

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">All Historical Matchups</h2>

            {sortedSeasons.map(season => {
                const seasonMatchups = historicalMatchups[season];
                const leagueDetails = allLeagueData[season]; // Get associated league data for this season

                // Get roster map for the current season
                const rosterToTeamNameMap = leagueDetails ? leagueDetails.teamNameMap : new Map();

                const sortedWeeks = Object.keys(seasonMatchups).sort((a, b) => parseInt(a) - parseInt(b));

                return (
                    <div key={season} className="mb-8 p-6 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-xl font-semibold text-blue-700 mb-4 border-b pb-2">Season: {season}</h3>
                        {sortedWeeks.length > 0 ? (
                            sortedWeeks.map(week => {
                                const matchupsInWeek = seasonMatchups[week];
                                if (!matchupsInWeek || matchupsInWeek.length === 0) {
                                    return <p key={`${season}-week-${week}`} className="text-gray-600 ml-4">Week {week}: No matchups found.</p>;
                                }

                                // Group matchups by matchup_id to display head-to-head pairs
                                const groupedMatchups = {};
                                matchupsInWeek.forEach(match => {
                                    if (!groupedMatchups[match.matchup_id]) {
                                        groupedMatchups[match.matchup_id] = [];
                                    }
                                    groupedMatchups[match.matchup_id].push(match);
                                });

                                return (
                                    <div key={`${season}-week-${week}`} className="mb-4">
                                        <h4 className="text-lg font-medium text-gray-700 mb-2 ml-4">Week {week}</h4>
                                        <div className="space-y-2 ml-8">
                                            {Object.values(groupedMatchups).map((matchupPair, index) => {
                                                // Ensure there are exactly two teams in the pair for a valid matchup
                                                if (matchupPair.length !== 2) {
                                                    console.warn(`Invalid matchup pair found for season ${season}, week ${week}, matchup_id ${matchupPair[0]?.matchup_id}`);
                                                    return null;
                                                }
                                                const team1 = matchupPair[0];
                                                const team2 = matchupPair[1];

                                                // Resolve team names using the map
                                                const team1Name = rosterToTeamNameMap.get(team1.roster_id) || `Roster ID: ${team1.roster_id}`;
                                                const team2Name = rosterToTeamNameMap.get(team2.roster_id) || `Roster ID: ${team2.roster_id}`;

                                                return (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm border border-gray-100">
                                                        <div className="flex-1 text-gray-800 font-semibold text-right pr-2">
                                                            {getDisplayTeamName(team1Name)}
                                                        </div>
                                                        <div className="text-gray-600 text-sm">
                                                            {team1.points.toFixed(2)} - {team2.points.toFixed(2)}
                                                        </div>
                                                        <div className="flex-1 text-gray-800 font-semibold text-left pl-2">
                                                            {getDisplayTeamName(team2Name)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-gray-600 ml-4">No matchups recorded for this season.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default HistoricalMatchupsByYear;

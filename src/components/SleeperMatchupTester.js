// src/components/SleeperMatchupTester.js
import React, { useState, useEffect } from 'react';
import { fetchAllHistoricalMatchups, fetchUsersData, fetchLeagueData } from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID, TEAM_NAME_TO_SLEEPER_ID_MAP } from '../config';

const SleeperMatchupTester = () => {
    const [matchupData, setMatchupData] = useState(null);
    const [usersData, setUsersData] = useState(null);
    const [leagueData, setLeague] = useState(null); // Renamed to avoid conflict with `league` in Promise.all
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch all necessary data concurrently
                const [matchups, users, leagueInfo] = await Promise.all([ // Renamed league to leagueInfo
                    fetchAllHistoricalMatchups(),
                    fetchUsersData(CURRENT_LEAGUE_ID),
                    fetchLeagueData(CURRENT_LEAGUE_ID)
                ]);

                setMatchupData(matchups);
                setUsersData(users);
                setLeague(leagueInfo); // Using setLeague

            } catch (err) {
                console.error("Error fetching Sleeper historical data for testing:", err);
                setError(`Failed to load data: ${err.message}. Check console for details.`);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Helper to get user display name from user ID
    const getUserDisplayName = (userId) => {
        const user = usersData?.find(u => u.user_id === userId);
        return user ? user.display_name : `Unknown User (${userId})`;
    };

    // Helper to get roster ID to user ID mapping (for convenience)
    const getRosterOwnerId = (rosterId) => {
        const roster = leagueData?.rosters.find(r => r.roster_id === rosterId);
        return roster ? roster.owner_id : null;
    };

    if (loading) {
        return <div className="text-center p-4">Loading Sleeper Historical Matchups for Verification...</div>;
    }

    if (error) {
        return <div className="text-center p-4 text-red-600">Error: {error}</div>;
    }

    // Check if matchupData is null or empty object before trying to iterate
    if (!matchupData || Object.keys(matchupData).length === 0) {
        return <div className="text-center p-4">No historical matchup data found from Sleeper API.</div>;
    }

    // Basic Data Verification Output
    const renderVerificationSummary = () => {
        const totalSeasons = Object.keys(matchupData).length;
        let totalMatchups = 0;
        let totalTeamsParticipating = new Set();

        Object.entries(matchupData).forEach(([season, weeks]) => {
            // Ensure 'weeks' is an object before iterating its entries
            if (typeof weeks === 'object' && weeks !== null) {
                Object.entries(weeks).forEach(([weekNum, matchupsInWeek]) => {
                    // Ensure 'matchupsInWeek' is an array before calling forEach
                    if (Array.isArray(matchupsInWeek)) { // <-- ADDED CHECK HERE
                        totalMatchups += matchupsInWeek.length;
                        matchupsInWeek.forEach(matchup => {
                            totalTeamsParticipating.add(matchup.team1_roster_id);
                            totalTeamsParticipating.add(matchup.team2_roster_id);
                        });
                    } else {
                        console.warn(`SleeperMatchupTester: Expected array for matchups in Week ${weekNum}, Season ${season}, but got:`, matchupsInWeek);
                    }
                });
            } else {
                console.warn(`SleeperMatchupTester: Expected object for weeks in Season ${season}, but got:`, weeks);
            }
        });

        return (
            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-4 mb-6 rounded">
                <h3 className="font-bold text-lg mb-2">Verification Summary:</h3>
                <p><strong>Total Seasons Found:</strong> {totalSeasons}</p>
                <p><strong>Total Matchups Found:</strong> {totalMatchups}</p>
                <p><strong>Unique Roster IDs (participating teams):</strong> {totalTeamsParticipating.size}</p>
                <p>
                    **Recommendation:** Compare these numbers (especially unique teams and matchups per season/week)
                    with your league's actual history on Sleeper.
                </p>
                <p className="mt-2 text-sm text-blue-700">
                    If `Unique Roster IDs` doesn't match your league size, check `config.js` `CURRENT_LEAGUE_ID` and your `sleeperApi.js` `fetchUsersData` and `fetchRostersWithDetails`.
                </p>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 bg-white shadow-lg rounded-lg">
            <h1 className="text-3xl font-bold text-blue-800 mb-6">Sleeper Historical Matchup Data Verification</h1>

            {renderVerificationSummary()}

            {Object.entries(matchupData).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).map(([season, weeks]) => (
                <div key={season} className="mb-8 p-4 border border-gray-200 rounded-md shadow-sm">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Season: {season}</h2>
                    {/* Ensure 'weeks' is an object before iterating */}
                    {typeof weeks === 'object' && weeks !== null ?
                        Object.entries(weeks).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([weekNum, matchupsInWeek]) => (
                            <div key={`${season}-week-${weekNum}`} className="mb-6 p-3 bg-gray-50 rounded-md">
                                <h3 className="text-xl font-medium text-gray-700 mb-3">Week {weekNum} ({Array.isArray(matchupsInWeek) ? matchupsInWeek.length : 0} Matchups)</h3>
                                <ul className="space-y-2">
                                    {Array.isArray(matchupsInWeek) && matchupsInWeek.map((matchup) => { // <-- ADDED CHECK HERE
                                        const team1UserId = getRosterOwnerId(matchup.team1_roster_id);
                                        const team2UserId = getRosterOwnerId(matchup.team2_roster_id);
                                        const team1Name = getUserDisplayName(team1UserId);
                                        const team2Name = getUserDisplayName(team2UserId);

                                        const winner = matchup.team1_score > matchup.team2_score ? team1Name :
                                                       matchup.team2_score > matchup.team1_score ? team2Name : "Tie";

                                        return (
                                            <li key={matchup.matchup_id} className="p-2 border border-gray-100 rounded bg-white text-sm">
                                                <p><strong>Matchup ID:</strong> {matchup.matchup_id}</p>
                                                <p><strong>{team1Name}</strong> ({matchup.team1_score} points) vs. <strong>{team2Name}</strong> ({matchup.team2_score} points)</p>
                                                <p>Winner: {winner}</p>
                                                <p className="text-xs text-gray-500">
                                                    (Roster IDs: {matchup.team1_roster_id}, {matchup.team2_roster_id})
                                                </p>
                                            </li>
                                        );
                                    })}
                                    {!Array.isArray(matchupsInWeek) && (
                                        <li className="p-2 border border-red-100 rounded bg-red-50 text-sm text-red-700">
                                            No valid matchup data for this week. Expected an array but got: {JSON.stringify(matchupsInWeek)}
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )) : (
                            <div className="p-2 border border-red-100 rounded bg-red-50 text-sm text-red-700">
                                No valid week data for this season. Expected an object but got: {JSON.stringify(weeks)}
                            </div>
                        )
                    }
                </div>
            ))}
        </div>
    );
};

export default SleeperMatchupTester;

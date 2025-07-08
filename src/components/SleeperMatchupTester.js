// src/components/SleeperMatchupTester.js
import React, { useEffect, useState } from 'react';
import {
    fetchAllHistoricalMatchups
    // Import other functions if you want to display their results here too
} from '../utils/sleeperApi';

const SleeperMatchupTester = () => {
    const [historicalData, setHistoricalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAndSetData = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchAllHistoricalMatchups();
                setHistoricalData(data);
                console.log("Fetched Historical Data (with brackets):", data); // Log the full structure
            } catch (err) {
                console.error("Error fetching historical data in component:", err);
                setError(err.message || "Failed to fetch historical data.");
            } finally {
                setLoading(false);
            }
        };

        fetchAndSetData();
    }, []);

    if (loading) {
        return <div style={{ color: '#007bff', fontSize: '1.2em' }}>Loading historical league data...</div>;
    }

    if (error) {
        return <div style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</div>;
    }

    if (!historicalData || Object.keys(historicalData.leaguesMetadataBySeason).length === 0) {
        return <div style={{ color: 'orange' }}>No historical league data found. Check your CURRENT_LEAGUE_ID.</div>;
    }

    // --- Data Processing for Display ---
    let totalSeasonsFound = Object.keys(historicalData.leaguesMetadataBySeason).length;
    let totalMatchupsFound = 0;
    const uniqueRosterIds = new Set();
    const uniqueUserIds = new Set(); // To track actual users

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ color: '#333', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Sleeper League Historical Data Verification</h1>

            {/* Overall Summary */}
            <div style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                <h2 style={{ color: '#0056b3' }}>Verification Summary:</h2>
                <p><strong>Total Seasons Found:</strong> {totalSeasonsFound}</p>

                {Object.entries(historicalData.matchupsBySeason).map(([, weeks]) => {
                    Object.values(weeks).forEach(matchups => {
                        totalMatchupsFound += matchups.length;
                    });
                })}
                <p><strong>Total Matchups Found (across all active seasons):</strong> {totalMatchupsFound}</p>

                {Object.entries(historicalData.rostersBySeason).forEach(([, rosters]) => {
                    rosters.forEach(roster => {
                        uniqueRosterIds.add(roster.roster_id);
                        if (roster.owner_id) { // Ensure owner_id exists
                            uniqueUserIds.add(roster.owner_id);
                        }
                    });
                })}
                <p><strong>Unique Roster IDs (participating teams):</strong> {uniqueRosterIds.size}</p>
                <p><strong>Unique User IDs (owners):</strong> {uniqueUserIds.size}</p>

                <p style={{ fontWeight: 'bold', color: uniqueRosterIds.size === historicalData.rostersBySeason[Object.keys(historicalData.rostersBySeason)[0]]?.length ? 'green' : 'red' }}>
                    Recommendation: Compare these numbers (especially unique teams and matchups per season/week) with your league's actual history on Sleeper.
                    If Unique Roster IDs or Unique User IDs don't match your expected league size, check `config.js` `CURRENT_LEAGUE_ID` and your `sleeperApi.js` `fetchUsersData` and `fetchRostersWithDetails`.
                </p>
            </div>

            {/* Detailed Season Breakdown */}
            {Object.entries(historicalData.leaguesMetadataBySeason)
                .sort(([seasonA], [seasonB]) => parseInt(seasonB) - parseInt(seasonA)) // Sort seasons from newest to oldest
                .map(([season, leagueMeta]) => {
                    const seasonMatchups = historicalData.matchupsBySeason[season] || {};
                    const seasonRosters = historicalData.rostersBySeason[season] || [];
                    const seasonWinnersBracket = historicalData.winnersBracketBySeason[season] || [];
                    const seasonLosersBracket = historicalData.losersBracketBySeason[season] || [];

                    // Create a map for quick lookup: roster_id -> { displayName, teamName }
                    const rosterToUserMap = new Map();
                    seasonRosters.forEach(roster => {
                        rosterToUserMap.set(roster.roster_id, {
                            displayName: roster.ownerDisplayName,
                            teamName: roster.ownerTeamName,
                            userId: roster.owner_id // Include userId for verification
                        });
                    });

                    // Helper to get team info from roster ID or bracket object
                    const getTeamInfo = (teamIdentifier) => {
                        if (typeof teamIdentifier === 'number') { // It's a roster_id
                            const team = rosterToUserMap.get(teamIdentifier);
                            return team ? `${team.teamName} (Owner: ${team.displayName})` : `Roster ${teamIdentifier}`;
                        } else if (teamIdentifier && (teamIdentifier.w || teamIdentifier.l)) { // It's a bracket winner/loser object
                            const type = teamIdentifier.w ? 'Winner' : 'Loser';
                            const matchId = teamIdentifier.w || teamIdentifier.l;
                            return `${type} of Match ${matchId}`;
                        }
                        return 'TBD'; // Default for null or unexpected
                    };

                    return (
                        <div key={season} style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', backgroundColor: '#fff' }}>
                            <h2 style={{ color: '#0056b3' }}>Season: {season} ({leagueMeta.name})</h2>
                            <p><strong>League ID:</strong> {leagueMeta.league_id}</p>
                            <p><strong>Season Start:</strong> {leagueMeta.season_start_date || 'N/A'}</p>
                            <p><strong>Total Teams:</strong> {seasonRosters.length}</p>

                            {/* Display Rosters for this season */}
                            <div style={{ marginTop: '15px', borderTop: '1px dashed #eee', paddingTop: '15px' }}>
                                <h3 style={{ color: '#444' }}>Teams (Rosters) in {season}:</h3>
                                {seasonRosters.length > 0 ? (
                                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                                        {seasonRosters.map(roster => (
                                            <li key={roster.roster_id} style={{ marginBottom: '5px' }}>
                                                <strong>Roster {roster.roster_id}:</strong> {roster.ownerTeamName} (Owner: {roster.ownerDisplayName} - User ID: {roster.owner_id})
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No roster data available for this season.</p>
                                )}
                            </div>

                            {/* Display Regular Season Matchups for this season */}
                            <div style={{ marginTop: '25px', borderTop: '2px solid #ddd', paddingTop: '20px' }}>
                                <h3 style={{ color: '#007bff' }}>Regular Season Matchups in {season}:</h3>
                                {Object.keys(seasonMatchups).length > 0 ? (
                                    Object.entries(seasonMatchups)
                                        .sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB)) // Sort weeks numerically
                                        .map(([week, matchups]) => (
                                            <div key={`${season}-week-${week}-regular`} style={{ marginBottom: '20px' }}>
                                                <h4 style={{ color: '#666' }}>Week {week} ({matchups.length} Matchups)</h4>
                                                {matchups.length > 0 ? (
                                                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                                                        {matchups.map(matchup => {
                                                            const team1 = rosterToUserMap.get(matchup.team1_roster_id);
                                                            const team2 = rosterToUserMap.get(matchup.team2_roster_id);

                                                            const team1DisplayName = team1 ? `${team1.teamName} (Owner: ${team1.displayName})` : `Roster ${matchup.team1_roster_id}`;
                                                            const team2DisplayName = team2 ? `${team2.teamName} (Owner: ${team2.displayName})` : `Roster ${matchup.team2_roster_id}`;

                                                            const winnerName = (matchup.team1_score > matchup.team2_score)
                                                                ? (team1 ? team1.teamName : `Roster ${matchup.team1_roster_id}`)
                                                                : (matchup.team2_score > matchup.team1_score)
                                                                    ? (team2 ? team2.teamName : `Roster ${matchup.team2_roster_id}`)
                                                                    : "Tie";

                                                            return (
                                                                <li key={`reg-match-${matchup.matchup_id}`} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#fdfdfd' }}>
                                                                    <strong>Matchup ID: {matchup.matchup_id}</strong>
                                                                    <br />
                                                                    {team1DisplayName} ({matchup.team1_score} points) vs. {team2DisplayName} ({matchup.team2_score} points)
                                                                    <br />
                                                                    Winner: <strong>{winnerName}</strong>
                                                                    <br />
                                                                    (Roster IDs: {matchup.team1_roster_id}, {matchup.team2_roster_id})
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                ) : (
                                                    <p>No regular season matchups found for Week {week}.</p>
                                                )}
                                            </div>
                                        ))
                                ) : (
                                    <p>No regular season matchup data available for this season (either future season or error fetching).</p>
                                )}
                            </div>

                            {/* Display Playoff Bracket Data for this season */}
                            <div style={{ marginTop: '25px', borderTop: '2px solid #ddd', paddingTop: '20px' }}>
                                <h3 style={{ color: '#007bff' }}>Playoff Brackets in {season}:</h3>

                                {seasonWinnersBracket.length === 0 && seasonLosersBracket.length === 0 ? (
                                    <p>No playoff bracket data available for this season.</p>
                                ) : (
                                    <>
                                        {seasonWinnersBracket.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ color: '#666' }}>Winners Bracket ({seasonWinnersBracket.length} Matches)</h4>
                                                <ul style={{ listStyleType: 'none', padding: 0 }}>
                                                    {seasonWinnersBracket.sort((a,b) => a.r - b.r || a.m - b.m).map(match => (
                                                        <li key={`wb-${match.m}`} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#fdfdfd' }}>
                                                            <strong>Round {match.r}, Match {match.m}:</strong>
                                                            <br />
                                                            Team 1: {getTeamInfo(match.t1 || match.t1_from)} {match.t1 && `(${rosterToUserMap.get(match.t1)?.teamName || match.t1})`}
                                                            <br />
                                                            Team 2: {getTeamInfo(match.t2 || match.t2_from)} {match.t2 && `(${rosterToUserMap.get(match.t2)?.teamName || match.t2})`}
                                                            <br />
                                                            Winner: {match.w ? getTeamInfo(match.w) : 'TBD'}
                                                            {match.w && ` (${rosterToUserMap.get(match.w)?.teamName || match.w})`}
                                                            <br />
                                                            Loser: {match.l ? getTeamInfo(match.l) : 'TBD'}
                                                            {match.l && ` (${rosterToUserMap.get(match.l)?.teamName || match.l})`}
                                                            {match.p && ` (Playoff Rank: ${match.p})`}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {seasonLosersBracket.length > 0 && (
                                            <div>
                                                <h4 style={{ color: '#666' }}>Losers Bracket ({seasonLosersBracket.length} Matches)</h4>
                                                <ul style={{ listStyleType: 'none', padding: 0 }}>
                                                    {seasonLosersBracket.sort((a,b) => a.r - b.r || a.m - b.m).map(match => (
                                                        <li key={`lb-${match.m}`} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#fdfdfd' }}>
                                                            <strong>Round {match.r}, Match {match.m}:</strong>
                                                            <br />
                                                            Team 1: {getTeamInfo(match.t1 || match.t1_from)} {match.t1 && `(${rosterToUserMap.get(match.t1)?.teamName || match.t1})`}
                                                            <br />
                                                            Team 2: {getTeamInfo(match.t2 || match.t2_from)} {match.t2 && `(${rosterToUserMap.get(match.t2)?.teamName || match.t2})`}
                                                            <br />
                                                            Winner: {match.w ? getTeamInfo(match.w) : 'TBD'}
                                                            {match.w && ` (${rosterToUserMap.get(match.w)?.teamName || match.w})`}
                                                            <br />
                                                            Loser: {match.l ? getTeamInfo(match.l) : 'TBD'}
                                                            {match.l && ` (${rosterToUserMap.get(match.l)?.teamName || match.l})`}
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
                    );
                })
            }
        </div>
    );
};

export default SleeperMatchupTester;

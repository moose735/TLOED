// src/components/SleeperMatchupTester.js
import React, { useEffect, useState } from 'react';
import {
    fetchAllHistoricalMatchups
} from '../utils/sleeperApi';
import { calculatePlayoffFinishes } from '../utils/playoffRankings'; // Import the playoff calculation function

const SleeperMatchupTester = () => {
    const [historicalData, setHistoricalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(''); // State for the selected year
    const [playoffResults, setPlayoffResults] = useState(null); // State for playoff calculation results

    useEffect(() => {
        const fetchAndSetData = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchAllHistoricalMatchups();
                setHistoricalData(data);
                console.log("Fetched Historical Data (with brackets and scores):", data); // Log the full structure

                // Set initial selected year to the latest available if data exists
                if (data && Object.keys(data.leaguesMetadataBySeason).length > 0) {
                    const latestYear = Math.max(...Object.keys(data.leaguesMetadataBySeason).map(Number)).toString();
                    setSelectedYear(latestYear);
                }

            } catch (err) {
                console.error("Error fetching historical data in component:", err);
                setError(err.message || "Failed to fetch historical data.");
            } finally {
                setLoading(false);
            }
        };

        fetchAndSetData();
    }, []); // Empty dependency array means this runs once on mount

    // Effect to recalculate playoff finishes when selectedYear or historicalData changes
    useEffect(() => {
        if (!loading && historicalData && selectedYear) {
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
    }, [historicalData, loading, selectedYear]); // Recalculate when these change

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
    const rosterToUserMap = new Map();
    currentSeasonRosters.forEach(roster => {
        rosterToUserMap.set(roster.roster_id, {
            displayName: roster.ownerDisplayName, // This is the user's display_name
            teamName: roster.ownerTeamName,     // This is the metadata.team_name
            userId: roster.owner_id
        });
    });

    // Helper to get team info from roster ID (or bracket object if needed for t1_from/t2_from)
    const getTeamInfo = (teamIdentifier) => {
        // Handle direct roster ID (number or string)
        if (typeof teamIdentifier === 'number' || typeof teamIdentifier === 'string') {
            const team = rosterToUserMap.get(String(teamIdentifier)); // Ensure key is string for lookup
            return team ? `${team.teamName || 'N/A Team Name'} (Owner: ${team.displayName || 'N/A Owner'})` : `Roster ${teamIdentifier}`;
        }
        // Handle bracket objects with 'from' references
        else if (teamIdentifier && (teamIdentifier.w || teamIdentifier.l || teamIdentifier.t1 || teamIdentifier.t2)) {
            const rosterId = teamIdentifier.w || teamIdentifier.l || teamIdentifier.t1 || teamIdentifier.t2;
            const team = rosterToUserMap.get(String(rosterId));
            const fromType = teamIdentifier.w ? 'Winner of Match' : teamIdentifier.l ? 'Loser of Match' : 'From Match';
            return team ? `${team.teamName || 'N/A Team Name'} (Owner: ${team.displayName || 'N/A Owner'}) - ${fromType} ${teamIdentifier.m}` : `${fromType} ${teamIdentifier.m} (Roster: ${rosterId})`;
        }
        return 'TBD';
    };


    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ color: '#333', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Sleeper League Historical Data Verification & Playoff Finishes</h1>

            {/* Overall Summary */}
            <div style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                <h2 style={{ color: '#0056b3' }}>Verification Summary:</h2>
                <p><strong>Total Seasons Found:</strong> {totalSeasonsFound}</p>
                <p><strong>Total Matchups Found (across all active seasons, including playoffs):</strong> {totalMatchupsOverall}</p>
                <p><strong>Unique Roster IDs (participating teams across all seasons):</strong> {uniqueRosterIds.size}</p>
                <p><strong>Unique User IDs (owners across all seasons):</strong> {uniqueUserIds.size}</p>

                <p style={{ fontWeight: 'bold', color: uniqueRosterIds.size > 0 && uniqueRosterIds.size === currentSeasonRosters.length ? 'green' : 'red' }}>
                    Recommendation: Compare these numbers (especially unique teams and matchups per season/week) with your league's actual history on Sleeper.
                    If Unique Roster IDs or Unique User IDs don't match your expected league size, check `config.js` `CURRENT_LEAGUE_ID` and your `sleeperApi.js` `fetchUsersData` and `fetchRostersWithDetails`.
                </p>
            </div>

            {/* Season Selector */}
            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="season-select" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Select Season for Detail:</label>
                <select
                    id="season-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', maxWidth: '200px' }}
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
                <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', backgroundColor: '#fff' }}>
                    <h2 style={{ color: '#0056b3' }}>Season: {selectedYear} ({currentSeasonMetadata.name})</h2>
                    <p><strong>League ID:</strong> {currentSeasonMetadata.league_id}</p>
                    <p><strong>Season Start:</strong> {currentSeasonMetadata.season_start_date || 'N/A'}</p>
                    <p><strong>Total Teams:</strong> {currentSeasonRosters.length}</p>

                    {/* Display Rosters for this season */}
                    <div style={{ marginTop: '15px', borderTop: '1px dashed #eee', paddingTop: '15px' }}>
                        <h3 style={{ color: '#444' }}>Teams (Rosters) in {selectedYear}:</h3>
                        {currentSeasonRosters.length > 0 ? (
                            <ul style={{ listStyleType: 'none', padding: 0 }}>
                                {currentSeasonRosters.map(roster => (
                                    <li key={roster.roster_id} style={{ marginBottom: '5px' }}>
                                        <strong>Roster {roster.roster_id}:</strong> {roster.ownerTeamName} (Owner: {roster.ownerDisplayName} - User ID: {roster.owner_id})
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No roster data available for this season.</p>
                        )}
                    </div>

                    {/* Display Playoff Finishes for this season */}
                    <div style={{ marginTop: '25px', borderTop: '2px solid #ddd', paddingTop: '20px' }}>
                        <h3 style={{ color: '#007bff' }}>Playoff Finishes in {selectedYear}:</h3>
                        {playoffResults && playoffResults.length > 0 ? (
                            <ul style={{ listStyleType: 'decimal', paddingLeft: '20px' }}>
                                {playoffResults.map(team => (
                                    <li key={team.roster_id} style={{ marginBottom: '5px' }}>
                                        <strong>{team.playoffFinish}</strong>: {team.ownerTeamName} (Owner: {team.ownerDisplayName})
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No playoff finish data available for this season. Ensure brackets are complete or check `playoffRankings.js` logic.</p>
                        )}
                    </div>

                    {/* Display Regular Season Matchups for this season */}
                    <div style={{ marginTop: '25px', borderTop: '2px solid #ddd', paddingTop: '20px' }}>
                        <h3 style={{ color: '#007bff' }}>Regular Season Matchups in {selectedYear}:</h3>
                        {Object.keys(currentSeasonMatchups).length > 0 ? (
                            Object.entries(currentSeasonMatchups)
                                .filter(([weekNum]) => parseInt(weekNum) < (currentSeasonMetadata.settings?.playoff_start_week || 99)) // Filter for regular season
                                .sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB))
                                .map(([week, matchups]) => (
                                    <div key={`${selectedYear}-week-${week}-regular`} style={{ marginBottom: '20px' }}>
                                        <h4 style={{ color: '#666' }}>Week {week} ({matchups.length} Matchups)</h4>
                                        {matchups.length > 0 ? (
                                            <ul style={{ listStyleType: 'none', padding: 0 }}>
                                                {matchups.map(matchup => {
                                                    const team1 = rosterToUserMap.get(String(matchup.team1_roster_id));
                                                    const team2 = rosterToUserMap.get(String(matchup.team2_roster_id));

                                                    // Use ownerTeamName first, then ownerDisplayName as fallback for display
                                                    const team1Display = team1 ? `${team1.teamName || team1.displayName}` : `Roster ${matchup.team1_roster_id}`;
                                                    const team2Display = team2 ? `${team2.teamName || team2.displayName}` : `Roster ${matchup.team2_roster_id}`;

                                                    const winnerName = (matchup.team1_score > matchup.team2_score)
                                                        ? (team1 ? (team1.teamName || team1.displayName) : `Roster ${matchup.team1_roster_id}`)
                                                        : (matchup.team2_score > matchup.team1_score)
                                                            ? (team2 ? (team2.teamName || team2.displayName) : `Roster ${matchup.team2_roster_id}`)
                                                            : "Tie";

                                                    return (
                                                        <li key={`reg-match-${matchup.matchup_id}`} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#fdfdfd' }}>
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
                        <h3 style={{ color: '#007bff' }}>Playoff Brackets in {selectedYear}:</h3>

                        {currentSeasonWinnersBracket.length === 0 && currentSeasonLosersBracket.length === 0 ? (
                            <p>No playoff bracket data available for this season.</p>
                        ) : (
                            <>
                                {currentSeasonWinnersBracket.length > 0 && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h4 style={{ color: '#666' }}>Winners Bracket ({currentSeasonWinnersBracket.length} Matches)</h4>
                                        <ul style={{ listStyleType: 'none', padding: 0 }}>
                                            {currentSeasonWinnersBracket.sort((a, b) => a.r - b.r || a.m - b.m).map(match => (
                                                <li key={`wb-${match.m}`} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#fdfdfd' }}>
                                                    <strong>Round {match.r}, Match {match.m}:</strong>
                                                    <br />
                                                    Team 1: {getTeamInfo(match.t1 || match.t1_from)} {typeof match.t1_score === 'number' ? `(${match.t1_score} points)` : ''}
                                                    <br />
                                                    Team 2: {getTeamInfo(match.t2 || match.t2_from)} {typeof match.t2_score === 'number' ? `(${match.t2_score} points)` : ''}
                                                    <br />
                                                    Winner: {match.w ? getTeamInfo(match.w) : 'TBD'}
                                                    <br />
                                                    Loser: {match.l ? getTeamInfo(match.l) : 'TBD'}
                                                    {match.p && ` (Playoff Rank: ${match.p})`}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {currentSeasonLosersBracket.length > 0 && (
                                    <div>
                                        <h4 style={{ color: '#666' }}>Losers Bracket ({currentSeasonLosersBracket.length} Matches)</h4>
                                        <ul style={{ listStyleType: 'none', padding: 0 }}>
                                            {currentSeasonLosersBracket.sort((a, b) => a.r - b.r || a.m - b.m).map(match => (
                                                <li key={`lb-${match.m}`} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#fdfdfd' }}>
                                                    <strong>Round {match.r}, Match {match.m}:</strong>
                                                    <br />
                                                    Team 1: {getTeamInfo(match.t1 || match.t1_from)} {typeof match.t1_score === 'number' ? `(${match.t1_score} points)` : ''}
                                                    <br />
                                                    Team 2: {getTeamInfo(match.t2 || match.t2_from)} {typeof match.t2_score === 'number' ? `(${match.t2_score} points)` : ''}
                                                    <br />
                                                    Winner: {match.w ? getTeamInfo(match.w) : 'TBD'}
                                                    <br />
                                                    Loser: {match.l ? getTeamInfo(match.l) : 'TBD'}
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
            ) : (
                <div style={{ textAlign: 'center', color: '#555' }}>Please select a season to view detailed data.</div>
            )}
        </div>
    );
};

export default SleeperMatchupTester;

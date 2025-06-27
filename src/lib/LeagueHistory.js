import React, { useState, useEffect, useCallback } from 'react';
import { fetchUsersData, fetchRostersWithDetails, fetchLeagueDrafts, fetchDraftDetails, fetchDraftPicks, fetchTradedPicks, getSleeperAvatarUrl, CURRENT_LEAGUE_ID, TEAM_NAME_TO_SLEEPER_ID_MAP } from '../utils/sleeperApi'; // CURRENT_LEAGUE_ID and TEAM_NAME_TO_SLEEPER_ID_MAP now imported from sleeperApi.js

const LeagueHistory = ({ historicalMatchups, loading, error, getDisplayTeamName }) => {
    const [allLeagueDetails, setAllLeagueDetails] = useState([]); // Stores { leagueId, season, name }
    const [allRostersBySeason, setAllRostersBySeason] = useState({}); // { season: { roster_id: { owner_id, teamName }, ... } }
    const [allUsersBySeason, setAllUsersBySeason] = useState({}); // { season: { user_id: { displayName, teamName }, ... } }
    const [allDraftsBySeason, setAllDraftsBySeason] = useState({}); // { season: [{ draft_details, picks, traded_picks }] }
    const [internalLoading, setInternalLoading] = useState(true);
    const [internalError, setInternalError] = useState(null);

    useEffect(() => {
        const loadHistoricalLeagueData = async () => {
            setInternalLoading(true);
            setInternalError(null);
            const loadedLeagueDetails = [];
            const loadedRostersBySeason = {};
            const loadedUsersBySeason = {};
            const loadedDraftsBySeason = {};

            try {
                let currentId = CURRENT_LEAGUE_ID;
                const seenLeagueIds = new Set(); // To prevent infinite loops for circular previous_league_id

                while (currentId && currentId !== '0' && !seenLeagueIds.has(currentId)) {
                    seenLeagueIds.add(currentId);
                    const leagueResponse = await fetch(`https://api.sleeper.app/v1/league/${currentId}`);
                    if (!leagueResponse.ok) {
                        console.warn(`Failed to fetch league details for ID ${currentId}: ${leagueResponse.statusText}`);
                        break; // Stop if a league cannot be fetched
                    }
                    const leagueDetail = await leagueResponse.json();

                    if (!leagueDetail || !leagueDetail.season) {
                        console.warn(`Invalid league details or missing season for ID ${currentId}.`);
                        break;
                    }

                    loadedLeagueDetails.push({
                        leagueId: leagueDetail.league_id,
                        season: leagueDetail.season,
                        name: leagueDetail.name,
                    });

                    // Fetch users and rosters for the current league
                    const [users, rosters] = await Promise.all([
                        fetchUsersData(leagueDetail.league_id),
                        fetchRostersWithDetails(leagueDetail.league_id) // This function already enriches rosters
                    ]);

                    const usersMap = new Map(users.map(user => [user.userId, user]));
                    loadedUsersBySeason[leagueDetail.season] = usersMap;

                    const rostersMap = new Map();
                    rosters.forEach(roster => {
                        rostersMap.set(roster.roster_id, roster); // Store enriched roster
                    });
                    loadedRostersBySeason[leagueDetail.season] = rostersMap;

                    // Fetch draft data
                    const drafts = await fetchLeagueDrafts(leagueDetail.league_id);
                    const seasonDrafts = [];
                    for (const draft of drafts) {
                        const [details, picks, tradedPicks] = await Promise.all([
                            fetchDraftDetails(draft.draft_id),
                            fetchDraftPicks(draft.draft_id),
                            fetchTradedPicks(draft.draft_id)
                        ]);
                        seasonDrafts.push({ details, picks, tradedPicks });
                    }
                    loadedDraftsBySeason[leagueDetail.season] = seasonDrafts;


                    currentId = leagueDetail.previous_league_id; // Move to the previous league
                }

                setAllLeagueDetails(loadedLeagueDetails.sort((a, b) => b.season - a.season)); // Sort by season descending
                setAllRostersBySeason(loadedRostersBySeason);
                setAllUsersBySeason(loadedUsersBySeason);
                setAllDraftsBySeason(loadedDraftsBySeason);

            } catch (err) {
                console.error("Error loading historical league data:", err);
                setInternalError(`Failed to load historical league data: ${err.message}`);
            } finally {
                setInternalLoading(false);
            }
        };

        loadHistoricalLeagueData();
    }, []); // Empty dependency array means this runs once on mount

    const getTeamNameForRosterId = useCallback((season, rosterId) => {
        const rosters = allRostersBySeason[season];
        if (rosters && rosters.has(rosterId)) {
            // Use the ownerTeamName property that was added by fetchRostersWithDetails
            return getDisplayTeamName(rosters.get(rosterId).ownerTeamName);
        }
        return `Roster ID: ${rosterId}`;
    }, [allRostersBySeason, getDisplayTeamName]);

    const getTeamNameForUserId = useCallback((season, userId) => {
        const users = allUsersBySeason[season];
        if (users && users.has(userId)) {
            // Use teamName from user object (which might be from metadata)
            return getDisplayTeamName(users.get(userId).teamName || users.get(userId).displayName);
        }
        // Fallback to internal team name if mapped
        const internalName = Object.keys(TEAM_NAME_TO_SLEEPER_ID_MAP).find(key => TEAM_NAME_TO_SLEEPER_ID_MAP[key] === userId);
        return internalName ? getDisplayTeamName(internalName) : `User ID: ${userId}`;
    }, [allUsersBySeason, getDisplayTeamName]);


    if (loading || internalLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-blue-600">
                <svg className="animate-spin h-12 w-12 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-xl font-medium">Loading historical league data...</p>
            </div>
        );
    }

    if (error || internalError) {
        return (
            <div className="text-center text-red-600 p-6 bg-red-50 rounded-lg shadow-md">
                <p className="text-lg font-semibold mb-2">Error Loading Data</p>
                <p className="text-md">{error || internalError}</p>
                <p className="text-sm mt-3">Please ensure your Sleeper API calls are configured correctly and you have an active internet connection.</p>
            </div>
        );
    }

    if (allLeagueDetails.length === 0) {
        return <p className="text-center text-gray-700">No historical league data available.</p>;
    }

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">League History</h2>

            {allLeagueDetails.map((league) => (
                <div key={league.leagueId} className="mb-8 p-6 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-xl font-semibold text-blue-700 mb-4 border-b pb-2">Season: {league.season} - {league.name}</h3>

                    {/* Display Rosters */}
                    <div className="mb-6">
                        <h4 className="text-lg font-medium text-gray-700 mb-3">Teams & Rosters:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allRostersBySeason[league.season] && Array.from(allRostersBySeason[league.season].values()).map(roster => (
                                <div key={roster.roster_id} className="bg-white p-4 rounded-md shadow-sm border border-gray-100 flex items-center space-x-3">
                                    {roster.ownerAvatar && (
                                        <img src={roster.ownerAvatar} alt={`${roster.ownerTeamName} Avatar`} className="w-10 h-10 rounded-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/000000?text=No+Avatar"; }}/>
                                    )}
                                    <div>
                                        <p className="font-semibold text-gray-800">{getDisplayTeamName(roster.ownerTeamName)}</p>
                                        <p className="text-sm text-gray-600">Owner: {getTeamNameForUserId(league.season, roster.owner_id)}</p>
                                        {roster.players && roster.players.length > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">Total Players: {roster.players.length}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Display Drafts */}
                    {allDraftsBySeason[league.season] && allDraftsBySeason[league.season].length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-lg font-medium text-gray-700 mb-3">Drafts:</h4>
                            <div className="space-y-4">
                                {allDraftsBySeason[league.season].map(draft => (
                                    <div key={draft.details.draft_id} className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
                                        <p className="font-semibold text-gray-800">Draft ID: {draft.details.draft_id} - Type: {draft.details.type}</p>
                                        <p className="text-sm text-gray-600">Status: {draft.details.status} - Rounds: {draft.details.settings.rounds}</p>
                                        {draft.picks && draft.picks.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-sm font-medium text-gray-700">Top 5 Picks:</p>
                                                <ul className="list-disc list-inside text-sm text-gray-600">
                                                    {draft.picks.slice(0, 5).map(pick => (
                                                        <li key={pick.pick_id}>
                                                            Round {pick.round}, Pick {pick.pick_no} - {getTeamNameForRosterId(league.season, pick.roster_id)} (Player ID: {pick.player_id || 'N/A'})
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {draft.tradedPicks && draft.tradedPicks.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-sm font-medium text-gray-700">Traded Picks ({draft.tradedPicks.length}):</p>
                                                <ul className="list-disc list-inside text-sm text-gray-600">
                                                    {draft.tradedPicks.slice(0, 3).map((tp, index) => (
                                                        <li key={index}>
                                                            Round {tp.round} - Original: {getTeamNameForRosterId(league.season, tp.owner_id)} to {getTeamNameForRosterId(league.season, tp.roster_id)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Display Historical Matchups for this season (if available and passed) */}
                    {historicalMatchups[league.season] && Object.keys(historicalMatchups[league.season]).length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-lg font-medium text-gray-700 mb-3">Regular Season Matchups:</h4>
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2"> {/* Added max-height and scroll */}
                                {Object.keys(historicalMatchups[league.season]).sort((a,b) => parseInt(a) - parseInt(b)).map(week => {
                                    const matchupsInWeek = historicalMatchups[league.season][week];
                                    if (!matchupsInWeek || matchupsInWeek.length === 0) {
                                        return null;
                                    }

                                    const groupedMatchups = {};
                                    matchupsInWeek.forEach(match => {
                                        if (!groupedMatchups[match.matchup_id]) {
                                            groupedMatchups[match.matchup_id] = [];
                                        }
                                        groupedMatchups[match.matchup_id].push(match);
                                    });

                                    return (
                                        <div key={`${league.season}-week-${week}`} className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
                                            <p className="font-semibold text-gray-800 mb-1">Week {week}</p>
                                            <div className="space-y-1">
                                                {Object.values(groupedMatchups).map((matchupPair, index) => {
                                                    if (matchupPair.length !== 2) return null; // Ensure it's a valid head-to-head matchup
                                                    const team1 = matchupPair[0];
                                                    const team2 = matchupPair[1];
                                                    return (
                                                        <p key={index} className="text-sm text-gray-600">
                                                            {getTeamNameForRosterId(league.season, team1.roster_id)} ({team1.points.toFixed(2)}) vs. {getTeamNameForRosterId(league.season, team2.roster_id)} ({team2.points.toFixed(2)})
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            ))}
        </div>
    );
};

export default LeagueHistory;

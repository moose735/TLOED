import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';

const LeagueRecords = () => {
    const { historicalData, allDraftHistory, getTeamName, getTeamDetails, currentSeason, loading, error, nflState } = useSleeperData();
    const [allTimeRecords, setAllTimeRecords] = useState({});
    const [recordHistory, setRecordHistory] = useState({});
    const [topFiveRankings, setTopFiveRankings] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const formatConfig = {
        highestDPR: { decimals: 3, type: 'decimal' },
        lowestDPR: { decimals: 3, type: 'decimal' },
        mostWins: { decimals: 0, type: 'count' },
        mostLosses: { decimals: 0, type: 'count' },
        bestWinPct: { decimals: 3, type: 'percentage' },
        bestAllPlayWinPct: { decimals: 3, type: 'percentage' },
        mostWeeklyHighScores: { decimals: 0, type: 'count' },
        mostWeeklyTop2Scores: { decimals: 0, type: 'count' },
        mostWinningSeasons: { decimals: 0, type: 'count' },
        mostLosingSeasons: { decimals: 0, type: 'count' },
        mostBlowoutWins: { decimals: 0, type: 'count' },
        mostBlowoutLosses: { decimals: 0, type: 'count' },
        mostSlimWins: { decimals: 0, type: 'count' },
        mostSlimLosses: { decimals: 0, type: 'count' },
        mostTotalPoints: { decimals: 2, type: 'points' },
        mostPointsAgainst: { decimals: 2, type: 'points' },
    };

    const updateRecord = (currentRecord, newValue, teamInfo) => {
        if (!teamInfo.ownerId && teamInfo.rosterId && historicalData.rostersBySeason) {
            const rosterMap = Object.values(historicalData.rostersBySeason).flat().find(r => r.roster_id === teamInfo.rosterId);
            if (rosterMap) {
                teamInfo.ownerId = rosterMap.owner_id;
            }
        }

        if (newValue > currentRecord.value) {
            currentRecord.value = newValue;
            currentRecord.teams = [teamInfo];
        } else if (newValue === currentRecord.value && newValue !== -Infinity) {
            if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                currentRecord.teams.push(teamInfo);
            }
        }
    };

    const updateLowestRecord = (currentRecord, newValue, teamInfo) => {
        if (!teamInfo.ownerId && teamInfo.rosterId && historicalData.rostersBySeason) {
            const rosterMap = Object.values(historicalData.rostersBySeason).flat().find(r => r.roster_id === teamInfo.rosterId);
            if (rosterMap) {
                teamInfo.ownerId = rosterMap.owner_id;
            }
        }

        if (newValue < currentRecord.value) {
            currentRecord.value = newValue;
            currentRecord.teams = [teamInfo];
        } else if (newValue === currentRecord.value && newValue !== Infinity) {
            if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                currentRecord.teams.push(teamInfo);
            }
        }
    };

    // Calculate historical record progression
    const calculateRecordHistory = (seasonalMetrics) => {
        const history = {};
        const years = Object.keys(seasonalMetrics).sort((a, b) => Number(a) - Number(b));
        
        // Initialize record tracking objects
        const recordTrackers = {
            mostWeeklyHighScores: { value: -Infinity, holders: [], history: [] },
            mostWins: { value: -Infinity, holders: [], history: [] },
            bestWinPct: { value: -Infinity, holders: [], history: [] },
            mostTotalPoints: { value: -Infinity, holders: [], history: [] },
        };

        // Process each year chronologically
        years.forEach(year => {
            const seasonData = seasonalMetrics[year];
            
            Object.entries(recordTrackers).forEach(([recordKey, tracker]) => {
                let recordBroken = false;
                
                Object.values(seasonData).forEach(teamData => {
                    if (!teamData.ownerId || teamData.totalGames === 0) return;
                    
                    let currentValue = 0;
                    switch (recordKey) {
                        case 'mostWeeklyHighScores':
                            currentValue = teamData.topScoreWeeksCount || 0;
                            break;
                        case 'mostWins':
                            currentValue = teamData.wins || 0;
                            break;
                        case 'bestWinPct':
                            currentValue = teamData.winPercentage || 0;
                            break;
                        case 'mostTotalPoints':
                            currentValue = teamData.pointsFor || 0;
                            break;
                    }
                    
                    // Check if this breaks the record
                    if (currentValue > tracker.value) {
                        const teamName = getTeamName(teamData.ownerId, year);
                        
                        // Record was broken
                        tracker.history.push({
                            year: year,
                            week: 'End of Season',
                            previousValue: tracker.value === -Infinity ? 0 : tracker.value,
                            newValue: currentValue,
                            previousHolder: tracker.holders.length > 0 ? tracker.holders[tracker.holders.length - 1].name : 'N/A',
                            newHolder: teamName,
                            ownerId: teamData.ownerId
                        });
                        
                        tracker.value = currentValue;
                        tracker.holders.push({
                            name: teamName,
                            ownerId: teamData.ownerId,
                            year: year,
                            value: currentValue,
                            startYear: year
                        });
                        recordBroken = true;
                    }
                });
            });
        });

        // Convert to final format
        Object.entries(recordTrackers).forEach(([key, tracker]) => {
            history[key] = {
                currentValue: tracker.value,
                currentHolders: tracker.holders.slice(-1), // Most recent holder(s)
                allTimeHolders: tracker.holders,
                recordHistory: tracker.history
            };
        });

        return history;
    };

    // Calculate top 5 rankings for each metric
    const calculateTopFiveRankings = (careerDPRData) => {
        const rankings = {};
        
        // Helper function to get top 5 for a metric
        const getTop5 = (metric, isHigherBetter = true) => {
            return careerDPRData
                .map(team => ({
                    name: team.teamName,
                    ownerId: team.ownerId,
                    value: team[metric]
                }))
                .filter(team => team.value !== undefined && team.value !== null)
                .sort((a, b) => isHigherBetter ? b.value - a.value : a.value - b.value)
                .slice(0, 5);
        };

        rankings.highestDPR = getTop5('dpr', true);
        rankings.lowestDPR = getTop5('dpr', false);
        rankings.mostWins = getTop5('wins', true);
        rankings.mostLosses = getTop5('losses', true);
        rankings.bestWinPct = getTop5('winPercentage', true);
        rankings.bestAllPlayWinPct = getTop5('allPlayWinPercentage', true);
        rankings.mostWeeklyHighScores = getTop5('topScoreWeeksCount', true);
        rankings.mostWeeklyTop2Scores = getTop5('weeklyTop2ScoresCount', true);
        rankings.mostBlowoutWins = getTop5('blowoutWins', true);
        rankings.mostBlowoutLosses = getTop5('blowoutLosses', true);
        rankings.mostSlimWins = getTop5('slimWins', true);
        rankings.mostSlimLosses = getTop5('slimLosses', true);
        rankings.mostTotalPoints = getTop5('pointsFor', true);
        rankings.mostPointsAgainst = getTop5('pointsAgainst', true);

        // Calculate winning/losing seasons separately
        const seasonalData = careerDPRData.map(team => {
            let winningSeasonsCount = 0;
            let losingSeasonsCount = 0;
            
            // This would need access to seasonalMetrics, so we'll calculate it differently
            return {
                name: team.teamName,
                ownerId: team.ownerId,
                winningSeasons: winningSeasonsCount,
                losingSeasons: losingSeasonsCount
            };
        });

        return rankings;
    };

    const toggleSection = (recordKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [recordKey]: !prev[recordKey]
        }));
    };

    useEffect(() => {
        setIsLoading(true);

        if (loading || error || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0 || !nflState) {
            setAllTimeRecords({});
            setRecordHistory({});
            setIsLoading(false);
            return;
        }

        try {
            const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);
            
            // Calculate historical progression
            const history = calculateRecordHistory(seasonalMetrics);
            setRecordHistory(history);
            
            // Calculate top 5 rankings
            const rankings = calculateTopFiveRankings(calculatedCareerDPRs);
            
            // Calculate winning/losing seasons for rankings
            calculatedCareerDPRs.forEach(careerStats => {
                const ownerId = careerStats.ownerId;
                let winningSeasonsCount = 0;
                let losingSeasonsCount = 0;

                Object.keys(seasonalMetrics).forEach(year => {
                    const teamsInSeason = Object.values(seasonalMetrics[year]);
                    const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                    if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
                        if (currentOwnerTeamInSeason.winPercentage > 0.5) {
                            winningSeasonsCount++;
                        } else if (currentOwnerTeamInSeason.winPercentage < 0.5) {
                            losingSeasonsCount++;
                        }
                    }
                });
                
                careerStats.winningSeasonsCount = winningSeasonsCount;
                careerStats.losingSeasonsCount = losingSeasonsCount;
            });

            // Update rankings with winning/losing seasons
            rankings.mostWinningSeasons = calculatedCareerDPRs
                .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.winningSeasonsCount }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            
            rankings.mostLosingSeasons = calculatedCareerDPRs
                .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.losingSeasonsCount }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            setTopFiveRankings(rankings);
            
            let highestDPR = { value: -Infinity, teams: [], key: 'highestDPR' };
            let lowestDPR = { value: Infinity, teams: [], key: 'lowestDPR' };
            let mostWins = { value: -Infinity, teams: [], key: 'mostWins' };
            let mostLosses = { value: -Infinity, teams: [], key: 'mostLosses' };
            let bestWinPct = { value: -Infinity, teams: [], key: 'bestWinPct' };
            let bestAllPlayWinPct = { value: -Infinity, teams: [], key: 'bestAllPlayWinPct' };
            let mostWeeklyHighScores = { value: -Infinity, teams: [], key: 'mostWeeklyHighScores' };
            let mostWeeklyTop2Scores = { value: -Infinity, teams: [], key: 'mostWeeklyTop2Scores' };
            let mostWinningSeasons = { value: -Infinity, teams: [], key: 'mostWinningSeasons' };
            let mostLosingSeasons = { value: -Infinity, teams: [], key: 'mostLosingSeasons' };
            let mostBlowoutWins = { value: -Infinity, teams: [], key: 'mostBlowoutWins' };
            let mostBlowoutLosses = { value: -Infinity, teams: [], key: 'mostBlowoutLosses' };
            let mostSlimWins = { value: -Infinity, teams: [], key: 'mostSlimWins' };
            let mostSlimLosses = { value: -Infinity, teams: [], key: 'mostSlimLosses' };
            let mostTotalPoints = { value: -Infinity, teams: [], key: 'mostTotalPoints' };
            let mostPointsAgainst = { value: -Infinity, teams: [], key: 'mostPointsAgainst' };

            calculatedCareerDPRs.forEach(careerStats => {
                const teamName = careerStats.teamName;
                const ownerId = careerStats.ownerId;

                if (careerStats.dpr !== 0) {
                    updateRecord(highestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId: ownerId });
                    updateLowestRecord(lowestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId: ownerId });
                }

                if (careerStats.totalGames > 0) {
                    updateRecord(mostWins, careerStats.wins, { name: teamName, value: careerStats.wins, ownerId: ownerId });
                    updateRecord(mostLosses, careerStats.losses, { name: teamName, value: careerStats.losses, ownerId: ownerId });
                    updateRecord(bestWinPct, careerStats.winPercentage, { name: teamName, value: careerStats.winPercentage, ownerId: ownerId });
                    updateRecord(mostTotalPoints, careerStats.pointsFor, { name: teamName, value: careerStats.pointsFor, ownerId: ownerId });
                    updateRecord(mostPointsAgainst, careerStats.pointsAgainst, { name: teamName, value: careerStats.pointsAgainst, ownerId: ownerId });
                    updateRecord(mostBlowoutWins, careerStats.blowoutWins, { name: teamName, value: careerStats.blowoutWins, ownerId: ownerId });
                    updateRecord(mostBlowoutLosses, careerStats.blowoutLosses, { name: teamName, value: careerStats.blowoutLosses, ownerId: ownerId });
                    updateRecord(mostSlimWins, careerStats.slimWins, { name: teamName, value: careerStats.slimWins, ownerId: ownerId });
                    updateRecord(mostSlimLosses, careerStats.slimLosses, { name: teamName, value: careerStats.slimLosses, ownerId: ownerId });
                    updateRecord(mostWeeklyTop2Scores, careerStats.weeklyTop2ScoresCount, { name: teamName, value: careerStats.weeklyTop2ScoresCount, ownerId: ownerId });
                    updateRecord(mostWeeklyHighScores, careerStats.topScoreWeeksCount, { name: teamName, value: careerStats.topScoreWeeksCount, ownerId: ownerId });
                    updateRecord(bestAllPlayWinPct, careerStats.allPlayWinPercentage, { name: teamName, value: careerStats.allPlayWinPercentage, ownerId: ownerId });
                }

                let winningSeasonsCount = 0;
                let losingSeasonsCount = 0;

                Object.keys(seasonalMetrics).forEach(year => {
                    const teamsInSeason = Object.values(seasonalMetrics[year]);
                    const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                    if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
                        if (currentOwnerTeamInSeason.winPercentage > 0.5) {
                            winningSeasonsCount++;
                        } else if (currentOwnerTeamInSeason.winPercentage < 0.5) {
                            losingSeasonsCount++;
                        }
                    }
                });
                updateRecord(mostWinningSeasons, winningSeasonsCount, { name: teamName, value: winningSeasonsCount, ownerId: ownerId });
                updateRecord(mostLosingSeasons, losingSeasonsCount, { name: teamName, value: losingSeasonsCount, ownerId: ownerId });
            });

            setAllTimeRecords({
                highestDPR,
                lowestDPR,
                mostWins,
                mostLosses,
                bestWinPct,
                bestAllPlayWinPct,
                mostWeeklyHighScores,
                mostWeeklyTop2Scores,
                mostWinningSeasons,
                mostLosingSeasons,
                mostBlowoutWins,
                mostBlowoutLosses,
                mostSlimWins,
                mostSlimLosses,
                mostTotalPoints,
                mostPointsAgainst,
            });

        } catch (error) {
            console.error("Error calculating league records:", error);
            setAllTimeRecords({});
            setRecordHistory({});
        } finally {
            setIsLoading(false);
        }
    }, [historicalData, allDraftHistory, getTeamName, loading, error, nflState]);

    if (isLoading) {
        return <div className="text-center py-8">Loading all-time league records...</div>;
    }

    if (Object.keys(allTimeRecords).length === 0 || allTimeRecords.highestDPR?.value === -Infinity) {
        return <div className="text-center py-8">No historical data available to calculate all-time records.</div>;
    }

    const getDisplayTeamName = (team) => {
        if (team.ownerId) {
            return getTeamName(team.ownerId, null);
        } else if (team.rosterId && team.year) {
            const rosterForYear = historicalData.rostersBySeason?.[team.year]?.find(r => String(r.roster_id) === String(team.rosterId));
            if (rosterForYear?.owner_id) {
                return getTeamName(rosterForYear.owner_id, null);
            }
        }
        return "Unknown Team";
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                        🌍
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">All-Time League Records</h3>
                        <p className="text-gray-600 mt-1 text-sm sm:text-base">
                            Career-spanning achievements and historical league data.
                        </p>
                    </div>
                </div>
            </div>

            {/* Records Display */}
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">🏆</span> Record
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">📊</span> Value
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">👑</span> Holder(s)
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {Object.entries(allTimeRecords).map(([key, record], recordGroupIndex) => {
                                const config = formatConfig[record.key] || { decimals: 2, type: 'default' };
                                const getLabel = () => {
                                    let label = record.key.replace(/([A-Z])/g, ' $1').trim();
                                    return label.charAt(0).toUpperCase() + label.slice(1);
                                };

                                if (!record || record.value === -Infinity || record.value === Infinity || !record.teams || record.teams.length === 0) {
                                    return (
                                        <tr key={key} className={`transition-all duration-200 hover:bg-blue-50 ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{getLabel()}</span>
                                                </div>
                                            </td>
                                            <td colSpan="2" className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <span className="text-gray-500 text-xs sm:text-sm italic">No data available</span>
                                            </td>
                                        </tr>
                                    );
                                }

                                const topFiveData = topFiveRankings[record.key] || [];
                                const isExpanded = expandedSections[record.key];

                                return (
                                    <React.Fragment key={key}>
                                        <tr className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{getLabel()}</span>
                                                    {topFiveData.length > 0 && (
                                                        <button
                                                            onClick={() => toggleSection(record.key)}
                                                            className="text-blue-600 hover:text-blue-800 transition-colors"
                                                        >
                                                            <svg 
                                                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                                fill="none" 
                                                                stroke="currentColor" 
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-green-100 to-teal-100 border border-green-200">
                                                    <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                        {config.type === 'percentage'
                                                            ? (record.value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%'
                                                            : record.value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex flex-col space-y-1 sm:space-y-2">
                                                    {record.teams.map((team, index) => (
                                                        <div key={index} className="flex items-center gap-2 sm:gap-3 bg-gray-100 rounded-lg p-1.5 sm:p-2 border border-gray-200">
                                                            <span className="font-medium text-gray-800 text-xs sm:text-sm truncate">{getDisplayTeamName(team)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && topFiveData.length > 0 && (
                                            <tr className="bg-blue-50/50">
                                                <td colSpan="3" className="py-3 px-3 sm:py-4 sm:px-6">
                                                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                                                        <h4 className="font-semibold text-gray-800 text-xs sm:text-sm mb-3">Top 5 Rankings</h4>
                                                        <div className="space-y-2">
                                                            {topFiveData.map((team, index) => (
                                                                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                                                            {index + 1}
                                                                        </span>
                                                                        <span className="font-medium text-gray-800 text-xs sm:text-sm">{team.name}</span>
                                                                    </div>
                                                                    <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                                        {config.type === 'percentage'
                                                                            ? (team.value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%'
                                                                            : team.value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LeagueRecords;
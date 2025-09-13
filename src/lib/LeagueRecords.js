import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';

const LeagueRecords = () => {
    const { historicalData, allDraftHistory, getTeamName, getTeamDetails, currentSeason, loading, error } = useSleeperData();
    const [allTimeRecords, setAllTimeRecords] = useState({});
    const [recordHistory, setRecordHistory] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'detailed'

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

    useEffect(() => {
        setIsLoading(true);

        if (loading || error || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
            setAllTimeRecords({});
            setRecordHistory({});
            setIsLoading(false);
            return;
        }

        try {
            const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName);
            
            // Calculate historical progression
            const history = calculateRecordHistory(seasonalMetrics);
            setRecordHistory(history);
            
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
    }, [historicalData, allDraftHistory, getTeamName, loading, error]);

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
        <div className="p-8">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                        🌍
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-gray-900">All-Time League Records</h3>
                        <p className="text-gray-600 mt-1">
                            Career-spanning achievements and historical league data.
                        </p>
                    </div>
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setViewMode('table')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            viewMode === 'table' 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Table View
                    </button>
                    <button
                        onClick={() => setViewMode('detailed')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            viewMode === 'detailed' 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Detailed View
                    </button>
                </div>
            </div>

            {/* Records Display */}
            {viewMode === 'table' ? (
                /* Table View */
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                                <th className="py-4 px-6 text-left text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-2">
                                        🏆 Record
                                    </div>
                                </th>
                                <th className="py-4 px-6 text-center text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-2">
                                        📊 Value
                                    </div>
                                </th>
                                <th className="py-4 px-6 text-left text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-2">
                                        👑 Holder(s)
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
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold text-gray-900 text-sm">{getLabel()}</span>
                                                </div>
                                            </td>
                                            <td colSpan="2" className="py-4 px-6 text-center">
                                                <span className="text-gray-500 text-sm italic">No data available</span>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr
                                        key={key}
                                        className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                                    >
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-gray-900 text-sm">{getLabel()}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-100 to-teal-100 border border-green-200">
                                                <span className="font-bold text-gray-900 text-sm">
                                                    {config.type === 'percentage'
                                                        ? (record.value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%'
                                                        : record.value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col space-y-2">
                                                {record.teams.map((team, index) => (
                                                    <div key={index} className="flex items-center gap-3 bg-gray-100 rounded-lg p-2 border border-gray-200">
                                                        <span className="font-medium text-gray-800 text-sm">{getDisplayTeamName(team)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            ) : (
                /* Detailed View */
                <div className="space-y-8">
                    {Object.entries(allTimeRecords).map(([key, record], recordGroupIndex) => {
                        const config = formatConfig[record.key] || { decimals: 2, type: 'default' };
                        const getLabel = () => {
                            let label = record.key.replace(/([A-Z])/g, ' $1').trim();
                            return label.charAt(0).toUpperCase() + label.slice(1);
                        };

                        if (!record || record.value === -Infinity || record.value === Infinity || !record.teams || record.teams.length === 0) {
                            return null;
                        }

                        return (
                            <div key={key} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                {/* Record Header */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-2xl font-bold text-gray-900">{getLabel()}</h3>
                                            <div className="text-4xl font-bold text-blue-600 mt-2">
                                                {config.type === 'percentage' 
                                                    ? `${(record.value * 100).toFixed(config.decimals)}%` 
                                                    : config.type === 'decimal' 
                                                    ? record.value.toFixed(config.decimals) 
                                                    : config.type === 'points' 
                                                    ? record.value.toFixed(config.decimals) 
                                                    : Math.round(record.value).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1">{getLabel()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-gray-500">Current Holder</div>
                                            <div className="font-semibold text-gray-900">
                                                {record.teams[0] ? getTeamName(record.teams[0].ownerId, record.teams[0].year || currentSeason) : 'Unknown'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Current Rankings */}
                                <div className="p-6">
                                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Current Rankings</h4>
                                    <div className="space-y-3">
                                        {record.teams.slice(0, 10).map((team, index) => {
                                            const teamName = getTeamName(team.ownerId, team.year || currentSeason);
                                            const teamDetails = getTeamDetails ? getTeamDetails(team.ownerId, currentSeason || team.year) : null;
                                            
                                            return (
                                                <div key={`${team.ownerId}-${index}`} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                                                            #{index + 1}
                                                        </div>
                                                        {teamDetails?.avatar && (
                                                            <img 
                                                                src={teamDetails.avatar}
                                                                alt={teamName}
                                                                className="w-8 h-8 rounded-full"
                                                                onError={(e) => { 
                                                                    e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; 
                                                                }}
                                                            />
                                                        )}
                                                        <span className="font-medium text-gray-900">{teamName}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-semibold text-gray-900">
                                                            {config.type === 'percentage' 
                                                                ? `${(record.value * 100).toFixed(config.decimals)}%` 
                                                                : config.type === 'decimal' 
                                                                ? record.value.toFixed(config.decimals) 
                                                                : config.type === 'points' 
                                                                ? record.value.toFixed(config.decimals) 
                                                                : Math.round(record.value).toLocaleString()}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {index === 0 ? '---' : `${index === 1 ? '-1' : index === 2 ? '1' : '---'}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Record Description */}
                                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-gray-700">
                                            This record honors the team with the {getLabel().toLowerCase()} in league history. 
                                            It reflects sustained excellence and competitive performance across multiple seasons.
                                        </p>
                                    </div>

                                    {/* Record Statistics */}
                                    <div className="mt-6 grid grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-gray-900">
                                                {record.teams[0] ? getTeamName(record.teams[0].ownerId, record.teams[0].year || currentSeason) : 'Unknown'}
                                            </div>
                                            <div className="text-sm text-gray-500">Current Holder Since</div>
                                            <div className="text-xl font-semibold text-blue-600">
                                                {recordHistory[record.key]?.allTimeHolders?.length > 0 
                                                    ? `${recordHistory[record.key].allTimeHolders[recordHistory[record.key].allTimeHolders.length - 1].year || 'Unknown'}`
                                                    : 'Unknown'
                                                }
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl font-semibold text-blue-600">
                                                {recordHistory[record.key]?.recordHistory?.length || 0}
                                            </div>
                                            <div className="text-sm text-gray-500">Times Record Broken</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl font-semibold text-blue-600">{record.teams.length}</div>
                                            <div className="text-sm text-gray-500"># All-Time Holders</div>
                                        </div>
                                    </div>

                                    {/* All-Time Holders History */}
                                    <div className="mt-6">
                                        <h4 className="text-lg font-semibold text-gray-900 mb-4">All-Time Holders History</h4>
                                        {recordHistory[record.key]?.allTimeHolders?.length > 0 ? (
                                            <div className="space-y-2">
                                                {recordHistory[record.key].allTimeHolders.map((holder, index) => {
                                                    const isCurrentHolder = index === recordHistory[record.key].allTimeHolders.length - 1;
                                                    const nextHolder = recordHistory[record.key].allTimeHolders[index + 1];
                                                    const endYear = nextHolder ? nextHolder.year : 'PRESENT';
                                                    const years = nextHolder ? (Number(nextHolder.year) - Number(holder.year)) : (Number(currentSeason) - Number(holder.year) + 1);
                                                    
                                                    return (
                                                        <div key={`${holder.ownerId}-${holder.year}-${index}`} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                                                            <div>
                                                                <span className="font-medium text-gray-900">{holder.name}</span>
                                                                <span className="text-gray-600 ml-2">
                                                                    {holder.year} - {endYear}
                                                                </span>
                                                                <span className="text-gray-500 ml-2">
                                                                    ({years} {years === 1 ? 'year' : 'years'})
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-semibold text-gray-900">
                                                                    {config.type === 'percentage' 
                                                                        ? `${(holder.value * 100).toFixed(config.decimals)}%` 
                                                                        : config.type === 'decimal' 
                                                                        ? holder.value.toFixed(config.decimals) 
                                                                        : config.type === 'points' 
                                                                        ? holder.value.toFixed(config.decimals) 
                                                                        : Math.round(holder.value).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-gray-500">
                                                No historical data available for this record.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LeagueRecords;
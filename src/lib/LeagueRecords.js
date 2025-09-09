import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';

const LeagueRecords = () => {
    const { historicalData, allDraftHistory, getTeamName, loading, error } = useSleeperData();
    const [allTimeRecords, setAllTimeRecords] = useState({});
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

    useEffect(() => {
        setIsLoading(true);

        if (loading || error || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
            setAllTimeRecords({});
            setIsLoading(false);
            return;
        }

        try {
            const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName);
            
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
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">ALL-TIME LEAGUE RECORD HOLDERS</h3>
            <p className="text-sm text-gray-600 mb-6">Historical league performance records.</p>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/2">Team</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(allTimeRecords).map(([key, record], recordGroupIndex) => {
                            const config = formatConfig[record.key] || { decimals: 2, type: 'default' };
                            const getLabel = () => {
                                let label = record.key.replace(/([A-Z])/g, ' $1').trim();
                                if (label.length > 0) {
                                    label = label.charAt(0).toUpperCase() + label.slice(1);
                                }
                                return label;
                            };
                            if (!record || record.value === -Infinity || record.value === Infinity || !record.teams || record.teams.length === 0) {
                                return (
                                    <tr key={key} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{getLabel()}</td>
                                        <td className="py-2 px-3 text-sm text-gray-800 text-center">N/A</td>
                                        <td className="py-2 px-3 text-sm text-gray-700"></td>
                                    </tr>
                                );
                            }
                            return record.teams.map((team, entryIndex) => (
                                <tr key={`${key}-${getDisplayTeamName(team)}-${entryIndex}`} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{entryIndex === 0 ? getLabel() : ''}</td>
                                    <td className="py-2 px-3 text-sm text-gray-800 text-center">
                                        {entryIndex === 0 ? (config.type === 'percentage' ? (team.value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%' : team.value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })) : ''}
                                    </td>
                                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{getDisplayTeamName(team)}</td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LeagueRecords;
// src/lib/PlayoffRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData context hook
import logger from '../utils/logger';

const PlayoffRecords = ({ historicalMatchups }) => { // Removed getDisplayTeamName from props as it's now from context
  const { historicalData, getTeamName, loading, error } = useSleeperData(); // Get historicalData and getTeamName from context
  const [aggregatedPlayoffRecords, setAggregatedPlayoffRecords] = useState({});
  
  // State for collapsible sections
  const [expandedSections, setExpandedSections] = useState({});
  const [allPlayoffData, setAllPlayoffData] = useState({});

  // Toggle function for expanding/collapsing sections
  const toggleSection = (key) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  useEffect(() => {
    if (loading || error || !historicalMatchups || historicalMatchups.length === 0 || !historicalData || !historicalData.rostersBySeason) {
      setAggregatedPlayoffRecords({});
      setAllPlayoffData({});
      return;
    }

    // Initialize collection for all playoff data
    const tempAllPlayoffData = {
      mostPlayoffAppearances: [],
      mostPlayoffWins: [],
      mostPlayoffLosses: [],
      bestPlayoffWinPercentage: [],
      worstPlayoffWinPercentage: [],
      mostPlayoffPointsFor: [],
      mostPlayoffPointsAgainst: [],
      mostChampionships: [],
      mostFirstPlaceFinishes: [],
      mostSecondPlaceFinishes: [],
      mostThirdPlaceFinishes: []
    };

    // Helper function to add data to all playoff data collection
    const addToAllPlayoffData = (recordKey, value, teamInfo) => {
      if (typeof value === 'number' && !isNaN(value) && tempAllPlayoffData[recordKey]) {
        tempAllPlayoffData[recordKey].push({
          ...teamInfo,
          value: value
        });
      }
    };

    // teamPlayoffStats will now be keyed by ownerId for consistent aggregation
    const teamPlayoffStats = {}; // { ownerId: { appearances: Set<year>, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, medals: { 1: 0, 2: 0, 3: 0 }, championships: 0 } }

    historicalMatchups.forEach((match, index) => {
      const year = parseInt(match.year);
      const team1RosterId = String(match.team1_roster_id);
      const team2RosterId = String(match.team2_roster_id);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Get owner IDs for consistent tracking across seasons
      const rosterForTeam1 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId);
      const team1OwnerId = rosterForTeam1?.owner_id;
      const rosterForTeam2 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId);
      const team2OwnerId = rosterForTeam2?.owner_id;

      // Basic validation for any playoff match
      if (!team1OwnerId || !team2OwnerId || isNaN(year) || isNaN(team1Score) || isNaN(team2Score) || !match.playoffs) {
        logger.warn(`PlayoffRecords useEffect: Skipping match ${index} due to invalid data, not a playoff game, or missing owner IDs. Match:`, match, `Team1 Owner: ${team1OwnerId}, Team2 Owner: ${team2OwnerId}`);
        return;
      }

      // Initialize team stats if not present for any owner involved in a playoff game
      [team1OwnerId, team2OwnerId].forEach(ownerId => {
        if (!teamPlayoffStats[ownerId]) {
          teamPlayoffStats[ownerId] = {
            appearances: new Set(),
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            medals: { 1: 0, 2: 0, 3: 0 },
            championships: 0
          };
        }
      });

      // --- Track Playoff Appearances (ONLY for Winners Bracket games) ---
      // An appearance is counted if they played in a winners bracket playoff game in a season.
      if (match.isWinnersBracket) {
        teamPlayoffStats[team1OwnerId].appearances.add(year);
        teamPlayoffStats[team2OwnerId].appearances.add(year);
        logger.debug(`PlayoffRecords: Counting appearance for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) and Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) in ${year} (Winners Bracket). Match:`, match);
      } else if (match.isLosersBracket) {
          logger.debug(`PlayoffRecords: NOT counting appearance for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) and Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) in ${year} (Losers Bracket). Match:`, match);
      }


      // --- Track Wins/Losses/Ties, Points For/Against, Medals, Championships (ONLY for Winners Bracket games) ---
      if (match.isWinnersBracket) {
        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (isTie) {
          teamPlayoffStats[team1OwnerId].ties++;
          teamPlayoffStats[team2OwnerId].ties++;
        } else if (team1Won) {
          teamPlayoffStats[team1OwnerId].wins++;
          teamPlayoffStats[team2OwnerId].losses++;
        } else { // team2Won
          teamPlayoffStats[team2OwnerId].wins++;
          teamPlayoffStats[team1OwnerId].losses++;
        }

        teamPlayoffStats[team1OwnerId].pointsFor += team1Score;
        teamPlayoffStats[team1OwnerId].pointsAgainst += team2Score;
        teamPlayoffStats[team2OwnerId].pointsFor += team2Score;
        teamPlayoffStats[team2OwnerId].pointsAgainst += team1Score;

  logger.debug(`PlayoffRecords: Processing winners bracket stats for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) vs Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}). Match:`, match);

        // Handle Medals and Championships based on finalSeedingGame
        if (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0) {
          let winnerOwnerId = '';
          let loserOwnerId = '';
          if (team1Won) {
            winnerOwnerId = team1OwnerId;
            loserOwnerId = team2OwnerId;
          } else if (team2Score > team1Score) {
            winnerOwnerId = team2OwnerId;
            loserOwnerId = team1OwnerId;
          }

          const finalPlacement = match.finalSeedingGame;

          if (finalPlacement === 1) { // Championship Game
            if (winnerOwnerId) {
              teamPlayoffStats[winnerOwnerId].medals[1]++;
              teamPlayoffStats[winnerOwnerId].championships++;
              if (loserOwnerId) {
                teamPlayoffStats[loserOwnerId].medals[2]++;
              }
            }
          } else if (finalPlacement === 3) { // 3rd Place Game
            if (winnerOwnerId) {
              teamPlayoffStats[winnerOwnerId].medals[3]++;
            }
          }
          // Can add logic for other final placements (e.g., 5th place) if desired
        }
    } else if (match.isLosersBracket) {
      logger.debug(`PlayoffRecords: Skipping losers bracket stats for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) vs Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) (only counting appearance). Match:`, match);
    }
    });

    // --- DEBUGGING: Log aggregated playoff stats for each team ---
    logger.debug("PlayoffRecords: Aggregated Playoff Stats Per Team:");
    Object.entries(teamPlayoffStats).forEach(([ownerId, stats]) => {
      // Use getTeamName(ownerId, null) to get the most current team name for display
      const currentTeamName = getTeamName(ownerId, null);
      logger.debug(`  Team: ${currentTeamName} (Owner ID: ${ownerId})`);
      logger.debug(`    Playoff Appearances: ${stats.appearances.size} (Years: ${Array.from(stats.appearances).join(', ')})`);
      logger.debug(`    Wins: ${stats.wins}`);
      logger.debug(`    Losses: ${stats.losses}`);
      logger.debug(`    Ties: ${stats.ties}`);
      logger.debug(`    Points For: ${stats.pointsFor.toFixed(2)}`);
      logger.debug(`    Points Against: ${stats.pointsAgainst.toFixed(2)}`);
      logger.debug(`    Championships: ${stats.championships}`);
      logger.debug(`    2nd Place Finishes: ${stats.medals[2]}`);
      logger.debug(`    3rd Place Finishes: ${stats.medals[3]}`);
    });
    // --- END DEBUGGING ---


    // Initialize aggregated records for top performers
    const newAggregatedRecords = {
      mostPlayoffAppearances: { value: 0, entries: [] }, // team, appearances
      mostPlayoffWins: { value: 0, entries: [] }, // team, wins
      totalPlayoffPoints: { value: 0, entries: [] }, // team, points
      mostPlayoffPointsAgainst: { value: 0, entries: [] },
      mostChampionships: { value: 0, entries: [] }, // team, championships
      most2ndPlaceFinishes: { value: 0, entries: [] }, // team, 2nd places
      most3rdPlaceFinishes: { value: 0, entries: [] }, // team, 3rd places
    };

    // Helper to update a record (max/min)
    const updateRecord = (recordObj, newValue, entryDetails, isMin = false) => {
      if (typeof newValue !== 'number' || isNaN(newValue)) return; // Ensure value is a number

      if (isMin) {
        if (newValue < recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          // Prevent duplicates for ties
          if (!recordObj.entries.some(e => e.team === entryDetails.team)) {
            recordObj.entries.push(entryDetails);
          }
        }
      } else { // Max
        if (newValue > recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          // Prevent duplicates for ties
          if (!recordObj.entries.some(e => e.team === entryDetails.team)) {
            recordObj.entries.push(entryDetails);
          }
        }
      }
    };

    // Populate aggregated records from teamPlayoffStats
    Object.keys(teamPlayoffStats).forEach(ownerId => { // Iterate through ownerIds
      const stats = teamPlayoffStats[ownerId];
      const currentTeamName = getTeamName(ownerId, null); // Get the current team name for display

      const appearancesEntry = { team: currentTeamName, appearances: stats.appearances.size };
      const winsEntry = { team: currentTeamName, wins: stats.wins };
      const pointsEntry = { team: currentTeamName, points: stats.pointsFor };
      const pointsAgainstEntry = { team: currentTeamName, pointsAgainst: stats.pointsAgainst };
      const championshipsEntry = { team: currentTeamName, championships: stats.championships };
      const secondPlaceEntry = { team: currentTeamName, place: stats.medals[2] };
      const thirdPlaceEntry = { team: currentTeamName, place: stats.medals[3] };

      updateRecord(newAggregatedRecords.mostPlayoffAppearances, stats.appearances.size, appearancesEntry);
      updateRecord(newAggregatedRecords.mostPlayoffWins, stats.wins, winsEntry);
      updateRecord(newAggregatedRecords.totalPlayoffPoints, stats.pointsFor, pointsEntry);
      updateRecord(newAggregatedRecords.mostPlayoffPointsAgainst, stats.pointsAgainst, pointsAgainstEntry);
      updateRecord(newAggregatedRecords.mostChampionships, stats.championships, championshipsEntry);
      updateRecord(newAggregatedRecords.most2ndPlaceFinishes, stats.medals[2], secondPlaceEntry);
      updateRecord(newAggregatedRecords.most3rdPlaceFinishes, stats.medals[3], thirdPlaceEntry);

      // Add to all playoff data for top 5 rankings
      addToAllPlayoffData('mostPlayoffAppearances', stats.appearances.size, appearancesEntry);
      addToAllPlayoffData('mostPlayoffWins', stats.wins, winsEntry);
      addToAllPlayoffData('mostPlayoffPointsFor', stats.pointsFor, pointsEntry);
      addToAllPlayoffData('mostPlayoffPointsAgainst', stats.pointsAgainst, pointsAgainstEntry);
      addToAllPlayoffData('mostChampionships', stats.championships, championshipsEntry);
      addToAllPlayoffData('mostFirstPlaceFinishes', stats.championships, championshipsEntry);
      addToAllPlayoffData('mostSecondPlaceFinishes', stats.medals[2], secondPlaceEntry);
      addToAllPlayoffData('mostThirdPlaceFinishes', stats.medals[3], thirdPlaceEntry);
    });

    // Clean up: filter out initial -Infinity/Infinity values, sort entries
    Object.keys(newAggregatedRecords).forEach(key => {
        const record = newAggregatedRecords[key];
        // If a record has -Infinity or Infinity value and no entries, it means no valid record was found
        if ((record.value === -Infinity || record.value === Infinity) && record.entries.length === 0) {
            record.value = 0; // Default to 0 for display if no data
            record.entries = [];
        } else if (record.value === Infinity) { // If it's still Infinity, means no data, set to N/A for display
            record.value = 'N/A';
        }

        // Sort entries consistently for tied records
        if (record.entries.length > 1) {
            record.entries.sort((a, b) => {
                const teamCompare = (a.team || '').localeCompare(b.team || '');
                if (teamCompare !== 0) return teamCompare;
                // If teams are the same, order by value (desc for most, asc for lowest)
                // The value to compare depends on the record key, e.g., 'appearances', 'wins', 'points', etc.
                let valueA, valueB;
                if (key === 'mostPlayoffAppearances') {
                    valueA = a.appearances;
                    valueB = b.appearances;
                } else if (key === 'mostPlayoffWins') {
                    valueA = a.wins;
                    valueB = b.wins;
                } else if (key === 'totalPlayoffPoints') {
                    valueA = a.points;
                    valueB = b.points;
                } else if (key === 'mostPlayoffPointsAgainst') {
                    valueA = a.pointsAgainst;
                    valueB = b.pointsAgainst;
                } else if (key === 'mostChampionships') {
                    valueA = a.championships;
                    valueB = b.championships;
                } else if (key === 'most2ndPlaceFinishes' || key === 'most3rdPlaceFinishes') {
                    valueA = a.place;
                    valueB = b.place;
                } else {
                    valueA = a.value; // Fallback to general 'value' if specific key not found
                    valueB = b.value;
                }

                if (typeof valueA === 'number' && typeof valueB === 'number') {
                    return valueB - valueA; // Always descending for "most" records
                }
                return 0;
            });
        }
    });

    setAggregatedPlayoffRecords(newAggregatedRecords);
    setAllPlayoffData(tempAllPlayoffData);
  }, [historicalMatchups, historicalData, getTeamName, loading, error]); // Add historicalData, loading, error to dependencies

  // Helper to format values for display
  const formatDisplayValue = (value, recordKey) => {
    if (typeof value === 'number') {
      if (recordKey === 'mostPlayoffAppearances' || recordKey === 'mostPlayoffWins') {
        return value; // Whole number for counts
      } else if (recordKey === 'totalPlayoffPoints' || recordKey === 'mostPlayoffPointsAgainst') {
        return value.toFixed(2); // Two decimal places for points
      } else {
        return value; // Default fallback
      }
    }
    return value; // For non-numeric values, return as is
  };

  const recordsToDisplay = [
    { key: 'mostPlayoffAppearances', label: 'Most Playoff Appearances' },
    { key: 'mostPlayoffWins', label: 'Most Playoff Wins' },
    { key: 'totalPlayoffPoints', label: 'Total Playoff Points For' },
    { key: 'mostPlayoffPointsAgainst', label: 'Most Playoff Points Against Total' },
    { key: 'mostChampionships', label: 'Most Championships' },
    { key: 'most2ndPlaceFinishes', label: 'Most 2nd Place Finishes' },
    { key: 'most3rdPlaceFinishes', label: 'Most 3rd Place Finishes' },
  ];

  // Render component
  return (
    <div className="p-4 sm:p-6 lg:p-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                    🏆
                </div>
                <div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">All-Time Playoff Records</h3>
                    <p className="text-gray-600 mt-1 text-sm sm:text-base">
                        Historical playoff performance and championship accolades.
                    </p>
                </div>
            </div>
        </div>

        {/* Records Table */}
        {Object.keys(aggregatedPlayoffRecords).length === 0 || recordsToDisplay.every(r => aggregatedPlayoffRecords[r.key]?.entries.length === 0) ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-200">
                <div className="text-4xl mb-4">🤷‍♂️</div>
                <h4 className="text-xl font-semibold text-gray-800">No Playoff Data Available</h4>
                <p className="text-gray-500">Cannot display records without historical playoff data.</p>
            </div>
        ) : (
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">�</span> Record
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
                            {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                                const recordData = aggregatedPlayoffRecords[recordDef.key];
                                const isExpanded = expandedSections[recordDef.key];
                                
                                if (!recordData || recordData.entries.length === 0) {
                                    return (
                                        <React.Fragment key={recordDef.key}>
                                            <tr className={`transition-all duration-200 hover:bg-blue-50 ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                                <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{recordDef.label}</span>
                                                </td>
                                                <td colSpan="2" className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                    <span className="text-gray-500 text-xs sm:text-sm italic">No data available</span>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                }

                                return (
                                    <React.Fragment key={recordDef.key}>
                                        <tr className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{recordDef.label}</span>
                                                    <button
                                                        onClick={() => toggleSection(recordDef.key)}
                                                        className="ml-2 p-1 rounded-md hover:bg-gray-200 transition-colors"
                                                        aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5 for ${recordDef.label}`}
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
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200">
                                                    <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                        {formatDisplayValue(recordData.value, recordDef.key)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex flex-col space-y-1 sm:space-y-2">
                                                    {recordData.entries.map((entry, index) => (
                                                        <div key={index} className="flex items-center gap-2 sm:gap-3 bg-gray-100 rounded-lg p-1.5 sm:p-2 border border-gray-200">
                                                            <span className="font-medium text-gray-800 text-xs sm:text-sm truncate">{entry.team}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                        
                                        {/* Collapsible Top 5 Section */}
                                        {isExpanded && allPlayoffData[recordDef.key] && allPlayoffData[recordDef.key].length > 0 && (
                                            <tr className={`${recordGroupIndex % 2 === 0 ? 'bg-gray-50' : 'bg-gray-75'}`}>
                                                <td colSpan="3" className="p-0">
                                                    <div className="px-3 py-4 sm:px-6 sm:py-6">
                                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                            Top 5 {recordDef.label}
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {allPlayoffData[recordDef.key]
                                                                .sort((a, b) => b.value - a.value)
                                                                .slice(0, 5)
                                                                .map((playoffData, index) => (
                                                                    <div key={`${playoffData.team}-${playoffData.value}-${index}`} 
                                                                         className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-200">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                                                                {index + 1}
                                                                            </span>
                                                                            <span className="font-medium text-gray-900 text-sm">{playoffData.team}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            <span className="font-bold text-gray-900">{formatDisplayValue(playoffData.value, recordDef.key)}</span>
                                                                        </div>
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
        )}
    </div>
);
};

export default PlayoffRecords;

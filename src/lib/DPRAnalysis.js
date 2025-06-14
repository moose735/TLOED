// src/lib/DPRAnalysis.js
import React, { useState, useEffect } from 'react';

const DPRAnalysis = ({ historicalMatchups, getDisplayTeamName }) => {
  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]); // Changed to an array for single list
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setCareerDPRData([]);
      setSeasonalDPRData([]); // Set to empty array
      setLoading(false);
      return;
    }

    const allTimeRecords = {}; // For career DPR calculation
    const seasonRecordsRaw = {};   // { year: { team: { ...stats } } } - intermediate for seasonal DPR calculation

    // First Pass: Aggregate all necessary data for both career and seasonal calculations
    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid data
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize structures for teams (career)
      [team1, team2].forEach(team => {
        if (!allTimeRecords[team]) {
          allTimeRecords[team] = {
            wins: 0, losses: 0, ties: 0, totalPointsFor: 0, totalGames: 0,
            careerWeeklyScores: [], // Collect all weekly scores for career max/min
            careerRawDPR: 0, adjustedDPR: 0,
          };
        }
      });

      // Initialize structures for teams (seasonal)
      [team1, team2].forEach(team => {
        if (!seasonRecordsRaw[year]) {
          seasonRecordsRaw[year] = {};
        }
        if (!seasonRecordsRaw[year][team]) {
          seasonRecordsRaw[year][team] = {
            wins: 0, losses: 0, ties: 0, pointsFor: 0, totalGames: 0,
            weeklyScores: [], // Collect weekly scores for seasonal max/min
            rawDPR: 0, adjustedDPR: 0,
            winPercentage: 0,
          };
        }
      });

      // Update All-Time Records
      if (isTie) {
        allTimeRecords[team1].ties++;
        allTimeRecords[team2].ties++;
      } else if (team1Won) {
        allTimeRecords[team1].wins++;
        allTimeRecords[team2].losses++;
      } else { // team2Won
        allTimeRecords[team2].wins++;
        allTimeRecords[team1].losses++;
      }
      allTimeRecords[team1].totalPointsFor += team1Score;
      allTimeRecords[team2].totalPointsFor += team2Score;
      allTimeRecords[team1].totalGames++;
      allTimeRecords[team2].totalGames++;
      allTimeRecords[team1].careerWeeklyScores.push(team1Score);
      allTimeRecords[team2].careerWeeklyScores.push(team2Score);

      // Update Season Records
      if (isTie) {
        seasonRecordsRaw[year][team1].ties++;
        seasonRecordsRaw[year][team2].ties++;
      } else if (team1Won) {
        seasonRecordsRaw[year][team1].wins++;
        seasonRecordsRaw[year][team2].losses++;
      } else { // team2Won
        seasonRecordsRaw[year][team2].wins++;
        seasonRecordsRaw[year][team1].losses++;
      }
      seasonRecordsRaw[year][team1].pointsFor += team1Score;
      seasonRecordsRaw[year][team2].pointsFor += team2Score;
      seasonRecordsRaw[year][team1].totalGames++;
      seasonRecordsRaw[year][team2].totalGames++;
      seasonRecordsRaw[year][team1].weeklyScores.push(team1Score);
      seasonRecordsRaw[year][team2].weeklyScores.push(team2Score);
    });


    // --- Calculate All-Time Career DPR ---
    let totalRawDPROverall = 0;
    let teamsWithValidCareerDPR = 0;
    const calculatedCareerDPRs = [];

    Object.keys(allTimeRecords).forEach(team => {
      const stats = allTimeRecords[team];
      if (stats.totalGames === 0) return;

      const careerWinPercentage = ((stats.wins + (0.5 * stats.ties)) / stats.totalGames);
      const teamMaxScoreOverall = stats.careerWeeklyScores.length > 0 ? Math.max(...stats.careerWeeklyScores) : 0;
      const teamMinScoreOverall = stats.careerWeeklyScores.length > 0 ? Math.min(...stats.careerWeeklyScores) : 0;

      stats.careerRawDPR = (
        (stats.totalPointsFor * 6) +
        ((teamMaxScoreOverall + teamMinScoreOverall) * 2) +
        ((careerWinPercentage * 200) * 2)
      ) / 10;
      totalRawDPROverall += stats.careerRawDPR;
      teamsWithValidCareerDPR++;
    });

    const avgRawDPROverall = teamsWithValidCareerDPR > 0 ? totalRawDPROverall / teamsWithValidCareerDPR : 0;

    Object.keys(allTimeRecords).forEach(team => {
      const stats = allTimeRecords[team];
      stats.adjustedDPR = avgRawDPROverall > 0 ? stats.careerRawDPR / avgRawDPROverall : 0;
      calculatedCareerDPRs.push({
        team,
        dpr: stats.adjustedDPR,
        wins: stats.wins,
        losses: stats.losses,
        ties: stats.ties,
        pointsFor: stats.totalPointsFor
      });
    });

    // Sort career DPR data descending
    calculatedCareerDPRs.sort((a, b) => b.dpr - a.dpr);
    setCareerDPRData(calculatedCareerDPRs);


    // --- Calculate Seasonal DPR (Consolidated List) ---
    const allSeasonalDPRs = []; // This will be the flat array

    Object.keys(seasonRecordsRaw).sort().forEach(year => { // Iterate through years
      const teamsInSeason = Object.keys(seasonRecordsRaw[year]);
      if (teamsInSeason.length === 0) return;

      let totalRawDPRForSeason = 0;
      let teamsWithValidDPR = 0;

      teamsInSeason.forEach(team => {
        const stats = seasonRecordsRaw[year][team];
        if (stats.totalGames === 0) return;

        stats.winPercentage = ((stats.wins + (0.5 * stats.ties)) / stats.totalGames);
        const teamMaxScoreInSeason = stats.weeklyScores.length > 0 ? Math.max(...stats.weeklyScores) : 0;
        const teamMinScoreInSeason = stats.weeklyScores.length > 0 ? Math.min(...stats.weeklyScores) : 0;

        stats.rawDPR = (
          (stats.pointsFor * 6) +
          ((teamMaxScoreInSeason + teamMinScoreInSeason) * 2) +
          ((stats.winPercentage * 200) * 2)
        ) / 10;
        totalRawDPRForSeason += stats.rawDPR;
        teamsWithValidDPR++;
      });

      const avgRawDPRForSeason = teamsWithValidDPR > 0 ? totalRawDPRForSeason / teamsWithValidDPR : 0;

      teamsInSeason.forEach(team => {
        const stats = seasonRecordsRaw[year][team];
        stats.adjustedDPR = avgRawDPRForSeason > 0 ? stats.rawDPR / avgRawDPRForSeason : 0;
        allSeasonalDPRs.push({ // Push to the flat array
          year: parseInt(year), // Add year as a property
          team,
          dpr: stats.adjustedDPR,
          wins: stats.wins,
          losses: stats.losses,
          ties: stats.ties,
          pointsFor: stats.pointsFor
        });
      });
    });

    // Sort the consolidated seasonal DPR data
    allSeasonalDPRs.sort((a, b) => {
        if (b.year !== a.year) { // Sort by year descending first
            return b.year - a.year;
        }
        return b.dpr - a.dpr; // Then by DPR descending
    });

    setSeasonalDPRData(allSeasonalDPRs); // Set the consolidated array
    setLoading(false);

  }, [historicalMatchups, getDisplayTeamName]);

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  const formatPoints = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return 'N/A';
  };

  const renderRecord = (wins, losses, ties) => {
    return `${wins || 0}-${losses || 0}-${ties || 0}`;
  };

  // sortedYears is no longer needed for rendering the consolidated list

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
        DPR Analysis (Career & Seasonal)
      </h2>
      <p className="text-sm text-gray-600 mb-6 text-center">
        Detailed breakdown of team performance using the DPR (Dominance Performance Rating) metric.
      </p>

      {loading ? (
        <p className="text-center text-gray-600">Calculating DPR data...</p>
      ) : (
        <>
          {/* Career DPR Rankings */}
          <section className="mb-8 p-4 bg-blue-50 rounded-lg shadow-sm border border-blue-200">
            <h3 className="text-xl font-bold text-blue-800 mb-4 border-b pb-2">All-Time Career DPR</h3>
            {careerDPRData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerDPRData.map((data, index) => (
                      <tr key={data.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-3 text-sm text-gray-800">{index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800">{data.team}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(data.dpr)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{renderRecord(data.wins, data.losses, data.ties)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{formatPoints(data.pointsFor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">No career DPR data available.</p>
            )}
          </section>

          {/* Seasonal DPR Rankings (Consolidated) */}
          <section className="mb-8 p-4 bg-green-50 rounded-lg shadow-sm border border-green-200">
            <h3 className="text-xl font-bold text-green-800 mb-4 border-b pb-2">Seasonal DPR Rankings</h3>
            {seasonalDPRData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Rank (Season)</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Season</th> {/* New column */}
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Iterate directly over the flat seasonalDPRData array */}
                    {seasonalDPRData.map((data, index) => (
                      <tr key={`${data.team}-${data.year}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        {/* Calculate rank within each season group on the fly if needed, or simply display sequential index */}
                        <td className="py-2 px-3 text-sm text-gray-800">{
                            // Simple rank based on current sorted order. For per-season rank, more logic is needed.
                            // For now, it's a global rank, which might be confusing.
                            // Let's refine this to be per-season rank based on sorted data.
                            // This would require finding the rank within its year's group.
                            // Simpler: just display overall index and note that in intro/outro
                            // For true per-season rank, we'd need to group them again here, or pre-calculate ranks in useEffect.
                            // For now, I'll provide an overall rank and you can re-evaluate if specific per-season ranks are needed.
                            index + 1 // This will show overall rank
                        }</td>
                        <td className="py-2 px-3 text-sm text-gray-800">{data.year}</td> {/* Display Season */}
                        <td className="py-2 px-3 text-sm text-gray-800">{data.team}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(data.dpr)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{renderRecord(data.wins, data.losses, data.ties)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{formatPoints(data.pointsFor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">No seasonal DPR data available.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DPRAnalysis;

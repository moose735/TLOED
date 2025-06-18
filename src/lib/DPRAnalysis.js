// src/lib/DPRAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const DPRAnalysis = ({ historicalMatchups, getDisplayTeamName }) => {
  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setCareerDPRData([]);
      setSeasonalDPRData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use the centralized calculation logic
    const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    // Flatten seasonalMetrics into an array for display in the table
    const allSeasonalDPRs = [];
    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        allSeasonalDPRs.push({
          year: parseInt(year),
          team: team,
          dpr: seasonalMetrics[year][team].adjustedDPR,
          wins: seasonalMetrics[year][team].wins,
          losses: seasonalMetrics[year][team].losses,
          ties: seasonalMetrics[year][team].ties,
          pointsFor: seasonalMetrics[year][team].pointsFor
        });
      });
    });

    // Sort the consolidated seasonal DPR data by DPR descending
    allSeasonalDPRs.sort((a, b) => b.dpr - a.dpr);

    setCareerDPRData(calculatedCareerDPRs);
    setSeasonalDPRData(allSeasonalDPRs);
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
          <section className="mb-8"> {/* Removed background card styling classes */}
            <h3 className="text-xl font-bold text-blue-800 mb-4 border-b pb-2">All-Time Career DPR</h3>
            {careerDPRData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Rank</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Team</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Adjusted DPR</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Record (W-L-T)</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Points For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerDPRData.map((data, index) => (
                      <tr key={data.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.team}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{formatDPR(data.dpr)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{renderRecord(data.wins, data.losses, data.ties)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{formatPoints(data.pointsFor)}</td>
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
          <section className="mb-8"> {/* Removed background card styling classes */}
            <h3 className="text-xl font-bold text-green-800 mb-4 border-b pb-2">Seasonal DPR Rankings</h3>
            {seasonalDPRData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Rank (Overall)</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Season</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Team</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Adjusted DPR</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Record (W-L-T)</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Points For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonalDPRData.map((data, index) => (
                      <tr key={`${data.team}-${data.year}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.year}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.team}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{formatDPR(data.dpr)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{renderRecord(data.wins, data.losses, data.ties)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{formatPoints(data.pointsFor)}</td>
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

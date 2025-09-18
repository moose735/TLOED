// src/lib/LuckRatingAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook
import logger from '../utils/logger';

const LuckRatingAnalysis = ({ onTeamNameClick }) => {
  // Consume necessary data from context
  const {
    loading: contextLoading, // Rename to avoid conflict with local loading state
    error: contextError,     // Rename to avoid conflict with local error state
    historicalData,
    allDraftHistory, // Get allDraftHistory from context
    getTeamName,
    getTeamDetails,
    nflState // Get nflState from context
  } = useSleeperData();

  const [careerLuckData, setCareerLuckData] = useState([]); // New state for career luck data
  const [seasonalLuckData, setSeasonalLuckData] = useState([]); // New state for seasonal luck data
  const [loading, setLoading] = useState(true);
  const [showAllSeasonal, setShowAllSeasonal] = useState(false); // State for "Show More" seasonal data

  useEffect(() => {
    // If context is still loading or has an error, set local loading/error states accordingly
    if (contextLoading) {
      setLoading(true);
      return;
    }
    if (contextError) {
      setLoading(false);
      // You might want to display contextError message in the UI here as well
      return;
    }

    // Check if historicalData is available and has any matchup data
    if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
      setCareerLuckData([]);
      setSeasonalLuckData([]);
      setLoading(false);
      return;
    }

    // Add a defensive check to ensure getTeamName is a function
  if (typeof getTeamName !== 'function') {
    logger.error("LuckRatingAnalysis: getTeamName is not a function from SleeperDataContext. Cannot perform calculations.");
        setLoading(false);
        setCareerLuckData([]);
        setSeasonalLuckData([]);
        return;
    }

    setLoading(true);

    // Use the centralized calculation logic to get seasonal and career metrics
    // Pass historicalData, allDraftHistory, getTeamName, and nflState
    const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);

    const allSeasonalLuckRatings = [];
    const currentNFLSeason = nflState?.season ? parseInt(nflState.season) : new Date().getFullYear();

    Object.keys(seasonalMetrics).forEach(yearStr => {
      const year = parseInt(yearStr);

      // Skip current NFL season if Week 1 data is not yet available
      // This prevents displaying incomplete current season data as 0s or N/As
      if (year === currentNFLSeason) {
        const week1Matchups = historicalData.matchupsBySeason?.[year]?.['1'];
        if (!week1Matchups || week1Matchups.length === 0) {
          logger.debug(`LuckRatingAnalysis: Skipping year ${year} (current season) as Week 1 data is not available.`);
          return; // Skip this year
        }
      }

      Object.keys(seasonalMetrics[year]).forEach(rosterId => { // Iterate over rosterIds
        const teamData = seasonalMetrics[year][rosterId]; // Access team data by rosterId

        // Ensure that the luckRating, actualWinsRecord, and seasonalExpectedWinsSum are populated for the team in this year
        if (
            teamData &&
            typeof teamData.luckRating === 'number' && !isNaN(teamData.luckRating) &&
            typeof teamData.actualWinsRecord === 'number' && !isNaN(teamData.actualWinsRecord) &&
            typeof teamData.seasonalExpectedWinsSum === 'number' && !isNaN(teamData.seasonalExpectedWinsSum)
        ) {
          allSeasonalLuckRatings.push({
            year: parseInt(year),
            team: getTeamName(teamData.ownerId, year), // Use getTeamName with ownerId and year
            ownerId: teamData.ownerId,
            luckRating: teamData.luckRating,
            actualWins: teamData.actualWinsRecord, // Directly use actualWinsRecord
            projectedWins: teamData.seasonalExpectedWinsSum // Directly use seasonalExpectedWinsSum
          });
        }
      });
    });

    // Sort seasonal luck ratings by luckRating (descending, as higher is better for "luckiest")
    allSeasonalLuckRatings.sort((a, b) => b.luckRating - a.luckRating);
    setSeasonalLuckData(allSeasonalLuckRatings);

    const allCareerLuckRatings = [];
    calculatedCareerDPRs.forEach(careerStats => {
        if (
            careerStats &&
            typeof careerStats.totalLuckRating === 'number' && !isNaN(careerStats.totalLuckRating) &&
            typeof careerStats.actualCareerWinsRecord === 'number' && !isNaN(careerStats.actualCareerWinsRecord) &&
            typeof careerStats.careerExpectedWinsSum === 'number' && !isNaN(careerStats.careerExpectedWinsSum)
        ) {
      allCareerLuckRatings.push({
        team: getTeamName(careerStats.ownerId, null), // Get current display name for career
        ownerId: careerStats.ownerId,
        luckRating: careerStats.totalLuckRating,
        actualWins: careerStats.actualCareerWinsRecord,
        projectedWins: careerStats.careerExpectedWinsSum
      });
        }
    });

    // Sort career luck ratings by luckRating (descending, as higher is better for "luckiest")
    allCareerLuckRatings.sort((a, b) => b.luckRating - a.luckRating);
    setCareerLuckData(allCareerLuckRatings);

    setLoading(false);

  }, [historicalData, allDraftHistory, getTeamName, nflState, contextLoading, contextError]); // Dependencies updated

  const formatLuckRating = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  const displayedSeasonalLuckData = showAllSeasonal ? seasonalLuckData : seasonalLuckData.slice(0, 20);
  const currentNFLSeason = nflState?.season ? parseInt(nflState.season) : new Date().getFullYear();

  // Determine current season from available seasonal data to keep highlighting consistent
  const dataCurrentSeason = (() => {
    try {
      const yrs = seasonalLuckData.map(r => (r && r.year) ? Number(r.year) : null).filter(Boolean);
      return yrs.length > 0 ? Math.max(...yrs) : currentNFLSeason;
    } catch (e) {
      return currentNFLSeason;
    }
  })();

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
        Luck Rating Analysis
      </h2>
      <p className="text-sm text-gray-600 mb-6 text-center">
        This analysis indicates how much "luckier" or "unluckier" a team was
        compared to their projected wins if every possible matchup against other teams
        in their league week-by-week were played. A positive score means luckier, negative means unluckier.
        Calculation includes regular season games only.
      </p>

      {loading ? (
        <p className="text-center text-gray-600">Calculating luck ratings...</p>
      ) : (
        <>
          {/* Career Luck Rankings */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-blue-800 mb-4 border-b pb-2">Career Luck Rankings</h3>
            {careerLuckData.length > 0 ? (
              <>
                {/* Mobile Cards View */}
                <div className="sm:hidden space-y-3">
                  {careerLuckData
                    .slice()
                    .sort((a, b) => (b.luckRating || 0) - (a.luckRating || 0))
                    .map((data, index) => (
                      <div key={data.team} className="bg-white rounded-lg shadow-md mobile-card p-4 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{index + 1}</div>
                            <img
                              src={getTeamDetails ? (getTeamDetails(data.ownerId, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                                alt={data.team}
                              className="w-10 h-10 rounded-full border-2 border-blue-300 shadow-sm object-cover flex-shrink-0"
                              onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm truncate">
                                {onTeamNameClick ? (
                                  <button onClick={() => onTeamNameClick(data.team)} className="text-gray-800 hover:underline p-0 bg-transparent border-none">
                                    {data.team}
                                  </button>
                                ) : (
                                  data.team
                                )}
                              </div>
                              <div className="text-xs text-gray-500">Actual: {data.actualWins}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-lg font-bold ${data.luckRating > 0 ? 'text-green-600' : data.luckRating < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatLuckRating(data.luckRating)}</div>
                            <div className="text-xs text-gray-500">Projected • {formatLuckRating(data.projectedWins)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto shadow-lg rounded-lg">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-blue-100 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Career Luck</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Actual Wins</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Projected Wins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {careerLuckData.slice().sort((a,b)=>(b.luckRating||0)-(a.luckRating||0)).map((data, index) => (
                        <tr key={data.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-blue-700 font-bold border-b border-gray-200">{index + 1}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 font-medium border-b border-gray-200">
                            <div className="flex items-center gap-2 md:gap-3">
                              <img
                                src={getTeamDetails ? (getTeamDetails(data.ownerId, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                                alt={data.team}
                                className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-blue-300 shadow-sm object-cover flex-shrink-0"
                                onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                              />
                              <span className="truncate font-semibold text-xs md:text-sm">
                                {onTeamNameClick ? (
                                  <button
                                    onClick={() => onTeamNameClick(data.team)}
                                    className="text-gray-800 hover:text-gray-600 cursor-pointer bg-transparent border-none p-0 text-left"
                                  >
                                    {data.team}
                                  </button>
                                ) : (
                                  data.team
                                )}
                              </span>
                            </div>
                          </td>
                          <td className={`py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold ${data.luckRating > 0 ? 'text-green-600' : data.luckRating < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatLuckRating(data.luckRating)}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{data.actualWins}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatLuckRating(data.projectedWins)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-600">No career luck data available.</p>
            )}
          </section>

          {/* Seasonal Luck Rankings */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-green-800 mb-4 border-b pb-2">Seasonal Luck Rankings</h3>
            {seasonalLuckData.length > 0 ? (
              <>
                {/* Mobile Cards View */}
                <div className="sm:hidden space-y-3">
                  {displayedSeasonalLuckData.map((data, idx) => (
                    <div key={`${data.team}-${data.year}`} className={`rounded-lg shadow p-4 ${Number(data.year) === Number(dataCurrentSeason) ? 'border-l-4 border-green-500 bg-green-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{idx + 1}</div>
                          <img
                                  src={getTeamDetails ? (getTeamDetails(data.ownerId, data.year)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                            alt={data.team}
                            className="w-10 h-10 rounded-full border-2 border-green-300 shadow-sm object-cover flex-shrink-0"
                            onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-sm truncate">
                                {onTeamNameClick ? (
                                  <button onClick={() => onTeamNameClick(data.team)} className="text-gray-800 hover:underline p-0 bg-transparent border-none">
                                    {data.team}
                                  </button>
                                ) : (
                                  data.team
                                )}
                              </div>
                              {Number(data.year) === Number(dataCurrentSeason) && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">Current</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">Season: {data.year}</div>
                          </div>
                        </div>

                        <div className="text-right min-w-[88px]">
                          <div className={`text-lg font-bold ${data.luckRating > 0 ? 'text-green-600' : data.luckRating < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatLuckRating(data.luckRating)}</div>
                          <div className="text-xs text-gray-500">Luck • Actual {data.actualWins}</div>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto shadow-lg rounded-lg">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-green-100 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Season</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Luck Rating</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Actual Wins</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Projected Wins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let actualRank = 0;
                        return displayedSeasonalLuckData.map((data, index) => {
                          actualRank++;
                          const isCurrentSeasonRow = data.year && Number(data.year) === Number(dataCurrentSeason);
                          const rowClass = isCurrentSeasonRow ? 'bg-green-50' : (actualRank % 2 === 0 ? 'bg-gray-50' : 'bg-white');
                          return (
                            <tr key={`${data.team}-${data.year}`} className={rowClass}>
                              <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200 relative pl-3">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-sm ${isCurrentSeasonRow ? 'bg-green-500' : 'bg-transparent'}`} />
                                <span className="">{actualRank}</span>
                              </td>
                              <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">
                                <div className="flex items-center gap-2 md:gap-3">
                                  <img
                                    src={getTeamDetails ? (getTeamDetails(data.ownerId, data.year)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                                    alt={data.team}
                                    className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-green-300 shadow-sm object-cover flex-shrink-0"
                                    onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                                  />
                                  <span className="truncate font-semibold text-xs md:text-sm">
                                    {onTeamNameClick ? (
                                      <button
                                        onClick={() => onTeamNameClick(data.team)}
                                        className="text-gray-800 hover:text-gray-600 cursor-pointer bg-transparent border-none p-0 text-left"
                                      >
                                        {data.team}
                                      </button>
                                    ) : (
                                      data.team
                                    )}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">{data.year}</td>
                              <td className={`py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold ${data.luckRating > 0 ? 'text-green-600' : data.luckRating < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatLuckRating(data.luckRating)}</td>
                              <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{data.actualWins}</td>
                              <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatLuckRating(data.projectedWins)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-600">No seasonal luck data available.</p>
            )}

            {seasonalLuckData.length > 20 && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowAllSeasonal(!showAllSeasonal)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                >
                  {showAllSeasonal ? 'Show Less' : 'Show All Seasons'}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default LuckRatingAnalysis;
// src/components/MatchupHistory.js
import React, { useState, useEffect } from 'react';
import { fetchRostersWithDetails } from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config'; // Still used for initial checks if historical data is empty

const MatchupHistory = ({ sleeperHistoricalMatchups, loading, error }) => {
  // State to store enriched rosters for the *currently selected* season
  // This will be populated dynamically when a year is chosen
  const [selectedSeasonRosters, setSelectedSeasonRosters] = useState({});

  // Loading and error states specifically for the *selected season's* roster data
  const [loadingSelectedSeasonData, setLoadingSelectedSeasonData] = useState(true);
  const [selectedSeasonDataError, setSelectedSeasonDataError] = useState(null);

  // State for the currently selected year in the dropdown
  // Initialize to null, will be set to the newest year available in an effect
  const [selectedYear, setSelectedYear] = useState(null);

  // Effect to initialize selectedYear to the newest available year
  // This runs once when historicalMatchups prop is first loaded
  useEffect(() => {
    if (!loading && !error && Object.keys(sleeperHistoricalMatchups).length > 0) {
      const sortedYears = Object.keys(sleeperHistoricalMatchups).sort((a, b) => parseInt(b) - parseInt(a));
      if (sortedYears.length > 0 && selectedYear === null) {
        setSelectedYear(parseInt(sortedYears[0])); // Set to the newest year by default
      }
    }
  }, [sleeperHistoricalMatchups, loading, error, selectedYear]); // selectedYear dependency prevents re-initializing if user changes it

  // Effect to load rosters for the selected year
  // This runs whenever `selectedYear` changes (user selects a different year)
  useEffect(() => {
    const loadRostersForSelectedSeason = async () => {
      setLoadingSelectedSeasonData(true);
      setSelectedSeasonDataError(null);
      setSelectedSeasonRosters({}); // Clear previous rosters while loading new ones

      // Only proceed if historicalMatchups are loaded and a year is actually selected
      if (!selectedYear || !sleeperHistoricalMatchups || Object.keys(sleeperHistoricalMatchups).length === 0) {
        setLoadingSelectedSeasonData(false);
        return;
      }

      // Get the specific season's data from the historical matchups object
      const seasonData = sleeperHistoricalMatchups[selectedYear];
      const seasonLeagueId = seasonData?.id; // This 'id' is crucial for fetching historical rosters

      if (!seasonLeagueId) {
        console.warn(`No league ID found for season ${selectedYear} in historical data. Cannot fetch roster data.`);
        setSelectedSeasonDataError(`No specific league ID found for the ${selectedYear} season in historical data. Make sure fetchHistoricalMatchups returns IDs.`);
        setLoadingSelectedSeasonData(false);
        return;
      }

      try {
        const fetchedRostersArray = await fetchRostersWithDetails(seasonLeagueId);

        const enrichedRostersById = fetchedRostersArray.reduce((acc, roster) => {
          if (!roster.roster_id) {
              console.warn(`Roster object from league ${seasonLeagueId} missing roster_id:`, roster);
          }
          acc[roster.roster_id] = roster;
          return acc;
        }, {});

        setSelectedSeasonRosters(enrichedRostersById);

        if (Object.keys(enrichedRostersById).length === 0) {
          console.warn(`No roster data loaded for season ${selectedYear}. League ID: ${seasonLeagueId}`);
          setSelectedSeasonDataError(`No roster data loaded for season ${selectedYear}. It might not exist or the API returned no rosters.`);
        }

      } catch (err) {
        console.error(`Error fetching rosters for selected season ${selectedYear} (ID: ${seasonLeagueId}):`, err);
        setSelectedSeasonDataError(`Failed to load roster data for ${selectedYear}: ${err.message}.`);
      } finally {
        setLoadingSelectedSeasonData(false);
      }
    };

    loadRostersForSelectedSeason();
  }, [selectedYear, sleeperHistoricalMatchups, loading, error]); // Dependencies: re-run on year change, or if main data (historicalMatchups) or its loading/error state changes

  // Handle year selection from dropdown
  const handleYearChange = (event) => {
    setSelectedYear(parseInt(event.target.value));
  };

  // Helper function to get team display name for the *currently selected* season
  // This function now relies on `selectedSeasonRosters` which is updated dynamically
  const getTeamDisplayName = (rosterId) => {
    const roster = selectedSeasonRosters[rosterId];

    if (roster) {
      const teamName = roster.ownerTeamName;
      const displayName = roster.ownerDisplayName;
      return teamName || displayName || `Roster ${rosterId}`; // Fallback if names are missing
    } else {
      console.warn(`No enriched roster found for rosterId: ${rosterId} in selected season ${selectedYear}.`);
    }
    return `Roster ${rosterId}`; // Fallback if no enriched roster is found for the ID
  };

  // Get all available years from the historical matchups data, sorted descending
  const allAvailableYears = Object.keys(sleeperHistoricalMatchups).sort((a, b) => parseInt(b) - parseInt(a));

  // --- Render Logic ---
  // Display a loading spinner if primary data is loading, no year is selected yet,
  // or data for the selected season is currently loading.
  if (loading || selectedYear === null || loadingSelectedSeasonData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
        <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-medium">Loading matchup history and league data...</p>
      </div>
    );
  }

  // Display error messages if there's an issue with primary data or selected season data
  if (error || selectedSeasonDataError) {
    return (
      <div className="text-center text-red-600 p-4 bg-red-100 border border-red-400 rounded-md">
        <p className="font-semibold text-lg">Error loading Matchup History:</p>
        <p>{error || selectedSeasonDataError}</p>
        {error && <p className="mt-2 text-sm">Check main data loading (from App.js) for issues.</p>}
        {selectedSeasonDataError && <p className="mt-2 text-sm">Check selected season data loading for issues. Ensure `CURRENT_LEAGUE_ID` in `config.js` is correct and `fetchHistoricalMatchups` provides historical league IDs for team names.</p>}
      </div>
    );
  }

  // Display a message if no historical matchup data is available at all
  if (!sleeperHistoricalMatchups || Object.keys(sleeperHistoricalMatchups).length === 0) {
    return (
      <div className="text-center p-4 bg-yellow-100 border border-yellow-400 rounded-md">
        <p className="text-lg font-medium text-yellow-800">No historical matchup data available from Sleeper API.</p>
        <p className="text-yellow-700 text-sm">This might mean the league ID is incorrect, or there's no data for previous seasons.</p>
      </div>
    );
  }

  // Get data for the currently selected year
  const selectedYearData = sleeperHistoricalMatchups[selectedYear];
  // Access the 'weeks' property which should contain the weekly matchup data
  const weeksData = selectedYearData?.weeks;

  // Display a message if no matchup data is found for the specifically selected year
  if (!selectedYearData || !weeksData || Object.keys(weeksData).length === 0) {
    return (
      <div className="text-center p-4 bg-orange-100 border border-orange-400 rounded-md">
        <p className="text-lg font-medium text-orange-800">No matchup data found for the selected {selectedYear} season.</p>
        <p className="text-orange-700 text-sm">Please select another year, or verify data for this season.</p>
        {/* Year dropdown still visible in this error state for user interaction */}
        <div className="flex justify-center mt-4">
          <label htmlFor="year-select" className="mr-2 text-gray-700 font-medium">Select Season:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={handleYearChange}
            className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {allAvailableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // Sort weeks numerically for display
  const sortedWeeks = Object.keys(weeksData).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Historical Matchup Data (Sleeper API)</h2>
      <p className="text-lg text-gray-700 mb-8 text-center max-w-2xl mx-auto">
        Select a season from the dropdown below to view its historical matchup data.
      </p>

      {/* Year Selection Dropdown */}
      <div className="flex justify-center mb-8">
        <label htmlFor="year-select" className="mr-2 text-gray-700 font-medium">Select Season:</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={handleYearChange}
          className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {allAvailableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Display data for the selected year only */}
      <div key={selectedYear} className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-200">
        <h3 className="text-2xl font-bold text-blue-700 mb-5 border-b-2 border-blue-100 pb-3">Season: {selectedYear}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedWeeks.length > 0 ? (
            sortedWeeks.map(week => (
              <div key={`${selectedYear}-week-${week}`} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Week {week}</h4>
                {weeksData[week] && weeksData[week].length > 0 ? (
                  <ul className="space-y-3">
                    {/* Group matchups by matchup_id to display as pairs */}
                    {Object.values(
                      weeksData[week].reduce((acc, current) => {
                        if (!acc[current.matchup_id]) {
                          acc[current.matchup_id] = [];
                        }
                        acc[current.matchup_id].push(current);
                        return acc;
                      }, {})
                    ).map((matchupPair, index) => (
                      <li key={`matchup-${selectedYear}-${week}-${index}`} className="flex flex-col space-y-1 p-2 bg-white border border-gray-200 rounded-md shadow-sm">
                        {matchupPair.map(teamData => (
                          <div key={teamData.roster_id} className="flex justify-between text-sm text-gray-700">
                            <span className="font-medium">
                              {/* getTeamDisplayName now correctly uses the dynamically loaded rosters */}
                              {getTeamDisplayName(teamData.roster_id)}
                            </span>
                            <span className="font-bold text-blue-600">{teamData.points ? teamData.points.toFixed(2) : 'N/A'}</span>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600 text-sm italic">No matchup data for this week.</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-600 italic col-span-full">No matchup data found for the selected season.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchupHistory;

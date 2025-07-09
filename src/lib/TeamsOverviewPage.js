// src/lib/TeamsOverviewPage.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import TeamDetailPage from './TeamDetailPage'; // Import the TeamDetailPage

const TeamsOverviewPage = () => {
  const {
    loading: contextLoading,
    error: contextError,
    careerDPRData, // Contains overall team stats including ownerId and teamName
    getTeamName // The function to resolve team names
  } = useSleeperData();

  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [availableTeamNames, setAvailableTeamNames] = useState([]);

  useEffect(() => {
    if (!contextLoading && !contextError && careerDPRData) {
      // Extract unique team names from careerDPRData
      const names = careerDPRData
        .map(team => getTeamName(team.ownerId, null)) // Get current display name for each team
        .filter(name => name && !name.startsWith('Unknown Team (ID:')) // Filter out unresolved names
        .sort((a, b) => a.localeCompare(b)); // Sort alphabetically

      setAvailableTeamNames(names);

      // Set the first available team as the default selected team
      if (names.length > 0 && !selectedTeamName) {
        setSelectedTeamName(names[0]);
      }
    }
  }, [contextLoading, contextError, careerDPRData, getTeamName, selectedTeamName]);

  const handleTeamChange = (event) => {
    setSelectedTeamName(event.target.value);
  };

  if (contextLoading) {
    return (
      <div className="w-full p-8 text-center text-gray-600">
        Loading league data for teams...
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="w-full p-8 text-center text-red-500 font-semibold">
        Error loading league data: {contextError.message || String(contextError)}
      </div>
    );
  }

  if (availableTeamNames.length === 0) {
    return (
      <div className="w-full p-8 text-center text-gray-600">
        No teams found or data is not yet available.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 text-center">
        <label htmlFor="team-select" className="block text-lg font-medium text-gray-700 mb-2">
          Select a Team:
        </label>
        <select
          id="team-select"
          value={selectedTeamName}
          onChange={handleTeamChange}
          className="mt-1 block w-full md:w-1/2 lg:w-1/3 mx-auto pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
        >
          {availableTeamNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {selectedTeamName && (
        <TeamDetailPage teamName={selectedTeamName} />
      )}
    </div>
  );
};

export default TeamsOverviewPage;

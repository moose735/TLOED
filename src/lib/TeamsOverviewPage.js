// src/lib/TeamsOverviewPage.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import TeamDetailPage from './TeamDetailPage';

const TeamsOverviewPage = ({ selectedTeamName: initialSelectedTeamName }) => {
  const {
    loading: contextLoading,
    error: contextError,
    careerDPRData,
    getTeamName
  } = useSleeperData();

  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [availableTeamNames, setAvailableTeamNames] = useState([]);

  useEffect(() => {
    if (!contextLoading && !contextError && careerDPRData) {
      const names = careerDPRData
        .map(team => getTeamName(team.ownerId, null))
        .filter(name => name && !name.startsWith('Unknown Team (ID:'))
        .sort((a, b) => a.localeCompare(b));

      setAvailableTeamNames(names);

      if (names.length > 0) {
        if (initialSelectedTeamName && names.includes(initialSelectedTeamName)) {
          setSelectedTeamName(initialSelectedTeamName);
        } else if (!selectedTeamName) {
          setSelectedTeamName(names[0]);
        }
      }
    }
  }, [contextLoading, contextError, careerDPRData, getTeamName, initialSelectedTeamName, selectedTeamName]);

  const handleTeamChange = (event) => {
    setSelectedTeamName(event.target.value);
  };

  if (contextLoading) {
    return (
      <div className="w-full py-12 text-center text-gray-500 animate-pulse text-sm">
        Loading league data for teams…
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="w-full py-12 text-center text-red-400 text-sm">
        Error loading league data: {contextError.message || String(contextError)}
      </div>
    );
  }

  if (availableTeamNames.length === 0) {
    return (
      <div className="w-full py-12 text-center text-gray-500 text-sm">
        No teams found or data is not yet available.
      </div>
    );
  }

  return (
    <div className="mx-2 sm:mx-auto p-2 sm:p-4 space-y-4">
      {/* Team selector */}
      <div className="flex flex-col items-center gap-2">
        <label htmlFor="team-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Select a Team
        </label>
        <select
          id="team-select"
          value={selectedTeamName}
          onChange={handleTeamChange}
          className="w-full md:w-1/2 lg:w-1/3 px-3 py-2 bg-gray-800 border border-white/10 text-gray-200 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
        >
          {availableTeamNames.map((name) => (
            <option key={name} value={name} className="bg-gray-800 text-gray-200">
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
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
        }
      }
    }
  }, [contextLoading, contextError, careerDPRData, getTeamName, initialSelectedTeamName]);

  const handleTeamSelect = (name) => {
    setSelectedTeamName(name);
  };

  const handleBack = () => {
    setSelectedTeamName('');
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

  // Team detail view
  if (selectedTeamName) {
    return (
      <div className="mx-2 sm:mx-auto p-2 sm:p-4 space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-blue-400 transition-colors uppercase tracking-wider group"
        >
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          All Teams
        </button>
        <TeamDetailPage teamName={selectedTeamName} />
      </div>
    );
  }

  // Team list view
  return (
    <div className="mx-2 sm:mx-auto p-2 sm:p-4 space-y-3">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-4">
        Select a Team
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {availableTeamNames.map((name) => (
          <button
            key={name}
            onClick={() => handleTeamSelect(name)}
            className="flex items-center justify-between px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-gray-200 text-sm font-medium hover:bg-gray-700 hover:border-blue-500/40 hover:text-white transition-all duration-150 group shadow-sm text-left"
          >
            <span>{name}</span>
            <svg
              className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TeamsOverviewPage;
// src/components/SeasonDraft.jsx
import React, { useState, useEffect } from 'react';
import { getSleeperAvatarUrl, getSleeperPlayerHeadshotUrl } from '../utils/sleeperApi';

const SeasonDraft = ({ season, leagueId, draftHistory, nflPlayers, users, rosters, getDisplayTeamName }) => {
  const [selectedDraftId, setSelectedDraftId] = useState('');

  // Memoized helper to get user display name from owner_id
  const getUserDisplayName = (userId) => {
    const user = users[userId];
    return user ? getDisplayTeamName(user.teamName || user.displayName) : 'Unknown User';
  };

  // Helper to get player name from player_id using NFL players data
  const getPlayerName = (playerId) => {
    const player = nflPlayers[playerId];
    return player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : `Unknown Player (${playerId})`;
  };

  // Helper to get team name from roster_id
  const getTeamNameByRosterId = (rosterId) => {
    const roster = rosters.find(r => r.roster_id === rosterId);
    return roster ? getDisplayTeamName(roster.ownerTeamName) : 'Unknown Team';
  };

  useEffect(() => {
    if (draftHistory && Object.keys(draftHistory).length > 0) {
      // Automatically select the first draft in the history for the season (most common scenario)
      setSelectedDraftId(Object.keys(draftHistory)[0]);
    } else {
      setSelectedDraftId('');
    }
  }, [season, draftHistory]);

  if (!season || !leagueId || !draftHistory || Object.keys(draftHistory).length === 0) {
    return (
      <div className="text-center p-4 text-gray-600">
        No draft history available for {season}.
      </div>
    );
  }

  const availableDrafts = Object.keys(draftHistory);
  const currentDraft = draftHistory[selectedDraftId];

  return (
    <div className="p-4">
      <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">
        {season} Season Draft History
      </h3>

      <div className="mb-6 flex flex-col md:flex-row items-center justify-start space-y-4 md:space-y-0 md:space-x-4">
        <label htmlFor="draft-select" className="font-semibold text-gray-700">Select Draft:</label>
        <select
          id="draft-select"
          className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          value={selectedDraftId}
          onChange={(e) => setSelectedDraftId(e.target.value)}
        >
          {availableDrafts.length === 0 && <option value="">No Drafts Available</option>}
          {availableDrafts.map(draftId => (
            <option key={draftId} value={draftId}>
              Draft {draftId} ({draftHistory[draftId].details?.type || 'N/A'})
            </option>
          ))}
        </select>
      </div>

      {currentDraft && (
        <div className="space-y-8">
          {/* Draft Details */}
          <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
            <h4 className="text-xl font-semibold text-blue-600 mb-3">Draft Details</h4>
            {currentDraft.details ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-700">
                <p><strong>Type:</strong> {currentDraft.details.type}</p>
                <p><strong>Status:</strong> {currentDraft.details.status}</p>
                <p><strong>Rounds:</strong> {currentDraft.details.settings?.rounds}</p>
                <p><strong>Teams:</strong> {currentDraft.details.settings?.teams}</p>
                <p><strong>Season Type:</strong> {currentDraft.details.season_type}</p>
                <p><strong>Start Time:</strong> {new Date(currentDraft.details.start_time).toLocaleString()}</p>
                {currentDraft.details.metadata?.name && <p><strong>Name:</strong> {currentDraft.details.metadata.name}</p>}
              </div>
            ) : (
              <p className="text-gray-500">No detailed information for this draft.</p>
            )}
          </div>

          {/* Draft Picks */}
          <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
            <h4 className="text-xl font-semibold text-blue-600 mb-3">Draft Picks</h4>
            {currentDraft.picks && currentDraft.picks.length > 0 ? (
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pick</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentDraft.picks.map((pick, index) => {
                      const player = nflPlayers[pick.player_id];
                      const roster = rosters.find(r => r.roster_id === pick.roster_id);
                      const ownerUserId = roster ? roster.owner_id : null;
                      const ownerDisplayName = ownerUserId ? getUserDisplayName(ownerUserId) : 'N/A';

                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{pick.round}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{pick.pick_no}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{ownerDisplayName}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 flex items-center">
                            {player && (
                              <img
                                src={getSleeperPlayerHeadshotUrl(pick.player_id)}
                                alt={getPlayerName(pick.player_id)}
                                className="w-7 h-7 rounded-full mr-2"
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=No+Headshot'; }}
                              />
                            )}
                            {getPlayerName(pick.player_id)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{player?.position || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No picks available for this draft.</p>
            )}
          </div>

          {/* Traded Picks */}
          <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
            <h4 className="text-xl font-semibold text-blue-600 mb-3">Traded Picks</h4>
            {currentDraft.tradedPicks && currentDraft.tradedPicks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Season</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Owner</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Owner</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Owner</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentDraft.tradedPicks.map((trade, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{trade.season}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{trade.round}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{getTeamNameByRosterId(trade.roster_id)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{getTeamNameByRosterId(trade.previous_owner_id)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{getTeamNameByRosterId(trade.owner_id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No traded picks available for this draft.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SeasonDraft;

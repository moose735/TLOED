// src/components/SeasonOverview.jsx
import React from 'react';

const SeasonOverview = ({ season, leagueDetails, rosters, users, getDisplayTeamName }) => {
  if (!season || !leagueDetails || !rosters || rosters.length === 0) {
    return (
      <div className="text-center p-4 text-gray-600">
        No overview data available for this season.
      </div>
    );
  }

  // Determine final standings based on wins, then fpts
  const sortedStandings = [...rosters].sort((a, b) => {
    // Primary sort: by wins (descending)
    if (a.settings?.wins !== b.settings?.wins) {
      return (b.settings?.wins || 0) - (a.settings?.wins || 0);
    }
    // Secondary sort: by fpts (descending)
    const fptsA = parseFloat(`${a.settings?.fpts}.${a.settings?.fpts_decimal || '0'}`);
    const fptsB = parseFloat(`${b.settings?.fpts}.${b.settings?.fpts_decimal || '0'}`);
    return fptsB - fptsA;
  });

  // Determine Champion (simplistic: highest wins/fpts overall, or from league_id.metadata if available)
  // In a real scenario, you'd pull championship results from sleeper_api.js if available in league details
  // For now, we'll assume the top team in final standings is the champion if no explicit champion info
  // is available from Sleeper API (which often only tells you playoff structure, not final winner directly)
  const championRoster = sortedStandings.length > 0 ? sortedStandings[0] : null;
  const runnerUpRoster = sortedStandings.length > 1 ? sortedStandings[1] : null;
  const thirdPlaceRoster = sortedStandings.length > 2 ? sortedStandings[2] : null;

  return (
    <div className="space-y-8">
      {/* Season Standings Section */}
      <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
        <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">
          {season} Season Standings
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record (W-L-T)</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points For</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points Against</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Rank</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStandings.map((roster, index) => {
                const ownerDisplayName = getDisplayTeamName(roster.ownerTeamName);
                const wins = roster.settings?.wins || 0;
                const losses = roster.settings?.losses || 0;
                const ties = roster.settings?.ties || 0;
                const fpts = parseFloat(`${roster.settings?.fpts}.${roster.settings?.fpts_decimal || '0'}`).toFixed(2);
                const fptsAgainst = parseFloat(`${roster.settings?.fpts_against}.${roster.settings?.fpts_against_decimal || '0'}`).toFixed(2);

                // Note: Sleeper API typically does not directly provide a "final_finish" rank in historical roster settings.
                // You might need to derive this from playoff bracket results or external data.
                // For simplicity, using the sorted index + 1 as "Final Rank" here.
                const finalRank = index + 1;

                return (
                  <tr key={roster.roster_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{ownerDisplayName}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{wins}-{losses}-{ties}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{fpts}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{fptsAgainst}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{finalRank}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Season Champion Section - Podium */}
      <div className="bg-blue-700 p-8 rounded-lg shadow-xl text-white text-center">
        <h3 className="text-3xl font-extrabold mb-6 text-yellow-300">
          {season} Season Champions
        </h3>
        <div className="flex flex-col items-center space-y-4">
          {championRoster && (
            <div className="flex flex-col items-center w-full max-w-sm p-4 bg-yellow-400 text-blue-900 rounded-lg shadow-lg transform -translate-y-4 relative z-10">
              <span className="text-5xl mb-2">🏆</span>
              <p className="text-2xl font-bold">{getDisplayTeamName(championRoster.ownerTeamName)}</p>
              <p className="text-lg">Champion</p>
              <p className="text-sm">({(championRoster.settings?.wins || 0)}-{(championRoster.settings?.losses || 0)})</p>
            </div>
          )}
          <div className="flex justify-center w-full space-x-6 z-0">
            {runnerUpRoster && (
              <div className="flex flex-col items-center w-1/2 max-w-[180px] p-3 bg-gray-300 text-gray-800 rounded-lg shadow-md transform translate-y-4">
                <span className="text-4xl mb-1">🥈</span>
                <p className="text-xl font-semibold">{getDisplayTeamName(runnerUpRoster.ownerTeamName)}</p>
                <p className="text-base">Runner-Up</p>
                <p className="text-xs">({(runnerUpRoster.settings?.wins || 0)}-{(runnerUpRoster.settings?.losses || 0)})</p>
              </div>
            )}
            {thirdPlaceRoster && (
              <div className="flex flex-col items-center w-1/2 max-w-[180px] p-3 bg-yellow-600 text-white rounded-lg shadow-md transform translate-y-8">
                <span className="text-4xl mb-1">🥉</span>
                <p className="text-xl font-semibold">{getDisplayTeamName(thirdPlaceRoster.ownerTeamName)}</p>
                <p className="text-base">3rd Place</p>
                <p className="text-xs">({(thirdPlaceRoster.settings?.wins || 0)}-{(thirdPlaceRoster.settings?.losses || 0)})</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonOverview;

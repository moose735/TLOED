import React from 'react';

const TeamTicker = ({ leagueManagers, getMappedTeamName }) => {
  return (
    <section id="team-ticker-container">
      {leagueManagers && leagueManagers.length > 0 ? (
        <div className="inline-flex animate-ticker-scroll items-center h-full">
          {[...leagueManagers, ...leagueManagers].map((manager, index) => (
            <div key={`<span class="math-inline">\{manager\.userId\}\-</span>{index}`} className="team-ticker-item">
              <img src={manager.avatar} alt={`${manager.teamName} avatar`} onError={(e) => e.target.src = 'https://placehold.co/30x30/cccccc/333333?text=M' } />
              <span className="team-name">{getMappedTeamName(manager.teamName)}</span> {/* Apply mapping here */}
              <span className="team-record">{manager.wins}-{manager.losses}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center py-2">Loading team data for ticker...</p>
      )}
    </section>
  );
};

export default TeamTicker;

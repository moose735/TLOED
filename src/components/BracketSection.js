import React from 'react';

const BracketSection = ({ bracketData, loadingBracket, errorBracket, getMappedTeamName }) => {
  return (
    <section className="w-full flex flex-col items-center">
      <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 w-full text-center">
        Projected Playoff Bracket
      </h2>
      {loadingBracket ? (
        <p className="text-gray-600">Loading playoff bracket data...</p>
      ) : errorBracket ? (
        <p className="text-red-500">Error: {errorBracket}</p>
      ) : bracketData ? (
        <>
          <div className="bracket-container">
            {/* Round 1 */}
            <div className="bracket-round">
              <div className="bracket-round-label">Round 1</div>
              {bracketData.round1.map((match, index) => {
                const displayTeam1 = getMappedTeamName(match.team1);
                const displayTeam2 = getMappedTeamName(match.team2);

                return (
                  <div key={`r1-match-${index}`} className="bracket-match">
                    <div className="bracket-match-player">
                      <strong>{match.seed1}</strong> <span>{displayTeam1 || <span className="bracket-bye">Bye</span>}</span>
                    </div>
                    <div className="bracket-vs">vs</div>
                    <div className="bracket-match-player">
                      <strong>{match.seed2}</strong> <span>{displayTeam2 || <span className="bracket-bye">Bye</span>}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Round 2 */}
            <div className="bracket-round">
              <div className="bracket-round-label">Round 2</div>
              {bracketData.round2.map((match, index) => {
                const displayTeam = getMappedTeamName(match.team);

                return (
                  <div key={`r2-match-${index}`} className="bracket-match">
                    <div className="bracket-match-player">
                      <strong>{match.seed}</strong> <span>{displayTeam || <span className="bracket-bye">Bye</span>}</span>
                    </div>
                    <div className="bracket-vs">vs</div>
                    <div className="bracket-bye">
                      {index === 0 ? "Lowest Seed Remaining" : "Highest Seed Remaining"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dotted-line"></div>

          {/* Lower seeds grid */}
          <h3 className="text-xl font-bold text-gray-700 mb-4 mt-6 w-full text-center">
            Remaining Seeds
          </h3>
          <div className="lower-seeds-grid">
            {bracketData.lowerSeeds.map((entry, index) => {
              const displayTeam = getMappedTeamName(entry.team);

              return (
                <div key={`lower-seed-${index}`} className="lower-seed-box">
                  <strong>{entry.seed}</strong> <span>{displayTeam || <span className="bracket-bye">Bye</span>}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-gray-600">No playoff bracket data available. Check your Apps Script and Google Sheet.</p>
      )}
    </section>
  );
};

export default BracketSection;

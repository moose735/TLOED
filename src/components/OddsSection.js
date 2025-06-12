import React from 'react';

const OddsSection = ({
  weeklyOddsData,
  currentOddsWeek,
  totalOddsWeeks,
  setCurrentOddsWeek,
  loadingOdds,
  errorOdds,
  getMappedTeamName,
}) => {
  return (
    <section className="w-full flex flex-col items-center">
      <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 w-full text-center">
        Weekly Odds & Results (Week {currentOddsWeek !== null ? currentOddsWeek + 1 : '...'})
      </h2>
      {loadingOdds ? (
        <p className="text-gray-600">Loading weekly odds data...</p>
      ) : errorOdds ? (
        <p className="text-red-500">Error: {errorOdds}</p>
      ) : weeklyOddsData[currentOddsWeek] && weeklyOddsData[currentOddsWeek].length > 0 ? (
        <>
          <div className="week-buttons-container">
            {Array.from({ length: totalOddsWeeks }, (_, i) => (
              <button
                key={i}
                className={`week-nav-button ${currentOddsWeek === i ? 'active' : ''}`}
                onClick={() => setCurrentOddsWeek(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center w-full">
            {weeklyOddsData[currentOddsWeek].map((match, idx) => {
              const displayP1Name = getMappedTeamName(match.p1Name);
              const displayP2Name = getMappedTeamName(match.p2Name);

              const p1Class = match.winner === 1 ? 'odds-win' : match.winner === 2 ? 'odds-lose' : '';
              const p2Class = match.winner === 2 ? 'odds-win' : match.winner === 1 ? 'odds-lose' : '';
              const ouOClass = match.ouResult === 1 ? 'odds-win' : match.ouResult === 2 ? 'odds-lose' : '';
              const ouUClass = match.ouResult === 2 ? 'odds-win' : match.ouResult === 1 ? 'odds-lose' : '';

              const hasScores = match.p1Score !== '' && match.p2Score !== '';
              const p1ScoreDisplay = hasScores ? `<span class="odds-score">${match.p1Score}</span>` : '';
              const p2ScoreDisplay = hasScores ? `<span class="odds-score">${match.p2Score}</span>` : '';

              return (
                <div key={idx} className="odds-matchup">
                  <div className="odds-player">
                    <div dangerouslySetInnerHTML={{ __html: `${displayP1Name} ${p1ScoreDisplay}` }}></div>
                    <div className="odds-bubbles">
                      <div className={`odds-value ${p1Class}`}>{match.p1Odds}</div>
                      <div className={`odds-ou-box ${ouOClass}`}>O {match.ou}<br/><small>-110</small></div>
                    </div>
                  </div>
                  <div className="odds-player">
                    <div dangerouslySetInnerHTML={{ __html: `${displayP2Name} ${p2ScoreDisplay}` }}></div>
                    <div className="odds-bubbles">
                      <div className={`odds-value ${p2Class}`}>{match.p2Odds}</div>
                      <div className={`odds-ou-box ${ouUClass}`}>U {match.ou}<br/><small>-110</small></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-gray-600">No weekly odds data available for this week. Check your Apps Script and Google Sheet.</p>
      )}
    </section>
  );
};

export default OddsSection;

import React from 'react';

// Helper: Calculate money line odds from scores difference
function calculateMoneyLine(scoreA, scoreB) {
  const diff = scoreA - scoreB;
  if (diff === 0) return { teamAML: -110, teamBML: -110 }; // default tie odds

  // Example formula for ML odds (you should replace with your real formula)
  // Positive diff => teamA favored
  if (diff > 0) {
    const mlA = Math.round(-100 * (1 + diff / 10)); // e.g. -110, -120...
    const mlB = Math.round(100 * (1 + diff / 20));
    return { teamAML: mlA, teamBML: mlB };
  } else {
    const mlA = Math.round(100 * (1 + -diff / 20));
    const mlB = Math.round(-100 * (1 + -diff / 10));
    return { teamAML: mlA, teamBML: mlB };
  }
}

function WeeklyMatchupsDisplay({ weeklyMatchups }) {
  if (!weeklyMatchups || weeklyMatchups.length === 0) {
    return <div>No matchups to display</div>;
  }

  // 1) Group matchups by week
  const weeksMap = weeklyMatchups.reduce((acc, matchup) => {
    if (!acc[matchup.week]) acc[matchup.week] = [];
    acc[matchup.week].push(matchup);
    return acc;
  }, {});

  // 2) Sort weeks ascending
  const sortedWeeks = Object.keys(weeksMap)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div>
      {sortedWeeks.map((week) => {
        // Filter duplicates:
        // Keep only matchups where teamA < teamB lex to avoid repeats with reversed teams
        const uniqueMatchups = weeksMap[week].filter((m) =>
          m.teamA.localeCompare(m.teamB) < 0
        );

        return (
          <div key={week} style={{ marginBottom: 30 }}>
            <h2>Week {week} Matchups</h2>
            {uniqueMatchups.length === 0 && <p>No matchups this week</p>}

            {uniqueMatchups.map((m, idx) => {
              const { teamAML, teamBML } = calculateMoneyLine(
                m.teamAScore,
                m.teamBScore
              );
              const overUnder = m.overUnder || 0;

              return (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #ccc",
                    padding: "10px",
                    marginBottom: "10px",
                    borderRadius: "5px",
                  }}
                >
                  <div>
                    <strong>{m.teamA}</strong> vs <strong>{m.teamB}</strong>
                  </div>
                  <div>
                    ML: {teamAML > 0 ? "+" : ""}
                    {teamAML} / {teamBML > 0 ? "+" : ""}
                    {teamBML}
                  </div>
                  <div>O/U: {overUnder.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default WeeklyMatchupsDisplay;

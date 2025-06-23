// src/components/WeeklyMatchupsDisplay.jsx
import React from "react";
import { calculateMatchupOdds } from "../utils/bettingCalculations";

export default function WeeklyMatchupsDisplay({ schedule, historicalData }) {
  // Build a map of matchups per week (team -> opponent)
  // schedule is array of players with Weeks as keys, e.g. Week_1, Week_2, etc.

  if (!schedule || schedule.length === 0) return <div>No matchups to display.</div>;

  // Extract weeks from keys (assume Week_1, Week_2... format)
  const weeks = Object.keys(schedule[0])
    .filter((k) => k.startsWith("Week_"))
    .sort((a, b) => {
      const nA = parseInt(a.replace("Week_", ""), 10);
      const nB = parseInt(b.replace("Week_", ""), 10);
      return nA - nB;
    });

  // Build matchups per week in this format:
  // { weekNumber: [ { teamA: "Boilard", teamB: "Randall" }, ... ] }
  const weeklyMatchups = {};

  weeks.forEach((weekKey) => {
    const weekNum = parseInt(weekKey.replace("Week_", ""), 10);
    const pairs = [];

    schedule.forEach(({ Player: teamA }) => {
      const teamB = schedule.find((row) => row.Player === teamA)[weekKey];
      if (!teamB) return;

      // Prevent duplicates: only add if teamA < teamB alphabetically
      if (teamA < teamB) {
        pairs.push({ teamA, teamB });
      }
    });

    weeklyMatchups[weekNum] = pairs;
  });

  return (
    <div>
      {Object.entries(weeklyMatchups).map(([week, matchups]) => (
        <div key={week} style={{ marginBottom: "2rem" }}>
          <h2>Week {week} Matchups</h2>
          {matchups.length === 0 ? (
            <p>No matchups for this week</p>
          ) : (
            <ul>
              {matchups.map(({ teamA, teamB }, i) => {
                // Calculate odds from bettingCalculations.js
                const odds = calculateMatchupOdds(teamA, teamB, parseInt(week, 10), historicalData);
                return (
                  <li key={i}>
                    {teamA} vs {teamB} &nbsp; | ML: {odds.mlTeam} / {odds.mlOpponent} &nbsp; | O/U: {odds.overUnder.toFixed(2)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

import React from "react";
import { calculateMatchupOdds } from "../utils/bettingCalculations";

export default function WeeklyMatchupsDisplay({ schedule }) {
  console.log("WeeklyMatchupsDisplay schedule prop:", schedule);

  if (!schedule || schedule.length === 0) return <div>No matchups to display.</div>;

  const weekKeys = Object.keys(schedule[0])
    .filter((k) => k.startsWith("Week_"))
    .sort((a, b) => {
      const aNum = parseInt(a.replace("Week_", ""), 10);
      const bNum = parseInt(b.replace("Week_", ""), 10);
      return aNum - bNum;
    });

  console.log("Week keys found:", weekKeys);

  const weeklyMatchups = {};

  weekKeys.forEach((weekKey) => {
    const weekNum = parseInt(weekKey.replace("Week_", ""), 10);
    const pairs = [];

    schedule.forEach((row) => {
      const teamA = row.Player;
      const teamB = row[weekKey];
      if (!teamB || teamB.trim() === "") {
        console.log(`No opponent for ${teamA} in ${weekKey}`);
        return;
      }

      const [t1, t2] = [teamA, teamB].sort();

      const exists = pairs.some(({ teamA: a, teamB: b }) => a === t1 && b === t2);
      if (!exists) {
        pairs.push({ teamA: t1, teamB: t2 });
      }
    });

    weeklyMatchups[weekNum] = pairs;
    console.log(`Week ${weekNum} matchups:`, pairs);
  });

  console.log("Final weeklyMatchups object:", weeklyMatchups);

  return (
    <div>
      {Object.entries(weeklyMatchups).map(([week, matchups]) => (
        <div key={week} style={{ marginBottom: 20 }}>
          <h2>Week {week} Matchups</h2>
          {matchups.length === 0 ? (
            <p>No matchups this week</p>
          ) : (
            <ul>
              {matchups.map(({ teamA, teamB }, i) => {
                const odds = calculateMatchupOdds(teamA, teamB);
                return (
                  <li key={i}>
                    {teamA} vs {teamB} &nbsp;|&nbsp; ML: {odds.mlTeam} / {odds.mlOpponent} &nbsp;|&nbsp; O/U:{" "}
                    {odds.overUnder.toFixed(2)}
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

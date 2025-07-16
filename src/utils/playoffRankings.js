// src/utils/playoffRankings.js

/**
 * Calculates playoff finishes (ranks) for each team based on winners and losers bracket data.
 * It determines 1st, 2nd, 3rd place, and then ranks teams in the losers bracket.
 *
 * @param {Object} bracketData - An object containing winnersBracket and losersBracket arrays.
 * @param {Map<string, string>} rosterIdToOwnerIdMap - A map from roster_id to owner_id.
 * @param {Function} getTeamName - A function to get the display name of a team.
 * @param {number} currentYear - The year for which playoffs is being calculated.
 * @param {Object} seasonalStatsForYear - Raw seasonal stats for all teams in the current year (from calculations.js's yearStatsRaw).
 * @returns {Array<Object>} An array of objects, each with roster_id and playoffFinish (rank).
 */
export const calculatePlayoffFinishes = (bracketData, rosterIdToOwnerIdMap, getTeamName, currentYear, seasonalStatsForYear) => {
    const { winnersBracket, losersBracket } = bracketData;
    const finalRanks = new Map(); // Map to store final ranks: roster_id -> rank

    // Helper to get team details (for logging/debugging)
    const getTeamDetails = (rosterId) => {
        const ownerId = rosterIdToOwnerIdMap.get(String(rosterId));
        return {
            roster_id: rosterId,
            owner_id: ownerId,
            teamName: getTeamName(ownerId, currentYear)
        };
    };

    // --- Step 1: Explicitly identify Champion, Runner-Up, and 3rd Place from Winners Bracket ---
    // These are the most important ranks and must be unique.
    // Find the championship match (p=1). If multiple, pick the one in the highest round (most final).
    const potentialChampionshipMatches = winnersBracket.filter(match => match.p === 1 && match.w && match.l);
    const championshipMatch = potentialChampionshipMatches.sort((a, b) => b.r - a.r)[0]; // Pick the one from the highest round

    if (championshipMatch) {
        const championRosterId = String(championshipMatch.w);
        const runnerUpRosterId = String(championshipMatch.l);

        // Assign ranks 1 and 2 only if they haven't been assigned yet.
        // This ensures absolute uniqueness for the top two spots.
        if (!finalRanks.has(championRosterId)) {
            finalRanks.set(championRosterId, 1);
            console.log(`[playoffRankings] Year ${currentYear}: Explicit Champion: ${getTeamDetails(championRosterId).teamName}`);
        }
        if (!finalRanks.has(runnerUpRosterId)) {
            finalRanks.set(runnerUpRosterId, 2);
            console.log(`[playoffRankings] Year ${currentYear}: Explicit Runner-Up: ${getTeamDetails(runnerUpRosterId).teamName}`);
        }
    } else {
        // Championship match not found or incomplete in winners bracket.
    }

    // Find the 3rd place match (p=3). If multiple, pick the one in the highest round.
    const potentialThirdPlaceMatches = winnersBracket.filter(match => match.p === 3 && match.w && match.l);
    const thirdPlaceMatch = potentialThirdPlaceMatches.sort((a, b) => b.r - a.r)[0]; // Pick the one from the highest round

    if (thirdPlaceMatch) {
        const thirdPlaceRosterId = String(thirdPlaceMatch.w);
        const fourthPlaceRosterId = String(thirdPlaceMatch.l);

        // Assign rank 3 only if it hasn't been assigned and the team doesn't already have a better rank
        if (!finalRanks.has(thirdPlaceRosterId) || finalRanks.get(thirdPlaceRosterId) > 3) {
            finalRanks.set(thirdPlaceRosterId, 3);
            console.log(`[playoffRankings] Year ${currentYear}: Explicit 3rd Place: ${getTeamDetails(thirdPlaceRosterId).teamName}`);
        }
        // Assign rank 4 only if it hasn't been assigned and the team doesn't already have a better rank
        if (!finalRanks.has(fourthPlaceRosterId) || finalRanks.get(fourthPlaceRosterId) > 4) {
            finalRanks.set(fourthPlaceRosterId, 4);
            console.log(`[playoffRankings] Year ${currentYear}: Explicit 4th Place: ${getTeamDetails(fourthPlaceRosterId).teamName}`);
        }
    } else {
        // 3rd Place match not found or incomplete in winners bracket.
    }

    // --- Step 2: Process other explicit place games (e.g., 5th, 7th, 9th, 11th) ---
    // These are less critical than top 3, but still explicit.
    // Ensure they don't overwrite higher ranks already set in Step 1.
    const otherPlaceMatches = [...winnersBracket, ...losersBracket].filter(match =>
        match.w && match.l && typeof match.p === 'number' && match.p !== 1 && match.p !== 3
    ).sort((a, b) => a.p - b.p); // Sort by place to process lower ranks first

    otherPlaceMatches.forEach(match => {
        const winnerId = String(match.w);
        const loserId = String(match.l);
        const rankWinner = match.p;
        const rankLoser = match.p + 1;

        // Only assign if the rank is not already set OR if the new rank is better (lower number)
        if (!finalRanks.has(winnerId) || finalRanks.get(winnerId) > rankWinner) {
            finalRanks.set(winnerId, rankWinner);
        }
        if (!finalRanks.has(loserId) || finalRanks.get(loserId) > rankLoser) {
            finalRanks.set(loserId, rankLoser);
        }
    });

    // Ranks after processing all explicit place games


    // --- Step 3: Assign ranks to remaining unranked teams based on playoff progression ---
    const allLeagueRosterIds = Array.from(rosterIdToOwnerIdMap.keys());
    let unrankedRosterIds = allLeagueRosterIds.filter(rosterId => !finalRanks.has(rosterId));

    // Track all participants in winners and losers brackets, and their deepest round reached
    const allBracketParticipants = new Map(); // rosterId -> max_round_reached

    // Populate allBracketParticipants from both brackets
    [...winnersBracket, ...losersBracket].forEach(match => {
        // Ensure t1, t2, w, l are resolved roster IDs (as done in sleeperApi.js's enrichBracketWithScores)
        if (match.t1) allBracketParticipants.set(String(match.t1), Math.max(match.r, allBracketParticipants.get(String(match.t1)) || 0));
        if (match.t2) allBracketParticipants.set(String(match.t2), Math.max(match.r, allBracketParticipants.get(String(match.t2)) || 0));
        if (match.w) allBracketParticipants.set(String(match.w), Math.max(match.r, allBracketParticipants.get(String(match.w)) || 0));
        if (match.l) allBracketParticipants.set(String(match.l), Math.max(match.r, allBracketParticipants.get(String(match.l)) || 0));
    });


    // Filter unranked teams that participated in any bracket (winners or losers)
    const unrankedPlayoffTeams = unrankedRosterIds.filter(rosterId => allBracketParticipants.has(rosterId));

    // Sort unranked playoff teams by deepest round reached (descending), then by regular season win % (desc), then pointsFor (desc)
    unrankedPlayoffTeams.sort((a, b) => {
        const roundA = allBracketParticipants.get(a) || 0;
        const roundB = allBracketParticipants.get(b) || 0;

        if (roundA !== roundB) return roundB - roundA; // Higher round reached is better

        // Tie-breaker: regular season win percentage
        const statsA = seasonalStatsForYear[a];
        const statsB = seasonalStatsForYear[b];

        if (!statsA && !statsB) return 0;
        if (!statsA) return 1; // Put teams with no stats at the end
        if (!statsB) return -1;

        const winPctA = statsA.totalGames > 0 ? (statsA.wins + 0.5 * statsA.ties) / statsA.totalGames : 0;
        const winPctB = statsB.totalGames > 0 ? (statsB.wins + 0.5 * statsB.ties) / statsB.totalGames : 0;

        if (winPctB !== winPctA) {
            return winPctB - winPctA;
        }
        // Secondary tie-breaker: total points for
        if (statsB.pointsFor !== statsA.pointsFor) {
            return statsB.pointsFor - statsA.pointsFor;
        }
        // Final tie-breaker: roster ID (ascending) for deterministic order
        return parseInt(a) - parseInt(b);
    });

    // Assign ranks to unranked playoff teams, filling in gaps
    let nextAvailableRank = 1;
    const takenRanks = new Set(Array.from(finalRanks.values()).filter(r => typeof r === 'number'));
    while(takenRanks.has(nextAvailableRank)) {
        nextAvailableRank++;
    }

    for (const rosterId of unrankedPlayoffTeams) {
        if (!finalRanks.has(rosterId)) {
            finalRanks.set(rosterId, nextAvailableRank);
            takenRanks.add(nextAvailableRank); // Mark as taken
            nextAvailableRank++;
            while(takenRanks.has(nextAvailableRank)) { // Ensure next rank is also available
                nextAvailableRank++;
            }
        }
    }

    // Ranks after processing unranked playoff teams


    // --- Step 4: Assign ranks to non-playoff teams (lowest ranks) ---
    const nonPlayoffTeams = allLeagueRosterIds.filter(rosterId => !finalRanks.has(rosterId));

    // Sort non-playoff teams by regular season performance (win %, then pointsFor) for lower ranks
    nonPlayoffTeams.sort((a, b) => {
        const statsA = seasonalStatsForYear[a];
        const statsB = seasonalStatsForYear[b];

        if (!statsA && !statsB) return 0;
        if (!statsA) return 1;
        if (!statsB) return -1;

        const winPctA = statsA.totalGames > 0 ? (statsA.wins + 0.5 * statsA.ties) / statsA.totalGames : 0;
        const winPctB = statsB.totalGames > 0 ? (statsB.wins + 0.5 * statsB.ties) / statsB.totalGames : 0;

        if (winPctB !== winPctA) { // Higher win percentage is better
            return winPctB - winPctA;
        }
        if (statsB.pointsFor !== statsA.pointsFor) { // Higher points for is better
            return statsB.pointsFor - statsA.pointsFor;
        }
        return parseInt(a) - parseInt(b); // Consistent tie-breaker: roster ID (ascending)
    });


    // Assign ranks to non-playoff teams, starting from the next available rank
    let currentNonPlayoffRank = 1;
    for (const rank of finalRanks.values()) {
        if (typeof rank === 'number') {
            currentNonPlayoffRank = Math.max(currentNonPlayoffRank, rank + 1);
        }
    }
    // Ensure we start from an unused rank
    while(takenRanks.has(currentNonPlayoffRank)) {
        currentNonPlayoffRank++;
    }


    for (const rosterId of nonPlayoffTeams) {
        if (!finalRanks.has(rosterId)) {
            finalRanks.set(rosterId, currentNonPlayoffRank);
            takenRanks.add(currentNonPlayoffRank); // Mark as taken
            currentNonPlayoffRank++;
            while(takenRanks.has(currentNonPlayoffRank)) { // Ensure next rank is also available
                currentNonPlayoffRank++;
            }
        }
    }

    // Final ranks assigned


    // Convert Map to array of objects
    const result = Array.from(finalRanks.entries()).map(([roster_id, rank]) => ({
        roster_id,
        playoffFinish: rank
    }));

    // Sort the results by rank
    result.sort((a, b) => {
        const rankA = typeof a.playoffFinish === 'number' ? a.playoffFinish : Infinity;
        const rankB = typeof b.playoffFinish === 'number' ? b.playoffFinish : Infinity;
        return rankA - rankB;
    });

    // Final sorted playoff finishes

    return result;
};

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.) - duplicated for self-containment
const getOrdinalSuffix = (n) => {
    if (typeof n !== 'number' || isNaN(n)) return '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return (s[v - 20] || s[v] || s[0]);
};

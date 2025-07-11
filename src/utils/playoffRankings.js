// src/utils/playoffRankings.js

/**
 * Calculates playoff finishes (ranks) for each team based on winners and losers bracket data.
 * It determines 1st, 2nd, 3rd place, and then ranks teams in the losers bracket.
 *
 * @param {Object} bracketData - An object containing winnersBracket and losersBracket arrays.
 * @param {Map<string, string>} rosterIdToOwnerIdMap - A map from roster_id to owner_id.
 * @param {Function} getTeamName - A function to get the display name of a team.
 * @param {number} currentYear - The year for which playoffs are being calculated.
 * @param {Object} seasonalStatsForYear - Raw seasonal stats for all teams in the current year (from calculations.js's yearStatsRaw).
 * @returns {Array<Object>} An array of objects, each with roster_id and playoffFinish (rank).
 */
export const calculatePlayoffFinishes = (bracketData, rosterIdToOwnerIdMap, getTeamName, currentYear, seasonalStatsForYear) => {
    const { winnersBracket, losersBracket } = bracketData;
    const finalRanks = new Map(); // Map to store final ranks: roster_id -> rank

    // Helper to get team details (for logging purposes)
    const getTeamDetails = (rosterId) => {
        const ownerId = rosterIdToOwnerIdMap.get(String(roosterId));
        return {
            roster_id: rosterId,
            owner_id: ownerId,
            teamName: getTeamName(ownerId, currentYear)
        };
    };

    // --- Process Winners Bracket for Championship, 3rd, 5th place ---
    // Sort winnersBracket by round (desc) and then match_id (desc) to ensure final matches are processed first
    const sortedWinnersBracket = [...winnersBracket].sort((a, b) => {
        if (b.r !== a.r) return b.r - a.r;
        return b.m - a.m;
    });

    sortedWinnersBracket.forEach(match => {
        if (match.w && match.l && typeof match.p === 'number') { // Only process if winner and loser are determined AND 'p' is present
            const winnerId = String(match.w);
            const loserId = String(match.l);

            let rankWinner = null;
            let rankLoser = null;

            if (match.p === 1) { // Championship Game
                rankWinner = 1;
                rankLoser = 2;
            } else if (match.p === 3) { // 3rd Place Game
                rankWinner = 3;
                rankLoser = 4;
            } else if (match.p === 5) { // 5th Place Game
                rankWinner = 5;
                rankLoser = 6;
            }

            if (rankWinner !== null) {
                // Assign ranks if not already assigned (e.g., if a team won multiple consolation games, only their highest rank counts)
                if (!finalRanks.has(winnerId)) {
                    finalRanks.set(winnerId, rankWinner);
                }
                if (!finalRanks.has(loserId)) {
                    finalRanks.set(loserId, rankLoser);
                }
            }
        }
    });

    // --- Process Losers Bracket for 7th, 9th, 11th place ---
    const sortedLosersBracket = [...losersBracket].sort((a, b) => {
        if (b.r !== a.r) return b.r - a.r;
        return b.m - a.m;
    });

    sortedLosersBracket.forEach(match => {
        if (match.w && match.l && typeof match.p === 'number') { // Only process if winner and loser are determined AND 'p' is present
            const winnerId = String(match.w);
            const loserId = String(match.l);

            // The 'p' value in losersBracket directly corresponds to the winner's rank
            const rankWinner = match.p;
            const rankLoser = match.p + 1; // Loser gets the next rank

            if (rankWinner !== null) {
                // Assign ranks, but only if the team hasn't already been assigned a higher (better) rank
                if (!finalRanks.has(winnerId) || finalRanks.get(winnerId) > rankWinner) {
                    finalRanks.set(winnerId, rankWinner);
                }
                if (!finalRanks.has(loserId) || finalRanks.get(loserId) > rankLoser) {
                    finalRanks.set(loserId, rankLoser);
                }
            }
        }
    });


    // --- Assign ranks to all remaining unranked teams based on regular season performance ---
    const allLeagueRosterIds = Array.from(rosterIdToOwnerIdMap.keys());
    const totalTeamsInLeague = allLeagueRosterIds.length;

    // Get all roster IDs that are still unranked
    let unrankedRosterIds = allLeagueRosterIds.filter(rosterId => !finalRanks.has(rosterId));

    // Sort unranked teams by regular season performance:
    // 1. Win Percentage (descending)
    // 2. Points For (descending)
    // 3. Roster ID (ascending, as a tie-breaker for consistency)
    unrankedRosterIds.sort((a, b) => {
        const statsA = seasonalStatsForYear[a];
        const statsB = seasonalStatsForYear[b];

        // Handle cases where stats might be missing
        if (!statsA && !statsB) return 0;
        if (!statsA) return 1; // Push missing stats to the end
        if (!statsB) return -1; // Pull valid stats forward

        const winPctA = statsA.totalGames > 0 ? (statsA.wins + 0.5 * statsA.ties) / statsA.totalGames : 0;
        const winPctB = statsB.totalGames > 0 ? (statsB.wins + 0.5 * statsB.ties) / statsB.totalGames : 0;

        if (winPctB !== winPctA) {
            return winPctB - winPctA; // Higher win percentage first
        }

        if (statsB.pointsFor !== statsA.pointsFor) {
            return statsB.pointsFor - statsA.pointsFor; // Higher points for first
        }

        return parseInt(a) - parseInt(b); // Fallback to roster ID
    });


    // Assign ranks to the remaining unranked teams, filling sequentially from the next available rank
    let nextAvailableRank = 1;
    // Find the highest rank already assigned to ensure we start from the next available integer rank
    for (const rank of finalRanks.values()) {
        if (typeof rank === 'number') {
            nextAvailableRank = Math.max(nextAvailableRank, rank + 1);
        }
    }
    // Ensure nextAvailableRank is at least 1
    nextAvailableRank = Math.max(1, nextAvailableRank);

    for (const rosterId of unrankedRosterIds) {
        if (!finalRanks.has(rosterId)) { // Double check in case it was assigned by a previous heuristic
            finalRanks.set(rosterId, nextAvailableRank);
            nextAvailableRank++;
        }
    }

    // Final safety net: Ensure all teams have a rank from 1 to totalTeamsInLeague
    // This handles any teams that might have been missed entirely (e.g., didn't play in playoffs, or data issues)
    allLeagueRosterIds.forEach(rosterId => {
        if (!finalRanks.has(rosterId)) {
            finalRanks.set(rosterId, nextAvailableRank);
            nextAvailableRank++;
        }
    });


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

    return result;
};

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.) - duplicated for self-containment
const getOrdinalSuffix = (n) => {
    if (typeof n !== 'number' || isNaN(n)) return '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return (s[v - 20] || s[v] || s[0]);
};

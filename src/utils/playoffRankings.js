// src/utils/playoffRankings.js

/**
 * Calculates the final playoff finish (1st, 2nd, ..., 12th) for each team
 * based on the structured playoff bracket data and known outcomes,
 * following the specific ranking rules provided for your league.
 *
 * @param {object} playoffData - Object containing winnersBracket and losersBracket arrays,
 * enriched with matchup results (w, l - winner/loser roster_id).
 * Example structure for playoffData: { winnersBracket: [...], losersBracket: [...] }
 * @param {Map<string, object>} rostersById - A map of roster_id (string) to full roster details
 * (e.g., { roster_id: '...', ownerDisplayName: '...', ownerTeamName: '...' }).
 * @returns {Array<object>} An array of team objects with their final 'playoffFinish' property,
 * sorted by rank.
 */
export function calculatePlayoffFinishes(playoffData, rostersById) {
    const { winnersBracket, losersBracket } = playoffData;
    const finalRankings = new Map(); // Map to store roster_id -> final rank

    // --- Winners Bracket Logic (1st - 6th) ---
    // These matches directly determine the top 6 positions.

    // 1st & 2nd Place: Championship Match (Round 3, Match 6)
    const championshipMatch = winnersBracket.find(m => m.r === 3 && m.m === 6);
    if (championshipMatch && championshipMatch.w && championshipMatch.l) {
        finalRankings.set(championshipMatch.w, 1); // Champion
        finalRankings.set(championshipMatch.l, 2); // Runner-Up
    } else {
        console.warn("Championship match (W:R3:M6) not found or not played yet. 1st/2nd place cannot be determined.");
    }

    // 3rd & 4th Place: 3rd Place Match (Round 3, Match 7)
    const thirdPlaceMatch = winnersBracket.find(m => m.r === 3 && m.m === 7);
    if (thirdPlaceMatch && thirdPlaceMatch.w && thirdPlaceMatch.l) {
        finalRankings.set(thirdPlaceMatch.w, 3); // 3rd Place
        finalRankings.set(thirdPlaceMatch.l, 4); // 4th Place
    } else {
        console.warn("3rd Place match (W:R3:M7) not found or not played yet. 3rd/4th place cannot be determined.");
    }

    // 5th & 6th Place: This is the winner/loser of a specific consolation match within the winners bracket.
    // Based on your provided data, this is Round 2, Match 5 in the Winners Bracket.
    const fifthSixthPlaceMatch = winnersBracket.find(m => m.r === 2 && m.m === 5);
    if (fifthSixthPlaceMatch && fifthSixthPlaceMatch.w && fifthSixthPlaceMatch.l) {
        finalRankings.set(fifthSixthPlaceMatch.w, 5); // 5th Place (Winner of this match)
        finalRankings.set(fifthSixthPlaceMatch.l, 6); // 6th Place (Loser of this match)
    } else {
        console.warn("5th Place match (W:R2:M5) not found or not played yet. 5th/6th place cannot be determined.");
    }

    // --- Losers Bracket Logic (7th - 12th) ---
    // These matches directly determine the 7th through 12th positions.

    // 7th & 8th Place: Consolation Championship (Round 3, Match 6 in your Losers Bracket)
    const consolationChampionshipMatch = losersBracket.find(m => m.r === 3 && m.m === 6);
    if (consolationChampionshipMatch && consolationChampionshipMatch.w && consolationChampionshipMatch.l) {
        finalRankings.set(consolationChampionshipMatch.w, 7); // 7th Place
        finalRankings.set(consolationChampionshipMatch.l, 8); // 8th Place
    } else {
        console.warn("Consolation Championship match (L:R3:M6) not found or not played yet. 7th/8th place cannot be determined.");
    }

    // 9th & 10th Place: Consolation 9th Place Match (Round 3, Match 7 in your Losers Bracket)
    const ninthTenthPlaceMatch = losersBracket.find(m => m.r === 3 && m.m === 7);
    if (ninthTenthPlaceMatch && ninthTenthPlaceMatch.w && ninthTenthPlaceMatch.l) {
        finalRankings.set(ninthTenthPlaceMatch.w, 9); // 9th Place
        finalRankings.set(ninthTenthPlaceMatch.l, 10); // 10th Place
    } else {
        console.warn("9th Place match (L:R3:M7) not found or not played yet. 9th/10th place cannot be determined.");
    }

    // 11th & 12th Place: Consolation 11th Place Match (Round 2, Match 5 in your Losers Bracket)
    const eleventhTwelfthPlaceMatch = losersBracket.find(m => m.r === 2 && m.m === 5);
    if (eleventhTwelfthPlaceMatch && eleventhTwelfthPlaceMatch.w && eleventhTwelfthPlaceMatch.l) {
        finalRankings.set(eleventhTwelfthPlaceMatch.w, 11); // 11th Place
        finalRankings.set(eleventhTwelfthPlaceMatch.l, 12); // 12th Place (Last Place)
    } else {
        console.warn("11th Place match (L:R2:M5) not found or not played yet. 11th/12th place cannot be determined.");
    }

    // --- Compile and Return Results ---
    const teamsWithPlayoffFinishes = [];
    rostersById.forEach(roster => {
        const finish = finalRankings.get(roster.roster_id);
        if (finish) { // Only include teams that have a determined playoff finish
            teamsWithPlayoffFinishes.push({
                roster_id: roster.roster_id,
                ownerDisplayName: roster.ownerDisplayName,
                ownerTeamName: roster.ownerTeamName,
                playoffFinish: finish
            });
        }
    });

    // Sort by playoff finish numerically
    return teamsWithPlayoffFinishes.sort((a, b) => a.playoffFinish - b.playoffFinish);
}

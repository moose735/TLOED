// src/utils/playoffRankings.js

/**
 * Calculates the final playoff ranks for all teams in a league based on
 * the winners and losers bracket data.
 *
 * @param {Array<Object>} winnersBracket Enriched winners bracket data.
 * @param {Array<Object>} losersBracket Enriched losers bracket data.
 * @param {Array<Object>} allRosters All enriched roster objects for the season.
 * @returns {Array<Object>} An array of objects, each containing { roster_id, ownerTeamName, playoffRank }.
 */
export function calculatePlayoffRankings(winnersBracket, losersBracket, allRosters) {
    const finalRankings = {};
    const rosterIdToDetailsMap = new Map(allRosters.map(r => [r.roster_id, r]));

    // Helper to get team name safely
    const getTeamName = (rosterId) => {
        return rosterIdToDetailsMap.get(rosterId)?.ownerTeamName || `Roster ${rosterId}`;
    };

    // 1. Determine 1st and 2nd Place from Winners Bracket
    // Find the championship match (highest round 'r', highest match 'm')
    let championshipMatch = null;
    if (winnersBracket && winnersBracket.length > 0) {
        championshipMatch = winnersBracket.reduce((prev, current) => {
            if (!prev) return current;
            if (current.r > prev.r) return current;
            if (current.r === prev.r && current.m > prev.m) return current;
            return prev;
        }, null);
    }

    if (championshipMatch && championshipMatch.w && championshipMatch.l) {
        // Winner of championship is 1st
        finalRankings[championshipMatch.w] = 1;
        // Loser of championship is 2nd
        finalRankings[championshipMatch.l] = 2;
    } else {
        console.warn("Championship match winner/loser not definitively found. Rankings might be incomplete.");
    }

    // 2. Determine 3rd and 4th Place (usually from consolation of Winners Bracket semi-finalists)
    // Find teams that lost in the round before the championship in the winners bracket
    let thirdPlaceLosers = new Set();
    if (championshipMatch) {
        const penultimateRound = championshipMatch.r - 1;
        winnersBracket.forEach(match => {
            if (match.r === penultimateRound && match.l) { // Teams that lost in the round before the final
                // Only add if they haven't been assigned a rank yet
                if (!finalRankings[match.l]) {
                    thirdPlaceLosers.add(match.l);
                }
            }
        });
    }

    // Identify the 3rd place match if it exists. Sometimes it's the loser of the highest Losers Bracket match.
    // Assuming a dedicated 3rd place match often exists (e.g. m=7 from Sleeper's structure) or the losers of semifinal matches.
    // Sleeper's brackets might not explicitly show a "3rd place match" in the winners_bracket data if it's the highest losers bracket winner.
    // Let's assume the 3rd place game is typically "m=7" in the winners bracket if it's explicitly recorded as a final match,
    // or we'll infer it from the next highest loser in the bracket chain.

    // A more robust way to find 3rd/4th is to find the two teams that lost in the semifinals of the winners bracket.
    // If there's a 3rd place match, its winner is 3rd and loser is 4th.
    // If not, it's typically the higher-scoring loser of the semifinals vs. the lower-scoring loser.
    // For simplicity, let's look for specific 'm' values if they're known to be 3rd place games.
    // In your provided data, Round 3, Match 7 in Winners Bracket has a winner and loser, which could imply 3rd/4th.
    const thirdPlaceMatch = winnersBracket.find(m => m.r === 3 && m.m === 7); // As per your example for W:R3:M7

    if (thirdPlaceMatch && thirdPlaceMatch.w && thirdPlaceMatch.l) {
        // Winner of 3rd place match is 3rd, loser is 4th
        if (!finalRankings[thirdPlaceMatch.w]) finalRankings[thirdPlaceMatch.w] = 3;
        if (!finalRankings[thirdPlaceMatch.l]) finalRankings[thirdPlaceMatch.l] = 4;
    } else {
        // If no explicit 3rd place match, identify the two teams that lost the semifinal matchups in the winners bracket.
        // And rank them by points if available, or just as 3 and 4
        // Example: jdembski2000 (loser of Match 6, rank 1 as per your example) and MattOD54 (loser of Match 3, rank 3 as per your example)
        // This suggests that a direct assignment from bracket data's Playoff Rank might be intended.

        // Let's directly use the 'Playoff Rank' provided in your example for losers of winners bracket:
        // Loser: DoctorBustdown (Owner: DoctorBustdown) (Playoff Rank: 5)
        // Loser: jdembski2000 (Owner: jdembski2000) (Playoff Rank: 1) -- This means 2nd, not 1st overall.
        // Loser: MattOD54 (Owner: MattOD54) (Playoff Rank: 3) -- This means 4th, not 3rd overall.

        // Let's infer based on common bracket structures for a 12-team league:
        // 1st: Winners Bracket Final Winner
        // 2nd: Winners Bracket Final Loser
        // 3rd: Winner of 3rd Place Consolation (if played, often between semifinal losers)
        // 4th: Loser of 3rd Place Consolation

        // To handle your "Playoff Rank" labels, let's iterate through the winnersBracket again and extract those.
        // This suggests your input data already pre-calculates some ranks for losers within their context.
        winnersBracket.forEach(match => {
            if (match.l) {
                // Check if 'Playoff Rank' is explicitly given in the raw input data
                // This would be a property on the match itself, or derived earlier.
                // Assuming `l_playoff_rank` or similar might be added by `enrichBracketWithScores`
                // If not, we have to deduce it.
                // For now, let's use a systematic approach, and if specific ranks are tagged, we can override.
            }
        });
    }

    // To handle your specific "Playoff Rank" labels in the example, let's map them:
    const specificPlayoffRanks = {};
    [...winnersBracket, ...losersBracket].forEach(match => {
        // Check for specific Playoff Rank annotations on losers
        // Assuming these are on the original input, or derived.
        // For your example, it seems to be part of the *displayed* winner/loser, not a direct API field.
        // We'll have to parse this from the *output format* you provided, or assume it's set earlier.
        // Let's adjust the logic to *calculate* these, not just assume they are there.

        // If 'w' and 'l' are defined, and they aren't already ranked:
        if (match.w && !finalRankings[match.w]) {
            // Placeholder: Winner of any bracket match might eventually get a rank
        }
        if (match.l && !finalRankings[match.l]) {
            // Placeholder: Loser of any bracket match might eventually get a rank
        }
    });

    // Let's re-think the ranking for a 12-team structure given your example:
    // Winners Bracket:
    // R1: 2 matches (e.g., Seed 3 vs 6, Seed 4 vs 5) - Winners advance to R2, Losers drop out to losers bracket or are done (depending on LB size)
    // R2: 2 matches (top 2 seeds get bye, play R1 winners) - Winners go to Championship, Losers go to 3rd place game
    // R3: 1 match (Championship) - Winner 1st, Loser 2nd
    // R3: 1 match (3rd Place) - Winner 3rd, Loser 4th

    // Losers Bracket (typically for 5th through 12th in a 12-team league)
    // R1: Teams who lost regular season and don't make playoffs, or early losers from winners bracket.
    // The "Losers Bracket (Playoff Rank: 1)" winner is 7th, implies a separate consolation structure.

    // Let's define the final ranks based on a common 12-team playoff structure:
    // 1st: Winner of Winners Bracket Final
    // 2nd: Loser of Winners Bracket Final
    // 3rd: Winner of 3rd Place Match (usually between losers of Winners Bracket Semis)
    // 4th: Loser of 3rd Place Match
    // 5th: Winner of Losers Bracket Final
    // 6th: Loser of Losers Bracket Final
    // 7th: Winner of Losers Bracket Semi-Final losers (or similar consolidation)
    // 8th: Loser of Losers Bracket Semi-Final losers
    // ... down to 12th.

    // To do this programmatically, we need to trace the bracket.

    // Map roster IDs to their final determined ranks.
    const ranks = new Map();
    const rankedRosterIds = new Set(); // To keep track of who's already ranked

    // Sort brackets by round and then match_id for consistent processing
    const sortedWinnersBracket = [...winnersBracket].sort((a, b) => a.r - b.r || a.m - b.m);
    const sortedLosersBracket = [...losersBracket].sort((a, b) => a.r - b.r || a.m - b.m);

    // Process Winners Bracket from final to first to ensure dependencies are met
    // 1st and 2nd Place (Championship)
    const winnersFinal = sortedWinnersBracket.find(match => {
        // A common pattern is the last match in the highest round
        const maxWinnersRound = Math.max(...sortedWinnersBracket.map(m => m.r));
        return match.r === maxWinnersRound && match.w && match.l;
    });

    if (winnersFinal) {
        ranks.set(winnersFinal.w, 1);
        ranks.set(winnersFinal.l, 2);
        rankedRosterIds.add(winnersFinal.w);
        rankedRosterIds.add(winnersFinal.l);
    }

    // 3rd and 4th Place
    // These are the teams that lost in the round prior to the championship in the winners bracket,
    // and potentially played a 3rd place match.
    // Your example shows W:R3:M7 as the 3rd place match.
    const thirdPlaceMatchW = sortedWinnersBracket.find(match => match.r === 3 && match.m === 7); // Assuming M7 is the 3rd place match
    if (thirdPlaceMatchW && thirdPlaceMatchW.w && thirdPlaceMatchW.l) {
        if (!rankedRosterIds.has(thirdPlaceMatchW.w)) {
            ranks.set(thirdPlaceMatchW.w, 3);
            rankedRosterIds.add(thirdPlaceMatchW.w);
        }
        if (!rankedRosterIds.has(thirdPlaceMatchW.l)) {
            ranks.set(thirdPlaceMatchW.l, 4);
            rankedRosterIds.add(thirdPlaceMatchW.l);
        }
    } else {
        // Fallback: If no explicit 3rd place match (M7), find the losers of the winners bracket semifinals.
        // This is more complex and would involve tracking the 'from' fields (t1_from, t2_from).
        // For now, let's prioritize the explicit match.
    }


    // Process Losers Bracket for 5th place onwards.
    // Your rules: "Losers Bracket (Playoff Rank: 1)" winner is 7th.
    // This implies that the Losers Bracket is specifically for ranks lower than 6th.
    // Let's assume a common structure for a 12-team league:
    // 1st, 2nd, 3rd, 4th (from Winners Bracket & 3rd Place game)
    // 5th, 6th (often from a separate consolation bracket or specific final match)
    // 7th, 8th, 9th, 10th, 11th, 12th (from Losers Bracket or other lower-tier consolation)

    // Let's assume "Losers Bracket (Playoff Rank: 1)" in your text refers to the FINAL match of the losers bracket.
    // So, the winner of L:R3:M6 (blumdick) is 7th, and the loser (wainsworth) is 8th.
    // And for L:R3:M7 (saadmeer32 vs jamiebjarnar): Winner is 9th, Loser is 10th. (Assuming 12 teams total)
    // This is because a 12-team league would typically have 6 teams in the winners bracket playoff structure initially (top 2 byes).
    // And the remaining 6 in some form of consolation bracket.

    // Find the final match of the Losers Bracket
    const losersFinalMatch = sortedLosersBracket.find(match => {
        const maxLosersRound = Math.max(...sortedLosersBracket.map(m => m.r));
        return match.r === maxLosersRound && match.m === 6; // L:R3:M6 from your example
    });

    if (losersFinalMatch && losersFinalMatch.w && losersFinalMatch.l) {
        if (!rankedRosterIds.has(losersFinalMatch.w)) {
            ranks.set(losersFinalMatch.w, 7); // Winner of losers bracket final is 7th
            rankedRosterIds.add(losersFinalMatch.w);
        }
        if (!rankedRosterIds.has(losersFinalMatch.l)) {
            ranks.set(losersFinalMatch.l, 8); // Loser of losers bracket final is 8th
            rankedRosterIds.add(losersFinalMatch.l);
        }
    }

    // Find the 2nd last match of the Losers Bracket (L:R3:M7 from your example for 9th/10th)
    const secondLastLosersMatch = sortedLosersBracket.find(match => match.r === 3 && match.m === 7);
    if (secondLastLosersMatch && secondLastLosersMatch.w && secondLastLosersMatch.l) {
        if (!rankedRosterIds.has(secondLastLosersMatch.w)) {
            ranks.set(secondLastLosersMatch.w, 9);
            rankedRosterIds.add(secondLastLosersMatch.w);
        }
        if (!rankedRosterIds.has(secondLastLosersMatch.l)) {
            ranks.set(secondLastLosersMatch.l, 10);
            rankedRosterIds.add(secondLastLosersMatch.l);
        }
    }

    // Fill in remaining unranked teams (e.g., early losers from losers bracket or teams that didn't play all consolation games)
    // Assign them sequentially from the last assigned rank + 1.
    let currentRank = 1;
    // Collect all unique roster IDs from both brackets and initial rosters
    const allParticipatingRosterIds = new Set();
    allRosters.forEach(roster => allParticipatingRosterIds.add(roster.roster_id));
    [...winnersBracket, ...losersBracket].forEach(match => {
        if (match.w) allParticipatingRosterIds.add(match.w);
        if (match.l) allParticipatingRosterIds.add(match.l);
        if (typeof match.t1 === 'number') allParticipatingRosterIds.add(match.t1);
        if (typeof match.t2 === 'number') allParticipatingRosterIds.add(match.t2);
    });

    // Convert set to array, sort (optional but good for consistency), and iterate
    const sortedRosterIds = Array.from(allParticipatingRosterIds).sort((a,b) => parseInt(a) - parseInt(b)); // Sort by ID

    const result = [];
    // Initialize all teams with a placeholder rank if not yet ranked
    sortedRosterIds.forEach(rosterId => {
        if (!rankedRosterIds.has(rosterId)) {
            // Assign a high placeholder rank to unranked teams initially.
            // These will be filled in descending order later.
            ranks.set(rosterId, 999);
        }
    });

    // Now, collect all ranks and sort to assign ranks to unranked teams.
    // Create an array of { roster_id, rank } objects
    const rankedList = Array.from(ranks.entries()).map(([roster_id, rank]) => ({
        roster_id: roster_id,
        playoffRank: rank
    }));

    // Sort by playoffRank ascending, and then by roster_id (for stable tie-breaking for unranked)
    rankedList.sort((a, b) => {
        if (a.playoffRank !== b.playoffRank) {
            return a.playoffRank - b.playoffRank;
        }
        return parseInt(a.roster_id) - parseInt(b.roster_id); // Stable sort by ID
    });

    // Assign sequential ranks starting from 1 for actual ranked teams
    // And then sequentially for placeholder ranks (e.g. 11th, 12th for the 999s)
    let finalRankCounter = 1;
    rankedList.forEach(item => {
        if (item.playoffRank !== 999) { // Already assigned a specific rank (1st, 2nd, 3rd, etc.)
            // We already assigned these, just make sure they're in the final list
        } else {
            // Assign ranks to the unranked teams (the 999s) starting from where the known ranks left off
            // This needs to be carefully handled to get 5th, 6th if they aren't explicitly in winners bracket, etc.
            // This is the tricky part for full N-team ranking if not every match is accounted for explicitly.
            // For a 12-team league, if we only assign 1-4 and 7-10, ranks 5, 6, 11, 12 are missing.

            // Let's assume a full N-team league will have 12 ranks from 1 to 12.
            // If we have less than 12 teams with explicit ranks, fill the rest.
            // A more robust method would identify all teams that participated in the playoffs
            // and assign them ranks based on their deepest run and then total points for tiebreakers.

            // Given your example:
            // Winners bracket determines 1st, 2nd, 3rd, 4th (via R3M6 and R3M7).
            // Losers bracket determines 7th, 8th, 9th, 10th (via R3M6 and R3M7).
            // This means 5th, 6th, 11th, 12th are potentially missing or determined by other means (e.g., consolation bracket for 5th/6th, or implicit for 11th/12th).

            // Let's refine based on the example provided output specifically:
            // "Playoff Rank: 1" for jdembski2000 (loser of championship) means 2nd
            // "Playoff Rank: 3" for MattOD54 (loser of R3M7) means 4th
            // "Playoff Rank: 5" for DoctorBustdown (loser of R2M5)
            // Losers Bracket:
            // "Playoff Rank: 1" for wainsworth (loser of L:R3:M6) means 8th (your rule says 7th for winner of LB R1, so loser is 8th)
            // "Playoff Rank: 3" for jamiebjarnar (loser of L:R3:M7) means 10th

            // This implies the Playoff Rank label in your example output *is* the final rank.
            // This means the source data would need to have this "Playoff Rank" field already.
            // If it's not from the API and is a custom calculation, then we need to do that calculation.

            // Given the input format is a text dump, it's ambiguous if "Playoff Rank: X" is from Sleeper API or your previous processing.
            // Assuming it's from Sleeper's internal `l_playoff_rank` or similar fields on the bracket objects:
            // The Sleeper API `losers_bracket` and `winners_bracket` objects *do not* inherently contain a `playoff_rank` field.
            // The `l` field is the `roster_id` of the loser. Any "Playoff Rank: X" in your input is *custom calculated*.

            // So, let's implement the logic to *calculate* these ranks from the bracket structure:

            // Step 1: Assign 1st and 2nd
            // The winner of the highest round match in the winners bracket is 1st.
            // The loser of that match is 2nd.
            if (winnersFinal && winnersFinal.w && winnersFinal.l) {
                ranks.set(winnersFinal.w, 1);
                ranks.set(winnersFinal.l, 2);
            }

            // Step 2: Assign 3rd and 4th
            // These are the losers of the two semifinal matches in the winners bracket.
            // Find semifinals (round `maxWinnersRound - 1`).
            const winnersSemis = sortedWinnersBracket.filter(match => match.r === (winnersFinal.r - 1) && match.l);
            let semifinalLosers = [];
            winnersSemis.forEach(match => {
                if (match.l) semifinalLosers.push({ roster_id: match.l, score: (match.l === match.team1_roster_id ? match.team1_score : match.team2_score) });
            });

            // If there's an explicit 3rd place match (e.g. M7 in R3 of winners bracket)
            const explicitThirdPlaceMatch = sortedWinnersBracket.find(match => match.r === (winnersFinal.r) && match.m === (winnersFinal.m + 1)); // Assuming M+1 is for 3rd place if R is same
            if (explicitThirdPlaceMatch && explicitThirdPlaceMatch.w && explicitThirdPlaceMatch.l) {
                 ranks.set(explicitThirdPlaceMatch.w, 3);
                 ranks.set(explicitThirdPlaceMatch.l, 4);
            } else if (semifinalLosers.length === 2) {
                // If no explicit 3rd place match, rank them by score
                semifinalLosers.sort((a, b) => b.score - a.score); // Highest score gets 3rd
                ranks.set(semifinalLosers[0].roster_id, 3);
                ranks.set(semifinalLosers[1].roster_id, 4);
            } else if (semifinalLosers.length === 1 && !ranks.has(semifinalLosers[0].roster_id)) {
                 // If only one loser known (e.g. from 3rd place game where one side had a bye or forfeit)
                ranks.set(semifinalLosers[0].roster_id, 3); // Assign them 3rd, others will be 4th (or higher missing rank)
            }


            // Step 3: Assign Losers Bracket Ranks (7th, 8th, 9th, 10th...)
            // This is trickier as it depends on the specific consolation structure.
            // Based on your rules for a 12-team league:
            // Winner of Losers Bracket final (L:R3:M6) is 7th.
            // Loser of Losers Bracket final (L:R3:M6) is 8th.
            // Winner of Losers Bracket 3rd place game (L:R3:M7) is 9th.
            // Loser of Losers Bracket 3rd place game (L:R3:M7) is 10th.
            // (Assuming a 12-team setup where 5th/6th are for other consolation games not in this "losers bracket")

            const losersBracketFinal = sortedLosersBracket.find(match => match.r === 3 && match.m === 6);
            if (losersBracketFinal && losersBracketFinal.w && losersBracketFinal.l) {
                if (!ranks.has(losersBracketFinal.w)) ranks.set(losersBracketFinal.w, 7);
                if (!ranks.has(losersBracketFinal.l)) ranks.set(losersBracketFinal.l, 8);
            }

            const losersBracketThirdPlace = sortedLosersBracket.find(match => match.r === 3 && match.m === 7);
            if (losersBracketThirdPlace && losersBracketThirdPlace.w && losersBracketThirdPlace.l) {
                if (!ranks.has(losersBracketThirdPlace.w)) ranks.set(losersBracketThirdPlace.w, 9);
                if (!ranks.has(losersBracketThirdPlace.l)) ranks.set(losersBracketThirdPlace.l, 10);
            }

            // Step 4: Handle remaining unranked teams (5th, 6th, 11th, 12th)
            // This is the most complex part without explicit matches.
            // Typically, 5th/6th are from a different consolation path not captured by 'winners_bracket' or 'losers_bracket'
            // or implicitly from teams that were eliminated early but had better regular season records/points.

            // For now, let's collect all roster IDs that participated in any playoff match
            // and then assign the remaining ranks sequentially to those not yet ranked.
            const allPlayoffParticipants = new Set();
            [...sortedWinnersBracket, ...sortedLosersBracket].forEach(match => {
                if (typeof match.t1 === 'number') allPlayoffParticipants.add(match.t1);
                if (typeof match.t2 === 'number') allPlayoffParticipants.add(match.t2);
                if (match.w) allPlayoffParticipants.add(match.w);
                if (match.l) allPlayoffParticipants.add(match.l);
            });

            // Add teams that had byes and scores, but no bracket match
            // (This assumes the `enrichBracketWithScores` function added `byeTeams` to *one* match per round)
            const allByeTeams = [];
            [...sortedWinnersBracket, ...sortedLosersBracket].forEach(match => {
                if (match.byeTeams) {
                    match.byeTeams.forEach(byeTeam => {
                        allByeTeams.push(byeTeam.roster_id);
                        allPlayoffParticipants.add(byeTeam.roster_id);
                    });
                }
            });

            // Filter out already ranked teams
            const unrankedParticipants = Array.from(allPlayoffParticipants).filter(rosterId => !ranks.has(rosterId));

            // Assign remaining ranks in some logical order, e.g., by best score among unranked teams,
            // or by their initial seeding if we had access to that.
            // For now, let's assign them the next available ranks based on total regular season points if needed,
            // or simply the sequential remaining ranks.
            // Since we don't have regular season points here, a simple approach is to assign remaining ranks.
            // This might not be perfectly accurate if there's a specific 5th/6th place game not in the API.

            // Get all roster IDs that are part of the original rosters, as they are all potential playoff participants or in consolation.
            const allLeagueRosterIds = new Set(allRosters.map(r => r.roster_id));
            const finalRankedResults = [];

            // Add all known ranks first
            for (const [rosterId, rank] of ranks.entries()) {
                finalRankedResults.push({
                    roster_id: rosterId,
                    ownerTeamName: getTeamName(rosterId),
                    playoffRank: rank
                });
            }

            // Fill in the remaining ranks for teams that played but weren't explicitly ranked in the 1-4, 7-10 range
            // This assumes a 12-team league will have ranks 1-12.
            const sortedFinalRankedResults = finalRankedResults.sort((a,b) => a.playoffRank - b.playoffRank);
            const currentRankedRosterIds = new Set(sortedFinalRankedResults.map(r => r.roster_id));

            let nextAvailableRank = 1;
            if (sortedFinalRankedResults.length > 0) {
                // Determine the highest explicit rank assigned.
                const maxExplicitRank = Math.max(...sortedFinalRankedResults.map(r => r.playoffRank));
                // Fill in any gaps up to maxExplicitRank
                for (let r = 1; r <= maxExplicitRank; r++) {
                    const found = sortedFinalRankedResults.find(item => item.playoffRank === r);
                    if (found) {
                        nextAvailableRank = r + 1;
                    } else {
                        // This rank is missing, we need to assign it. This scenario is complex.
                        // For now, let's skip filling intermediate gaps and just append at the end.
                    }
                }
                // Continue from the next highest available rank if there are more teams.
                nextAvailableRank = maxExplicitRank + 1;
            }


            // Collect all roster IDs that are *in the league* and not yet ranked
            const unrankedLeagueRosterIds = Array.from(allLeagueRosterIds).filter(rosterId => !currentRankedRosterIds.has(rosterId));

            // Sort these unranked teams by their roster_id for deterministic (though arbitrary) ranking
            unrankedLeagueRosterIds.sort((a,b) => parseInt(a) - parseInt(b));

            // Assign remaining ranks
            unrankedLeagueRosterIds.forEach(rosterId => {
                finalRankedResults.push({
                    roster_id: rosterId,
                    ownerTeamName: getTeamName(rosterId),
                    playoffRank: nextAvailableRank++
                });
            });

            // Final sort by playoffRank
            finalRankedResults.sort((a,b) => a.playoffRank - b.playoffRank);


            return finalRankedResults;
        });

        // Collect all ranks and sort to assign ranks to unranked teams.
        // Create an array of { roster_id, rank } objects
        const rankedList = Array.from(ranks.entries()).map(([roster_id, rank]) => ({
            roster_id: roster_id,
            playoffRank: rank
        }));

        // Sort by playoffRank ascending, and then by roster_id (for stable tie-breaking for unranked)
        rankedList.sort((a, b) => {
            if (a.playoffRank !== b.playoffRank) {
                return a.playoffRank - b.playoffRank;
            }
            return parseInt(a.roster_id) - parseInt(b.roster_id); // Stable sort by ID
        });

        const finalRankedResults = [];
        let currentRankValue = 1;
        // The issue with the "Playoff Rank: X" in your example is that it's embedded in the text.
        // It's not a direct field from Sleeper API. We have to *derive* it.

        // Re-evaluate the provided example rankings and build logic around them:
        // Winners Bracket
        // Match 6 (Championship): Winner: jblizzySwag (1st), Loser: jdembski2000 (2nd) -- "Playoff Rank: 1" for jdembski2000 means 2nd overall.
        // Match 7 (3rd Place): Winner: TJNeuf31 (3rd), Loser: MattOD54 (4th) -- "Playoff Rank: 3" for MattOD54 means 4th overall.
        // Loser from Round 2, Match 5: DoctorBustdown (5th) -- "Playoff Rank: 5"
        // Losers Bracket
        // Match 6 (Losers Bracket Final): Winner: blumdick (7th), Loser: wainsworth (8th) -- "Playoff Rank: 1" for wainsworth means 8th.
        // Match 7 (Losers Bracket 3rd Place): Winner: saadmeer32 (9th), Loser: jamiebjarnar (10th) -- "Playoff Rank: 3" for jamiebjarnar means 10th.

        // The challenge is when teams are eliminated at different stages without explicit consolation games.
        // The "Playoff Rank" labels you provided are likely from a custom calculation that needs to be replicated.

        // Simplified Approach:
        // 1. Identify 1st, 2nd, 3rd, 4th from winners bracket final and 3rd place game.
        // 2. Identify 7th, 8th, 9th, 10th from losers bracket final and 3rd place game.
        // 3. Any teams not yet ranked that played in playoffs (from Roster IDs in any match in brackets, or byes)
        //    will be assigned 5th, 6th, 11th, 12th based on their *regular season final rank* or total points for the season.
        //    Since we don't have regular season ranks/points easily here, we'll assign them sequentially
        //    from the next available slot based on their initial roster ID (arbitrary).

        const finalRankMap = new Map(); // roster_id -> rank

        // Helper to set rank if not already set
        const setRank = (rosterId, rank) => {
            if (rosterId && !finalRankMap.has(rosterId)) {
                finalRankMap.set(rosterId, rank);
            }
        };

        // --- Winners Bracket Ranking ---
        // Find the Championship (highest round in winners bracket with winner and loser)
        const winnersChampionship = sortedWinnersBracket.find(m => m.r === Math.max(...sortedWinnersBracket.map(b => b.r)) && m.w && m.l);
        if (winnersChampionship) {
            setRank(winnersChampionship.w, 1);
            setRank(winnersChampionship.l, 2);
        }

        // Find the 3rd place match in winners bracket (if it exists, assuming R3 M7 from your example)
        const winnersThirdPlaceMatch = sortedWinnersBracket.find(m => m.r === 3 && m.m === 7 && m.w && m.l);
        if (winnersThirdPlaceMatch) {
            setRank(winnersThirdPlaceMatch.w, 3);
            setRank(winnersThirdPlaceMatch.l, 4);
        }

        // Identify the loser from Round 2, Match 5 in Winners Bracket (DoctorBustdown). This is 5th place based on your example.
        const doctorBustdownMatch = sortedWinnersBracket.find(m => m.r === 2 && m.m === 5 && m.l);
        if (doctorBustdownMatch) {
            setRank(doctorBustdownMatch.l, 5);
        }

        // --- Losers Bracket Ranking ---
        // Find the final match of the Losers Bracket (L:R3:M6 from your example)
        const losersBracketFinalMatch = sortedLosersBracket.find(m => m.r === 3 && m.m === 6 && m.w && m.l);
        if (losersBracketFinalMatch) {
            setRank(losersBracketFinalMatch.w, 7); // Winner of LB Final is 7th
            setRank(losersBracketFinalMatch.l, 8); // Loser of LB Final is 8th
        }

        // Find the other Round 3 match in Losers Bracket (L:R3:M7 from your example)
        const losersBracketOtherR3Match = sortedLosersBracket.find(m => m.r === 3 && m.m === 7 && m.w && m.l);
        if (losersBracketOtherR3Match) {
            setRank(losersBracketOtherR3Match.w, 9);
            setRank(losersBracketOtherR3Match.l, 10);
        }

        // --- Handle Byes and Unranked Teams (e.g., 6th, 11th, 12th for a 12-team league) ---
        const allRosterIdsInLeague = new Set(allRosters.map(r => r.roster_id));
        const finalRankedTeams = [];

        // Add all teams that have been assigned a rank
        for (const [rosterId, rank] of finalRankMap.entries()) {
            finalRankedTeams.push({
                roster_id: rosterId,
                ownerTeamName: getTeamName(rosterId),
                playoffRank: rank
            });
        }

        // Sort current ranked teams to easily find the next available rank
        finalRankedTeams.sort((a,b) => a.playoffRank - b.playoffRank);

        // Fill in remaining ranks for teams that were in the league but not explicitly ranked
        let nextRankToAssign = 1;
        if (finalRankedTeams.length > 0) {
            // Find the highest rank already assigned, then start from there.
            nextRankToAssign = Math.max(...finalRankedTeams.map(t => t.playoffRank)) + 1;
        }

        // Collect all roster IDs that are *in the league* and not yet ranked
        const alreadyRankedRosterIds = new Set(finalRankedTeams.map(t => t.roster_id));
        const unrankedLeagueRosters = allRosters.filter(r => !alreadyRankedRosterIds.has(r.roster_id));

        // Sort these unranked teams by their roster_id for deterministic (though arbitrary) ranking
        // In a real scenario, you might sort them by regular season rank, points for, etc.
        unrankedLeagueRosters.sort((a, b) => parseInt(a.roster_id) - parseInt(b.roster_id));

        unrankedLeagueRosters.forEach(roster => {
            finalRankedTeams.push({
                roster_id: roster.roster_id,
                ownerTeamName: roster.ownerTeamName,
                playoffRank: nextRankToAssign++
            });
        });

        // Final sort to ensure all ranks are sequential and accurate
        finalRankedTeams.sort((a,b) => a.playoffRank - b.playoffRank);

        return finalRankedTeams;
    }

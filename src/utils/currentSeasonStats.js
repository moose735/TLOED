// Current season team statistics for enhanced spread calculations
// Based on the power rankings data provided

export const currentSeasonStats = {
    'Mayfield of Dreams': {
        rank: 1,
        dpr: 1.263,
        record: '3-1',
        pointsFor: 610.98,
        pointsAgainst: 504.03,
        luck: -0.455,
        projectedRecord: '12-2',
        avgPerGame: 152.75, // 610.98 / 4
        tier: 2
    },
    'The Wolf of Waller Street': {
        rank: 2,
        dpr: 1.131,
        record: '3-1', 
        pointsFor: 529.25,
        pointsAgainst: 465.87,
        luck: 0.727,
        projectedRecord: '10-4',
        avgPerGame: 132.31, // 529.25 / 4
        tier: 3
    },
    'Allen Merchants': {
        rank: 3,
        dpr: 1.057,
        record: '3-1',
        pointsFor: 496.06,
        pointsAgainst: 462.59, 
        luck: 0.818,
        projectedRecord: '8-6',
        avgPerGame: 124.02, // 496.06 / 4
        tier: 3
    },
    'Crude Crushers': {
        rank: 4,
        dpr: 1.049,
        record: '2-2',
        pointsFor: 525.40,
        pointsAgainst: 506.36,
        luck: -0.455,
        projectedRecord: '10-4',
        avgPerGame: 131.35, // 525.40 / 4
        tier: 3
    },
    'Fupa Fappers': {
        rank: 5,
        dpr: 1.017,
        record: '3-1',
        pointsFor: 466.40,
        pointsAgainst: 433.41,
        luck: 1.364,
        projectedRecord: '7-7',
        avgPerGame: 116.60, // 466.40 / 4
        isCold: true,
        tier: 3
    },
    'Burrowing for Brownies': {
        rank: 6,
        dpr: 0.989,
        record: '2-2',
        pointsFor: 475.66,
        pointsAgainst: 432.12,
        luck: 0.364,
        projectedRecord: '6-8',
        avgPerGame: 118.92, // 475.66 / 4
        isHot: true,
        tier: 3
    },
    'The Freakshow': {
        rank: 7,
        dpr: 0.967,
        record: '2-2',
        pointsFor: 464.48,
        pointsAgainst: 491.23,
        luck: 0.182,
        projectedRecord: '5-9',
        avgPerGame: 116.12, // 464.48 / 4
        isCold: true,
        tier: 3
    },
    'Michael Vick\'s Vet Clinic': {
        rank: 8,
        dpr: 0.947,
        record: '1-3',
        pointsFor: 496.22,
        pointsAgainst: 576.35,
        luck: -1.182,
        projectedRecord: '7-7',
        avgPerGame: 124.06, // 496.22 / 4
        tier: 3
    },
    'A Touch Of Downs': {
        rank: 9,
        dpr: 0.928,
        record: '2-2',
        pointsFor: 470.67,
        pointsAgainst: 514.59,
        luck: 0.000,
        projectedRecord: '6-8',
        avgPerGame: 117.67, // 470.67 / 4
        tier: 3
    },
    'The Nightriders': {
        rank: 10,
        dpr: 0.901,
        record: '1-3',
        pointsFor: 478.29,
        pointsAgainst: 536.89,
        luck: -0.636,
        projectedRecord: '5-9',
        avgPerGame: 119.57, // 478.29 / 4
        isCold: true,
        tier: 3
    },
    'Team of Constant Sorrow': {
        rank: 11,
        dpr: 0.889,
        record: '1-3',
        pointsFor: 475.19,
        pointsAgainst: 532.27,
        luck: -0.545,
        projectedRecord: '5-9',
        avgPerGame: 118.80, // 475.19 / 4
        isCold: true,
        tier: 3
    },
    'Je_B': {
        rank: 12,
        dpr: 0.862,
        record: '1-3',
        pointsFor: 449.82,
        pointsAgainst: 482.71,
        luck: -0.182,
        projectedRecord: '3-11',
        avgPerGame: 112.46, // 449.82 / 4
        isCold: true,
        tier: 3
    }
};

/**
 * Calculate probability-based spread with team stats adjustments
 * Win probability is the PRIMARY factor, team stats provide minor adjustments
 */
export function calculateEnhancedSpread(team1Name, team2Name, winProbability = 0.5) {
    const team1Current = currentSeasonStats[team1Name];
    const team2Current = currentSeasonStats[team2Name];
    
    if (!team1Current || !team2Current) {
        console.warn(`Missing current season stats for ${team1Name} or ${team2Name}`);
        return { spread: 0, confidence: 0.3, basis: 'fallback' };
    }
    
    // PRIMARY FACTOR: Convert win probability to base spread
    // Standard conversion: 50% = PK, 60% = ~3 point favorite, 70% = ~6 points, etc.
    const probDiff = winProbability - 0.5; // How much team1 is favored/unfavored
    let baseSpread;
    
    const absProbDiff = Math.abs(probDiff);
    if (absProbDiff <= 0.05) {
        // 45-55% range: Pick'em to 1.5 points
        baseSpread = probDiff * -30; // 0.05 diff = 1.5 points
    } else if (absProbDiff <= 0.15) {
        // 35-65% range: 1.5 to 6 points
        const basePts = Math.sign(-probDiff) * 1.5;
        const additionalPts = (absProbDiff - 0.05) * -30 * Math.sign(probDiff);
        baseSpread = basePts + additionalPts;
    } else if (absProbDiff <= 0.25) {
        // 25-75% range: 6 to 12 points  
        const basePts = Math.sign(-probDiff) * 6;
        const additionalPts = (absProbDiff - 0.15) * -60 * Math.sign(probDiff);
        baseSpread = basePts + additionalPts;
    } else {
        // 75%+ range: 12+ points
        const basePts = Math.sign(-probDiff) * 12;
        const additionalPts = (absProbDiff - 0.25) * -40 * Math.sign(probDiff);
        baseSpread = basePts + additionalPts;
    }
    
    // SUBSTANTIAL ADJUSTMENTS: Use team stats to significantly adjust probability-based spread
    // Fantasy football has much larger variance than NFL - allow for big adjustments
    
    // 1. DPR validation adjustment (can be substantial - up to ±10 points)
    const dprDiff = team2Current.dpr - team1Current.dpr;
    const dprAdjustment = dprDiff * 12; // Large DPR gaps create big spread differences
    
    // 2. Scoring average validation (major factor - up to ±15 points) 
    const avgDiff = team2Current.avgPerGame - team1Current.avgPerGame;
    const avgAdjustment = avgDiff * 0.25; // 40 point average difference = 10 point spread adjustment
    
    // 3. Recent form (can swing ±3 points)
    let formAdjustment = 0;
    if (team1Current.isHot && !team2Current.isHot) formAdjustment -= 3;
    if (team2Current.isHot && !team1Current.isHot) formAdjustment += 3;
    if (team1Current.isCold && !team2Current.isCold) formAdjustment += 3;
    if (team2Current.isCold && !team1Current.isCold) formAdjustment -= 3;
    
    // 4. Luck regression (up to ±2 points)
    const luckAdjustment = (team1Current.luck - team2Current.luck) * 1.5;
    
    // FINAL SPREAD: Probability-based + substantial team-based adjustments
    const totalAdjustment = dprAdjustment + avgAdjustment + formAdjustment + luckAdjustment;
    let finalSpread = baseSpread + totalAdjustment;
    
    // Round to nearest 0.5 and apply fantasy football bounds (larger than NFL)
    finalSpread = Math.round(finalSpread * 2) / 2;
    finalSpread = Math.max(-35, Math.min(35, finalSpread)); // Allow for big fantasy spreads
    
    // Confidence based on data alignment - large adjustments are normal in fantasy
    const statsAlignment = Math.min(1, Math.abs(totalAdjustment) / 15); // Adjusted scale for fantasy
    const confidence = Math.max(0.5, Math.min(0.9, 0.85 - (statsAlignment * 0.3)));
    
    return {
        spread: finalSpread,
        confidence,
        basis: 'enhanced',
        components: {
            baseSpread: baseSpread.toFixed(1),
            dprAdjustment: dprAdjustment.toFixed(1),
            avgAdjustment: avgAdjustment.toFixed(1), 
            formAdjustment: formAdjustment.toFixed(1),
            luckAdjustment: luckAdjustment.toFixed(1),
            totalAdjustment: totalAdjustment.toFixed(1)
        },
        team1Stats: team1Current,
        team2Stats: team2Current
    };
}
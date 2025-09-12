# DPR Integration with Sportsbook System

## Overview
The sportsbook system has been enhanced to use the DPR (Dominance Performance Rating) system based on the Oberon Mt. Power Rating Formula. This provides more accurate team evaluation, especially during early season periods with high variance.

## Key Improvements

### 1. DPR-Based Team Evaluation
- **Primary Metric**: Adjusted DPR (normalized to league average of 1.0) is now the primary factor in win probability calculations
- **Weight Distribution**: DPR component gets 50% weight (increased from 40% for basic scoring)
- **Confidence Multipliers**: Early season teams get reduced confidence based on games played

### 2. Enhanced Win Probability Calculation
The `calculateWinProbability` function now uses:
- **DPR Component (50%)**: `Math.tanh(dprDiff * 2) * 0.5`
- **Elo Rating (20%)**: Reduced from 25%
- **Momentum (15%)**: Reduced from 20%
- **Head-to-Head (10%)**: Unchanged
- **All-Play Win % (5%)**: Replaces luck component

### 3. Early Season Variance Handling
- **Games 1-3**: 70% confidence multiplier, 25% error coefficient
- **Games 4-6**: 85% confidence multiplier, 18% error coefficient  
- **Games 7-10**: 95% confidence multiplier, 15% error coefficient
- **Games 10+**: Full confidence, 12% error coefficient

### 4. Championship Odds Enhancement
The championship simulation now incorporates:
- **DPR Quality Adjustment**: `(dprRating - 1.0) * 15` points per game
- **Confidence-Based Variance**: Low DPR confidence = higher variance
- **Enhanced Opponent Modeling**: Good DPR teams face tougher schedules

## Technical Implementation

### New Functions Added
1. `calculateTeamDPRValues()` - Extracts current season DPR data
2. Enhanced `calculateWinProbability()` - DPR-based probability calculation
3. Enhanced `calculateChampionshipOdds()` - DPR-enhanced championship simulation

### Modified Files
- `/src/utils/sportsbookCalculations.js` - Core DPR integration
- `/src/components/Sportsbook.js` - Updated function calls and imports

### Integration Points
- **Matchup Odds**: Use DPR for more accurate head-to-head probabilities
- **Playoff Odds**: Enhanced team evaluation with DPR confidence factors
- **Championship Odds**: Full DPR simulation with variance adjustments

## The Oberon Mt. Formula Integration

The system now uses the complete Oberon Mt. Power Rating Formula:
```
Raw DPR = [(avg_score × 6) + (high_score + low_score) × 2 + (win_% × 200) × 2] ÷ 10
Adjusted DPR = Raw DPR ÷ League Average Raw DPR
```

This provides:
- **Scoring Component**: 60% weight in raw calculation
- **Deviation Factor**: 20% weight (high + low scores)
- **Win Percentage**: 20% weight with managerial skill factor
- **League Normalization**: Allows cross-season comparisons

## Early Season Benefits

1. **Reduced Overconfidence**: Teams with limited games get appropriate uncertainty
2. **Variance Scaling**: Error coefficients scale with sample size
3. **DPR Confidence**: Built-in confidence multipliers based on games played
4. **Progressive Accuracy**: System becomes more confident as season progresses

## Expected Improvements

- **More Realistic Early Season Odds**: Less extreme probabilities for teams with few games
- **Better Team Evaluation**: DPR captures managerial skills and consistency
- **Accurate Championship Odds**: Proper correlation between playoff odds and championship potential
- **Variance-Appropriate Betting Lines**: Wider spreads early season, tighter late season

## Usage Notes

The enhanced system maintains backward compatibility with existing sportsbook functionality while providing significantly improved accuracy through the DPR integration. The system automatically calculates DPR values when historical data is available, falling back to basic stats when needed.
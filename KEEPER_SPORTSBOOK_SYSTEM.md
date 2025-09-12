## Sportsbook Edge & Odds Relationships

### Proper Moneyline-Spread Relationships
The system now ensures that moneyline and spread odds are mathematically connected:

- **Large spreads** (e.g., -13.5) → **Heavily skewed moneylines** (e.g., -450/+350)
- **Small spreads** (e.g., -3.5) → **Balanced moneylines** (e.g., -140/+125)
- **Pick'em games** → **Nearly even moneylines** (e.g., -105/+105)

### Sportsbook Edge (House Edge)
Every betting market includes a proper sportsbook edge:

**Spread Bets:**
- Standard: -110/-110 (4.5% edge each side = 9% total hold)
- High confidence: -118/-118 (higher juice when book is sure)
- Low confidence: -105/-105 (better odds to attract action)

**Moneyline Bets:**
- Automatically calculated to match spread probabilities
- Minimum 4% total edge enforced
- Example: -450/+389 ensures house edge

**Total (Over/Under):**
- Standard: -110/-110
- Adjusted based on game predictability

### Edge Validation
The system automatically:
1. Calculates expected moneylines from spreads
2. Validates that total implied probability > 100%
3. Adjusts odds if edge is insufficient
4. Ensures consistency between bet types

## Enhanced Keeper League Sportsbook System

## Overview
This enhanced sportsbook system is specifically designed for 12-owner fantasy football keeper leagues with 3 keepers per team. It accounts for the unique dynamics where some teams are "selling out" to win now, others are tanking for future value, and some are stuck in mediocrity.

## Key Features

### 1. Team Classification System
Teams are automatically classified into strategic categories:

- **Contenders** (Championship push - "selling out")
  - High win percentage (≥70%) + top quartile power score + positive momentum
  - These teams are going all-in to win the championship

- **Rebuilding** (Tanking for future assets)
  - Low win percentage (≤30%) + bottom quartile power score + negative momentum
  - These teams are accumulating future value through draft picks and young talent

- **Rising** (Building momentum)
  - Positive recent momentum with moderate win percentage
  - Teams trending upward but not yet elite

- **Declining** (Losing momentum)
  - Negative recent momentum despite decent record
  - Teams trending downward from earlier success

- **Middle** (Stuck in mediocrity)
  - Teams that don't fit other categories
  - Often the most unpredictable

### 2. Enhanced Momentum Analysis
The momentum system now includes:
- **Stronger recency weighting** - Recent games matter much more
- **Streak detection** - Identifies hot/cold streaks and win/loss streaks
- **Scoring trend analysis** - Tracks improvement/decline in performance
- **Blowout bonuses** - Dominant wins get extra momentum credit

### 3. Consistency Scoring
Teams are evaluated on:
- **Scoring variance** - How consistent their weekly output is
- **Week-to-week reliability** - Predictability of performance changes
- **Trend stability** - Whether they're consistently improving/declining
- **Coefficient of variation** - Statistical measure of consistency

### 4. Dynamic Spread Calculations
Spreads adjust based on:
- **Team classifications** - Contender vs Rebuilder = larger spreads
- **Season progression** - Later in season = more extreme spreads
- **Momentum differentials** - Hot vs cold teams
- **Consistency gaps** - Reliable vs unreliable teams
- **Contextual multipliers** - Different matchup types get different treatments

### 5. Enhanced Totals (Over/Under)
Total points calculations factor in:
- **Team strategies** - Contenders score more, rebuilders score less
- **Momentum effects** - Hot teams boost totals
- **Consistency impacts** - Consistent teams = more predictable totals
- **Matchup context** - Contender vs Contender = higher total

### 6. Intelligent Moneyline Pricing
Moneylines incorporate:
- **Dynamic vig adjustments** - Higher confidence = higher vig
- **Probability-based pricing** - More accurate odds for extreme mismatches
- **Context-aware adjustments** - Different strategies affect pricing

## Matchup Context Analysis

The system identifies specific matchup types:

### Contender vs Rebuilder
- **Spread**: Large (typically 8-20+ points)
- **Confidence**: High
- **Total**: Normal to high (contender scores well)
- **Variance**: Low (predictable outcome)

### Contender vs Contender
- **Spread**: Small (typically 0-7 points)
- **Confidence**: Moderate
- **Total**: High (both teams score well)
- **Variance**: High (competitive game)

### Rebuilder vs Rebuilder
- **Spread**: Small to moderate
- **Confidence**: Low
- **Total**: Low (both teams struggle)
- **Variance**: Very high (unpredictable)

### Rising vs Declining
- **Spread**: Moderate (momentum matters)
- **Confidence**: Moderate
- **Total**: Normal
- **Variance**: Moderate

## Season-Based Adjustments

### Early Season (Weeks 1-3)
- More conservative spreads
- Higher regression to league averages
- Lower confidence levels
- More variance in totals

### Mid Season (Weeks 4-10)
- Normal confidence building
- Team patterns emerging
- Balanced approach

### Late Season (Weeks 11+)
- Most aggressive spreads
- High confidence in patterns
- Extreme disparities expected
- Lower variance (established patterns)

## Advanced Features

### Confidence Indicators
Each bet includes confidence indicators:
- 🔥 High confidence (>70%)
- ✓ Moderate confidence (50-70%)
- ? Low confidence (<50%)

### Contextual Insights
Each matchup shows:
- Team strategy classifications
- Momentum indicators (↗↘→)
- Consistency percentages
- Matchup-specific insights

### Dynamic Vig Pricing
- Higher confidence lines = higher vig (worse odds for bettors)
- Lower confidence lines = lower vig (better odds for bettors)
- Uncertain games get better odds to attract action

## Usage in Component

The enhanced system is implemented in the Sportsbook component with:
- Enhanced team power rankings including classification data
- Improved UI showing team analysis
- Contextual matchup insights
- Visual confidence indicators
- Strategy-based color coding

## Benefits for Keeper Leagues

1. **Realistic spreads** that account for talent disparities
2. **Strategic context** understanding why teams perform differently
3. **Momentum tracking** for hot/cold streaks
4. **Consistency analysis** for more predictable teams
5. **Season-aware adjustments** as patterns emerge
6. **Matchup-specific insights** for different strategic battles

This system provides a much more sophisticated and keeper league-appropriate sportsbook experience compared to standard fantasy football odds calculations.
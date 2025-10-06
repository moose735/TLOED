# 🏈 TLOED Fantasy Football App - Yearly Maintenance Guide

This guide outlines all the manual tasks you need to complete each year to keep your fantasy football app updated and functional.

## 📅 Annual Tasks Checklist

> **📢 GOOD NEWS:** Your sportsbook spreads are now fully automated! No more manual weekly work needed.
> 
> **📢 CLEANUP NEEDED:** Google Sheets are no longer used - you can remove those URLs from config.js

### 🏆 1. Update League ID (START OF SEASON)
**File:** `/src/config.js`
**Line:** `export const CURRENT_LEAGUE_ID = '1181984921049018368';`

**When:** At the beginning of each new season when Sleeper creates a new league
**Why:** Each year Sleeper creates a new league ID, even for continuing leagues
**How to find new League ID:**
1. Go to your league on Sleeper website
2. Look at the URL: `https://sleeper.app/leagues/[LEAGUE_ID]/`
3. Copy the league ID from the URL
4. Replace the old ID in config.js

```javascript
// Example update
export const CURRENT_LEAGUE_ID = '1234567890123456789'; // Replace with new year's league ID
```

---

### 🏆 2. Add Champion Images (AFTER PLAYOFFS)
**Directory:** `/src/assets/images/hall-of-champions/`
**File to Update:** `/src/lib/HallOfChampions.js`

**When:** After your fantasy football playoffs conclude
**Steps:**
1. **Take/Find Champion Photo**
   - Get a celebration photo of the champion
   - Recommended size: 400x400px or larger
   - Formats: JPG, PNG
   - Name it: `YEAR-champion.jpg` (e.g., `2025-champion.jpg`)

2. **Add Image to Directory**
   - Save the image in `/src/assets/images/hall-of-champions/`

3. **Update HallOfChampions.js**
   - Find the `championImages` object (around line 110)
   - Add the new year's entry:
   ```javascript
   const championImages = {
       2025: require('../assets/images/hall-of-champions/2025-champion.jpg'),
       2024: require('../assets/images/hall-of-champions/2024-champion.JPG'),
       // ... existing years
   };
   ```

---

### 🏆 3. Add League MVP (AFTER PLAYOFFS)
**File:** `/src/lib/HallOfChampions.js`
**Section:** `leagueMVPs` object (around line 25-80)

**When:** After playoffs, when you decide the League MVP
**Steps:**
1. **Find Player ID**
   - Use the "View Roster" button on champion cards to see player IDs
   - Or check browser console for `championPlayersByYear` object

2. **Add MVP Entry**
   ```javascript
   const leagueMVPs = {
       2025: { 
           playerId: '1234', 
           name: 'Player Name', 
           position: 'QB', 
           team: 'BUF', 
           reasonTitle: 'Why they were MVP'
           // staticHeadshot: require('../assets/images/mvp-headshots/2025-player-name-buf.jpg')
       },
       // ... existing years
   };
   ```

3. **Add Static MVP Headshot (RECOMMENDED)**
   - Save player headshot: `/src/assets/images/mvp-headshots/2025-player-name-team.jpg`
   - Uncomment and update the `staticHeadshot` line
   - This preserves the image even if player retires/changes teams

---

### 👥 4. Update Team Roster Changes (AS NEEDED)
**File:** `/src/config.js`
**Section:** `TEAM_NAME_TO_SLEEPER_ID_MAP`

**When:** When managers join/leave the league
**What to Update:**
```javascript
export const TEAM_NAME_TO_SLEEPER_ID_MAP = {
  'ManagerName': 'sleeper_user_id',
  // Add new managers, remove old ones
};

export const RETIRED_MANAGERS = new Set ([
  'old_sleeper_user_id_1',
  'old_sleeper_user_id_2',
  // Add IDs of managers who left
]);
```

---

### 📈 5. Clean Up Legacy Configuration (ONE-TIME CLEANUP)
**File:** `/src/config.js`
**Section:** Remove unused Google Sheets URLs

**When:** Next time you update the config
**What to Remove:**
```javascript
// These are NO LONGER USED - can be deleted:
export const GOOGLE_SHEET_POWER_RANKINGS_API_URL = '...';
export const HISTORICAL_MATCHUPS_API_URL = '...';
```

**Why:** Your app now uses Sleeper API directly - these Google Sheets URLs are legacy and no longer used.

---

### 🎰 6. Sportsbook Spreads (FULLY AUTOMATED ✅)
**Status:** No manual work required!

**What's Automated:**
- Spread calculations based on team performance
- Power rankings and ELO ratings
- Win probability calculations
- All betting markets generate automatically

**Files That Handle This:**
- `/src/utils/cleanOddsCalculator.js` - Main calculation engine
- `/src/components/Sportsbook.js` - UI display
- `/src/utils/matchupOdds.js` - Win probability calculations

**You Don't Need To:**
- ❌ Manually update spreads weekly
- ❌ Run analysis scripts
- ❌ Update hardcoded matchup expectations

**The System Automatically:**
- ✅ Calculates spreads based on team stats
- ✅ Updates win probabilities in real-time
- ✅ Generates betting markets from Sleeper data
- ✅ Adjusts for recent performance and trends

---

## 🤖 Automated Features (No Manual Work Required!)

### 🎰 Sportsbook System
Your sportsbook system is **fully automated** and calculates:
- **Point Spreads** - Based on team performance metrics
- **Win Probabilities** - Using ELO ratings and recent form
- **Betting Odds** - Moneyline, spread, and totals
- **Power Rankings** - Dynamic team strength calculations

**How It Works:**
1. Pulls data directly from Sleeper API
2. Analyzes team performance, consistency, momentum
3. Calculates spreads using multiple algorithms
4. Updates automatically as games are played

**Files Powering This:**
- `/src/utils/cleanOddsCalculator.js` - Main calculation engine
- `/src/utils/sportsbookCalculations.js` - Team metrics
- `/src/utils/matchupOdds.js` - Win probability models
- `/src/components/Sportsbook.js` - User interface

### 📊 Data Processing
Your app automatically:
- **Fetches Sleeper data** - League info, matchups, rosters
- **Processes historical data** - All seasons back to 2018
- **Calculates advanced metrics** - DPR, luck ratings, streaks
- **Updates in real-time** - As new games complete

**No Google Sheets Needed:** Everything runs directly from Sleeper's API!

---

## 🔧 Optional Advanced Tasks

### 🏆 Champion Image Organization
Create organized subdirectories:
```
/src/assets/images/hall-of-champions/
├── 2025-champion.jpg
├── 2024-champion.jpg
├── celebration-photos/
└── trophy-photos/
```

### 📸 Automated Image Processing
Consider adding image optimization for:
- Champion photos
- MVP headshots
- Team logos

### 📊 Historical Data Backup
**Recommended:** Regularly backup:
- `/src/config.js` - Your configuration
- `/src/assets/images/` - All your custom images
- Google Sheets data

---

## 🚨 Critical Reminders

### ⚠️ Don't Forget These!
1. **League ID is the #1 priority** - App won't work without correct current league ID
2. **Test after League ID change** - Verify data loads correctly
3. **MVP images should be added ASAP** - Before players retire or change teams
4. **Backup your images** - Store copies outside the repo
5. **Document your changes** - Keep notes on what you changed each year
6. **Clean up legacy code** - Remove unused Google Sheets URLs from config.js

### 🔍 Testing Your Changes
After making updates:
1. Clear browser cache
2. Refresh the app
3. Check that new champion appears in Hall of Champions
4. Verify MVP displays correctly
5. Test that league data loads properly

### 📞 Getting Help
If something breaks:
1. Check browser console for errors
2. Verify League ID is correct and league exists
3. Ensure image paths are correct
4. Check that all require() statements work
5. **Remember:** Sportsbook spreads are automated - no manual fixes needed!

---

## 📋 Quick Reference - File Locations

| What to Update | File Location | When | Status |
|---|---|---|---|
| League ID | `/src/config.js` | Start of season | ✅ Required |
| Champion Images | `/src/assets/images/hall-of-champions/` | After playoffs | ✅ Required |
| Champion Image Config | `/src/lib/HallOfChampions.js` (championImages) | After playoffs | ✅ Required |
| MVP Selection | `/src/lib/HallOfChampions.js` (leagueMVPs) | After playoffs | ✅ Required |
| MVP Headshots | `/src/assets/images/mvp-headshots/` | After playoffs | 🎯 Recommended |
| Team Mappings | `/src/config.js` (TEAM_NAME_TO_SLEEPER_ID_MAP) | When rosters change | ✅ Required |
| ~~Google Sheets URLs~~ | ~~`/src/config.js`~~ | ~~Legacy - Remove~~ | ❌ Deprecated |
| ~~Sportsbook Data~~ | ~~Various `.js` files~~ | ~~Fully Automated~~ | ✅ Automated |

---

## 🎯 Success Checklist
- [ ] Updated League ID for new season
- [ ] Added champion photo and updated config
- [ ] Selected and configured League MVP
- [ ] Added static MVP headshot (recommended)
- [ ] Updated team roster mappings if needed
- [ ] Tested app functionality
- [ ] Backed up images and config
- [ ] App loads and displays current season data

**🎉 You're all set for another great fantasy football season!**
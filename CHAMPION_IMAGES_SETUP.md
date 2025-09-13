# 🏆 Champion Images Setup Guide

## 📸 Where to Add Champion Images

### Easy Image Locations:
1. **Primary Location**: `/src/assets/images/champions/`
2. **Public Assets**: `/public/assets/images/champions/`

### 🎯 Step-by-Step Setup:

1. **Add your champion images** to `/src/assets/images/champions/`
   - Name them: `2024-champion.jpg`, `2023-champion.jpg`, etc.
   - Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`

2. **Update the championImages object** in `HallOfChampions.js` (lines 15-21):
   ```javascript
   const championImages = {
       2024: require('../assets/images/champions/2024-champion.jpg'),
       2023: require('../assets/images/champions/2023-champion.jpg'),
       2022: require('../assets/images/champions/2022-champion.jpg'),
       2021: require('../assets/images/champions/2021-champion.jpg'),
       // Add more years as needed
   };
   ```

3. **Recommended Image Specs**:
   - **Size**: 200x200px to 500x500px
   - **Format**: JPG or PNG
   - **Style**: Square aspect ratio works best for the circular display

## 🏀 Bracket Viewing Feature

### ✅ What's Already Implemented:
- **Click any champion banner** to view their championship bracket
- **Modal displays**: Championship game, semi-finals, quarter-finals
- **Team avatars and scores** shown for each matchup
- **Winner highlighting** with green backgrounds and crown icons

### 🎯 How It Works:
1. The bracket data comes from `historicalData.winnersBracketBySeason[year]`
2. Finds championship game (`p: 1`), semi-finals (`p: 2`), quarter-finals (`p: 4`)
3. Shows team names, avatars, scores, and winners for each round

## 🔧 Easy Customization:

### To Add Images:
1. Drop image files in `/src/assets/images/champions/`
2. Uncomment the corresponding line in `championImages` object
3. The images will automatically appear in the champion cards

### Fallback Display:
- If no image is provided, shows team avatar
- If no team avatar, shows trophy emoji
- Always gracefully handles missing images

## 📱 Mobile Optimized:
- Responsive design works on all screen sizes
- Touch-friendly champion cards and bracket modal
- Scrollable bracket display for smaller screens

## 🎨 Visual Features:
- **Golden gradient backgrounds** for champion cards
- **Hover effects** with scaling and shadow changes
- **Click indicators** showing "📊 Click to view bracket"
- **Trophy icons** that vary by era (🏆 for recent, 🥇 for modern, 🏅 for historical)
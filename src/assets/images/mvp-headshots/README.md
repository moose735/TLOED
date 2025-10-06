# 🏆 MVP Static Headshots Guide

## 📋 Overview
This directory contains static headshot images for League MVPs to preserve historical accuracy when NFL players retire or change teams.

## 🚨 Why Static Headshots Matter
When NFL players retire or change teams:
- **Sleeper CDN headshots may become unavailable** or show outdated team uniforms
- **Team abbreviations become incorrect** (e.g., Saquon moving from NYG to PHI)
- **Historical context is lost** for future league history viewing

## 📁 File Naming Convention
Use this format for consistent organization:
```
YEAR-player-name-team.jpg
```

Examples:
- `2024-saquon-barkley-phi.jpg`
- `2023-joe-flacco-cle.jpg` 
- `2022-ceedee-lamb-dal.jpg`
- `2021-josh-allen-buf.jpg`

## 🖼️ Image Requirements
- **Format**: JPG or PNG
- **Size**: Recommended 256x256 pixels or larger
- **Quality**: High resolution headshot showing player in team uniform from championship year
- **Aspect Ratio**: Square (1:1) works best

## 📝 How to Add Static MVP Headshots

### Step 1: Save Image
1. Find a high-quality headshot of the MVP from their championship year
2. Save it in this directory using the naming convention above
3. Ensure the image shows them in the correct team uniform from that year

### Step 2: Update HallOfChampions.js
In `/src/lib/HallOfChampions.js`, update the `leagueMVPs` object:

```javascript
const leagueMVPs = {
    2024: { 
        playerId: '4866', 
        name: 'Saquon Barkley', 
        position: 'RB', 
        team: 'PHI', 
        reasonTitle: 'Joe Schmitt',
        staticHeadshot: require('../assets/images/mvp-headshots/2024-saquon-barkley-phi.jpg')
    },
    // Add more years...
};
```

### Step 3: Test the Display
1. Start your development server
2. Navigate to Hall of Champions
3. Verify the MVP headshot displays correctly
4. Check that it maintains the historical team context

## 🔄 Fallback Behavior
The system uses this priority order for headshots:
1. **Static headshot** (highest priority - preserves history)
2. **NFL metadata headshot** (from Sleeper's player data)
3. **Sleeper CDN headshot** (built from player ID)
4. **Initials fallback** (if all images fail to load)

## 💡 Pro Tips
- **Capture headshots soon after championship**: Get the images while players are still active
- **Save original sources**: Keep notes on where you found the images
- **Backup images**: Consider storing copies outside the repo for safety
- **Update annually**: Add new MVP headshots each season

## 🎯 Best Practices
- Use official team/league photos when possible
- Avoid copyrighted images - use public domain or properly licensed images
- Maintain consistent image quality across all MVPs
- Document the source of each image for future reference

## 🚀 Future Enhancements
Consider these improvements:
- Automated image optimization
- Multiple image formats (WebP, AVIF)
- Lazy loading for better performance
- Image compression for faster load times
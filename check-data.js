// Quick check of what data is available
const fs = require('fs');
const { exec } = require('child_process');

// Check if we can access the app data by looking at localStorage or API endpoints
console.log('Checking available seasons and weeks...');

// Test the Sleeper API directly to see what data exists
const leagues = [
    '1181984921049018368' // Current league ID from config
];

async function checkSeasonData() {
    try {
        const response = await fetch(`https://api.sleeper.app/v1/league/${leagues[0]}`);
        const leagueData = await response.json();
        console.log('Current league season:', leagueData.season);
        
        // Check matchups for current season
        const matchupsResponse = await fetch(`https://api.sleeper.app/v1/league/${leagues[0]}/matchups/1`);
        const matchups = await matchupsResponse.json();
        console.log('Week 1 matchups available:', matchups ? matchups.length : 0);
        
        // Check NFL state
        const nflResponse = await fetch('https://api.sleeper.app/v1/state/nfl');
        const nflState = await nflResponse.json();
        console.log('NFL State:', nflState);
        
    } catch (error) {
        console.error('Error checking data:', error);
    }
}

checkSeasonData();

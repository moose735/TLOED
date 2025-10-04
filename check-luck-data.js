// Simple script to check if we have luck data by manually calling the Sleeper API
const https = require('https');

function makeApiCall(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function checkLuckData() {
    try {
        console.log('Checking NFL state...');
        const nflState = await makeApiCall('https://api.sleeper.app/v1/state/nfl');
        console.log('NFL State:', { season: nflState.season, week: nflState.week });
        
        const leagueId = '1181984921049018368';
        
        // Check what weeks have matchups
        for (let week = 1; week <= 5; week++) {
            console.log(`\nChecking week ${week}...`);
            const matchups = await makeApiCall(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
            
            if (matchups && Array.isArray(matchups)) {
                const completedMatchups = matchups.filter(m => 
                    m.team1_roster_id && m.team2_roster_id && 
                    m.team1_score > 0 && m.team2_score > 0
                );
                
                console.log(`  Total matchups: ${matchups.length}`);
                console.log(`  Completed matchups: ${completedMatchups.length}`);
                
                if (completedMatchups.length > 0) {
                    console.log(`  Sample completed: ${completedMatchups[0].team1_roster_id} vs ${completedMatchups[0].team2_roster_id} (${completedMatchups[0].team1_score} - ${completedMatchups[0].team2_score})`);
                }
                
                if (matchups.length > completedMatchups.length) {
                    const incompleteMatchup = matchups.find(m => 
                        !m.team1_roster_id || !m.team2_roster_id || 
                        m.team1_score === 0 || m.team2_score === 0 || 
                        m.team1_score === null || m.team2_score === null
                    );
                    if (incompleteMatchup) {
                        console.log(`  Sample incomplete: ${incompleteMatchup.team1_roster_id} vs ${incompleteMatchup.team2_roster_id} (${incompleteMatchup.team1_score} - ${incompleteMatchup.team2_score})`);
                    }
                }
            } else {
                console.log(`  No matchup data for week ${week}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkLuckData();
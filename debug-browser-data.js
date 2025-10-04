// Quick script to check what processed data is available
// Open browser dev tools and paste this in the console to debug

function checkProcessedData() {
    // Check if the global window has the context data
    if (window.React && window.React.version) {
        console.log('React is available, but context data not exposed globally');
        console.log('Please navigate to Gamecenter and check the console logs for:');
        console.log('- "weeklyLuckData Debug"');
        console.log('- "weeklyLuckData Result"');
        console.log('- "Frisky Game Debug"');
        return;
    }
    
    // If we're in a React component context, this won't work
    console.log('This script should be run in browser dev tools console while on the app page');
    console.log('Navigate to the Gamecenter page and look for debug logs');
    
    // Instructions for manual debugging
    console.log('\nManual debugging steps:');
    console.log('1. Open browser dev tools (F12)');
    console.log('2. Navigate to Gamecenter');
    console.log('3. Look for console messages with:');
    console.log('   - "weeklyLuckData Debug" - shows available seasons and data presence');
    console.log('   - "weeklyLuckData Result" - shows team count and sample luck data');
    console.log('   - "Frisky Game Debug" - shows current/past/future week determination');
    console.log('4. Check if selectedSeason shows 2025 or 2024');
    console.log('5. Check if weeklyLuckData has any entries');
}

checkProcessedData();
// Debug script to check Gamecenter console output for Frisky Game of the Week
// This helps us see what's happening with the debugging we added

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugGamecenter() {
    console.log('Starting Gamecenter debug...');
    
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: false, 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            devtools: true
        });
        
        const page = await browser.newPage();
        
        // Listen to console messages
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Frisky Game') || text.includes('weeklyLuckData') || text.includes('friskyGameMatchupId')) {
                console.log('CONSOLE:', text);
            }
        });
        
        // Navigate to the React app
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
        
        console.log('Navigated to app, waiting for load...');
        await page.waitForTimeout(3000);
        
        // Click on Games dropdown if it exists
        try {
            const gamesButton = await page.waitForSelector('button:has-text("Games")', { timeout: 5000 });
            if (gamesButton) {
                await gamesButton.click();
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('Games dropdown not found, trying direct navigation...');
        }
        
        // Try to click Gamecenter
        try {
            const gamecenterButton = await page.waitForSelector('button:has-text("Gamecenter")', { timeout: 5000 });
            if (gamecenterButton) {
                await gamecenterButton.click();
                console.log('Clicked Gamecenter button');
                await page.waitForTimeout(5000); // Wait for data to load
            }
        } catch (e) {
            console.log('Gamecenter button not found, checking if already on page...');
        }
        
        // Check if we're on the Gamecenter page
        const gamecenterHeader = await page.$('h1:has-text("Gamecenter")');
        if (gamecenterHeader) {
            console.log('Successfully on Gamecenter page');
            
            // Wait a bit more for all data to load
            await page.waitForTimeout(5000);
            
            // Check for any Frisky Game badges
            const friskyBadges = await page.$$eval('[class*="purple"]', elements => 
                elements.filter(el => el.textContent.includes('Frisky')).map(el => el.textContent)
            );
            
            if (friskyBadges.length > 0) {
                console.log('Found Frisky Game badges:', friskyBadges);
            } else {
                console.log('No Frisky Game badges found on page');
            }
            
            // Get current season/week info
            const seasonSelect = await page.$('select#season-select');
            const weekSelect = await page.$('select#week-select');
            
            if (seasonSelect && weekSelect) {
                const currentSeason = await page.evaluate(el => el.value, seasonSelect);
                const currentWeek = await page.evaluate(el => el.value, weekSelect);
                console.log(`Current selection: Season ${currentSeason}, Week ${currentWeek}`);
            }
            
        } else {
            console.log('Not on Gamecenter page');
        }
        
        // Wait for a bit to see all console messages
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

debugGamecenter();
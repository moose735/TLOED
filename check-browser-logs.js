const puppeteer = require('puppeteer');

async function checkBrowserLogs() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console messages
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('weeklyLuckData') || text.includes('Frisky Game')) {
            console.log('BROWSER LOG:', text);
        }
    });
    
    try {
        console.log('Opening app...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        console.log('Navigating to Gamecenter...');
        // Click on Gamecenter tab if it exists
        await page.waitForSelector('nav', { timeout: 5000 });
        const gamecenterLink = await page.$('text=Gamecenter');
        if (gamecenterLink) {
            await gamecenterLink.click();
            await page.waitForTimeout(2000);
        }
        
        console.log('Waiting for logs...');
        await page.waitForTimeout(3000);
        
        // Also check Dashboard
        console.log('Navigating to Dashboard...');
        const dashboardLink = await page.$('text=Dashboard');
        if (dashboardLink) {
            await dashboardLink.click();
            await page.waitForTimeout(2000);
        }
        
        await page.waitForTimeout(2000);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

checkBrowserLogs().catch(console.error);
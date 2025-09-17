// src/services/financialService.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import logger from '../utils/logger';

// Firebase Config (same as in FinancialTracker)
const firebaseConfig = {
    apiKey: 'AIzaSyDcuPXgRPIdX-NYblBqQkdXqrGiD6yobcA',
    authDomain: 'tloed-finance-tracker.firebaseapp.com',
    projectId: 'tloed-finance-tracker',
    storageBucket: 'tloed-finance-tracker.appspot.com',
    messagingSenderId: '220652845054',
    appId: '1:220652845054:web:2d2f498ce8158afa2cf2af',
    measurementId: 'G-0N3ZD0XNTC',
};

// Initialize Firebase (reuse existing app if available)
let firebaseApp;
let db;

const initializeFirebase = () => {
    if (!firebaseApp) {
        // Use the same pattern as FinancialTracker
        if (window.firebaseApp) {
            firebaseApp = window.firebaseApp;
        } else {
            firebaseApp = initializeApp(firebaseConfig);
            window.firebaseApp = firebaseApp;
        }
        db = getFirestore(firebaseApp);
    }
    return db;
};

/**
 * Fetch financial data for a specific year
 * @param {string} year - The year to fetch data for
 * @returns {Promise<Object>} Financial data for the year
 */
export const fetchFinancialDataForYear = async (year) => {
    logger.debug(`Fetching financial data for year: ${year}`);
    try {
        const database = initializeFirebase();
        logger.debug('Firebase initialized, attempting to fetch document...');
        
        const docRef = doc(database, 'league_finances', year);
        logger.debug('Document reference created:', docRef.path);
        
        const docSnap = await getDoc(docRef);
        logger.debug('Document snapshot received:', docSnap.exists() ? 'EXISTS' : 'DOES NOT EXIST');
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            logger.debug(`Raw financial data for ${year}:`, Object.keys(data || {}));
            logger.debug(`Transactions count for ${year}:`, data?.transactions?.length || 0);
            
            if (data?.transactions && data.transactions.length > 0) {
                logger.debug(`Sample transaction for ${year}:`, data.transactions[0]);
            }
            
            return data && data.transactions ? data : { transactions: [], potentialFees: [], potentialPayouts: [] };
        } else {
            logger.debug(`No financial document found for year ${year} in Firestore`);
            return { transactions: [], potentialFees: [], potentialPayouts: [] };
        }
    } catch (error) {
        logger.error(`Error fetching financial data for year ${year}:`, error);
        logger.error('Error details:', error.message, error.code);
        return { transactions: [], potentialFees: [], potentialPayouts: [] };
    }
};

/**
 * Fetch financial data for multiple years
 * @param {Array<string>} years - Array of years to fetch data for
 * @returns {Promise<Object>} Financial data organized by year
 */
export const fetchFinancialDataForYears = async (years) => {
    if (!years || !Array.isArray(years) || years.length === 0) {
        logger.debug('No years provided for financial data fetch');
        return {};
    }
    logger.debug('Fetching financial data for multiple years:', years);
    try {
        const promises = years.map(year => fetchFinancialDataForYear(year));
        const results = await Promise.all(promises);
        
        const financialDataByYear = {};
        years.forEach((year, index) => {
            financialDataByYear[year] = results[index];
        });
        
        logger.debug('Final financial data by year:', financialDataByYear);
        return financialDataByYear;
    } catch (error) {
        logger.error('Error fetching financial data for multiple years:', error);
        return {};
    }
};
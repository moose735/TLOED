// Example: src/components/Transactions.js

// OLD:
// import { fetchTransactionsForWeek } from '../utils/sleeperApi';

// NEW:
import { fetchTransactions } from '../utils/sleeperApi';

// ... other code ...

const fetchAndSetTransactions = async (leagueId, week) => {
    setLoading(true);
    try {
        // OLD:
        // const fetchedTransactions = await fetchTransactionsForWeek(leagueId, week);

        // NEW:
        const fetchedTransactions = await fetchTransactions(leagueId, week);
        setTransactions(fetchedTransactions);
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        // ... error handling ...
    } finally {
        setLoading(false);
    }
};

// ... rest of your component ...

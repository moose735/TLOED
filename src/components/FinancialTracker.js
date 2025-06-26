import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    signInAnonymously
} from 'firebase/auth';
import {
    getFirestore, collection, addDoc, query, orderBy, onSnapshot,
    serverTimestamp, deleteDoc, doc, setDoc, getDoc, writeBatch
} from 'firebase/firestore';

// Helper function to format currency
const formatCurrency = (value) => {
    if (typeof value === 'number') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
    return 'N/A';
};

// Exported helper function for calculating financial data for TeamDetailPage
export const calculateFinancialDataForTeamDetailPage = (transactions, getMappedTeamName) => {
    const yearlyTeamBalances = {};

    transactions.forEach(transaction => {
        const year = transaction.season ? parseInt(transaction.season) : (transaction.date?.toDate ? new Date(transaction.date.toDate()).getFullYear() : null);
        const team = getMappedTeamName(String(transaction.teamName || '').trim());
        const amount = parseFloat(transaction.amount);
        const type = transaction.type;

        if (isNaN(year) || !team || isNaN(amount)) return;

        if (!yearlyTeamBalances[year]) {
            yearlyTeamBalances[year] = {};
        }
        if (!yearlyTeamBalances[year][team]) {
            yearlyTeamBalances[year][team] = { totalDebits: 0, totalCredits: 0 };
        }

        if (type === 'debit') {
            yearlyTeamBalances[year][team].totalDebits += amount;
        } else if (type === 'credit') {
            yearlyTeamBalances[year][team].totalCredits += amount;
        }
    });

    const financialDataArray = [];
    for (const year in yearlyTeamBalances) {
        for (const teamName in yearlyTeamBalances[year]) {
            const balances = yearlyTeamBalances[year][teamName];
            const netBalance = balances.totalCredits - balances.totalDebits;
            financialDataArray.push({
                year: parseInt(year),
                teamName: teamName,
                netBalance: netBalance
            });
        }
    }
    return financialDataArray;
};

// New component for the Overall Financial History Tab
const OverallFinancialHistoryTab = ({ allTransactions, getDisplayTeamName, uniqueTeamsForOverallHistory }) => { // Added uniqueTeamsForOverallHistory
    // Calculate overall team financials across all seasons
    const overallTeamFinancials = useMemo(() => {
        const teamStats = {};

        // Initialize teamStats for all unique teams to ensure all teams are listed
        uniqueTeamsForOverallHistory.forEach(team => {
            teamStats[team] = { name: team, totalDebits: 0, totalCredits: 0, netBalance: 0 };
        });

        allTransactions.forEach(t => {
            const displayTeam = getDisplayTeamName(String(t.teamName || '').trim());
            const amount = parseFloat(t.amount);

            if (isNaN(amount)) return;

            // Handle 'All Teams' debits by dividing among all active teams
            if (t.teamName === 'All Teams' && t.type === 'debit' && t.teamsInvolvedCount > 0) {
                const perTeamAmount = amount / t.teamsInvolvedCount;
                uniqueTeamsForOverallHistory.forEach(individualTeam => {
                    if (teamStats[individualTeam]) {
                        teamStats[individualTeam].totalDebits += perTeamAmount;
                    }
                });
            } else if (displayTeam && teamStats[displayTeam]) { // For specific team transactions
                if (t.type === 'debit') {
                    teamStats[displayTeam].totalDebits += amount;
                } else if (t.type === 'credit') {
                    teamStats[displayTeam].totalCredits += amount;
                }
            }
        });

        // Calculate net balance for overall team stats
        Object.keys(teamStats).forEach(team => {
            teamStats[team].netBalance = teamStats[team].totalCredits - teamStats[team].totalDebits;
        });

        // Sort by team name before returning for display
        return Object.values(teamStats).sort((a, b) => a.name.localeCompare(b.name));
    }, [allTransactions, getDisplayTeamName, uniqueTeamsForOverallHistory]);

    return (
        <section className="bg-white p-6 rounded-lg shadow-md mt-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Overall Financial History by Team</h3>

            {overallTeamFinancials.length === 0 ? (
                <p className="text-center text-gray-600">No financial data available across all seasons.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                        <thead className="bg-blue-100">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team Name</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Fees</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Payouts</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Overall Net Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overallTeamFinancials.map((data, index) => (
                                <tr key={data.name} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{data.name}</td>
                                    <td className="py-2 px-4 text-sm text-right text-red-700 border-b border-gray-200">{formatCurrency(data.totalDebits)}</td>
                                    <td className="py-2 px-4 text-sm text-right text-green-700 border-b border-gray-200">{formatCurrency(data.totalCredits)}</td>
                                    <td className={`py-2 px-4 text-sm text-right font-bold border-b border-gray-200 ${data.netBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                        {formatCurrency(data.netBalance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};


const FinancialTracker = ({ getDisplayTeamName, historicalMatchups }) => {
    const [transactions, setTransactions] = useState([]); // Transactions for the selected season (for main view)
    const [allTransactions, setAllTransactions] = useState([]); // All transactions (for overall history)

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('debit');
    const [category, setCategory] = useState('entry_fee');
    const [weeklyPointsWeek, setWeeklyPointsWeek] = useState('');
    const [sidePotName, setSidePotName] = useState('');

    const [teamName, setTeamName] = useState('');
    const [tradeTeams, setTradeTeams] = useState(['', '']);
    const [waiverEntries, setWaiverEntries] = useState([{ team: '', numPickups: 1 }]);

    const [tradeEntryMethod, setTradeEntryMethod] = useState('multi_team');
    const [numTrades, setNumTrades] = useState(1);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [uniqueTeams, setUniqueTeams] = useState([]); // Unique teams for selected season
    const [weeklyHighScores, setWeeklyHighScores] = useState({});
    const [currentWeekForSelectedSeason, setCurrentWeekForSelectedSeason] = useState(0);

    const [selectedSeason, setSelectedSeason] = useState(null);
    const [availableSeasons, setAvailableSeasons] = useState([]);
    const [activeTeamsCount, setActiveTeamsCount] = useState(0);

    const [isTeamAutoPopulated, setIsTeamAutoPopulated] = useState(false);
    const [autoPopulateWarning, setAutoPopulateWarning] = useState(null);

    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
    const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(null);
    const [showCommishLogin, setShowCommishLogin] = useState(false);

    const [filterTeam, setFilterTeam] = useState('');

    const [debitStructureData, setDebitStructureData] = useState([]);
    const [creditStructureData, setCreditStructureData] = useState([]);
    const [isEditingStructure, setIsEditingStructure] = useState(false);
    const [loadingStructure, setLoadingStructure] = useState(true);

    const [transactionPot, setTransactionPot] = useState(0);

    const [currentPage, setCurrentPage] = useState(1);
    const transactionsPerPage = 10;

    // New state for active tab
    const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'overall_history'

    const COMMISH_UID = process.env.REACT_APP_COMMISH_UID;
    const isCommish = userId && COMMISH_UID && userId === COMMISH_UID;

    const getCategoriesForType = useCallback((currentType) => {
        if (currentType === 'debit') {
            return [
                { value: 'entry_fee', label: 'Entry Fee' },
                { value: 'waiver_fa_fee', label: 'Waiver/FA Fee' },
                { value: 'trade_fee', label: 'Trade Fee' },
                { value: 'other_fee', label: 'Other' },
            ];
        } else if (currentType === 'credit') {
            return [
                { value: 'weekly_1st_points', label: 'Weekly 1st - Points' },
                { value: 'weekly_2nd_points', label: 'Weekly 2nd - Points' },
                { value: 'playoff_finish', label: 'Playoff Finish' },
                { value: 'points_finish', label: 'Points Finish' },
                { value: 'side_pot', label: 'Side Pot' },
                { value: 'other_payout', label: 'Other' },
            ];
        }
        return [];
    }, []);

    const defaultDebitStructure = useMemo(() => [
        { name: 'League Entry Fee', amount: '$70', description: 'Paid per team for entry.' },
        { name: 'Waivers/Free Agents', amount: '$1', description: 'Per transaction.' },
        { name: 'Trades', amount: '$2', description: 'Per team involved.' },
        { name: 'Other Fee', amount: '', description: 'Miscellaneous fees.' },
    ], []);

    const defaultCreditStructure = useMemo(() => [
        { name: 'Weekly 1st Place (Points)', amount: '$10' },
        { name: 'Weekly 2nd Place (Points)', amount: '$5' },
        { name: 'Sween Bowl Champion', amount: '$100' },
        { name: 'Sween Bowl Runner Up', amount: '$70' },
        { name: 'Playoff 3rd Place', amount: '$50' },
        { name: '1st Place Overall Points', amount: '$60' },
        { name: '2nd Place Overall Points', amount: '$40' },
        { name: '3rd Place Overall Points', amount: '$25' },
        { name: 'Side Pots', description: 'Vary in amount and criteria.' },
        { name: 'Other Payout', amount: '', description: 'Miscellaneous payouts.' },
    ], []);


    useEffect(() => {
        const categories = getCategoriesForType(type);
        if (categories.length > 0) {
            if (!categories.some(cat => cat.value === category)) {
                setCategory(categories[0].value);
            }
        } else {
            setCategory('');
        }
        if (!(type === 'debit' && category === 'trade_fee')) {
            setTradeTeams(['', '']);
            setNumTrades(1);
            setTradeEntryMethod('multi_team');
        }
        if (!(type === 'debit' && category === 'waiver_fa_fee')) {
            setWaiverEntries([{ team: '', numPickups: 1 }]);
        }
    }, [type, category, getCategoriesForType]);


    useEffect(() => {
        if (historicalMatchups && Array.isArray(historicalMatchups)) {
            const yearsSet = new Set();
            let maxSeasonOverall = 0;

            historicalMatchups.forEach(match => {
                if (match.year && typeof match.year === 'number') {
                    yearsSet.add(match.year);
                    if (match.year > maxSeasonOverall) {
                        maxSeasonOverall = match.year;
                    }
                }
            });

            const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
            setAvailableSeasons(sortedYears);

            if (maxSeasonOverall > 0 && selectedSeason === null) {
                setSelectedSeason(maxSeasonOverall);
            }
        }
    }, [historicalMatchups, selectedSeason]);


    useEffect(() => {
        if (!selectedSeason || !historicalMatchups) {
            setUniqueTeams([]);
            setWeeklyHighScores({});
            setCurrentWeekForSelectedSeason(0);
            setActiveTeamsCount(0);
            return;
        }

        const teamsSet = new Set();
        const weeklyScores = {};
        let maxWeekForCurrentSelectedSeason = 0;

        historicalMatchups.forEach(match => {
            if (match.year === selectedSeason) {
                const team1 = getDisplayTeamName(match.team1);
                const team2 = getDisplayTeamName(match.team2);
                if (team1) teamsSet.add(team1);
                if (team2) teamsSet.add(team2);

                const week = match.week;
                if (week) {
                    if (!weeklyScores[week]) {
                        weeklyScores[week] = [];
                    }
                    if (team1 && match.team1Score != null) {
                        weeklyScores[week].push({ team: team1, score: parseFloat(match.team1Score) });
                    }
                    if (team2 && match.team2Score != null) {
                        weeklyScores[week].push({ team: team2, score: parseFloat(match.team2Score) });
                    }
                    if (week > maxWeekForCurrentSelectedSeason) {
                        maxWeekForCurrentSelectedSeason = week;
                    }
                }
            }
        });

        const calculatedHighScores = {};
        Object.keys(weeklyScores).forEach(week => {
            const scoresInWeek = weeklyScores[week];
            if (scoresInWeek.length > 0) {
                scoresInWeek.sort((a, b) => b.score - a.score);

                calculatedHighScores[week] = {
                    highest: scoresInWeek[0],
                    secondHighest: null
                };

                let secondHighestScore = null;
                for (let i = 1; i < scoresInWeek.length; i++) {
                    if (scoresInWeek[i].score < scoresInWeek[0].score) {
                        secondHighestScore = scoresInWeek[i];
                        break;
                    }
                }
                calculatedHighScores[week].secondHighest = secondHighestScore;
            }
        });
        setWeeklyHighScores(calculatedHighScores);
        setCurrentWeekForSelectedSeason(maxWeekForCurrentSelectedSeason);


        const sortedTeams = Array.from(teamsSet).sort();
        setUniqueTeams(['ALL_TEAMS_MULTIPLIER', ...sortedTeams]);
        setActiveTeamsCount(sortedTeams.length);
    }, [selectedSeason, historicalMatchups, getDisplayTeamName]);


    useEffect(() => {
        setAutoPopulateWarning(null);
        setIsTeamAutoPopulated(false);

        if (!(type === 'debit' && category === 'trade_fee')) {
            setTradeTeams(['', '']);
            setNumTrades(1);
            setTradeEntryMethod('multi_team');
        }
        if (!(type === 'debit' && category === 'waiver_fa_fee')) {
            setWaiverEntries([{ team: '', numPickups: 1 }]);
        }

        if (type === 'credit' &&
            (category === 'weekly_1st_points' || category === 'weekly_2nd_points') &&
            weeklyPointsWeek)
        {
            const weekNum = parseInt(weeklyPointsWeek);
            const weekData = weeklyHighScores[weekNum];

            if (weekData) {
                if (category === 'weekly_1st_points' && weekData.highest) {
                    setTeamName(weekData.highest.team);
                    setDescription(`Payout: Weekly 1st Points - ${weekData.highest.team} (${weekData.highest.score} pts)`);
                    setIsTeamAutoPopulated(true);
                } else if (category === 'weekly_2nd_points' && weekData.secondHighest) {
                    setTeamName(weekData.secondHighest.team);
                    setDescription(`Payout: Weekly 2nd Points - ${weekData.secondHighest.team} (${weekData.secondHighest.score} pts)`);
                    setIsTeamAutoPopulated(true);
                } else {
                    setAutoPopulateWarning(`No ${category.replace(/_/g, ' ')} winner found for Week ${weeklyPointsWeek} in the selected season.`);
                }
            } else {
                setAutoPopulateWarning(`No score data found for Week ${weeklyPointsWeek} in the selected season.`);
            }
        } else if (type === 'credit' && category === 'side_pot') {
            setTeamName('');
            setDescription(`Payout: Side Pot`);
        } else {
            setTeamName('');
            setDescription('');
        }
    }, [category, weeklyPointsWeek, weeklyHighScores, type, selectedSeason]);

    // Initialize Firebase and set up authentication
    useEffect(() => {
        let firebaseConfig = {};
        let appId = 'default-app-id';

        try {
            const rawFirebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG;
            if (rawFirebaseConfig) {
                try {
                    firebaseConfig = JSON.parse(rawFirebaseConfig);
                } catch (parseError) {
                    throw new Error(`Failed to parse REACT_APP_FIREBASE_CONFIG environment variable. It might not be valid JSON. Error: ${parseError.message}`);
                }
            } else {
                throw new Error("REACT_APP_FIREBASE_CONFIG environment variable is not defined or is empty. Please ensure it's set in your Vercel project settings with the 'REACT_APP_' prefix.");
            }

            const envAppId = process.env.REACT_APP_APP_ID;
            if (envAppId) {
                appId = envAppId;
            } else {
                console.warn("REACT_APP_APP_ID environment variable is not defined or is empty. Using 'default-app-id'.");
            }

            if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
                throw new Error("Firebase configuration missing projectId or apiKey. Please ensure your REACT_APP_FIREBASE_CONFIG environment variable contains these properties and is correctly formatted JSON.");
            }

            const app = initializeApp(firebaseConfig, appId);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestore);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (initialAuthToken) {
                         try {
                            // await signInWithCustomToken(firebaseAuth, initialAuthToken); // Changed to signInAnonymously
                            await signInAnonymously(firebaseAuth); // Fallback to anonymous
                            setUserId(firebaseAuth.currentUser?.uid);
                        } catch (tokenSignInError) {
                            try {
                                await signInAnonymously(firebaseAuth);
                                setUserId(firebaseAuth.currentUser?.uid);
                            } catch (anonSignInError) {
                                setError(`Failed to sign in: ${anonSignInError.message}. View access may be limited.`);
                                setUserId(null);
                            }
                        }
                    } else {
                        try {
                            await signInAnonymously(firebaseAuth);
                            setUserId(firebaseAuth.currentUser?.uid);
                        } catch (anonSignInError) {
                            setError(`Failed to sign in: ${anonSignInError.message}. View access may be limited.`);
                            setUserId(null);
                        }
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (initError) {
            setError(`Firebase initialization failed: ${initError.message}`);
            setLoading(false);
            setIsAuthReady(true);
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError(null);
        if (!auth) {
            setLoginError("Authentication service not initialized.");
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            setEmail('');
            setPassword('');
            setError(null);
            setShowCommishLogin(false);
        } catch (error) {
            setLoginError(`Login failed: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setLoginError(null);
            setError(null);
        } catch (error) {
            setLoginError(`Logout failed: ${error.message}`);
        }
    };

    // Fetch transactions for the currently selected season (for main view)
    useEffect(() => {
        if (!db || !isAuthReady || selectedSeason === null || activeTab !== 'transactions') {
            setTransactions([]);
            setTransactionPot(0);
            setSelectedTransactionIds([]);
            if (activeTab === 'transactions') setLoading(false); // Only stop loading if this tab is active
            return;
        }

        setLoading(true);
        setError(null);

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        const transactionCollectionPath = `/artifacts/${appId}/public/data/financial_transactions`;

        const q = query(
            collection(db, transactionCollectionPath),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isAuthReady) return;
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const filteredBySeason = fetchedTransactions.filter(t =>
                selectedSeason === 0 || t.season === selectedSeason
            );
            setTransactions(filteredBySeason);

            const currentSeasonTransactionPot = filteredBySeason
                .filter(t =>
                    (t.category === 'waiver_fa_fee' || t.category === 'trade_fee')
                )
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            setTransactionPot(currentSeasonTransactionPot);

            setLoading(false);
            setSelectedTransactionIds([]);
        }, (firestoreError) => {
            setError(`Failed to load financial data: ${firestoreError.message}.`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, selectedSeason, activeTab]);


    // Fetch ALL transactions (for overall history tab)
    useEffect(() => {
        if (!db || !isAuthReady || activeTab !== 'overall_history') {
            setAllTransactions([]);
            if (activeTab === 'overall_history') setLoading(false); // Only stop loading if this tab is active
            return;
        }

        setLoading(true);
        setError(null);

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        const transactionCollectionPath = `/artifacts/${appId}/public/data/financial_transactions`;

        const q = query(
            collection(db, transactionCollectionPath),
            orderBy('date', 'asc') // Order by date ascending for consistent yearly calculations
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isAuthReady) return;
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllTransactions(fetchedTransactions);
            setLoading(false);
        }, (firestoreError) => {
            setError(`Failed to load overall financial data: ${firestoreError.message}.`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, activeTab]);

    // Fetch and listen for updates to the Fee/Payout structure for the SELECTED season
    useEffect(() => {
        if (!db || !isAuthReady || selectedSeason === null) {
            setLoadingStructure(false);
            setDebitStructureData(defaultDebitStructure);
            setCreditStructureData(defaultCreditStructure);
            return;
        }

        setLoadingStructure(true);
        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        // MODIFIED: Season-specific document path for structure
        const structureDocRef = doc(db, `/artifacts/${appId}/public/data/league_structure/${selectedSeason}`);

        const unsubscribe = onSnapshot(structureDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDebitStructureData(data.fees || defaultDebitStructure);
                setCreditStructureData(data.payouts || defaultCreditStructure);
            } else {
                // If no specific structure for the season, load defaults
                setDebitStructureData(defaultDebitStructure);
                setCreditStructureData(defaultCreditStructure);
            }
            setLoadingStructure(false);
            // Clear any previous error related to structure loading if successful
            setError(null);
        }, (firestoreError) => {
            // Log the error to the console for debugging
            console.warn(`Failed to load league structure for season ${selectedSeason}: ${firestoreError.message}. Displaying default structure.`);
            // Do NOT set the general error state for the UI to prevent it from displaying.
            setLoadingStructure(false);
            setDebitStructureData(defaultDebitStructure);
            setCreditStructureData(defaultCreditStructure);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, selectedSeason, defaultDebitStructure, defaultCreditStructure]); // Removed isCommish from dependencies as the error is now always suppressed from UI

    const handleAddTransaction = async (e) => {
        e.preventDefault();

        setError(null);
        setAutoPopulateWarning(null);

        if (!db || !userId) {
            setError("Database not ready or user not authenticated. Cannot add transaction.");
            return;
        }
        if (!isCommish) {
            setError("You do not have permission to add transactions.");
            return;
        }
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            setError("Please enter a valid positive amount.");
            return;
        }
        if (!description.trim() && category !== 'waiver_fa_fee' && !(category === 'trade_fee' && tradeEntryMethod === 'single_team')) {
            setError("Description cannot be empty.");
            return;
        }

        let transactionsToAdd = [];
        const transactionDate = serverTimestamp(); // Use a single timestamp for all related transactions

        if (type === 'debit' && category === 'trade_fee') {
            if (tradeEntryMethod === 'multi_team') {
                const validTradeTeams = tradeTeams.filter(team => team.trim() !== '');
                if (validTradeTeams.length < 2) {
                    setError("Please select at least two teams for a trade fee.");
                    return;
                }
                if (new Set(validTradeTeams).size !== validTradeTeams.length) {
                    setError("Duplicate teams detected for trade fee. Please select unique teams.");
                    return;
                }

                for (const team of validTradeTeams) {
                    transactionsToAdd.push({
                        amount: parseFloat(amount),
                        description: description.trim(),
                        type: type, // 'debit'
                        teamName: team,
                        date: transactionDate,
                        userId: userId,
                        category: category,
                        season: selectedSeason, // Use selectedSeason for new transactions
                        weekNumber: currentWeekForSelectedSeason,
                        teamsInvolvedCount: 1,
                    });
                }
            } else if (tradeEntryMethod === 'single_team') {
                if (!teamName.trim()) {
                    setError("Please select a team for the single team trade entry.");
                    return;
                }
                if (isNaN(numTrades) || numTrades <= 0) {
                    setError("Please enter a valid positive number of trades.");
                    return;
                }
                transactionsToAdd.push({
                    amount: parseFloat(amount) * numTrades,
                    description: `Trade Fee: ${teamName} - ${numTrades} trade(s)`,
                    type: type,
                    teamName: teamName,
                    date: transactionDate,
                    userId: userId,
                    category: category,
                    season: selectedSeason,
                    weekNumber: currentWeekForSelectedSeason,
                    numTrades: numTrades,
                    teamsInvolvedCount: 1,
                });
            }
        } else if (type === 'debit' && category === 'waiver_fa_fee') {
            if (waiverEntries.length === 0 || waiverEntries.some(entry => !entry.team || entry.numPickups <= 0)) {
                setError("Please add at least one valid waiver/FA entry with a team and positive number of pickups.");
                return;
            }
            const perPickupCost = parseFloat(amount);

            for (const entry of waiverEntries) {
                if (entry.team && entry.numPickups > 0) {
                    transactionsToAdd.push({
                        amount: perPickupCost * entry.numPickups,
                        description: `Waiver/FA Fee: ${entry.team} - ${entry.numPickups} pickup(s)`,
                        type: type,
                        teamName: entry.team,
                        date: transactionDate,
                        userId: userId,
                        category: category,
                        season: selectedSeason,
                        weekNumber: currentWeekForSelectedSeason,
                        numPickups: entry.numPickups,
                    });
                }
            }
            if (transactionsToAdd.length === 0) {
                setError("No valid waiver/FA entries to add.");
                return;
            }

        } else {
            if (!teamName.trim() && teamName !== 'ALL_TEAMS_MULTIPLIER') {
                setError("Please select an Associated Team.");
                return;
            }

            let finalAmount = parseFloat(amount);
            let finalTeamName = teamName;
            let teamsInvolved = 1;

            if (type === 'debit' && teamName === 'ALL_TEAMS_MULTIPLIER') {
                if (activeTeamsCount === 0) {
                    setError("Cannot process 'All Teams' transaction: No active teams found in the selected season.");
                    return;
                }
                finalAmount = finalAmount * activeTeamsCount;
                finalTeamName = 'All Teams';
                teamsInvolved = activeTeamsCount;
            } else if (type === 'credit' && teamName === 'ALL_TEAMS_MULTIPLIER') {
                finalTeamName = 'All Teams';
            }

            transactionsToAdd.push({
                amount: finalAmount,
                description: description.trim(),
                type: type,
                teamName: finalTeamName,
                date: transactionDate,
                userId: userId,
                category: category,
                season: selectedSeason,
                weekNumber: currentWeekForSelectedSeason,
                teamsInvolvedCount: teamsInvolved,
            });

            if (type === 'credit') {
                if (category === 'weekly_1st_points' || category === 'weekly_2nd_points') {
                    if (!weeklyPointsWeek || isNaN(parseInt(weeklyPointsWeek))) {
                        setError("Please enter a valid week number for weekly points payouts.");
                        return;
                    }
                    const weekNum = parseInt(weeklyPointsWeek);
                    transactionsToAdd[0].weekNumber = weekNum;

                    const weekData = weeklyHighScores[weekNum];
                    if (weekData) {
                        if (category === 'weekly_1st_points' && weekData.highest) {
                            transactionsToAdd[0].teamName = weekData.highest.team;
                            transactionsToAdd[0].description = `Payout: Weekly 1st Points - ${weekData.highest.team} (${weekData.highest.score} pts)`;
                        } else if (category === 'weekly_2nd_points' && weekData.secondHighest) {
                            transactionsToAdd[0].teamName = weekData.secondHighest.team;
                            transactionsToAdd[0].description = `Payout: Weekly 2nd Points - ${weekData.secondHighest.team} (${weekData.secondHighest.score} pts)`;
                        } else {
                            setError(`Could not find a winning team for ${category.replace(/_/g, ' ')} in Week ${weekNum} for the selected season. Transaction not added.`);
                            return;
                        }
                    } else {
                        setError(`No score data found for Week ${weekNum} in the selected season. Transaction not added.`);
                        return;
                    }
                } else if (category === 'side_pot') {
                    if (!sidePotName.trim()) {
                        setError("Please enter a name for the side pot.");
                        return;
                    }
                    transactionsToAdd[0].potName = sidePotName.trim();
                }
            }
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const transactionCollectionRef = collection(db, `/artifacts/${appId}/public/data/financial_transactions`);

            for (const transaction of transactionsToAdd) {
                await addDoc(transactionCollectionRef, transaction);
            }

            setAmount('');
            setDescription('');
            setType('debit');
            setCategory(getCategoriesForType('debit')[0].value);
            setTeamName('');
            setTradeTeams(['', '']);
            setWaiverEntries([{ team: '', numPickups: 1 }]);
            setWeeklyPointsWeek('');
            setSidePotName('');
            setNumTrades(1);
            setTradeEntryMethod('multi_team');
            setError(null);
            setAutoPopulateWarning(null);
        } catch (addError) {
            setError(`Failed to add transaction: ${addError.message}. Please try again.`);
        }
    };

    const confirmDelete = (transaction) => {
        setTransactionToDelete(transaction);
        setShowConfirmDelete(true);
    };

    const executeDelete = async () => {
        setShowConfirmDelete(false);
        if (!transactionToDelete || !db || !userId) {
            setError("Cannot delete: Invalid transaction or not authenticated.");
            return;
        }
        if (!isCommish) {
            setError("You do not have permission to delete transactions.");
            return;
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const transactionDocRef = doc(db, `/artifacts/${appId}/public/data/financial_transactions`, transactionToDelete.id);
            await deleteDoc(transactionDocRef);
            setError(null);
            setTransactionToDelete(null);
            setSelectedTransactionIds([]);
        } catch (deleteError) {
            setError(`Failed to delete transaction: ${deleteError.message}. Please check your permissions.`);
        }
    };

    const cancelDelete = () => {
        setShowConfirmDelete(false);
        setTransactionToDelete(null);
    };

    const handleAddWaiverEntry = () => {
        setWaiverEntries([...waiverEntries, { team: '', numPickups: 1 }]);
    };

    const handleRemoveWaiverEntry = (indexToRemove) => {
        setWaiverEntries(waiverEntries.filter((_, index) => index !== indexToRemove));
    };

    const handleWaiverEntryChange = (index, field, value) => {
        const newWaiverEntries = [...waiverEntries];
        if (field === 'numPickups') {
            newWaiverEntries[index][field] = parseInt(value) || 0;
        } else {
            newWaiverEntries[index][field] = value;
        }
        setWaiverEntries(newWaiverEntries);
    };

    const isTeamSelectionDisabled = isTeamAutoPopulated || (type === 'debit' && (category === 'waiver_fa_fee'));

    const filteredTransactions = transactions.filter(t => {
        if (filterTeam === '') {
            return true;
        } else if (filterTeam === 'All Teams') {
            return t.teamName === 'All Teams';
        } else {
            // Filter by specific team, also include 'All Teams' debits for individual team view
            return (t.teamName === filterTeam || (t.teamName === 'All Teams' && t.type === 'debit'));
        }
    });

    const handleToggleTransaction = (transactionId) => {
        setSelectedTransactionIds(prevSelected => {
            if (prevSelected.includes(transactionId)) {
                return prevSelected.filter(id => id !== transactionId);
            } else {
                return [...prevSelected, transactionId];
            }
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedTransactionIds.length === currentTransactions.length && currentTransactions.length > 0) {
            setSelectedTransactionIds([]);
        } else {
            setSelectedTransactionIds(currentTransactions.map(t => t.id));
        }
    };

    const confirmBulkDelete = () => {
        if (selectedTransactionIds.length > 0) {
            setShowConfirmBulkDelete(true);
        }
    };

    const executeBulkDelete = async () => {
        setShowConfirmBulkDelete(false);
        if (!db || !userId) {
            setError("Database not ready or user not authenticated. Cannot delete transactions.");
            return;
        }
        if (!isCommish) {
            setError("You do not have permission to delete transactions.");
            return;
        }

        try {
            const batch = writeBatch(db);
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

            selectedTransactionIds.forEach(id => {
                const docRef = doc(db, `/artifacts/${appId}/public/data/financial_transactions`, id);
                batch.delete(docRef);
            });
            await batch.commit();
            setError(null);
            setSelectedTransactionIds([]);
        } catch (bulkDeleteError) {
            setError(`Failed to delete selected transactions: ${bulkDeleteError.message}.`);
        }
    };

    const cancelBulkDelete = () => {
        setShowConfirmBulkDelete(false);
    };

    const overallDebits = transactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const overallCredits = transactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const overallNetBalance = overallDebits - overallCredits;

    // Calculate team summary data for the CURRENTLY SELECTED season
    const teamSummary = {};
    uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').forEach(team => {
        teamSummary[team] = {
            totalDebits: 0,
            totalCredits: 0,
            netBalance: 0,
            totalDebitsLessEntryFee: 0,
            winningsExtraFees: 0,
        };
    });

    transactions.forEach(t => {
        if (t.teamName === 'All Teams' && t.type === 'debit' && t.teamsInvolvedCount > 0) {
            const perTeamAmount = t.amount / t.teamsInvolvedCount;
            uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').forEach(team => {
                if (teamSummary[team]) {
                    teamSummary[team].totalDebits += perTeamAmount;
                    if (t.category !== 'entry_fee') {
                        teamSummary[team].totalDebitsLessEntryFee += perTeamAmount;
                    }
                }
            });
        } else if (teamSummary[t.teamName]) {
            if (t.type === 'debit') {
                teamSummary[t.teamName].totalDebits += (t.amount || 0);
                if (t.category !== 'entry_fee') {
                    teamSummary[t.teamName].totalDebitsLessEntryFee += (t.amount || 0);
                }
            } else if (t.type === 'credit') {
                teamSummary[t.teamName].totalCredits += (t.amount || 0);
            }
        }
    });

    Object.keys(teamSummary).forEach(team => {
        teamSummary[team].netBalance = teamSummary[team].totalCredits - teamSummary[team].totalDebits;
        teamSummary[team].winningsExtraFees = teamSummary[team].totalCredits - teamSummary[team].totalDebitsLessEntryFee;
    });

    const handleAddTradeTeam = () => {
        setTradeTeams([...tradeTeams, '']);
    };

    const handleRemoveTradeTeam = (indexToRemove) => {
        setTradeTeams(tradeTeams.filter((_, index) => index !== indexToRemove));
    };

    const handleTradeTeamChange = (index, value) => {
        const newTradeTeams = [...tradeTeams];
        newTradeTeams[index] = value;
        setTradeTeams(newTradeTeams);
    };

    const nonAllTeams = uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER');

    const handleDebitStructureChange = (index, field, value) => {
        const newStructure = [...debitStructureData];
        newStructure[index][field] = value;
        setDebitStructureData(newStructure);
    };

    const handleCreditStructureChange = (index, field, value) => {
        const newStructure = [...creditStructureData];
        newStructure[index][field] = value;
        setCreditStructureData(newStructure);
    };

    const handleAddDebitItem = () => {
        setDebitStructureData([...debitStructureData, { name: '', amount: '', description: '' }]);
    };

    const handleRemoveDebitItem = (indexToRemove) => {
        setDebitStructureData(debitStructureData.filter((_, index) => index !== indexToRemove));
    };

    const handleAddCreditItem = () => {
        setCreditStructureData([...creditStructureData, { name: '', amount: '', description: '' }]);
    };

    const handleRemoveCreditItem = (indexToRemove) => {
        setCreditStructureData(creditStructureData.filter((_, index) => index !== indexToRemove));
    };

    const handleSaveStructure = async () => {
        if (!db || !isCommish || selectedSeason === null) {
            setError("Cannot save structure: Not authenticated as commish, database not ready, or no season selected.");
            return;
        }
        setLoadingStructure(true);
        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            // MODIFIED: Save to season-specific document path
            const structureDocRef = doc(db, `/artifacts/${appId}/public/data/league_structure/${selectedSeason}`);
            await setDoc(structureDocRef, {
                fees: debitStructureData,
                payouts: creditStructureData,
                lastUpdated: serverTimestamp()
            });
            setIsEditingStructure(false);
            setError(null);
        } catch (saveError) {
            setError(`Failed to save league structure for season ${selectedSeason}: ${saveError.message}`);
        } finally {
            setLoadingStructure(false);
        }
    };

    const handleCancelEditStructure = () => {
        setIsEditingStructure(false);
        // On cancel, re-fetch the current season's structure to discard unsaved changes
        // This will be handled by the useEffect for structure data based on selectedSeason
        setError(null);
    };

    const indexOfLastTransaction = currentPage * transactionsPerPage;
    const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
    const currentTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfFirstTransaction + transactionsPerPage);

    const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // Derive all unique team names for the Overall History tab
    const uniqueTeamsForOverallHistory = useMemo(() => {
        const names = new Set();
        allTransactions.forEach(t => {
            const displayTeam = getDisplayTeamName(String(t.teamName || '').trim());
            // Only add actual team names, not "All Teams" or empty
            if (displayTeam && displayTeam !== 'All Teams') {
                names.add(displayTeam);
            }
        });
        return Array.from(names).sort();
    }, [allTransactions, getDisplayTeamName]);

    return (
        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4 mx-auto">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 text-center">
                League Financial Tracker
            </h2>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-6">
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-6 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${
                        activeTab === 'transactions' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Transactions
                </button>
                <button
                    onClick={() => setActiveTab('overall_history')}
                    className={`px-6 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${
                        activeTab === 'overall_history' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Overall Financial History
                </button>
            </div>

            <div className="mb-4 text-center text-sm text-gray-600 p-2 bg-blue-50 rounded">
                {COMMISH_UID && isCommish && (
                    <span className="font-semibold mt-1">
                        You are logged in as the Commish.
                    </span>
                )}

                {isAuthReady && !isCommish && ( // Only show login form if not already commish
                    <div className="mt-4">
                        {!showCommishLogin ? (
                            <button
                                onClick={() => setShowCommishLogin(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors w-full max-w-xs"
                            >
                                Commish Login
                            </button>
                        ) : (
                            <form onSubmit={handleLogin} className="flex flex-col items-center space-y-2">
                                <p className="text-gray-700 font-semibold mb-2">Enter Commish Credentials</p>
                                <input
                                    type="email"
                                    placeholder="Commish Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-full max-w-xs"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-full max-w-xs"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors w-full max-w-xs"
                                >
                                    Login (Commish Only)
                                </button>
                                {loginError && <p className="text-red-500 text-sm mt-2">{loginError}</p>}
                                <button
                                    type="button"
                                    onClick={() => setShowCommishLogin(false)}
                                    className="text-gray-500 hover:text-gray-700 text-sm mt-2"
                                >
                                    Hide Login
                                </button>
                            </form>
                        )}
                    </div>
                )}
                {isAuthReady && isCommish && ( // Show logout button only if commish is logged in
                    <div className="mt-4">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors"
                        >
                            Logout (Commish)
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <p className="text-center text-blue-600 font-semibold">Loading financial data...</p>
            ) : (
                <>
                    {error && (
                        <p className="text-center text-red-600 font-semibold mb-4">{error}</p>
                    )}

                    {activeTab === 'transactions' && (
                        <>
                            {/* Season Selector for Viewing */}
                            {availableSeasons.length > 0 && (
                                <div className="flex justify-center items-center mb-4 p-2 bg-blue-50 rounded-lg shadow-sm">
                                    <label htmlFor="seasonFilter" className="mr-2 font-semibold text-blue-700">View/Add Data For Season:</label>
                                    <select
                                        id="seasonFilter"
                                        value={selectedSeason || ''}
                                        onChange={(e) => {
                                            const newSeason = parseInt(e.target.value);
                                            setSelectedSeason(isNaN(newSeason) ? null : newSeason);
                                            setCurrentPage(1);
                                            setFilterTeam('');
                                        }}
                                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    >
                                        {availableSeasons.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Financial Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <div className="bg-red-50 p-4 rounded-lg shadow-sm text-center">
                                    <h3 className="text-lg font-semibold text-red-700">Total Fees</h3>
                                    <p className="text-2xl font-bold text-red-900">{formatCurrency(overallDebits)}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg shadow-sm text-center">
                                    <h3 className="text-lg font-semibold text-green-700">Total Payouts</h3>
                                    <p className="text-2xl font-bold text-green-900">{formatCurrency(overallCredits)}</p>
                                </div>
                                <div className={`p-4 rounded-lg shadow-sm text-center ${overallNetBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <h3 className="text-lg font-semibold text-blue-700">League Bank</h3>
                                    <p className={`text-2xl font-bold ${overallNetBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>{formatCurrency(overallNetBalance)}</p>
                                </div>
                                <div className="bg-yellow-50 p-4 rounded-lg shadow-sm text-center">
                                    <h3 className="text-lg font-semibold text-yellow-700">Transaction Pot</h3>
                                    <p className="text-2xl font-bold text-yellow-900">{formatCurrency(transactionPot)}</p>
                                </div>
                            </div>

                            {/* Add New Transaction Form (Conditionally rendered for Commish) */}
                            {isCommish ? (
                                <section className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Add New Transaction (for {selectedSeason || 'selected'} season)</h3>
                                    <form onSubmit={handleAddTransaction} className="space-y-4">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1">
                                                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                                <input
                                                    type="number"
                                                    id="amount"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    placeholder={category === 'waiver_fa_fee' ? "e.g., 1.00 (per pickup)" : (category === 'trade_fee' && tradeEntryMethod === 'single_team' ? "e.g., 2.00 (per trade)" : "e.g., 50.00")}
                                                    step="0.01"
                                                    min="0.01"
                                                    required
                                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                                                <select
                                                    id="type"
                                                    value={type}
                                                    onChange={(e) => setType(e.target.value)}
                                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                >
                                                    <option value="debit">Fee (Money In)</option>
                                                    <option value="credit">Payout (Money Out)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                            <select
                                                id="category"
                                                value={category}
                                                onChange={(e) => {
                                                    setCategory(e.target.value);
                                                    setWeeklyPointsWeek('');
                                                    setSidePotName('');
                                                    setTeamName('');
                                                    setTradeTeams(['', '']);
                                                    setWaiverEntries([{ team: '', numPickups: 1 }]);
                                                    setDescription('');
                                                    setNumTrades(1);
                                                    setTradeEntryMethod('multi_team');
                                                }}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            >
                                                {getCategoriesForType(type).map(cat => (
                                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {!(type === 'debit' && category === 'waiver_fa_fee') && !(type === 'debit' && category === 'trade_fee' && tradeEntryMethod === 'single_team') && (
                                            <div>
                                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                                <input
                                                    type="text"
                                                    id="description"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder="e.g., Annual League Entry, Weekly Winnings"
                                                    maxLength="100"
                                                    required
                                                    readOnly={isTeamAutoPopulated}
                                                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isTeamAutoPopulated ? 'bg-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                                                />
                                            </div>
                                        )}

                                        {(category === 'weekly_1st_points' || category === 'weekly_2nd_points') && (
                                            <div>
                                                <label htmlFor="weeklyPointsWeek" className="block text-sm font-medium text-gray-700 mb-1">Week Number (defaults to latest for selected season)</label>
                                                <input
                                                    type="number"
                                                    id="weeklyPointsWeek"
                                                    value={weeklyPointsWeek}
                                                    onChange={(e) => setWeeklyPointsWeek(e.target.value)}
                                                    placeholder="e.g., 1, 5, 14"
                                                    min="0"
                                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                />
                                            </div>
                                        )}

                                        {category === 'side_pot' && (
                                            <div>
                                                <label htmlFor="sidePotName" className="block text-sm font-medium text-gray-700 mb-1">Side Pot Name</label>
                                                <input
                                                    type="text"
                                                    id="sidePotName"
                                                    value={sidePotName}
                                                    onChange={(e) => setSidePotName(e.target.value)}
                                                    placeholder="e.g., Draft Day Pot, Playoff Pool"
                                                    maxLength="50"
                                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                />
                                            </div>
                                        )}

                                        {type === 'debit' && category === 'trade_fee' ? (
                                            <div className="space-y-4">
                                                <label className="block text-sm font-medium text-gray-700">Trade Entry Method:</label>
                                                <div className="flex space-x-4">
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            className="form-radio text-blue-600"
                                                            value="multi_team"
                                                            checked={tradeEntryMethod === 'multi_team'}
                                                            onChange={() => {
                                                                setTradeEntryMethod('multi_team');
                                                                setTeamName('');
                                                                setNumTrades(1);
                                                            }}
                                                        />
                                                        <span className="ml-2">Multiple Teams (Current Method)</span>
                                                    </label>
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            className="form-radio text-blue-600"
                                                            value="single_team"
                                                            checked={tradeEntryMethod === 'single_team'}
                                                            onChange={() => {
                                                                setTradeEntryMethod('single_team');
                                                                setTradeTeams(['', '']);
                                                            }}
                                                        />
                                                        <span className="ml-2">Single Team (Enter Number of Trades)</span>
                                                    </label>
                                                </div>

                                                {tradeEntryMethod === 'multi_team' ? (
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Teams Involved in Trade (Min 2)</label>
                                                        {tradeTeams.map((team, index) => (
                                                            <div key={index} className="flex items-center space-x-2">
                                                                <select
                                                                    value={team}
                                                                    onChange={(e) => handleTradeTeamChange(index, e.target.value)}
                                                                    required
                                                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                                >
                                                                    <option value="">Select Team</option>
                                                                    {nonAllTeams.map(optionTeam => (
                                                                        <option key={optionTeam} value={optionTeam}>{optionTeam}</option>
                                                                    ))}
                                                                </select>
                                                                {tradeTeams.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveTradeTeam(index)}
                                                                        className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500 transition-colors text-sm"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={handleAddTradeTeam}
                                                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                                                        >
                                                            Add Another Team
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div>
                                                            <label htmlFor="singleTeamTradeTeamName" className="block text-sm font-medium text-gray-700 mb-1">Associated Team</label>
                                                            <select
                                                                id="singleTeamTradeTeamName"
                                                                value={teamName}
                                                                onChange={(e) => setTeamName(e.target.value)}
                                                                required
                                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                            >
                                                                <option value="">Select Team</option>
                                                                {nonAllTeams.map(team => (
                                                                    <option key={team} value={team}>{team}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label htmlFor="numTrades" className="block text-sm font-medium text-gray-700 mb-1">Number of Trades</label>
                                                            <input
                                                                type="number"
                                                                id="numTrades"
                                                                value={numTrades}
                                                                onChange={(e) => setNumTrades(parseInt(e.target.value) || 0)}
                                                                placeholder="e.g., 3"
                                                                min="1"
                                                                required
                                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : type === 'debit' && category === 'waiver_fa_fee' ? (
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Waiver/FA Pickups (Enter per team)</label>
                                                {waiverEntries.map((entry, index) => (
                                                    <div key={index} className="flex flex-col sm:flex-row gap-2 items-center">
                                                        <select
                                                            value={entry.team}
                                                            onChange={(e) => handleWaiverEntryChange(index, 'team', e.target.value)}
                                                            required
                                                            className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        >
                                                            <option value="">Select Team</option>
                                                            {nonAllTeams.map(optionTeam => (
                                                                <option key={optionTeam} value={optionTeam}>{optionTeam}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            value={entry.numPickups}
                                                            onChange={(e) => handleWaiverEntryChange(index, 'numPickups', e.target.value)}
                                                            placeholder="Pickups"
                                                            min="1"
                                                            required
                                                            className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                        {waiverEntries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveWaiverEntry(index)}
                                                                className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500 transition-colors text-sm"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={handleAddWaiverEntry}
                                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                                                >
                                                    Add Another Waiver Entry
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Associated Team</label>
                                                <select
                                                    id="teamName"
                                                    value={teamName}
                                                    onChange={(e) => {
                                                        setTeamName(e.target.value);
                                                        setIsTeamAutoPopulated(false);
                                                        setAutoPopulateWarning(null);
                                                    }}
                                                    required
                                                    disabled={isTeamSelectionDisabled}
                                                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isTeamAutoPopulated ? 'bg-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                                                >
                                                    <option value="">Select Team</option>
                                                    {type === 'debit' && (
                                                        <option value="ALL_TEAMS_MULTIPLIER">All Teams (Multiplied)</option>
                                                    )}
                                                    {nonAllTeams.map(team => (
                                                        <option key={team} value={team}>{team}</option>
                                                    ))}
                                                </select>
                                                {autoPopulateWarning && (
                                                    <p className="text-xs text-orange-600 mt-1">{autoPopulateWarning}</p>
                                                )}
                                                {isTeamAutoPopulated && teamName && (
                                                    <p className="text-xs text-gray-500 mt-1">Automatically determined: {teamName}</p>
                                                )}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                        >
                                            Add Transaction
                                        </button>
                                    </form>
                                </section>
                            ) : (
                                // This entire block is removed, as requested by the user
                                null
                            )}

                            {/* Transaction History Table */}
                            <section>
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Transaction History</h3>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="w-1/2">
                                        <label htmlFor="filterTeam" className="block text-sm font-medium text-gray-700 mb-1">Filter by Team:</label>
                                        <select
                                            id="filterTeam"
                                            value={filterTeam}
                                            onChange={(e) => {
                                                setFilterTeam(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm w-full"
                                        >
                                            <option value="">Show All Teams</option>
                                            {uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').map(team => (
                                                <option key={team} value={team}>{team}</option>
                                            ))}
                                            <option value="All Teams">Transactions for 'All Teams'</option>
                                        </select>
                                    </div>
                                    {isCommish && selectedTransactionIds.length > 0 && (
                                        <button
                                            onClick={confirmBulkDelete}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md shadow-md transition-colors text-sm flex-shrink-0 ml-4"
                                        >
                                            Delete Selected ({selectedTransactionIds.length})
                                        </button>
                                    )}
                                </div>
                                {filteredTransactions.length === 0 ? (
                                    <p className="text-center text-gray-600">No transactions recorded yet{filterTeam && ` for ${filterTeam}`}.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                            <thead className="bg-blue-100">
                                                <tr>
                                                    {isCommish && (
                                                        <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 w-12">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTransactionIds.length === currentTransactions.length && currentTransactions.length > 0}
                                                                onChange={handleToggleSelectAll}
                                                                className="form-checkbox h-4 w-4 text-blue-600"
                                                            />
                                                        </th>
                                                    )}
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Date</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Description</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Amount</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Type</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Category</th>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Week</th>
                                                    {isCommish && <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Actions</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentTransactions.map((t, index) => {
                                                    let displayAmount = (t.amount || 0).toFixed(2);
                                                    const effectiveTeamsCount = t.teamsInvolvedCount > 0 ? t.teamsInvolvedCount : activeTeamsCount;

                                                    if (filterTeam !== '' && filterTeam !== 'All Teams' && t.teamName === 'All Teams' && t.type === 'debit' && effectiveTeamsCount > 0) {
                                                        displayAmount = (t.amount / effectiveTeamsCount).toFixed(2);
                                                    }
                                                    return (
                                                        <tr key={t.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                            {isCommish && (
                                                                <td className="py-2 px-4 text-sm border-b border-gray-200">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedTransactionIds.includes(t.id)}
                                                                        onChange={() => handleToggleTransaction(t.id)}
                                                                        className="form-checkbox h-4 w-4 text-blue-600"
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                                {t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'N/A'}
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                                {t.description}
                                                                {t.category === 'side_pot' && t.potName && ` (${t.potName})`}
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{t.teamName || '-'}</td>
                                                            <td className="py-2 px-4 text-sm text-right border-b border-gray-200">
                                                                <span className={`${t.type === 'debit' ? 'text-red-700' : 'text-green-700'} font-medium`}>
                                                                    {formatCurrency(parseFloat(displayAmount))}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                                    t.type === 'debit' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                                                }`}>
                                                                    {t.type === 'debit' ? 'Fee' : 'Payout'}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200 capitalize">
                                                                {t.category ? t.category.replace(/_/g, ' ') : 'General'}
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                                {t.weekNumber === 0 ? 'Pre' : (t.weekNumber || '-')}
                                                            </td>
                                                            {isCommish && (
                                                                <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                                    <button
                                                                        onClick={() => confirmDelete(t)}
                                                                        className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-md shadow-sm transition-colors duration-200"
                                                                        title="Delete Transaction"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {totalPages > 1 && (
                                            <div className="flex justify-center items-center space-x-2 mt-4">
                                                <button
                                                    onClick={handlePreviousPage}
                                                    disabled={currentPage === 1}
                                                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Previous
                                                </button>
                                                {[...Array(totalPages)].map((_, index) => (
                                                    <button
                                                        key={index + 1}
                                                        onClick={() => paginate(index + 1)}
                                                        className={`px-3 py-1 rounded-md ${
                                                            currentPage === index + 1 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                        }`}
                                                    >
                                                        {index + 1}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={handleNextPage}
                                                    disabled={currentPage === totalPages}
                                                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* Team Financial Summary Section (Current Season) */}
                            {Object.keys(teamSummary).length > 0 && (
                                <section className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Team Financial Summary (Current Season)</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                            <thead className="bg-blue-100">
                                                <tr>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team Name</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Fees</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Payouts</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Net Balance</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Winnings/(Extra Fees)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(teamSummary).sort(([teamA], [teamB]) => teamA.localeCompare(teamB)).map(([team, data], index) => (
                                                    <tr key={team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{team}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-gray-900 font-medium border-b border-gray-200">{formatCurrency(data.totalDebits)}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-gray-900 font-medium border-b border-gray-200">{formatCurrency(data.totalCredits)}</td>
                                                        <td className={`py-2 px-4 text-sm text-right font-bold border-b border-gray-200 ${data.netBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                                            {formatCurrency(data.netBalance)}
                                                        </td>
                                                        <td className={`py-2 px-4 text-sm text-right font-bold border-b border-gray-200 ${data.winningsExtraFees >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                                            {formatCurrency(data.winningsExtraFees)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            {/* Fee and Payout Structure Section */}
                            <section className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">League Fee & Payout Structure (for {selectedSeason || 'selected'} season)</h3>
                                {isCommish && !isEditingStructure && (
                                    <div className="text-center mb-4">
                                        <button
                                            onClick={() => setIsEditingStructure(true)}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                        >
                                            Edit Structure
                                        </button>
                                    </div>
                                )}

                                {loadingStructure ? (
                                    <p className="text-center text-blue-600">Loading structure...</p>
                                ) : isEditingStructure ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xl font-semibold text-red-700 mb-3">Fees (Money In)</h4>
                                            {debitStructureData.map((item, index) => (
                                                <div key={index} className="flex flex-col md:flex-row gap-2 mb-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => handleDebitStructureChange(index, 'name', e.target.value)}
                                                        placeholder="Fee Name"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.amount}
                                                        onChange={(e) => handleDebitStructureChange(index, 'amount', e.target.value)}
                                                        placeholder="Amount"
                                                        className="w-24 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.description} // Ensured value is bound to state
                                                        onChange={(e) => handleDebitStructureChange(index, 'description', e.target.value)}
                                                        placeholder="Description (optional)"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveDebitItem(index)}
                                                        className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={handleAddDebitItem}
                                                className="mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
                                            >
                                                Add Fee Item
                                            </button>
                                        </div>

                                        <div>
                                            <h4 className="text-xl font-semibold text-green-700 mb-3">Payouts (Money Out)</h4>
                                            {creditStructureData.map((item, index) => (
                                                <div key={index} className="flex flex-col md:flex-row gap-2 mb-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => handleCreditStructureChange(index, 'name', e.target.value)}
                                                        placeholder="Payout Name"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.amount}
                                                        onChange={(e) => handleCreditStructureChange(index, 'amount', e.target.value)}
                                                        placeholder="Amount (optional)"
                                                        className="w-24 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.description} // Ensured value is bound to state
                                                        onChange={(e) => handleCreditStructureChange(index, 'description', e.target.value)}
                                                        placeholder="Description (optional)"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCreditItem(index)}
                                                        className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={handleAddCreditItem}
                                                className="mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
                                            >
                                                Add Payout Item
                                            </button>
                                        </div>
                                        <div className="flex justify-center space-x-4 mt-6">
                                            <button
                                                type="button"
                                                onClick={handleSaveStructure}
                                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-md"
                                            >
                                                Save Structure
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCancelEditStructure}
                                                className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold rounded-md shadow-md"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xl font-semibold text-red-700 mb-3">Fees (Money In)</h4>
                                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                {debitStructureData.map((item, index) => (
                                                    <li key={index}>
                                                        <strong>{item.name}:</strong> {item.amount}{item.description && ` - ${item.description}`}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-semibold text-green-700 mb-3">Payouts (Money Out)</h4>
                                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                {creditStructureData.map((item, index) => (
                                                    <li key={index}>
                                                        <strong>{item.name}:</strong> {item.amount}{item.description && ` - ${item.description}`}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {activeTab === 'overall_history' && (
                        <OverallFinancialHistoryTab
                            allTransactions={allTransactions}
                            getDisplayTeamName={getDisplayTeamName}
                            uniqueTeamsForOverallHistory={uniqueTeamsForOverallHistory} // Pass this prop
                        />
                    )}
                </>
            )}

            {showConfirmDelete && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Deletion</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this transaction? This action cannot be undone.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                type="button"
                                onClick={cancelDelete}
                                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={executeDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmBulkDelete && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Bulk Deletion</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete {selectedTransactionIds.length} selected transactions? This action cannot be undone.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                type="button"
                                onClick={cancelBulkDelete}
                                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={executeBulkDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            >
                                Delete All Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialTracker;

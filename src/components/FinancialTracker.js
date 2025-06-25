import React, { useState, useEffect } from 'react';
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

const FinancialTracker = ({ getDisplayTeamName, historicalMatchups }) => {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('debit'); // 'debit' or 'credit' - internal values
    const [category, setCategory] = useState('entry_fee'); // Updated default category for fees
    const [weeklyPointsWeek, setWeeklyPointsWeek] = useState('');
    const [sidePotName, setSidePotName] = useState('');

    const [teamName, setTeamName] = useState(''); 
    const [tradeTeams, setTradeTeams] = useState(['', '']); 
    // State for multiple waiver/FA entries
    const [waiverEntries, setWaiverEntries] = useState([{ team: '', numPickups: 1 }]); 
    
    // New state for trade entry method: 'multi_team' or 'single_team'
    const [tradeEntryMethod, setTradeEntryMethod] = useState('multi_team'); 
    const [numTrades, setNumTrades] = useState(1); // For single team trade entry

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); 
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null); 
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [uniqueTeams, setUniqueTeams] = useState([]);
    // weeklyHighScores will now store data for the currently selected season
    const [weeklyHighScores, setWeeklyHighScores] = useState({}); 
    // currentWeek will now store the max week for the currently selected season
    const [currentWeekForSelectedSeason, setCurrentWeekForSelectedSeason] = useState(0); 

    const [selectedSeason, setSelectedSeason] = useState(null); // Season currently being viewed/filtered
    const [availableSeasons, setAvailableSeasons] = useState([]); // All seasons available in historicalMatchups
    const [activeTeamsCount, setActiveTeamsCount] = useState(0); // Teams in the selected season
    
    const [isTeamAutoPopulated, setIsTeamAutoPopulated] = useState(false); 
    const [autoPopulateWarning, setAutoPopulateWarning] = useState(null); 
    
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null); // For single delete
    // State for multi-select delete
    const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
    const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);


    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(null);
    const [showCommishLogin, setShowCommishLogin] = useState(false); // New state for showing login fields

    const [filterTeam, setFilterTeam] = useState(''); 

    // State for editable structure (now Fees/Payouts)
    const [debitStructureData, setDebitStructureData] = useState([]); // Internal name
    const [creditStructureData, setCreditStructureData] = useState([]); // Internal name
    const [isEditingStructure, setIsEditingStructure] = useState(false);
    const [loadingStructure, setLoadingStructure] = useState(true); 

    // State for transaction pot
    const [transactionPot, setTransactionPot] = useState(0);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const transactionsPerPage = 10;

    const COMMISH_UID = process.env.REACT_APP_COMMISH_UID;
    const isCommish = userId && COMMISH_UID && userId === COMMISH_UID; 

    // Define categories based on type for form selection
    const getCategoriesForType = (currentType) => {
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
    };

    // Hardcoded default structure (used if no data in Firebase)
    const defaultDebitStructure = [
        { name: 'League Entry Fee', amount: '$70', description: 'Paid per team for entry.' },
        { name: 'Waivers/Free Agents', amount: '$1', description: 'Per transaction.' },
        { name: 'Trades', amount: '$2', description: 'Per team involved.' },
        { name: 'Other Fee', amount: '', description: 'Miscellaneous fees.' },
    ];

    const defaultCreditStructure = [
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
    ];


    // Effect to update category when type changes
    useEffect(() => {
        const categories = getCategoriesForType(type);
        if (categories.length > 0) {
            // Check if the current category is still valid for the new type
            if (!categories.some(cat => cat.value === category)) {
                // If not, set to the first category of the new type
                setCategory(categories[0].value);
            }
        } else {
            setCategory('');
        }
        // When type changes, reset category-specific states
        if (!(type === 'debit' && category === 'trade_fee')) {
            setTradeTeams(['', '']);
            setNumTrades(1); // Reset numTrades
            setTradeEntryMethod('multi_team'); // Reset trade entry method
        }
        if (!(type === 'debit' && category === 'waiver_fa_fee')) {
            setWaiverEntries([{ team: '', numPickups: 1 }]);
        }
    }, [type, category]); 


    // Derive unique teams, calculate weekly high scores, and determine available/current/selected seasons
    useEffect(() => {
        if (historicalMatchups && Array.isArray(historicalMatchups)) {
            const yearsSet = new Set();
            let maxSeasonOverall = 0; // Track the absolute latest season

            historicalMatchups.forEach(match => {
                if (match.year && typeof match.year === 'number') {
                    yearsSet.add(match.year);
                    if (match.year > maxSeasonOverall) {
                        maxSeasonOverall = match.year;
                    }
                }
            });

            const sortedYears = Array.from(yearsSet).sort((a, b) => b - a); // Descending order
            setAvailableSeasons(sortedYears);
            
            // Set selectedSeason to the latest overall season on initial load if not already set
            if (maxSeasonOverall > 0 && selectedSeason === null) {
                setSelectedSeason(maxSeasonOverall);
            }
            console.log("Determined maxSeasonOverall:", maxSeasonOverall);
            console.log("Available Seasons:", sortedYears);
        }
    }, [historicalMatchups, selectedSeason]);


    // Effect to update team data, weekly high scores, and current week based on selectedSeason
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
        console.log(`Calculated Weekly High Scores for selected season ${selectedSeason}:`, calculatedHighScores);
        console.log(`Determined max week for selected season ${selectedSeason}:`, maxWeekForCurrentSelectedSeason);


        const sortedTeams = Array.from(teamsSet).sort();
        setUniqueTeams(['ALL_TEAMS_MULTIPLIER', ...sortedTeams]); 
        setActiveTeamsCount(sortedTeams.length); 
        console.log(`Unique teams for selected season ${selectedSeason}:`, sortedTeams);
    }, [selectedSeason, historicalMatchups, getDisplayTeamName]);


    // Effect to automatically set teamName and description when category and weeklyPointsWeek change
    useEffect(() => {
        setAutoPopulateWarning(null); 
        setIsTeamAutoPopulated(false); 

        // Reset category-specific states if not applicable
        if (type !== 'debit' || category !== 'trade_fee') {
            setTradeTeams(['', '']);
            setNumTrades(1); // Reset numTrades
            setTradeEntryMethod('multi_team'); // Reset trade entry method
        }
        if (type !== 'debit' || category !== 'waiver_fa_fee') {
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
            // Clear team name and description for other categories
            setTeamName('');
            setDescription('');
        }
    }, [category, weeklyPointsWeek, weeklyHighScores, type, selectedSeason]); // Added selectedSeason here

    // Initialize Firebase and set up authentication
    useEffect(() => {
        let firebaseConfig = {};
        let appId = 'default-app-id';

        try {
            const rawFirebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG;
            if (rawFirebaseConfig) {
                try {
                    firebaseConfig = JSON.parse(rawFirebaseConfig);
                    console.log("Parsed firebaseConfig from REACT_APP_FIREBASE_CONFIG:", firebaseConfig);
                } catch (parseError) {
                    throw new Error(`Failed to parse REACT_APP_FIREBASE_CONFIG environment variable. It might not be valid JSON. Error: ${parseError.message}`);
                }
            } else {
                throw new Error("REACT_APP_FIREBASE_CONFIG environment variable is not defined or is empty. Please ensure it's set in your Vercel project settings with the 'REACT_APP_' prefix.");
            }

            const envAppId = process.env.REACT_APP_APP_ID;
            if (envAppId) {
                appId = envAppId;
                console.log("App ID from REACT_APP_APP_ID:", appId);
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
                    console.log("Firebase Auth Ready. User ID:", user.uid);
                } else {
                    // Always try to sign in anonymously for view access if not already logged in.
                    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (initialAuthToken) {
                         try {
                            // Note: signInWithCustomToken is not available in the provided tool API.
                            // Assuming there's a mechanism for custom token sign-in if needed.
                            // For now, removing this as it causes an error with provided tools.
                            // await signInWithCustomToken(firebaseAuth, initialAuthToken);
                            // setUserId(firebaseAuth.currentUser?.uid); 
                            // console.log("Signed in with custom token. User ID:", firebaseAuth.currentUser?.uid);
                             await signInAnonymously(firebaseAuth); // Fallback to anonymous
                             setUserId(firebaseAuth.currentUser?.uid);
                             console.log("Signed in anonymously (fallback from custom token attempt). User ID:", firebaseAuth.currentUser?.uid);

                        } catch (tokenSignInError) {
                            console.error("Error signing in with custom token (falling back to anonymous):", tokenSignInError);
                            try {
                                await signInAnonymously(firebaseAuth);
                                setUserId(firebaseAuth.currentUser?.uid);
                                console.log("Signed in anonymously (fallback). User ID:", firebaseAuth.currentUser?.uid);
                            } catch (anonSignInError) {
                                console.error("Error during anonymous sign-in:", anonSignInError);
                                setError(`Failed to sign in: ${anonSignInError.message}. View access may be limited.`);
                                setUserId(null);
                            }
                        }
                    } else {
                        try {
                            await signInAnonymously(firebaseAuth);
                            setUserId(firebaseAuth.currentUser?.uid);
                            console.log("Signed in anonymously. User ID:", firebaseAuth.currentUser?.uid);
                        } catch (anonSignInError) {
                            console.error("Error during anonymous sign-in:", anonSignInError);
                            setError(`Failed to sign in: ${anonSignInError.message}. View access may be limited.`);
                            setUserId(null);
                        }
                    }
                }
                setIsAuthReady(true); 
            });

            return () => unsubscribe();
        } catch (initError) {
            console.error("Error initializing Firebase:", initError);
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
            console.log("Logged in successfully!");
            setEmail('');
            setPassword('');
            setError(null); // Clear any general errors
            setShowCommishLogin(false); // Hide login fields after successful login
        } catch (error) {
            console.error("Login Error:", error);
            setLoginError(`Login failed: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            console.log("Logged out successfully!");
            setLoginError(null);
            setError(null); // Clear any general errors
        } catch (error) {
            console.error("Logout Error:", error);
            setLoginError(`Logout failed: ${error.message}`);
        }
    };

    // Fetch transaction history
    useEffect(() => {
        // Fetch transactions for ANY authenticated user (anonymous or otherwise)
        if (!db || !isAuthReady || selectedSeason === null) {
            console.log("Firestore not ready, Auth not ready, or selectedSeason not set. Skipping transaction fetch.");
            setTransactions([]); // Clear existing transactions
            setTransactionPot(0); // Clear pot
            setLoading(false); // Stop loading
            setSelectedTransactionIds([]); // Clear selections
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

        console.log(`Attempting to listen to Firestore collection: ${transactionCollectionPath} for season: ${selectedSeason}`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isAuthReady) {
                console.log("onSnapshot triggered but auth not ready. Skipping update.");
                return;
            }
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Client-side filtering by selectedSeason for display
            const filteredBySeason = fetchedTransactions.filter(t => 
                selectedSeason === 0 || t.season === selectedSeason
            );
            setTransactions(filteredBySeason);

            // Calculate transaction pot for the selected season (using filtered transactions)
            const currentSeasonTransactionPot = filteredBySeason
                .filter(t => 
                    (t.category === 'waiver_fa_fee' || t.category === 'trade_fee') 
                )
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            setTransactionPot(currentSeasonTransactionPot);

            setLoading(false);
            setSelectedTransactionIds([]); // Clear selections on new data fetch
            console.log(`Fetched and filtered transactions for season ${selectedSeason}:`, filteredBySeason.length);
        }, (firestoreError) => {
            console.error("Error fetching transactions from Firestore:", firestoreError);
            setError(`Failed to load financial data: ${firestoreError.message}. Please check your internet connection or Firestore security rules.`);
            setLoading(false);
        });

        return () => {
            console.log("Unsubscribing from Firestore listener (transactions).");
            unsubscribe();
        };
    }, [db, isAuthReady, selectedSeason]);


    // Fetch and listen for updates to the Fee/Payout structure
    useEffect(() => {
        // Fetch structure for ANY authenticated user (anonymous or otherwise)
        if (!db || !isAuthReady) { 
            console.log("Firestore not ready or Auth not ready. Skipping structure fetch.");
            setLoadingStructure(false);
            setDebitStructureData(defaultDebitStructure);
            setCreditStructureData(defaultCreditStructure);
            return;
        }

        setLoadingStructure(true);
        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        const structureDocRef = doc(db, `/artifacts/${appId}/public/data/league_structure/current_structure`);

        const unsubscribe = onSnapshot(structureDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDebitStructureData(data.fees || defaultDebitStructure);
                setCreditStructureData(data.payouts || defaultCreditStructure);
                console.log("Fetched league structure from Firestore.");
            } else {
                setDebitStructureData(defaultDebitStructure);
                setCreditStructureData(defaultCreditStructure);
                console.log("League structure document not found, using defaults.");
            }
            setLoadingStructure(false);
        }, (firestoreError) => {
            console.error("Error fetching league structure:", firestoreError);
            setError(`Failed to load league structure: ${firestoreError.message}`);
            setLoadingStructure(false);
            setDebitStructureData(defaultDebitStructure);
            setCreditStructureData(defaultCreditStructure);
        });

        return () => {
            console.log("Unsubscribing from Firestore listener (structure).");
            unsubscribe();
        };
    }, [db, isAuthReady]);


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
                        date: serverTimestamp(),
                        userId: userId,
                        category: category,
                        season: selectedSeason, // Use selectedSeason for new transactions
                        weekNumber: currentWeekForSelectedSeason, // Assign current week for selected season
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
                    date: serverTimestamp(),
                    userId: userId,
                    category: category,
                    season: selectedSeason, 
                    weekNumber: currentWeekForSelectedSeason,
                    numTrades: numTrades, // Store number of trades
                    teamsInvolvedCount: 1,
                });
            }
        } else if (type === 'debit' && category === 'waiver_fa_fee') {
            if (waiverEntries.length === 0 || waiverEntries.some(entry => !entry.team || entry.numPickups <= 0)) {
                setError("Please add at least one valid waiver/FA entry with a team and positive number of pickups.");
                return;
            }
            const perPickupCost = parseFloat(amount); // Amount field is now per-pickup cost

            for (const entry of waiverEntries) {
                if (entry.team && entry.numPickups > 0) {
                    transactionsToAdd.push({
                        amount: perPickupCost * entry.numPickups,
                        description: `Waiver/FA Fee: ${entry.team} - ${entry.numPickups} pickup(s)`,
                        type: type,
                        teamName: entry.team,
                        date: serverTimestamp(),
                        userId: userId,
                        category: category,
                        season: selectedSeason, // Use selectedSeason for new transactions
                        weekNumber: currentWeekForSelectedSeason, // Assign current week for selected season
                        numPickups: entry.numPickups, // Store number of pickups
                    });
                }
            }
            if (transactionsToAdd.length === 0) {
                setError("No valid waiver/FA entries to add.");
                return;
            }

        } else { // Handle other single team/all teams transactions
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
                type: type, // 'debit' or 'credit'
                teamName: finalTeamName, 
                date: serverTimestamp(),
                userId: userId,
                category: category, 
                season: selectedSeason, // Use selectedSeason for new transactions
                weekNumber: currentWeekForSelectedSeason, // Assign current week for selected season by default
                teamsInvolvedCount: teamsInvolved,
            });

            if (type === 'credit') {
                if (category === 'weekly_1st_points' || category === 'weekly_2nd_points') {
                    if (!weeklyPointsWeek || isNaN(parseInt(weeklyPointsWeek))) {
                        setError("Please enter a valid week number for weekly points payouts.");
                        return;
                    }
                    const weekNum = parseInt(weeklyPointsWeek);
                    transactionsToAdd[0].weekNumber = weekNum; // Override currentWeek for specific weekly payouts

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
            
            // Reset form fields after successful submission
            setAmount('');
            setDescription('');
            setType('debit'); 
            setCategory(getCategoriesForType('debit')[0].value); // Reset to first debit category
            setTeamName(''); 
            setTradeTeams(['', '']); 
            setWaiverEntries([{ team: '', numPickups: 1 }]); // Reset waiver entries
            setWeeklyPointsWeek(''); 
            setSidePotName(''); 
            setNumTrades(1); // Reset numTrades
            setTradeEntryMethod('multi_team'); // Reset trade entry method
            setError(null); 
            setAutoPopulateWarning(null); 
            console.log("Transaction(s) added to Firestore successfully.");
        } catch (addError) {
            console.error("Error adding transaction:", addError);
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
            console.log("Transaction deleted successfully.");
            setTransactionToDelete(null); 
            setSelectedTransactionIds([]); // Clear selections after single delete
        } catch (deleteError) {
            console.error("Error deleting transaction:", deleteError);
            setError(`Failed to delete transaction: ${deleteError.message}. Please check your permissions.`);
        }
    };

    const cancelDelete = () => {
        setShowConfirmDelete(false);
        setTransactionToDelete(null);
    };

    // New functions for bulk waiver entries
    const handleAddWaiverEntry = () => {
        setWaiverEntries([...waiverEntries, { team: '', numPickups: 1 }]);
    };

    const handleRemoveWaiverEntry = (indexToRemove) => {
        setWaiverEntries(waiverEntries.filter((_, index) => index !== indexToRemove));
    };

    const handleWaiverEntryChange = (index, field, value) => {
        const newWaiverEntries = [...waiverEntries];
        if (field === 'numPickups') {
            newWaiverEntries[index][field] = parseInt(value) || 0; // Ensure number
        } else {
            newWaiverEntries[index][field] = value;
        }
        setWaiverEntries(newWaiverEntries);
    };

    const isTeamSelectionDisabled = isTeamAutoPopulated || (type === 'debit' && (category === 'waiver_fa_fee'));
    // Team selection for single-team trade fee is managed by its own conditional rendering.

    // Filter transactions for history table and pagination
    const filteredTransactions = transactions.filter(t => {
        // `transactions` state already holds data for the selectedSeason from Firestore fetch
        // Just filter by team if selected.
        if (filterTeam === '') {
            return true; 
        } else if (filterTeam === 'All Teams') {
            return t.teamName === 'All Teams';
        } else {
            return (t.teamName === filterTeam || (t.teamName === 'All Teams' && t.type === 'debit'));
        }
    });

    // Multi-select delete logic
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
            // If all are selected, deselect all
            setSelectedTransactionIds([]);
        } else {
            // Select all currently displayed transactions
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
            setSelectedTransactionIds([]); // Clear selection after successful deletion
            console.log(`${selectedTransactionIds.length} transactions deleted successfully.`);
        } catch (bulkDeleteError) {
            console.error("Error deleting selected transactions:", bulkDeleteError);
            setError(`Failed to delete selected transactions: ${bulkDeleteError.message}.`);
        }
    };

    const cancelBulkDelete = () => {
        setShowConfirmBulkDelete(false);
    };

    // Calculate OVERALL totals for Fees and Payouts (for summary cards) using *transactions for selected season*
    const overallDebits = transactions 
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const overallCredits = transactions 
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const overallNetBalance = overallDebits - overallCredits; 

    // Calculate team summary data
    const teamSummary = {};
    uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').forEach(team => {
        teamSummary[team] = {
            totalDebits: 0, // Internal name
            totalCredits: 0, // Internal name
            netBalance: 0, // This will be Payouts - Fees for team summary
            totalDebitsLessEntryFee: 0, 
            winningsExtraFees: 0, 
        };
    });

    // Populate team summary data based on transactions (already filtered by selectedSeason)
    transactions.forEach(t => { 
        if (t.teamName === 'All Teams' && t.type === 'debit' && t.teamsInvolvedCount > 0) {
            const perTeamAmount = t.amount / t.teamsInvolvedCount;
            uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').forEach(team => {
                if (teamSummary[team]) { 
                    teamSummary[team].totalDebits += perTeamAmount;
                    // FIX: Ensure 'entry_fee' category is correctly excluded
                    if (t.category !== 'entry_fee') { 
                        teamSummary[team].totalDebitsLessEntryFee += perTeamAmount;
                    }
                }
            });
        } else if (teamSummary[t.teamName]) { 
            if (t.type === 'debit') {
                teamSummary[t.teamName].totalDebits += (t.amount || 0);
                // FIX: Ensure 'entry_fee' category is correctly excluded
                if (t.category !== 'entry_fee') { 
                    teamSummary[t.teamName].totalDebitsLessEntryFee += (t.amount || 0);
                }
            } else if (t.type === 'credit') {
                teamSummary[t.teamName].totalCredits += (t.amount || 0);
            }
        }
    });

    Object.keys(teamSummary).forEach(team => {
        // Net balance for team summary is Payouts - Fees
        teamSummary[team].netBalance = teamSummary[team].totalCredits - teamSummary[team].totalDebits;
        // Calculate Winnings/(Extra Fees) as Payouts - Fees (excluding entry fee)
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

    // Functions for editing Fee/Payout structure
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
        if (!db || !isCommish) {
            setError("Cannot save structure: Not authenticated as commish or database not ready.");
            return;
        }
        setLoadingStructure(true);
        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const structureDocRef = doc(db, `/artifacts/${appId}/public/data/league_structure/current_structure`);
            await setDoc(structureDocRef, {
                fees: debitStructureData, // Firebase key unchanged
                payouts: creditStructureData, // Firebase key unchanged
                lastUpdated: serverTimestamp()
            });
            setIsEditingStructure(false);
            setError(null);
            console.log("League structure saved to Firestore.");
        } catch (saveError) {
            console.error("Error saving league structure:", saveError);
            setError(`Failed to save league structure: ${saveError.message}`);
        } finally {
            setLoadingStructure(false);
        }
    };

    const handleCancelEditStructure = () => {
        setIsEditingStructure(false);
        setError(null); 
    };

    // Pagination logic
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

    return (
        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4 mx-auto">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 text-center">
                League Financial Tracker
            </h2>

            <div className="mb-4 text-center text-sm text-gray-600 p-2 bg-blue-50 rounded">
                {COMMISH_UID && isCommish && (
                    <span className="font-semibold mt-1">
                        You are logged in as the Commish.
                    </span>
                )}
                
                {isAuthReady && ( 
                    <div className="mt-4">
                        {isCommish ? ( // If commish is logged in
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors"
                            >
                                Logout (Commish)
                            </button>
                        ) : ( // If not commish or not logged in
                            <>
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
                                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-full max-w-xs"
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
                            </>
                        )}
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
                                    setCurrentPage(1); // Reset pagination on season change
                                    setFilterTeam(''); // Also reset team filter
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
                            <p className="text-2xl font-bold text-red-900">${overallDebits.toFixed(2)}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg shadow-sm text-center">
                            <h3 className="text-lg font-semibold text-green-700">Total Payouts</h3>
                            <p className="text-2xl font-bold text-green-900">${overallCredits.toFixed(2)}</p>
                        </div>
                        <div className={`p-4 rounded-lg shadow-sm text-center ${overallNetBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                            <h3 className="text-lg font-semibold text-blue-700">League Bank</h3>
                            <p className={`text-2xl font-bold ${overallNetBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>${overallNetBalance.toFixed(2)}</p>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg shadow-sm text-center">
                            <h3 className="text-lg font-semibold text-yellow-700">Transaction Pot</h3>
                            <p className="text-2xl font-bold text-yellow-900">${transactionPot.toFixed(2)}</p>
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
                                {/* Dynamic Category Selection (now above description) */}
                                <div className="flex-1">
                                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        id="category"
                                        value={category}
                                        onChange={(e) => {
                                            setCategory(e.target.value);
                                            setWeeklyPointsWeek(''); 
                                            setSidePotName('');
                                            setTeamName(''); // Reset team name on category change
                                            setTradeTeams(['', '']); 
                                            setWaiverEntries([{ team: '', numPickups: 1 }]); 
                                            setDescription(''); 
                                            setNumTrades(1); // Reset numTrades
                                            setTradeEntryMethod('multi_team'); // Reset trade entry method
                                        }}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    >
                                        {getCategoriesForType(type).map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Description field (conditionally rendered for waiver/FA and single-team trade) */}
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
                                    // Trade Fee Entry Method Selection
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
                                            // Multiple team selectors for trade fees (existing logic)
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
                                            // Single team trade entry
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
                                    // Multiple entries for waiver/FA fees
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
                                    // Single team selector for other transaction types
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
                        <p className="text-center text-gray-600 p-4 bg-gray-100 rounded-lg shadow-inner mb-8">
                            Only the league commissioner can add and remove transactions. Please log in with the commish account.
                        </p>
                    )}

                    {/* Transaction History Table */}
                    <section>
                        <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Transaction History</h3>
                        {/* Team Filter Dropdown */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="w-1/2"> {/* Adjusted width for filter */}
                                <label htmlFor="filterTeam" className="block text-sm font-medium text-gray-700 mb-1">Filter by Team:</label>
                                <select
                                    id="filterTeam"
                                    value={filterTeam}
                                    onChange={(e) => {
                                        setFilterTeam(e.target.value);
                                        setCurrentPage(1); // Reset to first page on filter change
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
                                                            ${displayAmount}
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
                                                        {t.category === 'waiver_fa_fee' ? 'Waiver/FA Fee' : (t.category ? t.category.replace(/_/g, ' ') : 'General')}
                                                    </td> 
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                        {t.weekNumber === 0 ? 'Pre' : (t.weekNumber || '-')} 
                                                    </td>
                                                    {isCommish && ( 
                                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                            <button
                                                                onClick={() => confirmDelete(t)}
                                                                className="text-red-500 hover:text-red-700"
                                                                title="Delete transaction"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center mt-4 space-x-2">
                                <button
                                    onClick={handlePreviousPage}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => paginate(page)}
                                        className={`px-3 py-1 rounded-md ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Team Summary Table */}
                    <section className="mt-8">
                        <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Team Financial Summary (for {selectedSeason || 'selected'} season)</h3>
                        {Object.keys(teamSummary).length === 0 ? (
                            <p className="text-center text-gray-600">No team financial data available for this season.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <thead className="bg-blue-100">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team Name</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Fees</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Payouts</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Net Balance (Payouts - Fees)</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Winnings/(Extra Fees)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(teamSummary).sort(([,a], [,b]) => b.netBalance - a.netBalance).map(([team, data], index) => (
                                            <tr key={team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="py-2 px-4 text-sm font-medium text-gray-800 border-b border-gray-200">{team}</td>
                                                <td className="py-2 px-4 text-sm text-right text-red-700 border-b border-gray-200">${data.totalDebits.toFixed(2)}</td>
                                                <td className="py-2 px-4 text-sm text-right text-green-700 border-b border-gray-200">${data.totalCredits.toFixed(2)}</td>
                                                <td className={`py-2 px-4 text-sm text-right border-b border-gray-200 ${data.netBalance >= 0 ? 'text-green-800' : 'text-red-800'} font-bold`}>
                                                    ${data.netBalance.toFixed(2)}
                                                </td>
                                                <td className={`py-2 px-4 text-sm text-right border-b border-gray-200 ${data.winningsExtraFees >= 0 ? 'text-green-800' : 'text-red-800'} font-bold`}>
                                                    ${data.winningsExtraFees.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                    
                    {/* Fee/Payout Structure Management (Commish only) */}
                    {isCommish && (
                        <section className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                            <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Manage League Structure (Fees & Payouts)</h3>
                            {loadingStructure ? (
                                <p className="text-center text-blue-600">Loading structure data...</p>
                            ) : (
                                <>
                                    {!isEditingStructure ? (
                                        <button
                                            onClick={() => setIsEditingStructure(true)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mb-4"
                                        >
                                            Edit Structure
                                        </button>
                                    ) : (
                                        <div>
                                            {/* Fees (Debits) */}
                                            <h4 className="text-xl font-semibold text-gray-700 mb-3">Fees (Debits)</h4>
                                            <div className="space-y-4 mb-6">
                                                {debitStructureData.map((item, index) => (
                                                    <div key={index} className="flex flex-col md:flex-row gap-3 items-center p-3 border border-gray-200 rounded-md bg-white shadow-sm">
                                                        <input
                                                            type="text"
                                                            value={item.name}
                                                            onChange={(e) => handleDebitStructureChange(index, 'name', e.target.value)}
                                                            placeholder="Fee Name"
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={item.amount}
                                                            onChange={(e) => handleDebitStructureChange(index, 'amount', e.target.value)}
                                                            placeholder="Amount (e.g., $50, $1/pickup)"
                                                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={(e) => handleDebitStructureChange(index, 'description', e.target.value)}
                                                            placeholder="Description"
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDebitItem(index)}
                                                            className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500 transition-colors text-sm"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={handleAddDebitItem}
                                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                                                >
                                                    Add New Fee Item
                                                </button>
                                            </div>

                                            {/* Payouts (Credits) */}
                                            <h4 className="text-xl font-semibold text-gray-700 mb-3">Payouts (Credits)</h4>
                                            <div className="space-y-4 mb-6">
                                                {creditStructureData.map((item, index) => (
                                                    <div key={index} className="flex flex-col md:flex-row gap-3 items-center p-3 border border-gray-200 rounded-md bg-white shadow-sm">
                                                        <input
                                                            type="text"
                                                            value={item.name}
                                                            onChange={(e) => handleCreditStructureChange(index, 'name', e.target.value)}
                                                            placeholder="Payout Name"
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={item.amount}
                                                            onChange={(e) => handleCreditStructureChange(index, 'amount', e.target.value)}
                                                            placeholder="Amount (e.g., $100)"
                                                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={(e) => handleCreditStructureChange(index, 'description', e.target.value)}
                                                            placeholder="Description"
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCreditItem(index)}
                                                            className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500 transition-colors text-sm"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={handleAddCreditItem}
                                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                                                >
                                                    Add New Payout Item
                                                </button>
                                            </div>

                                            <div className="flex justify-end space-x-4">
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEditStructure}
                                                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveStructure}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                                                >
                                                    Save Structure
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    )}
                </>
            )}

            {/* Confirmation Modal for Single Delete */}
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

            {/* Confirmation Modal for Bulk Delete */}
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

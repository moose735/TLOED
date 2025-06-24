import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut,
    signInAnonymously 
} from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

const CHART_COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00c49f', '#ff0000',
    '#0088fe', '#bb3f85', '#7a421a', '#4a4a4a', '#a5d6a7', '#ef9a9a'
];

const FinancialTracker = ({ getDisplayTeamName, historicalMatchups }) => {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('fee'); // 'fee' or 'payout'
    const [category, setCategory] = useState('general_fee'); 
    const [weeklyPointsWeek, setWeeklyPointsWeek] = useState('');
    const [sidePotName, setSidePotName] = useState('');

    const [teamName, setTeamName] = useState(''); // For single team transactions
    const [tradeTeams, setTradeTeams] = useState(['', '']); // For trade fees, initially two empty selections
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); 
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [uniqueTeams, setUniqueTeams] = useState([]);
    const [weeklyHighScores, setWeeklyHighScores] = useState({});
    const [currentSeason, setCurrentSeason] = useState(0); // Initialize with 0 or null
    const [activeTeamsCount, setActiveTeamsCount] = useState(0); 
    
    const [isTeamAutoPopulated, setIsTeamAutoPopulated] = useState(false);
    const [autoPopulateWarning, setAutoPopulateWarning] = useState(null); 
    
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(null);

    const [filterTeam, setFilterTeam] = useState(''); 

    const COMMISH_UID = process.env.REACT_APP_COMMISH_UID;
    const isCommish = userId && COMMISH_UID && userId === COMMISH_UID; 

    // Define categories based on type
    const getCategoriesForType = (currentType) => {
        if (currentType === 'fee') {
            return [
                { value: 'general_fee', label: 'General Fee' },
                { value: 'annual_fee', label: 'Annual League Fee' },
                { value: 'trade_fee', label: 'Trade Fee' },
                { value: 'waiver_pickup_fee', label: 'Waiver Pickup Fee' },
            ];
        } else if (currentType === 'payout') {
            return [
                { value: 'general_payout', label: 'General Payout' },
                { value: 'highest_weekly_points', label: 'Highest Weekly Points' },
                { value: 'second_highest_weekly_points', label: 'Second Highest Weekly Points' },
                { value: 'side_pot', label: 'Side Pot' },
            ];
        }
        return [];
    };

    // Effect to update category when type changes
    useEffect(() => {
        const categories = getCategoriesForType(type);
        if (categories.length > 0) {
            if (!categories.some(cat => cat.value === category)) {
                setCategory(categories[0].value);
            }
        } else {
            setCategory('');
        }
        // When type changes, reset tradeTeams as it's specific to trade fees
        if (type !== 'fee' || category !== 'trade_fee') {
            setTradeTeams(['', '']);
        }
    }, [type, category]); 


    // Derive unique teams and calculate weekly high scores from historicalMatchups
    useEffect(() => {
        if (historicalMatchups && Array.isArray(historicalMatchups)) {
            let maxSeason = 0;
            historicalMatchups.forEach(match => {
                if (match.year && typeof match.year === 'number') {
                    if (match.year > maxSeason) {
                        maxSeason = match.year;
                    }
                }
            });
            setCurrentSeason(maxSeason > 0 ? maxSeason : 0); // Use 0 for no season found
            console.log("Determined Current Season:", maxSeason);

            if (maxSeason === 0) {
                setError("No historical matchup data with a valid 'year' property found to determine the current season. Showing all transactions.");
                return; 
            }

            const teamsSet = new Set();
            const weeklyScores = {}; 

            historicalMatchups.forEach(match => {
                if (match.year === maxSeason) { 
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
            console.log("Calculated Weekly High Scores (Current Season Only):", calculatedHighScores);


            const sortedTeams = Array.from(teamsSet).sort();
            setUniqueTeams(['ALL_TEAMS_MULTIPLIER', ...sortedTeams]); 
            setActiveTeamsCount(sortedTeams.length); 
            
        }
    }, [historicalMatchups, getDisplayTeamName]);

    // Effect to automatically set teamName and description when category and weeklyPointsWeek change
    useEffect(() => {
        setAutoPopulateWarning(null); 
        setIsTeamAutoPopulated(false); 

        // Reset tradeTeams if not a trade fee category
        if (!(type === 'fee' && category === 'trade_fee')) {
            setTradeTeams(['', '']); 
        }

        if (type === 'payout' && 
            (category === 'highest_weekly_points' || category === 'second_highest_weekly_points') &&
            weeklyPointsWeek) 
        {
            const weekNum = parseInt(weeklyPointsWeek);
            const weekData = weeklyHighScores[weekNum];

            if (weekData) {
                if (category === 'highest_weekly_points' && weekData.highest) {
                    setTeamName(weekData.highest.team);
                    setDescription(`Payout: Highest Weekly Points (Week ${weeklyPointsWeek}) - ${weekData.highest.team} (${weekData.highest.score} pts)`);
                    setIsTeamAutoPopulated(true);
                } else if (category === 'second_highest_weekly_points' && weekData.secondHighest) {
                    setTeamName(weekData.secondHighest.team);
                    setDescription(`Payout: Second Highest Weekly Points (Week ${weeklyPointsWeek}) - ${weekData.secondHighest.team} (${weekData.secondHighest.score} pts)`);
                    setIsTeamAutoPopulated(true);
                } else {
                    setAutoPopulateWarning(`No ${category.replace(/_/g, ' ')} winner found for Week ${weeklyPointsWeek} in the current season.`);
                }
            } else {
                setAutoPopulateWarning(`No score data found for Week ${weeklyPointsWeek} in the current season.`);
            }
        } else if (type === 'payout' && category === 'side_pot') {
            setTeamName(''); 
            setDescription(`Payout: Side Pot`);
        } else if (type === 'fee' && (category === 'trade_fee' || category === 'waiver_pickup_fee')) {
            setTeamName(''); 
            setDescription('');
        } else {
            setTeamName('');
            setDescription('');
        }
    }, [category, weeklyPointsWeek, weeklyHighScores, type]); 


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
                    console.log("No user signed in. Attempting anonymous sign-in to allow read access.");
                    try {
                        await signInAnonymously(firebaseAuth);
                        setUserId(firebaseAuth.currentUser?.uid); 
                        console.log("Signed in anonymously. User ID:", firebaseAuth.currentUser?.uid);
                    } catch (anonSignInError) {
                        console.error("Error during anonymous sign-in:", anonSignInError);
                        setError(`Failed to sign in anonymously: ${anonSignInError.message}. Read access may be affected.`);
                        setUserId(null); 
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
        } catch (error) {
            console.error("Logout Error:", error);
            setLoginError(`Logout failed: ${error.message}`);
        }
    };

    useEffect(() => {
        if (!db || !isAuthReady) {
            console.log("Firestore not ready or Auth not ready. Waiting for db and isAuthReady...");
            return;
        }

        setLoading(true);
        setError(null);

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        const transactionCollectionPath = `/artifacts/${appId}/public/data/financial_transactions`;
        
        const q = query(collection(db, transactionCollectionPath), orderBy('date', 'desc'));

        console.log("Attempting to listen to Firestore collection:", transactionCollectionPath);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isAuthReady) {
                console.log("onSnapshot triggered but auth not ready. Skipping update.");
                return;
            }
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTransactions(fetchedTransactions);
            setLoading(false);
            console.log("Fetched transactions:", fetchedTransactions.length);
        }, (firestoreError) => {
            console.error("Error fetching transactions from Firestore:", firestoreError);
            setError(`Failed to load financial data: ${firestoreError.message}. Please check your internet connection or Firestore security rules.`);
            setLoading(false);
        });

        return () => {
            console.log("Unsubscribing from Firestore listener.");
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
        if (!description.trim()) {
            setError("Description cannot be empty.");
            return;
        }
        
        let transactionsToAdd = [];

        if (type === 'fee' && category === 'trade_fee') {
            // Validate trade teams
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
                    amount: parseFloat(amount), // Amount is per team for trades
                    description: description.trim(),
                    type: type,
                    teamName: team,
                    date: serverTimestamp(),
                    userId: userId,
                    category: category,
                    season: currentSeason,
                    teamsInvolvedCount: 1 // Each is an individual transaction for a single team
                });
            }
        } else {
            // Handle single team or "All Teams" transactions
            if (!teamName.trim() && teamName !== 'ALL_TEAMS_MULTIPLIER') { 
                setError("Please select an Associated Team.");
                return;
            }

            let finalAmount = parseFloat(amount);
            let finalTeamName = teamName; 
            let teamsInvolved = 1; 

            if (type === 'fee' && teamName === 'ALL_TEAMS_MULTIPLIER') {
                if (activeTeamsCount === 0) {
                    setError("Cannot process 'All Teams' transaction: No active teams found in the current season.");
                    return;
                }
                finalAmount = finalAmount * activeTeamsCount;
                finalTeamName = 'All Teams'; 
                teamsInvolved = activeTeamsCount; 
            } else if (type === 'payout' && teamName === 'ALL_TEAMS_MULTIPLIER') {
                finalTeamName = 'All Teams';
                // No explicit error, but a warning if user misinterprets 'All Teams' for payout
            }

            transactionsToAdd.push({
                amount: finalAmount,
                description: description.trim(),
                type: type,
                teamName: finalTeamName, 
                date: serverTimestamp(),
                userId: userId,
                category: category, 
                season: currentSeason,
                teamsInvolvedCount: teamsInvolved 
            });

            if (type === 'payout') {
                if (category === 'highest_weekly_points' || category === 'second_highest_weekly_points') {
                    if (!weeklyPointsWeek || isNaN(parseInt(weeklyPointsWeek))) {
                        setError("Please enter a valid week number for weekly points payouts.");
                        return;
                    }
                    const weekNum = parseInt(weeklyPointsWeek);
                    transactionsToAdd[0].weekNumber = weekNum; 

                    const weekData = weeklyHighScores[weekNum];
                    if (weekData) {
                        if (category === 'highest_weekly_points' && weekData.highest) {
                            transactionsToAdd[0].teamName = weekData.highest.team;
                            transactionsToAdd[0].description = `Payout: Highest Weekly Points (Week ${weekNum}) - ${weekData.highest.team} (${weekData.highest.score} pts)`;
                        } else if (category === 'second_highest_weekly_points' && weekData.secondHighest) {
                            transactionsToAdd[0].teamName = weekData.secondHighest.team;
                            transactionsToAdd[0].description = `Payout: Second Highest Weekly Points (Week ${weekNum}) - ${weekData.secondHighest.team} (${weekData.secondHighest.score} pts)`;
                        } else {
                            setError(`Could not find a winning team for ${category.replace(/_/g, ' ')} in Week ${weekNum} for the current season. Transaction not added.`);
                            return; 
                        }
                    } else {
                        setError(`No score data found for Week ${weekNum} in the current season. Transaction not added.`);
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
            setType('fee'); 
            setCategory('general_fee'); 
            setTeamName(''); 
            setTradeTeams(['', '']); 
            setWeeklyPointsWeek(''); 
            setSidePotName(''); 
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
        } catch (deleteError) {
            console.error("Error deleting transaction:", deleteError);
            setError(`Failed to delete transaction: ${deleteError.message}. Please check your permissions.`);
        }
    };

    const cancelDelete = () => {
        setShowConfirmDelete(false);
        setTransactionToDelete(null);
    };

    const isTeamSelectionDisabled = isTeamAutoPopulated || (type === 'fee' && category === 'trade_fee');

    const filteredTransactions = transactions.filter(t => {
        const isCurrentSeason = (currentSeason === 0 || t.season === currentSeason);

        if (filterTeam === '') {
            return isCurrentSeason; 
        } else if (filterTeam === 'All Teams') {
            return isCurrentSeason && t.teamName === 'All Teams';
        } else {
            return isCurrentSeason && (t.teamName === filterTeam || (t.teamName === 'All Teams' && t.type === 'fee'));
        }
    });

    const totalFees = filteredTransactions
        .filter(t => t.type === 'fee')
        .reduce((sum, t) => {
            if (filterTeam !== '' && filterTeam !== 'All Teams' && t.teamName === 'All Teams' && t.teamsInvolvedCount > 0) {
                return sum + (t.amount / t.teamsInvolvedCount || 0);
            }
            return sum + (t.amount || 0);
        }, 0);

    const totalPayouts = filteredTransactions
        .filter(t => t.type === 'payout')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netBalance = totalFees - totalPayouts;

    // Calculate team summary data
    const teamSummary = {};
    uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').forEach(team => {
        teamSummary[team] = {
            totalFees: 0,
            totalPayouts: 0,
            netBalance: 0
        };
    });

    transactions.filter(t => currentSeason === 0 || t.season === currentSeason).forEach(t => { 
        if (t.teamName === 'All Teams' && t.type === 'fee' && t.teamsInvolvedCount > 0) {
            const perTeamAmount = t.amount / t.teamsInvolvedCount;
            uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').forEach(team => {
                if (teamSummary[team]) { 
                    teamSummary[team].totalFees += perTeamAmount;
                }
            });
        } else if (teamSummary[t.teamName]) { 
            if (t.type === 'fee') {
                teamSummary[t.teamName].totalFees += (t.amount || 0);
            } else if (t.type === 'payout') {
                teamSummary[t.teamName].totalPayouts += (t.amount || 0);
            }
        }
    });

    Object.keys(teamSummary).forEach(team => {
        teamSummary[team].netBalance = teamSummary[team].totalFees - teamSummary[team].totalPayouts;
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

    return (
        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4 mx-auto">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 text-center">
                League Financial Tracker
            </h2>

            <div className="mb-4 text-center text-sm text-gray-600 p-2 bg-blue-50 rounded">
                Your User ID: <span className="font-mono text-blue-700 break-all">{userId || "Not logged in"}</span><br/>
                {COMMISH_UID ? (
                    <span className="font-semibold mt-1">
                        {isCommish ? "You are logged in as the Commish." : "You are not the Commish."}
                    </span>
                ) : (
                    <span className="text-red-600 mt-1">
                        REACT_APP_COMMISH_UID not set in Vercel. Commish access not configured.
                    </span>
                )}
                
                {isAuthReady && ( 
                    <div className="mt-4">
                        {userId && !isCommish ? ( 
                             <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors"
                            >
                                Logout (Currently Viewing Only)
                            </button>
                        ) : (userId && isCommish ? ( 
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors"
                            >
                            Logout (Commish)
                            </button>
                        ) : ( 
                            <form onSubmit={handleLogin} className="flex flex-col items-center space-y-2">
                                <p className="text-gray-700 font-semibold mb-2">Commish Login</p>
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
                                    Login
                                </button>
                                {loginError && <p className="text-red-500 text-sm mt-2">{loginError}</p>}
                            </form>
                        ))}
                    </div>
                )}
            </div>

            {currentSeason !== 0 && ( // Conditionally render if currentSeason is determined
                <div className="text-center text-sm text-blue-700 font-semibold mb-4">
                    Displaying Data for: Season {currentSeason}
                </div>
            )}
            {currentSeason === 0 && !loading && ( // Show error if currentSeason is 0 and not loading
                 <div className="text-center text-orange-600 text-sm font-semibold mb-4">
                    Could not determine current season from historical data. Showing all available transactions.
                 </div>
            )}


            {loading && <p className="text-center text-blue-600 font-semibold">Loading financial data...</p>}
            {error && <p className="text-center text-red-600 font-semibold mb-4">{error}</p>}

            {!loading && !error && (
                <>
                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {/* Total Fees Collected - Now Red */}
                        <div className="bg-red-50 p-4 rounded-lg shadow-sm text-center">
                            <h3 className="text-lg font-semibold text-red-700">Total Fees Collected</h3>
                            <p className="text-2xl font-bold text-red-900">${totalFees.toFixed(2)}</p>
                        </div>
                        {/* Total Payouts Made - Now Green */}
                        <div className="bg-green-50 p-4 rounded-lg shadow-sm text-center">
                            <h3 className="text-lg font-semibold text-green-700">Total Payouts Made</h3>
                            <p className="text-2xl font-bold text-green-900">${totalPayouts.toFixed(2)}</p>
                        </div>
                        <div className={`p-4 rounded-lg shadow-sm text-center ${netBalance >= 0 ? 'bg-blue-50' : 'bg-red-100'}`}>
                            <h3 className="text-lg font-semibold text-blue-700">Net Balance</h3>
                            <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-900' : 'text-red-900'}`}>${netBalance.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Add New Transaction Form (Conditionally rendered) */}
                    {isCommish ? (
                        <section className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                            <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Add New Transaction</h3>
                            <form onSubmit={handleAddTransaction} className="space-y-4">
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                        <input
                                            type="number"
                                            id="amount"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="e.g., 50.00"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                        <select
                                            id="type"
                                            value={type}
                                            onChange={(e) => setType(e.target.value)}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        >
                                            <option value="fee">Fee (Money In)</option>
                                            <option value="payout">Payout (Money Out)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="e.g., Annual League Fee, Playoff Winner Bonus"
                                        maxLength="100"
                                        required
                                        readOnly={isTeamAutoPopulated} 
                                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isTeamAutoPopulated ? 'bg-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                                    />
                                </div>

                                {/* Dynamic Category Selection */}
                                <div className="flex-1">
                                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        id="category"
                                        value={category}
                                        onChange={(e) => {
                                            setCategory(e.target.value);
                                            setWeeklyPointsWeek(''); 
                                            setSidePotName('');
                                        }}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    >
                                        {getCategoriesForType(type).map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                

                                {(category === 'highest_weekly_points' || category === 'second_highest_weekly_points') && (
                                    <div>
                                        <label htmlFor="weeklyPointsWeek" className="block text-sm font-medium text-gray-700 mb-1">Week Number</label>
                                        <input
                                            type="number"
                                            id="weeklyPointsWeek"
                                            value={weeklyPointsWeek}
                                            onChange={(e) => setWeeklyPointsWeek(e.target.value)}
                                            placeholder="e.g., 1, 5, 14"
                                            min="1"
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
                                
                                {type === 'fee' && category === 'trade_fee' ? (
                                    // Multiple team selectors for trade fees
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
                                                {tradeTeams.length > 2 && ( // Allow removing if more than 2 teams
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
                                            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isTeamSelectionDisabled ? 'bg-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                                        >
                                            <option value="">Select Team</option> 
                                            {type === 'fee' && ( 
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
                        <div className="mb-4 text-right">
                            <label htmlFor="filterTeam" className="block text-sm font-medium text-gray-700 mb-1">Filter by Team:</label>
                            <select
                                id="filterTeam"
                                value={filterTeam}
                                onChange={(e) => setFilterTeam(e.target.value)}
                                className="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                                <option value="">Show All Teams</option>
                                {uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').map(team => (
                                    <option key={team} value={team}>{team}</option>
                                ))}
                                <option value="All Teams">Transactions for 'All Teams'</option> 
                            </select>
                        </div>
                        {filteredTransactions.length === 0 ? (
                            <p className="text-center text-gray-600">No transactions recorded yet{filterTeam && ` for ${filterTeam}`}.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <thead className="bg-blue-100">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Date</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Description</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Amount</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Type</th>
                                            <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Category</th> 
                                            {isCommish && <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.map((t, index) => {
                                            let displayAmount = (t.amount || 0).toFixed(2);
                                            const effectiveTeamsCount = t.teamsInvolvedCount > 0 ? t.teamsInvolvedCount : activeTeamsCount;

                                            if (filterTeam !== '' && filterTeam !== 'All Teams' && t.teamName === 'All Teams' && t.type === 'fee' && effectiveTeamsCount > 0) {
                                                displayAmount = (t.amount / effectiveTeamsCount).toFixed(2);
                                            }
                                            return (
                                                <tr key={t.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                        {t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                        {/* Display description as is, remove redundant week display */}
                                                        {t.description}
                                                        {t.category === 'side_pot' && t.potName && ` (${t.potName})`}
                                                    </td>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{t.teamName || '-'}</td>
                                                    <td className="py-2 px-4 text-sm text-right border-b border-gray-200">
                                                        <span className={`${t.type === 'fee' ? 'text-red-700' : 'text-green-700'} font-medium`}>
                                                            ${displayAmount}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                            t.type === 'fee' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                                        }`}>
                                                            {t.type === 'fee' ? 'Fee' : 'Payout'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200 capitalize">
                                                        {t.category ? t.category.replace(/_/g, ' ') : 'General'}
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
                            </div>
                        )}
                    </section>

                    {/* Team Financial Summary Section */}
                    {Object.keys(teamSummary).length > 0 && (
                        <section className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                            <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Team Financial Summary (Current Season)</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <thead className="bg-blue-100">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team Name</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Fees Paid</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Payouts Received</th>
                                            <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Net Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(teamSummary).sort(([teamA], [teamB]) => teamA.localeCompare(teamB)).map(([team, data], index) => (
                                            <tr key={team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{team}</td>
                                                <td className="py-2 px-4 text-sm text-right text-red-700 font-medium border-b border-gray-200">${data.totalFees.toFixed(2)}</td>
                                                <td className="py-2 px-4 text-sm text-right text-green-700 font-medium border-b border-gray-200">${data.totalPayouts.toFixed(2)}</td>
                                                <td className={`py-2 px-4 text-sm text-right font-bold border-b border-gray-200 ${data.netBalance >= 0 ? 'text-blue-900' : 'text-red-900'}`}>
                                                    ${data.netBalance.toFixed(2)}
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
                        <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">League Fee & Payout Structure</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-xl font-semibold text-red-700 mb-3">Fees (Money In)</h4>
                                <ul className="list-disc list-inside space-y-1 text-gray-700">
                                    {getCategoriesForType('fee').map(cat => (
                                        <li key={cat.value}>{cat.label}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-xl font-semibold text-green-700 mb-3">Payouts (Money Out)</h4>
                                <ul className="list-disc list-inside space-y-1 text-gray-700">
                                    {getCategoriesForType('payout').map(cat => (
                                        <li key={cat.value}>{cat.label}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
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
                                onClick={cancelDelete}
                                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialTracker;

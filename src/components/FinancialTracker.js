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
    // New states for structured payouts
    const [payoutCategory, setPayoutCategory] = useState('general'); // e.g., 'general', 'highest_weekly_points', 'side_pot'
    const [weeklyPointsWeek, setWeeklyPointsWeek] = useState('');
    const [sidePotName, setSidePotName] = useState('');

    const [teamName, setTeamName] = useState(''); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [uniqueTeams, setUniqueTeams] = useState([]);
    const [weeklyHighScores, setWeeklyHighScores] = useState({});
    const [currentSeason, setCurrentSeason] = useState(null); 
    const [activeTeamsCount, setActiveTeamsCount] = useState(0); // New state for count of active teams
    
    // State to manage automatic population of teamName field
    const [isTeamAutoPopulated, setIsTeamAutoPopulated] = useState(false);
    
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(null);

    const [filterTeam, setFilterTeam] = useState(''); 

    const COMMISH_UID = process.env.REACT_APP_COMMISH_UID;
    const isCommish = userId && COMMISH_UID && userId === COMMISH_UID; 

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
            setCurrentSeason(maxSeason > 0 ? maxSeason : null);
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
            setActiveTeamsCount(sortedTeams.length); // Set the count of active teams
            
            if (sortedTeams.length > 0) {
                setTeamName(''); 
            }
        }
    }, [historicalMatchups, getDisplayTeamName]);

    // Effect to automatically set teamName and description when payoutCategory and weeklyPointsWeek change
    useEffect(() => {
        setError(null); // Clear errors related to previous auto-population attempts
        setIsTeamAutoPopulated(false); // Reset auto-population flag

        if (type === 'payout' && 
            (payoutCategory === 'highest_weekly_points' || payoutCategory === 'second_highest_weekly_points') &&
            weeklyPointsWeek) 
        {
            const weekNum = parseInt(weeklyPointsWeek);
            const weekData = weeklyHighScores[weekNum];

            if (weekData) {
                if (payoutCategory === 'highest_weekly_points' && weekData.highest) {
                    setTeamName(weekData.highest.team);
                    setDescription(`Payout: Highest Weekly Points (Week ${weeklyPointsWeek}) - ${weekData.highest.team} (${weekData.highest.score} pts)`);
                    setIsTeamAutoPopulated(true);
                } else if (payoutCategory === 'second_highest_weekly_points' && weekData.secondHighest) {
                    setTeamName(weekData.secondHighest.team);
                    setDescription(`Payout: Second Highest Weekly Points (Week ${weeklyPointsWeek}) - ${weekData.secondHighest.team} (${weekData.secondHighest.score} pts)`);
                    setIsTeamAutoPopulated(true);
                } else {
                    setTeamName('');
                    // Only set a specific error if data is explicitly missing for the selected category
                    if (payoutCategory === 'highest_weekly_points' && !weekData.highest) {
                        setError(`No Highest Weekly Points winner found for Week ${weeklyPointsWeek} in the current season.`);
                    } else if (payoutCategory === 'second_highest_weekly_points' && !weekData.secondHighest) {
                        setError(`No Second Highest Weekly Points winner found for Week ${weeklyPointsWeek} in the current season.`);
                    }
                    setDescription(''); // Clear description if automated team not found
                }
            } else {
                setTeamName('');
                setDescription('');
                setError(`No score data found for Week ${weeklyPointsWeek} in the current season. Please ensure data is available for this week.`);
            }
        } else if (type === 'payout' && payoutCategory === 'side_pot') {
            setTeamName(''); 
            setDescription(`Payout: Side Pot`);
            // Side pot team is manually selected, so not auto-populated
        } else {
            setTeamName('');
            setDescription('');
        }
    }, [payoutCategory, weeklyPointsWeek, weeklyHighScores, type]); 


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
        
        let finalAmount = parseFloat(amount);
        let finalTeamName = teamName; 

        if (type === 'fee' && teamName === 'ALL_TEAMS_MULTIPLIER') {
            if (activeTeamsCount === 0) {
                setError("Cannot process 'All Teams' transaction: No active teams found in the current season.");
                return;
            }
            finalAmount = finalAmount * activeTeamsCount;
            finalTeamName = 'All Teams'; 
        } else if (type === 'payout' && teamName === 'ALL_TEAMS_MULTIPLIER') {
            finalTeamName = 'All Teams';
            setError("Warning: 'All Teams' selected for a payout. Amount will not be multiplied. Ensure this is intentional.");
        }


        const newTransaction = {
            amount: finalAmount,
            description: description.trim(),
            type: type,
            teamName: finalTeamName, 
            date: serverTimestamp(),
            userId: userId,
            category: payoutCategory, 
            season: currentSeason 
        };

        if (type === 'payout') {
            if (payoutCategory === 'highest_weekly_points' || payoutCategory === 'second_highest_weekly_points') {
                if (!weeklyPointsWeek || isNaN(parseInt(weeklyPointsWeek))) {
                    setError("Please enter a valid week number for weekly points payouts.");
                    return;
                }
                const weekNum = parseInt(weeklyPointsWeek);
                newTransaction.weekNumber = weekNum;

                const weekData = weeklyHighScores[weekNum];
                if (weekData) {
                    if (payoutCategory === 'highest_weekly_points' && weekData.highest) {
                        newTransaction.teamName = weekData.highest.team;
                        newTransaction.description = `Payout: Highest Weekly Points (Week ${weekNum}) - ${weekData.highest.team} (${weekData.highest.score} pts)`;
                    } else if (payoutCategory === 'second_highest_weekly_points' && weekData.secondHighest) {
                        newTransaction.teamName = weekData.secondHighest.team;
                        newTransaction.description = `Payout: Second Highest Weekly Points (Week ${weekNum}) - ${weekData.secondHighest.team} (${weekData.secondHighest.score} pts)`;
                    } else {
                        setError(`Could not find a winning team for ${payoutCategory.replace(/_/g, ' ')} in Week ${weekNum} for the current season. Transaction not added.`);
                        return; 
                    }
                } else {
                    setError(`No score data found for Week ${weekNum} in the current season. Transaction not added.`);
                    return; 
                }
            } else if (payoutCategory === 'side_pot') {
                if (!sidePotName.trim()) {
                    setError("Please enter a name for the side pot.");
                    return;
                }
                newTransaction.potName = sidePotName.trim();
            }
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const transactionCollectionRef = collection(db, `/artifacts/${appId}/public/data/financial_transactions`);
            await addDoc(transactionCollectionRef, newTransaction);
            
            setAmount('');
            setDescription('');
            setType('fee'); 
            setTeamName(''); 
            setPayoutCategory('general'); 
            setWeeklyPointsWeek(''); 
            setSidePotName(''); 
            setError(null);
            console.log("Transaction added to Firestore successfully.");
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

    // Determine if team dropdown should be disabled/read-only. Now depends on isTeamAutoPopulated.
    const isTeamSelectionDisabled = isTeamAutoPopulated;

    // Filtered transactions for display based on selected team AND current season
    const filteredTransactions = transactions.filter(t => 
        t.season === currentSeason && 
        (filterTeam === '' || t.teamName === filterTeam || (filterTeam === 'ALL_TEAMS_MULTIPLIER' && t.teamName === 'All Teams'))
    );

    const totalFees = filteredTransactions
        .filter(t => t.type === 'fee')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPayouts = filteredTransactions
        .filter(t => t.type === 'payout')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netBalance = totalFees - totalPayouts;

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

            {currentSeason && (
                <div className="text-center text-sm text-blue-700 font-semibold mb-4">
                    Displaying Data for: Season {currentSeason}
                </div>
            )}
            {!currentSeason && !loading && (
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
                        <div className="bg-green-50 p-4 rounded-lg shadow-sm text-center">
                            <h3 className="text-lg font-semibold text-green-700">Total Fees Collected</h3>
                            <p className="text-2xl font-bold text-green-900">${totalFees.toFixed(2)}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg shadow-sm text-center">
                            <h3 className="text-lg font-semibold text-red-700">Total Payouts Made</h3>
                            <p className="text-2xl font-bold text-red-900">${totalPayouts.toFixed(2)}</p>
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
                                        // Make description read-only if team is auto-populated
                                        readOnly={isTeamAutoPopulated}
                                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isTeamAutoPopulated ? 'bg-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                                    />
                                </div>

                                {type === 'payout' && ( 
                                    <div className="flex-1">
                                        <label htmlFor="payoutCategory" className="block text-sm font-medium text-gray-700 mb-1">Payout Category</label>
                                        <select
                                            id="payoutCategory"
                                            value={payoutCategory}
                                            onChange={(e) => {
                                                setPayoutCategory(e.target.value);
                                                // Reset weeklyPointsWeek and sidePotName when category changes
                                                setWeeklyPointsWeek(''); 
                                                setSidePotName('');
                                            }}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        >
                                            <option value="general">General Payout</option>
                                            <option value="highest_weekly_points">Highest Weekly Points</option>
                                            <option value="second_highest_weekly_points">Second Highest Weekly Points</option>
                                            <option value="side_pot">Side Pot</option>
                                        </select>
                                    </div>
                                )}

                                {type === 'payout' && (payoutCategory === 'highest_weekly_points' || payoutCategory === 'second_highest_weekly_points') && (
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

                                {type === 'payout' && payoutCategory === 'side_pot' && (
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

                                <div>
                                    <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Associated Team (Optional)</label>
                                    <select
                                        id="teamName"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        disabled={isTeamSelectionDisabled} // Use new state here
                                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none ${isTeamSelectionDisabled ? 'bg-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                                    >
                                        <option value="">Select Team (Optional)</option>
                                        {type === 'fee' && ( 
                                            <option value="ALL_TEAMS_MULTIPLIER">All Teams (Multiplied)</option>
                                        )}
                                        {uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').map(team => ( 
                                            <option key={team} value={team}>{team}</option>
                                        ))}
                                    </select>
                                    {isTeamAutoPopulated && teamName && ( // Show message only if auto-populated
                                        <p className="text-xs text-gray-500 mt-1">Automatically determined: {teamName}</p>
                                    )}
                                </div>
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
                                            // Apply division logic only if filtering by a specific team,
                                            // transaction is a fee for 'All Teams', and activeTeamsCount is valid.
                                            if (filterTeam !== '' && filterTeam !== 'All Teams' && t.teamName === 'All Teams' && t.type === 'fee' && activeTeamsCount > 0) {
                                                displayAmount = (t.amount / activeTeamsCount).toFixed(2);
                                            }
                                            return (
                                                <tr key={t.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                        {t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                        {t.description}
                                                        {t.category === 'highest_weekly_points' && t.weekNumber && ` (Week ${t.weekNumber})`}
                                                        {t.category === 'second_highest_weekly_points' && t.weekNumber && ` (Week ${t.weekNumber})`}
                                                        {t.category === 'side_pot' && t.potName && ` (${t.potName})`}
                                                    </td>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{t.teamName || '-'}</td>
                                                    <td className="py-2 px-4 text-sm text-right border-b border-gray-200">
                                                        <span className={`${t.type === 'fee' ? 'text-green-700' : 'text-red-700'} font-medium`}>
                                                            ${displayAmount}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                            t.type === 'fee' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

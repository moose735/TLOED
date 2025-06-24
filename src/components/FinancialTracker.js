import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut,
    signInAnonymously // Added back signInAnonymously
} from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

// CHART_COLORS can be reused from PowerRankings or defined here if not used elsewhere
const CHART_COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00c49f', '#ff0000',
    '#0088fe', '#bb3f85', '#7a421a', '#4a4a4a', '#a5d6a7', '#ef9a9a'
];

const FinancialTracker = ({ getDisplayTeamName, historicalMatchups }) => {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('fee');
    const [teamName, setTeamName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [uniqueTeams, setUniqueTeams] = useState([]);
    
    // State for deletion confirmation modal
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);

    // New states for login form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(null);

    // Get the Commish UID from environment variables
    const COMMISH_UID = process.env.REACT_APP_COMMISH_UID;
    const isCommish = userId && COMMISH_UID && userId === COMMISH_UID; // Check if current user is the commish

    // Derive unique teams from historicalMatchups whenever it changes
    useEffect(() => {
        if (historicalMatchups && Array.isArray(historicalMatchups)) {
            const teamsSet = new Set();
            historicalMatchups.forEach(match => {
                const team1 = getDisplayTeamName(match.team1);
                const team2 = getDisplayTeamName(match.team2);
                if (team1) teamsSet.add(team1);
                if (team2) teamsSet.add(team2);
            });
            const sortedTeams = Array.from(teamsSet).sort();
            
            setUniqueTeams(['ALL_TEAMS_MULTIPLIER', ...sortedTeams]);
            
            if (sortedTeams.length > 0) {
                setTeamName(''); 
            }
        }
    }, [historicalMatchups, getDisplayTeamName]);

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

            // Authentication listener for both initial load and subsequent changes
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => { // Added 'async' here
                if (user) {
                    setUserId(user.uid);
                    console.log("Firebase Auth Ready. User ID:", user.uid);
                } else {
                    // If no user is logged in, try to sign in anonymously
                    console.log("No user signed in. Attempting anonymous sign-in to allow read access.");
                    try {
                        await signInAnonymously(firebaseAuth);
                        setUserId(firebaseAuth.currentUser?.uid); // Set UID from newly signed-in anonymous user
                        console.log("Signed in anonymously. User ID:", firebaseAuth.currentUser?.uid);
                    } catch (anonSignInError) {
                        console.error("Error during anonymous sign-in:", anonSignInError);
                        setError(`Failed to sign in anonymously: ${anonSignInError.message}. Read access may be affected.`);
                        setUserId(null); // Keep user ID null if anonymous sign-in also fails
                    }
                }
                setIsAuthReady(true); // Auth system is ready, even if no user is logged in
            });

            return () => unsubscribe();
        } catch (initError) {
            console.error("Error initializing Firebase:", initError);
            setError(`Firebase initialization failed: ${initError.message}`);
            setLoading(false);
            setIsAuthReady(true);
        }
    }, []);

    // Function to handle Email/Password login
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError(null); // Clear previous errors
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

    // Function to handle logout
    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            console.log("Logged out successfully!");
            setLoginError(null);
            // After logout, the onAuthStateChanged listener will trigger and sign in anonymously
        } catch (error) {
            console.error("Logout Error:", error);
            setLoginError(`Logout failed: ${error.message}`);
        }
    };

    // Fetch transactions from Firestore once Firebase and authentication are ready
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
        // Only allow commish to add transactions
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

        if (teamName === 'ALL_TEAMS_MULTIPLIER') {
            const activeTeamsCount = uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').length;
            if (activeTeamsCount === 0) {
                setError("Cannot process 'All Teams' transaction: No active teams found.");
                return;
            }
            finalAmount = finalAmount * activeTeamsCount;
            finalTeamName = 'All Teams';
        }

        const newTransaction = {
            amount: finalAmount,
            description: description.trim(),
            type: type,
            teamName: finalTeamName,
            date: serverTimestamp(),
            userId: userId,
        };

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const transactionCollectionRef = collection(db, `/artifacts/${appId}/public/data/financial_transactions`);
            await addDoc(transactionCollectionRef, newTransaction);
            
            setAmount('');
            setDescription('');
            setTeamName('');
            setError(null);
            console.log("Transaction added to Firestore successfully.");
        } catch (addError) {
            console.error("Error adding transaction:", addError);
            setError(`Failed to add transaction: ${addError.message}. Please try again.`);
        }
    };

    // Function to initiate deletion, opens confirmation modal
    const confirmDelete = (transaction) => {
        setTransactionToDelete(transaction);
        setShowConfirmDelete(true);
    };

    // Function to execute deletion after confirmation
    const executeDelete = async () => {
        setShowConfirmDelete(false); // Close the modal
        if (!transactionToDelete || !db || !userId) {
            setError("Cannot delete: Invalid transaction or not authenticated.");
            return;
        }
        // Only allow commish to delete transactions
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
            setTransactionToDelete(null); // Clear the transaction from state
        } catch (deleteError) {
            console.error("Error deleting transaction:", deleteError);
            setError(`Failed to delete transaction: ${deleteError.message}. Please check your permissions.`);
        }
    };

    // Function to cancel deletion
    const cancelDelete = () => {
        setShowConfirmDelete(false);
        setTransactionToDelete(null);
    };


    const totalFees = transactions
        .filter(t => t.type === 'fee')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPayouts = transactions
        .filter(t => t.type === 'payout')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netBalance = totalFees - totalPayouts;

    return (
        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4 mx-auto">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 text-center">
                League Financial Tracker
            </h2>

            {/* User ID Display and Login/Logout UI */}
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
                
                {/* Login/Logout UI */}
                {isAuthReady && ( // Only show login/logout options once Firebase Auth is ready
                    <div className="mt-4">
                        {userId && !isCommish ? ( // If a user is logged in, but NOT the commish, show logout
                             <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors"
                            >
                                Logout (Currently Viewing Only)
                            </button>
                        ) : (userId && isCommish ? ( // If commish is logged in
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors"
                            >
                                Logout (Commish)
                            </button>
                        ) : ( // If no one is logged in, show login form
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

            {/* Display loading or error messages */}
            {loading && <p className="text-center text-blue-600 font-semibold">Loading financial data...</p>}
            {error && <p className="text-center text-red-600 font-semibold mb-4">{error}</p>}

            {/* Render content only when not loading and no major errors */}
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
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Associated Team (Optional)</label>
                                    <select
                                        id="teamName"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    >
                                        <option value="">Select Team (Optional)</option>
                                        <option value="ALL_TEAMS_MULTIPLIER">All Teams (Multiplied)</option>
                                        {uniqueTeams.filter(team => team !== 'ALL_TEAMS_MULTIPLIER').map(team => (
                                            <option key={team} value={team}>{team}</option>
                                        ))}
                                    </select>
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
                        {transactions.length === 0 ? (
                            <p className="text-center text-gray-600">No transactions recorded yet.</p>
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
                                            {isCommish && <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((t, index) => (
                                            <tr key={t.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                    {t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{t.description}</td>
                                                <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{t.teamName || '-'}</td>
                                                <td className="py-2 px-4 text-sm text-right border-b border-gray-200">
                                                    <span className={`${t.type === 'fee' ? 'text-green-700' : 'text-red-700'} font-medium`}>
                                                        ${(t.amount || 0).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                        t.type === 'fee' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {t.type === 'fee' ? 'Fee' : 'Payout'}
                                                    </span>
                                                </td>
                                                {isCommish && ( // Conditionally render delete button for commish
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* Custom Confirmation Modal for Deletion */}
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

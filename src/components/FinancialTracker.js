import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

// CHART_COLORS can be reused from PowerRankings or defined here if not used elsewhere
const CHART_COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00c49f', '#ff0000',
    '#0088fe', '#bb3f85', '#7a421a', '#4a4a4a', '#a5d6a7', '#ef9a9a'
];

// Added historicalMatchups prop to receive data from App.js
const FinancialTracker = ({ getDisplayTeamName, historicalMatchups }) => {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('fee'); // Corrected to useState, as it's a selectable input
    const [teamName, setTeamName] = useState(''); // State for the selected team name
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [uniqueTeams, setUniqueTeams] = useState([]); // New state for unique team names

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
            setUniqueTeams(sortedTeams);
            if (sortedTeams.length > 0) {
                setTeamName(''); // Set initial value for the dropdown to empty/placeholder
            }
        }
    }, [historicalMatchups, getDisplayTeamName]);


    // Initialize Firebase and set up authentication
    useEffect(() => {
        let firebaseConfig = {};
        let appId = 'default-app-id'; // Default value if not set via env
        let initialAuthToken = undefined;

        try {
            // Attempt to retrieve and parse REACT_APP_FIREBASE_CONFIG
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

            // Attempt to retrieve REACT_APP_APP_ID
            const envAppId = process.env.REACT_APP_APP_ID;
            if (envAppId) {
                appId = envAppId;
                console.log("App ID from REACT_APP_APP_ID:", appId);
            } else {
                console.warn("REACT_APP_APP_ID environment variable is not defined or is empty. Using 'default-app-id'.");
            }

            // Attempt to retrieve REACT_APP_INITIAL_AUTH_TOKEN
            const envInitialAuthToken = process.env.REACT_APP_INITIAL_AUTH_TOKEN;
            if (envInitialAuthToken !== undefined) {
                initialAuthToken = envInitialAuthToken;
                // Log whether the token is empty or has content for debugging
                console.log("Initial Auth Token from REACT_APP_INITIAL_AUTH_TOKEN:", initialAuthToken === "" ? "empty string" : "present (non-empty)");
            } else {
                console.warn("REACT_APP_INITIAL_AUTH_TOKEN environment variable is not defined. Anonymous sign-in will be attempted.");
            }

            // Essential check: Ensure projectId and apiKey are provided for Firebase initialization
            if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
                // If config is missing, set an error and stop loading
                throw new Error("Firebase configuration missing projectId or apiKey. Please ensure your REACT_APP_FIREBASE_CONFIG environment variable contains these properties and is correctly formatted JSON.");
            }

            // Initialize Firebase app with the provided configuration and app ID
            const app = initializeApp(firebaseConfig, appId);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);

            // Store initialized Firebase instances in state
            setDb(firestore);
            setAuth(firebaseAuth);

            // Set up an authentication state listener
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    // If a user is logged in (authenticated), set their UID
                    setUserId(user.uid);
                    console.log("Firebase Auth Ready. User ID:", user.uid);
                } else {
                    // If no user, attempt to sign in anonymously or with a custom token
                    console.log("No user signed in. Attempting anonymous sign-in or custom token sign-in.");
                    try {
                        // FIX: Explicitly check if initialAuthToken is NOT an empty string before using signInWithCustomToken
                        if (initialAuthToken !== undefined && initialAuthToken !== "") {
                            // If a valid custom auth token is available, use it for sign-in
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                            console.log("Signed in with custom token.");
                        } else {
                            // Otherwise (if token is undefined or empty string), sign in anonymously
                            await signInAnonymously(firebaseAuth);
                            console.log("Signed in anonymously.");
                        }
                        // After successful sign-in (anonymous or custom), update the userId state
                        setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID()); // Fallback to random if no UID for some reason
                    } catch (signInError) {
                        console.error("Error during initial Firebase sign-in:", signInError);
                        setError(`Authentication failed: ${signInError.message}. Data persistence may be affected.`);
                        // Even on sign-in error, proceed as the app might still display public data
                        setUserId(crypto.randomUUID()); // Use a random ID if auth fails for client-side ops
                    }
                }
                setIsAuthReady(true); // Mark authentication as ready, regardless of success or failure
            });

            // Cleanup the authentication listener when the component unmounts
            return () => unsubscribe();
        } catch (initError) {
            // Catch and display any errors during Firebase initialization
            console.error("Error initializing Firebase:", initError);
            setError(`Firebase initialization failed: ${initError.message}`);
            setLoading(false);
            setIsAuthReady(true); // Mark ready to display the error
        }
    }, []); // Empty dependency array ensures this runs only once on component mount

    // Fetch transactions from Firestore once Firebase and authentication are ready
    useEffect(() => {
        if (!db || !isAuthReady) {
            // Wait until Firestore instance and authentication state are ready
            console.log("Firestore not ready or Auth not ready. Waiting for db and isAuthReady...");
            return;
        }

        setLoading(true); // Set loading to true while fetching data
        setError(null); // Clear previous errors

        // Define the public collection path as per Firestore security rules for shared data
        const appId = process.env.REACT_APP_APP_ID || 'default-app-id'; // Use REACT_APP_APP_ID here too
        // Data for everyone to see should be in a public collection
        const transactionCollectionPath = `/artifacts/${appId}/public/data/financial_transactions`;
        
        // Create a query to order transactions by date (most recent first)
        const q = query(collection(db, transactionCollectionPath), orderBy('date', 'desc'));

        console.log("Attempting to listen to Firestore collection:", transactionCollectionPath);

        // Set up a real-time listener for changes in the transactions collection
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isAuthReady) { // Double-check auth readiness before processing snapshot
                console.log("onSnapshot triggered but auth not ready. Skipping update.");
                return;
            }
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTransactions(fetchedTransactions); // Update component state with fetched data
            setLoading(false); // Set loading to false after data is fetched
            console.log("Fetched transactions:", fetchedTransactions.length);
        }, (firestoreError) => {
            // Handle any errors during data fetching
            console.error("Error fetching transactions from Firestore:", firestoreError);
            setError(`Failed to load financial data: ${firestoreError.message}. Please check your internet connection or Firestore security rules.`);
            setLoading(false); // Stop loading on error
        });

        // Cleanup the Firestore listener when the component unmounts or dependencies change
        return () => {
            console.log("Unsubscribing from Firestore listener.");
            unsubscribe();
        };
    }, [db, isAuthReady]); // Re-run this effect when 'db' or 'isAuthReady' changes

    // Handle adding a new transaction to Firestore
    const handleAddTransaction = async (e) => {
        e.preventDefault(); // Prevent default form submission behavior

        // Basic form validation
        if (!db || !userId) {
            setError("Database not ready or user not authenticated. Cannot add transaction.");
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
        // If team name is required, add validation here
        // if (!teamName.trim()) {
        //     setError("Please select or enter a team name.");
        //     return;
        // }


        // Prepare the new transaction object
        const newTransaction = {
            amount: parseFloat(amount),
            description: description.trim(),
            type: type,
            teamName: teamName, // Use the selected team name directly
            date: serverTimestamp(), // Use Firestore's server timestamp for consistent ordering
            userId: userId, // Include the user ID for tracking who added it (if applicable)
        };

        try {
            // Get the app ID for constructing the public collection path
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id'; // Use REACT_APP_APP_ID here too
            // Add the new document to the public financial transactions collection
            const transactionCollectionRef = collection(db, `/artifacts/${appId}/public/data/financial_transactions`);
            await addDoc(transactionCollectionRef, newTransaction);
            
            // Clear form fields on successful addition
            setAmount('');
            setDescription('');
            setTeamName(''); // Reset team name to default (or empty string)
            setError(null); // Clear any previous errors
            console.log("Transaction added to Firestore successfully.");
        } catch (addError) {
            // Handle errors during adding transaction
            console.error("Error adding transaction:", addError);
            setError(`Failed to add transaction: ${addError.message}. Please try again.`);
        }
    };

    // Calculate total fees collected
    const totalFees = transactions
        .filter(t => t.type === 'fee')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Calculate total payouts made
    const totalPayouts = transactions
        .filter(t => t.type === 'payout')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Calculate the net balance
    const netBalance = totalFees - totalPayouts;

    return (
        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4 mx-auto">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 text-center">
                League Financial Tracker
            </h2>

            {/* User ID Display - Mandatory for multi-user apps */}
            <div className="mb-4 text-center text-sm text-gray-600 p-2 bg-blue-50 rounded">
                Your User ID: <span className="font-mono text-blue-700 break-all">{userId || "Loading..."}</span>
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

                    {/* Add New Transaction Form */}
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
                                {/* Replaced input with select dropdown for team names */}
                                <select
                                    id="teamName"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="">Select Team (Optional)</option> {/* Optional blank option */}
                                    {uniqueTeams.map(team => (
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default FinancialTracker;

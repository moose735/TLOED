import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

// CHART_COLORS can be reused from PowerRankings or defined here if not used elsewhere
const CHART_COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00c49f', '#ff0000',
    '#0088fe', '#bb3f85', '#7a421a', '#4a4a4a', '#a5d6a7', '#ef9a9a'
];

const FinancialTracker = ({ getDisplayTeamName }) => {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('fee'); // 'fee' or 'payout'
    const [teamName, setTeamName] = useState(''); // Optional, for team-specific transactions
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Initialize Firebase and set up authentication
    useEffect(() => {
        try {
            // Ensure __firebase_config and __app_id are available
            const firebaseConfig = typeof __firebase_config !== 'undefined'
                ? JSON.parse(__firebase_config)
                : {}; 
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            // IMPORTANT: Ensure projectId, apiKey, and appId are present for initialization.
            // These should be provided by the Canvas environment.
            if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
                throw new Error("Firebase configuration missing projectId or apiKey. Please ensure __firebase_config is correctly provided by the environment.");
            }

            const app = initializeApp(firebaseConfig, appId);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestore);
            setAuth(firebaseAuth);

            // Listen for auth state changes
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                    console.log("Firebase Auth Ready. User ID:", user.uid);
                } else {
                    console.log("No user signed in. Attempting anonymous sign-in.");
                    try {
                        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                            console.log("Signed in with custom token.");
                        } else {
                            await signInAnonymously(firebaseAuth);
                            console.log("Signed in anonymously.");
                        }
                    } catch (signInError) {
                        console.error("Error during initial Firebase sign-in:", signInError);
                        setError(`Authentication failed: ${signInError.message}`);
                    } finally {
                        setIsAuthReady(true); // Always set ready to stop loading, even if there's an auth error
                    }
                }
            });

            return () => unsubscribe(); // Cleanup auth listener on unmount
        } catch (initError) {
            console.error("Error initializing Firebase:", initError);
            setError(`Firebase initialization failed: ${initError.message}`);
            setLoading(false);
            setIsAuthReady(true); // Mark ready to display error
        }
    }, []);

    // Fetch transactions when auth and db are ready
    useEffect(() => {
        if (!db || !auth || !userId || !isAuthReady) {
            console.log("Firestore not ready. Waiting for db, auth, userId, and isAuthReady...");
            return;
        }

        setLoading(true);
        setError(null);

        // Define the collection path based on user ID for private data
        // For public data, it would be `/artifacts/${appId}/public/data/financial_transactions`
        const transactionCollectionPath = `/artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/users/${userId}/financial_transactions`;
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
            setError(`Failed to load financial data: ${firestoreError.message}`);
            setLoading(false);
        });

        // Cleanup listener on unmount
        return () => {
            console.log("Unsubscribing from Firestore listener.");
            unsubscribe();
        };
    }, [db, auth, userId, isAuthReady]); // Re-run when db, auth, userId, or auth ready state changes

    const handleAddTransaction = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            setError("Database not ready or user not authenticated. Please try again.");
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

        const newTransaction = {
            amount: parseFloat(amount),
            description: description.trim(),
            type: type,
            teamName: teamName.trim(), // Keep team name even if empty
            date: serverTimestamp(), // Firestore timestamp
            userId: userId, // Store userId with the document (redundant if using user-specific collections, but good for verification)
        };

        try {
            const transactionCollectionPath = `/artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/users/${userId}/financial_transactions`;
            await addDoc(collection(db, transactionCollectionPath), newTransaction);
            setAmount('');
            setDescription('');
            setTeamName('');
            setError(null); // Clear any previous errors
            console.log("Transaction added successfully.");
        } catch (addError) {
            console.error("Error adding transaction:", addError);
            setError(`Failed to add transaction: ${addError.message}`);
        }
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

            {/* User ID Display - Mandatory for multi-user apps */}
            <div className="mb-4 text-center text-sm text-gray-600 p-2 bg-blue-50 rounded">
                Your User ID: <span className="font-mono text-blue-700 break-all">{userId || "Loading..."}</span>
            </div>

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
                                <input
                                    type="text"
                                    id="teamName"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    placeholder="e.g., Team Alpha"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
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

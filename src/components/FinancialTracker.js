// src/components/FinancialTracker.js
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Your Firebase Config (should be replaced by env vars in a real app)
const firebaseConfig = {
	apiKey: 'AIzaSyDcuPXgRPIdX-NYblBqQkdXqrGiD6yobcA',
	authDomain: 'tloed-finance-tracker.firebaseapp.com',
	projectId: 'tloed-finance-tracker',
	storageBucket: 'tloed-finance-tracker.appspot.com',
	messagingSenderId: '220652845054',
	appId: '1:220652845054:web:2d2f498ce8158afa2cf2af',
	measurementId: 'G-0N3ZD0XNTC',
};

// Commissioner's UID for admin access
const COMMISH_UID = 'QzIJSZWBHgSzhmC6pOOiuJNxbI83';

const FinancialTracker = () => {
	const { loading, error, usersData, historicalData } = useSleeperData();
	const [authUser, setAuthUser] = useState(null);
	const [db, setDb] = useState(null);
	const [auth, setAuth] = useState(null);
	const [login, setLogin] = useState({ email: '', password: '' });
	const [authError, setAuthError] = useState('');
	const [showCommishLogin, setShowCommishLogin] = useState(false);
	const [transaction, setTransaction] = useState({
		type: 'Fee',
		amount: '',
		category: '',
		description: '',
		week: '',
		team: [],
		quantity: 1
	});
	const [transactionMessage, setTransactionMessage] = useState({ text: '', type: '' });
	const [editingTransaction, setEditingTransaction] = useState(null);
	const [showTeamDropdown, setShowTeamDropdown] = useState(false);
	const [filters, setFilters] = useState({ type: 'ALL', team: 'ALL' });
	const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
	const [currentPage, setCurrentPage] = useState(1);
	const transactionsPerPage = 10;
	const [selectedTransactions, setSelectedTransactions] = useState([]);
	const [potentialFormInput, setPotentialFormInput] = useState({ description: '', amount: '' });
    const [showPotentialForm, setShowPotentialForm] = useState(null);
    const [selectedYear, setSelectedYear] = useState('');

	// State to hold data for the selected year only
	const [currentYearData, setCurrentYearData] = useState({ transactions: [], potentialFees: [], potentialPayouts: [] });
	const [firestoreLoading, setFirestoreLoading] = useState(true);
    
    // New state to manage the expanded state of team lists in the table
    const [expandedTransactionId, setExpandedTransactionId] = useState(null);

	// Fee and payout description options
	const FEE_DESCRIPTIONS = [
		'Entry Fee',
		'Trade Fee',
		'Waiver/FA Fee',
		'Other',
	];
	const PAYOUT_DESCRIPTIONS = [
		'Weekly 1st',
		'Weekly 2nd',
		'Playoff 1st',
		'Playoff 2nd',
		'Playoff 3rd',
		'Total Points 1st',
		'Total Points 2nd',
		'Total Points 3rd',
		'Bonus',
		'Other',
	];

	const isAdmin = !!authUser && authUser.uid === COMMISH_UID;

	// Get all league members (owners)
	const allMembers = usersData ? usersData.map(u => ({
		userId: u.user_id,
		displayName: u.display_name || u.username || u.user_id,
	})) : [];

	// Get all seasons
	const allSeasons = Object.keys(historicalData?.rostersBySeason || {}).sort((a, b) => b - a);

	// Weekly top 2 scorers for each week/season
	const weeklyTopScorers = useMemo(() => {
		const result = {};
		if (!historicalData) return result;
		Object.entries(historicalData.matchupsBySeason || {}).forEach(([year, matchups]) => {
			const byWeek = {};
			matchups.forEach(m => {
				if (!m.week) return;
				if (!byWeek[m.week]) byWeek[m.week] = [];
				byWeek[m.week].push(m);
			});
			result[year] = {};
			Object.entries(byWeek).forEach(([week, weekMatchups]) => {
				let scores = [];
				weekMatchups.forEach(m => {
					const team1 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === String(m.team1_roster_id));
					const team2 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === String(m.team2_roster_id));
					if (team1 && !isNaN(m.team1_score)) scores.push({ userId: team1.owner_id, score: m.team1_score });
					if (team2 && !isNaN(m.team2_score)) scores.push({ userId: team2.owner_id, score: m.team2_score });
				});
				scores.sort((a, b) => b.score - a.score);
				const top2 = scores.slice(0, 2).map(s => s.userId);
				result[year][week] = top2;
			});
		});
		return result;
	}, [historicalData]);

    // Calculate total points leaders for each season
    const totalPointsLeaders = useMemo(() => {
        const result = {};
        if (!historicalData || !historicalData.matchupsBySeason || !historicalData.rostersBySeason) {
            return result;
        }

        Object.keys(historicalData.matchupsBySeason).forEach(year => {
            const teamScores = {};
            const rosters = historicalData.rostersBySeason[year];
            if (!rosters) return;

            rosters.forEach(roster => {
                if (roster.owner_id) {
                    teamScores[roster.owner_id] = 0;
                }
            });

            const matchups = historicalData.matchupsBySeason[year];
            matchups.forEach(matchup => {
                const roster1 = rosters.find(r => String(r.roster_id) === String(matchup.team1_roster_id));
                if (roster1 && roster1.owner_id && !isNaN(matchup.team1_score)) {
                    teamScores[roster1.owner_id] += matchup.team1_score;
                }
                const roster2 = rosters.find(r => String(r.roster_id) === String(matchup.team2_roster_id));
                if (roster2 && roster2.owner_id && !isNaN(matchup.team2_score)) {
                    teamScores[roster2.owner_id] += matchup.team2_score;
                }
            });

            const sortedScores = Object.entries(teamScores)
                .map(([userId, score]) => ({ userId, score }))
                .sort((a, b) => b.score - a.score);

            result[year] = sortedScores;
        });
        return result;
    }, [historicalData]);
    
    // Helper function for sorting
    const sortData = (data, key, direction, allMembers) => {
        const sortedData = [...data].sort((a, b) => {
            let aValue = a[key];
            let bValue = b[key];

            // Handle specific data types for sorting
            if (key === 'amount') {
                aValue = Number(aValue);
                bValue = Number(bValue);
            } else if (key === 'date') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else if (key === 'team') {
                const getTeamDisplayName = (teamId) => allMembers.find(m => m.userId === teamId)?.displayName || teamId;
                aValue = Array.isArray(a.team) ? a.team.map(getTeamDisplayName).join(', ') : getTeamDisplayName(a.team);
                bValue = Array.isArray(b.team) ? b.team.map(getTeamDisplayName).join(', ') : getTeamDisplayName(b.team);
            }

            // Corrected comparison logic
            if (aValue < bValue) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sortedData;
    };

	// Filter and sort transactions
	const filteredAndSortedTransactions = useMemo(() => {
		let filtered = currentYearData.transactions.filter(t => {
			const typeMatch = filters.type === 'ALL' || t.type === filters.type;
			const teamMatch = filters.team === 'ALL' || (Array.isArray(t.team) ? t.team.includes(filters.team) : t.team === filters.team);
			return typeMatch && teamMatch;
		});

		if (sortConfig.key) {
			filtered = sortData(filtered, sortConfig.key, sortConfig.direction, allMembers);
		}
		
		return filtered;
	}, [currentYearData, filters, sortConfig, allMembers]);

	// Pagination
	const totalPages = Math.ceil(filteredAndSortedTransactions.length / transactionsPerPage);
	const paginatedTransactions = filteredAndSortedTransactions.slice((currentPage - 1) * transactionsPerPage, currentPage * transactionsPerPage);

	// --- FIX: Correct Firebase Initialization and Auth Logic ---
	useEffect(() => {
		// Only initialize Firebase once, even with hot reloads
		if (!window.firebaseApp) {
			window.firebaseApp = initializeApp(firebaseConfig);
		}
		const app = window.firebaseApp;
		
		const authInstance = getAuth(app);
		const dbInstance = getFirestore(app);

		setAuth(authInstance);
		setDb(dbInstance);

		const unsubAuth = onAuthStateChanged(authInstance, user => {
			setAuthUser(user);
		});

		return () => {
			unsubAuth();
		};
	}, []);
	
	useEffect(() => {
		if (allSeasons.length > 0 && !selectedYear) {
			setSelectedYear(allSeasons[0]);
		}
	}, [allSeasons, selectedYear]);

	// Firestore: Real-time updates for the selected year only
	useEffect(() => {
		if (!selectedYear || !db) return; // Add a check for db to prevent the error

		setFirestoreLoading(true);
		const docRef = doc(db, 'league_finances', selectedYear);
		const unsub = onSnapshot(docRef, (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setCurrentYearData(data && data.transactions ? data : { transactions: [], potentialFees: [], potentialPayouts: [] });
			} else {
                setCurrentYearData({ transactions: [], potentialFees: [], potentialPayouts: [] });
			}
			setFirestoreLoading(false);
		}, (error) => {
            console.error("Error fetching Firestore data:", error);
            setFirestoreLoading(false);
        });

		return () => unsub();
	}, [selectedYear, db]);

	// --- NEW HELPER FUNCTION TO GET TRANSACTION TOTAL ---
	// This function calculates the total value of a transaction,
	// which is amount * number of teams for trade fees, and just amount otherwise.
	const getTransactionTotal = (transaction) => {
		if (transaction.category === 'Trade Fee' && Array.isArray(transaction.team)) {
			return Number(transaction.amount || 0) * transaction.team.length;
		}
		return Number(transaction.amount || 0);
	};
	// --------------------------------------------------

	// Summary calculations for the selected year's data
	const transactionBank = currentYearData.transactions
		.filter(t => t.type === 'Fee' && (t.category === 'Trade Fee' || t.category === 'Waiver/FA Fee'))
		// --- UPDATED: Use the new helper function to get the correct total for each transaction. ---
		.reduce((sum, t) => sum + getTransactionTotal(t), 0);
	const totalFees = currentYearData.transactions.filter(t => t.type === 'Fee')
		// --- UPDATED: Use the new helper function to get the correct total for all fees. ---
		.reduce((sum, t) => sum + getTransactionTotal(t), 0);
	const totalPayouts = currentYearData.transactions.filter(t => t.type === 'Payout').reduce((sum, t) => sum + Number(t.amount || 0), 0);
	const leagueBank = totalFees - totalPayouts;

	if (loading || firestoreLoading) return <div className="p-4 text-blue-600">Loading financial tracker...</div>;
	if (error) return <div className="p-4 text-red-600">Error loading data: {error.message}</div>;
	if (!usersData || !historicalData) return <div className="p-4 text-orange-600">No data available.</div>;

	// Login form handler
	const handleLogin = async e => {
		e.preventDefault();
		if (!auth) return;
		setAuthError('');
		try {
			await signInWithEmailAndPassword(auth, login.email, login.password);
		} catch (err) {
			setAuthError('Login failed. Please check your credentials.');
		}
	};

	// Logout handler
	const handleLogout = () => {
		if (!auth) return;
		signOut(auth);
	};

	const requestSort = (key) => {
		let direction = 'asc';
		if (sortConfig.key === key && sortConfig.direction === 'asc') {
			direction = 'desc';
		}
		setSortConfig({ key, direction });
	};

	// New function to handle CSV export
	const handleExport = () => {
		const columns = ["Date", "Team", "Type", "Amount", "Category", "Description", "Week"];
		const csvData = filteredAndSortedTransactions.map(t => {
			const teamNames = Array.isArray(t.team) ?
				t.team.map(id => allMembers.find(m => m.userId === id)?.displayName || id).join(', ') :
				allMembers.find(m => m.userId === t.team)?.displayName || t.team;
			const displayDate = t.date ? (isNaN(new Date(t.date)) ? 'Invalid Date' : new Date(t.date).toLocaleString()) : '';
			return [
				displayDate,
				teamNames,
				t.type,
				Number(t.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}),
				t.category,
				t.description,
				t.week,
			];
		});
		const csvContent = [
			columns.join(','),
			...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.setAttribute("href", url);
		link.setAttribute("download", `league_finances_${selectedYear}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// Handle saving a new transaction or updating an existing one
	const handleAddOrUpdateTransaction = async (e) => {
		e.preventDefault();
		if (!isAdmin || !db) return;
		if (transaction.team.length === 0) {
			setTransactionMessage({ text: 'Please select at least one team.', type: 'error' });
			return;
		}

		let newTransactions;
		let messageText;
	
		if (editingTransaction) {
			// **FIX:** Now using the unique 'id' for editing.
			newTransactions = currentYearData.transactions.map(t =>
				t.id === editingTransaction.id ? { ...transaction, id: editingTransaction.id, date: new Date().toISOString() } : t
			);
			messageText = 'Transaction updated successfully!';
			setEditingTransaction(null);
		} else {
			const transactionsToAdd = [];
	
			// **FIX:** Corrected logic to handle Entry Fee and Waiver/FA Fee correctly
			if (transaction.category === 'Waiver/FA Fee' || transaction.category === 'Entry Fee') {
				// Iterate over each selected team and create a separate transaction
				transaction.team.forEach(teamId => {
					transactionsToAdd.push({
						...transaction,
						id: crypto.randomUUID(), // Each transaction gets a unique ID
						quantity: 1, // Quantity is 1 for each individual transaction
						team: [teamId], // Ensure team is an array with a single ID
						date: new Date().toISOString()
					});
				});
			} else {
				// For other categories, add a single transaction with all selected teams
				transactionsToAdd.push({
					...transaction,
					id: crypto.randomUUID(),
					team: transaction.team,
					date: new Date().toISOString()
				});
			}
	
			newTransactions = [...currentYearData.transactions, ...transactionsToAdd];
			messageText = 'Transaction saved successfully!';
		}
	
		try {
			const docRef = doc(db, 'league_finances', selectedYear);
			await setDoc(docRef, { ...currentYearData, transactions: newTransactions }, { merge: true });
			setTransactionMessage({ text: messageText, type: 'success' });
		} catch (e) {
			console.error("Error saving transaction: ", e);
			setTransactionMessage({ text: 'Error saving transaction.', type: 'error' });
		}
	
		setTransaction({ type: 'Fee', amount: '', category: '', description: '', week: '', team: [], quantity: 1 });
		setShowTeamDropdown(false);
	};

	// Handle editing a transaction
	const handleEditTransaction = (transactionToEdit) => {
		if (!isAdmin) return;
		setEditingTransaction(transactionToEdit);
		setTransaction({
			...transactionToEdit,
			team: Array.isArray(transactionToEdit.team) ? transactionToEdit.team : [transactionToEdit.team],
			quantity: transactionToEdit.category === 'Waiver/FA Fee' ? transactionToEdit.quantity : 1,
		});
		setTransactionMessage({ text: 'Editing transaction...', type: 'info' });
	};

	// Delete transaction handler (commish only)
	const handleDeleteTransaction = async (transactionsToDelete) => {
		if (!isAdmin || !db) return;
		
		// **FIX:** Use a unique ID set instead of a date set for filtering.
		const transactionIdsToDelete = new Set(transactionsToDelete.map(t => t.id));
		const newTransactions = currentYearData.transactions.filter(t => !transactionIdsToDelete.has(t.id));

		try {
			const docRef = doc(db, 'league_finances', selectedYear);
			await setDoc(docRef, { ...currentYearData, transactions: newTransactions }, { merge: true });
			setTransactionMessage({ text: 'Transaction(s) deleted successfully!', type: 'success' });
		} catch (e) {
			console.error("Error deleting transaction: ", e);
			setTransactionMessage({ text: 'Error deleting transaction.', type: 'error' });
		}

		setSelectedTransactions([]);
	};

	const handleSelectTransaction = (transaction, isChecked) => {
		if (isChecked) {
			setSelectedTransactions(prev => [...prev, transaction]);
		} else {
			// **FIX:** Use the unique ID for filtering when deselecting.
			setSelectedTransactions(prev => prev.filter(t => t.id !== transaction.id));
		}
	};
	
	const handleDeleteSelected = () => {
		if (selectedTransactions.length > 0) {
			handleDeleteTransaction(selectedTransactions);
		}
	};
	
	const allTransactionsSelected = selectedTransactions.length > 0 && selectedTransactions.length === paginatedTransactions.length;
	
	// Handle adding/deleting potential transactions
	const handleAddPotentialTransaction = async (e, type) => {
		e.preventDefault();
		if (!isAdmin || !db) return;
		const newPotentialTx = {
			id: new Date().toISOString(),
			...potentialFormInput,
		};
		let newPotentialArray;
		if (type === 'fees') {
			newPotentialArray = [...currentYearData.potentialFees, newPotentialTx];
		} else {
			newPotentialArray = [...currentYearData.potentialPayouts, newPotentialTx];
		}

		try {
			const docRef = doc(db, 'league_finances', selectedYear);
			await setDoc(docRef, {
				...currentYearData,
				[type === 'fees' ? 'potentialFees' : 'potentialPayouts']: newPotentialArray
			}, { merge: true });
			setTransactionMessage({ text: `Potential ${type.slice(0, -1)} added successfully!`, type: 'success' });
		} catch (e) {
			console.error("Error saving potential transaction: ", e);
			setTransactionMessage({ text: `Error saving potential ${type.slice(0, -1)}.`, type: 'error' });
		}

		setShowPotentialForm(null);
		setPotentialFormInput({ description: '', amount: '' });
	};

	const handleDeletePotentialTransaction = async (id, type) => {
		if (!isAdmin || !db) return;
		
		const newPotentialArray = currentYearData[type === 'fees' ? 'potentialFees' : 'potentialPayouts'].filter(t => t.id !== id);

		try {
			const docRef = doc(db, 'league_finances', selectedYear);
			await setDoc(docRef, {
				...currentYearData,
				[type === 'fees' ? 'potentialFees' : 'potentialPayouts']: newPotentialArray
			}, { merge: true });
			setTransactionMessage({ text: `Potential ${type.slice(0, -1)} deleted successfully!`, type: 'success' });
		} catch (e) {
			console.error("Error deleting potential transaction: ", e);
			setTransactionMessage({ text: `Error deleting potential ${type.slice(0, -1)}.`, type: 'error' });
		}
	};

	// Helper function to render the truncated or full list of teams
	const renderTeams = (transactionId, teams, allMembers, expandedId, setExpandedId) => {
        const teamNames = Array.isArray(teams) ?
            teams.map(id => allMembers.find(m => m.userId === id)?.displayName || id) :
            [allMembers.find(m => m.userId === teams)?.displayName || teams];
        
        if (teamNames.length > 3 && expandedId !== transactionId) {
            return (
                <div className="flex flex-col items-start">
                    <span>{teamNames.slice(0, 3).join(', ')} ...</span>
                    <button 
                        onClick={() => setExpandedId(transactionId)}
                        className="text-blue-500 hover:text-blue-700 text-xs mt-1"
                    >
                        (+{teamNames.length - 3} more)
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-start">
                <span>{teamNames.join(', ')}</span>
                {teamNames.length > 3 && (
                    <button
                        onClick={() => setExpandedId(null)}
                        className="text-gray-500 hover:text-gray-700 text-xs mt-1"
                    >
                        Show less
                    </button>
                )}
            </div>
        );
    };

	return (
		<div className="p-4 max-w-5xl mx-auto font-sans">
			<h2 className="text-3xl font-bold mb-6 text-center text-gray-800">League Financial Tracker</h2>
			{/* Year Dropdown */}
			<div className="flex flex-wrap justify-center gap-4 mb-6">
				<label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
					<span>League Year:</span>
					<select
						className="border rounded px-2 py-1 bg-gray-50"
						value={selectedYear}
						onChange={e => {
							setSelectedYear(e.target.value);
							setCurrentPage(1);
						}}
					>
						{allSeasons.map(year => (
							<option key={year} value={year}>{year}</option>
						))}
					</select>
				</label>
			</div>
			{/* Summary Bubbles */}
			<div className="flex flex-wrap justify-center gap-4 mb-8">
				<div className="flex flex-col items-center bg-blue-50 rounded-lg px-6 py-3 shadow-md text-blue-800 min-w-[120px]">
					<span className="text-xs font-semibold uppercase tracking-wide">League Bank</span>
					<span className="text-2xl font-bold">${leagueBank.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
				</div>
				<div className="flex flex-col items-center bg-red-50 rounded-lg px-6 py-3 shadow-md text-red-800 min-w-[120px]">
					<span className="text-xs font-semibold uppercase tracking-wide">Total Fees</span>
					<span className="text-2xl font-bold">${totalFees.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
				</div>
				<div className="flex flex-col items-center bg-green-50 rounded-lg px-6 py-3 shadow-md text-green-800 min-w-[120px]">
					<span className="text-xs font-semibold uppercase tracking-wide">Total Payouts</span>
					<span className="text-2xl font-bold">${totalPayouts.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
				</div>
				<div className="flex flex-col items-center bg-yellow-50 rounded-lg px-6 py-3 shadow-md text-yellow-800 min-w-[120px]">
					<span className="text-xs font-semibold uppercase tracking-wide">Transaction Bank</span>
					<span className="text-2xl font-bold">${transactionBank.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
				</div>
			</div>
			{/* Login/Logout Section with collapsible commish login */}
			<div className="flex flex-col md:flex-row md:justify-center md:items-center mb-6 gap-4">
				{authUser ? (
					<div className="flex items-center gap-3">
						<span className="text-green-700 font-semibold">Logged in as {authUser.email}</span>
						{isAdmin && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Commissioner</span>}
						<button onClick={handleLogout} className="ml-2 px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Logout</button>
					</div>
				) : (
					<div className="w-full max-w-sm mx-auto">
						<button
							onClick={() => setShowCommishLogin(!showCommishLogin)}
							className="w-full text-center py-2 px-4 rounded-lg bg-blue-500 text-white font-semibold mb-4 flex items-center justify-center gap-2 hover:bg-blue-600 transition duration-200"
						>
							Commissioner Login
							<span className={`transform transition-transform duration-200 ${showCommishLogin ? 'rotate-180' : 'rotate-0'}`}>
								&#9660;
							</span>
						</button>
						{showCommishLogin && (
							<div className="bg-white p-6 rounded-2xl shadow-2xl w-full mx-auto animate-fadeIn">
								<div className="text-center mb-6">
									<h1 className="text-xl font-bold text-slate-800 mb-2">Commish Login</h1>
									<p className="text-slate-500 text-sm">Sign in to manage league finances.</p>
								</div>
								<form onSubmit={handleLogin} className="flex flex-col gap-4 items-center">
									<input
										type="email"
										required
										placeholder="Commish Email"
										className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
										value={login.email}
										onChange={e => setLogin(l => ({ ...l, email: e.target.value }))}
									/>
									<input
										type="password"
										required
										placeholder="Password"
										className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
										value={login.password}
										onChange={e => setLogin(l => ({ ...l, password: e.target.value }))}
									/>
									<button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200">
										Log In
									</button>
									{authError && <span className="text-red-600 text-xs mt-2">{authError}</span>}
								</form>
							</div>
						)}
					</div>
				)}
			</div>
			{/* Commish-only transaction entry section */}
			{isAdmin && (
				<div className="mb-8 bg-white rounded-lg shadow-md p-6 border border-blue-200">
					<form
						className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-blue-50 p-4 rounded-lg"
						onSubmit={handleAddOrUpdateTransaction}
					>
						<div>
							<label className="block text-xs font-semibold mb-1 text-gray-700">Type</label>
							<select
								className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={transaction.type}
								onChange={e => {
									const newType = e.target.value;
									setTransaction(t => ({
										...t,
										type: newType,
										description: '',
										category: '',
										team: [],
									}));
								}}
								disabled={editingTransaction}
							>
								<option value="Fee">Fee</option>
								<option value="Payout">Payout</option>
							</select>
						</div>
						<div>
							<label className="block text-xs font-semibold mb-1 text-gray-700">Amount ($)</label>
							<input
								type="number"
								min="0"
								step="0.01"
								className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={transaction.amount}
								onChange={e => setTransaction(t => ({ ...t, amount: e.target.value }))}
								required
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold mb-1 text-gray-700">Category</label>
							<select
								className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={transaction.category}
								onChange={e => {
									const cat = e.target.value;
									let newTeam = transaction.team;
									let newDesc = transaction.description;
									
									if (cat === 'Trade Fee') {
										newTeam = [];
									}
									if (transaction.type === 'Payout' && cat.startsWith('Weekly') && transaction.week) {
										const idx = cat === 'Weekly 1st' ? 0 : 1;
										const topUserId = weeklyTopScorers[selectedYear]?.[transaction.week]?.[idx];
										if (topUserId) {
											newTeam = [topUserId];
											const matchups = historicalData.matchupsBySeason?.[selectedYear]?.filter(m => String(m.week) === String(transaction.week));
											let points = null;
											if (matchups) {
												for (const m of matchups) {
													if (historicalData.rostersBySeason?.[selectedYear]) {
														if (String(m.team1_roster_id) && historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team1_roster_id) && r.owner_id === topUserId)) {
															points = m.team1_score;
														}
														if (String(m.team2_roster_id) && historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team2_roster_id) && r.owner_id === topUserId)) {
															points = m.team2_score;
														}
													}
												}
											}
											if (points !== null && !isNaN(points)) {
												newDesc = `${cat} (${points.toFixed(2)} pts)`;
											}
										}
									}
                                    if (transaction.type === 'Payout' && cat.startsWith('Total Points')) {
                                        const leaders = totalPointsLeaders[selectedYear];
                                        let leaderIndex = -1;
                                        if (cat === 'Total Points 1st') leaderIndex = 0;
                                        if (cat === 'Total Points 2nd') leaderIndex = 1;
                                        if (cat === 'Total Points 3rd') leaderIndex = 2;
                                        if (leaders && leaders[leaderIndex]) {
                                            const leader = leaders[leaderIndex];
                                            newTeam = [leader.userId];
                                            newDesc = `${cat} (${leader.score.toFixed(2)} pts)`;
                                        }
                                    }
									setTransaction(t => ({ ...t, category: cat, team: newTeam, description: newDesc }));
								}}
								required
							>
								<option value="">Select...</option>
								{(transaction.type === 'Fee' ? FEE_DESCRIPTIONS : PAYOUT_DESCRIPTIONS).map(opt => (
									<option key={opt} value={opt}>{opt}</option>
								))}
							</select>
						</div>
						<div className="relative">
							<label className="block text-xs font-semibold mb-1 text-gray-700">Team(s)</label>
							<button
								type="button"
								onClick={() => setShowTeamDropdown(!showTeamDropdown)}
								className="w-full border rounded-lg px-2 py-2 text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
                                {transaction.team.length === allMembers.length ? 'All Teams' :
                                transaction.team.length > 3 ? `${allMembers.find(m => m.userId === transaction.team[0])?.displayName || 'Team'}, ${allMembers.find(m => m.userId === transaction.team[1])?.displayName || 'Team'}, ${allMembers.find(m => m.userId === transaction.team[2])?.displayName || 'Team'}... (+${transaction.team.length - 3} more)` :
								transaction.team.length > 0 ? transaction.team.map(id => allMembers.find(m => m.userId === id)?.displayName).join(', ') : 'Select Team(s)'}
							</button>
							{showTeamDropdown && (
								<div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
									<label key="all" className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer">
										<input
											type="checkbox"
											className="form-checkbox"
											checked={transaction.team.length === allMembers.length}
											onChange={e => {
												const isChecked = e.target.checked;
												// FIX: Ensure the entire transaction object is spread correctly before updating the team property.
												setTransaction(t => ({
													...t,
													team: isChecked ? allMembers.map(m => m.userId) : [],
												}));
											}}
										/>
										<span>All Teams</span>
									</label>
									{allMembers.map(m => (
										<label key={m.userId} className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer">
											<input
												type="checkbox"
												className="form-checkbox"
												checked={transaction.team.includes(m.userId)}
												onChange={e => {
													const isChecked = e.target.checked;
													// FIX: Ensure the entire transaction object is spread correctly before updating the team property.
													setTransaction(t => {
														const newTeams = isChecked
															? [...t.team, m.userId]
															: t.team.filter(id => id !== m.userId);
														return { ...t, team: newTeams };
													});
												}}
											/>
											<span>{m.displayName}</span>
										</label>
									))}
								</div>
							)}
						</div>
						{transaction.category === 'Waiver/FA Fee' && (
							<div>
								<label className="block text-xs font-semibold mb-1 text-gray-700">Quantity</label>
								<input
									type="number"
									min="1"
									step="1"
									className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									value={transaction.quantity}
									onChange={e => setTransaction(t => ({ ...t, quantity: parseInt(e.target.value) || 1 }))}
									required
								/>
							</div>
						)}
						<div>
							<label className="block text-xs font-semibold mb-1 text-gray-700">Description</label>
							<input
								type="text"
								className={`w-full border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${(transaction.type === 'Payout' && ((transaction.category.startsWith('Weekly') && transaction.week) || transaction.category.startsWith('Total Points'))) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
								value={transaction.description}
								onChange={e => {
									if (!(transaction.type === 'Payout' && ((transaction.category.startsWith('Weekly') && transaction.week) || transaction.category.startsWith('Total Points')))) {
										setTransaction(t => ({ ...t, description: e.target.value }));
									}
								}}
								placeholder="e.g. Paid for entry, Weekly winner, etc."
								required
								disabled={(transaction.type === 'Payout' && ((transaction.category.startsWith('Weekly') && transaction.week) || transaction.category.startsWith('Total Points')))}
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold mb-1 text-gray-700">Week #</label>
							<input
								type="number"
								min="0"
								className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={transaction.week}
								onChange={e => {
									const newWeek = e.target.value;
									let newTeam = transaction.team;
									let newDesc = transaction.description;
									if (!newWeek) {
										newTeam = [];
										newDesc = '';
									} else if (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && weeklyTopScorers[selectedYear]?.[newWeek]) {
										const idx = transaction.category === 'Weekly 1st' ? 0 : 1;
										const topUserId = weeklyTopScorers[selectedYear][newWeek][idx];
										if (topUserId) {
											newTeam = [topUserId];
											const matchups = historicalData.matchupsBySeason?.[selectedYear]?.filter(m => String(m.week) === String(newWeek));
											let points = null;
											if (matchups) {
												for (const m of matchups) {
													if (historicalData.rostersBySeason?.[selectedYear]) {
														if (String(m.team1_roster_id) && historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team1_roster_id) && r.owner_id === topUserId)) {
															points = m.team1_score;
														}
														if (String(m.team2_roster_id) && historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team2_roster_id) && r.owner_id === topUserId)) {
															points = m.team2_score;
														}
													}
												}
											}
											if (points !== null && !isNaN(points)) {
												newDesc = `${transaction.category} (${points.toFixed(2)} pts)`;
											}
										}
									}
									setTransaction(t => ({ ...t, week: newWeek, team: newTeam, description: newDesc }));
								}}
								placeholder="e.g. 1, 2, ..."
							/>
						</div>
						<div className="md:col-span-2 flex justify-end gap-2">
							{editingTransaction && (
								<button
									type="button"
									className="bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-500 transition duration-200"
									onClick={() => {
										setEditingTransaction(null);
										setTransaction({ type: 'Fee', amount: '', category: '', description: '', week: '', team: [], quantity: 1 });
										setTransactionMessage({ text: 'Cancelled edit.', type: 'info' });
									}}
								>
									Cancel
								</button>
							)}
							<button type="submit" className={`bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-200`}>
								{editingTransaction ? 'Update Transaction' : 'Submit Transaction'}
							</button>
						</div>
					</form>
					{transactionMessage.text && (
						<div className={`mt-4 p-3 rounded-lg text-sm font-medium ${transactionMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
							{transactionMessage.text}
						</div>
					)}
				</div>
			)}
			<div className="mb-10 bg-white rounded-lg shadow-md p-6 border border-gray-100">
				<h3 className="text-xl font-semibold text-blue-800">League Members & Dues</h3>
				<div className="overflow-x-auto">
					<table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
						<thead className="bg-blue-50">
							<tr>
								<th className="py-2 px-3 text-left">Member</th>
								<th className="py-2 px-3 text-center">Total Fees</th>
								<th className="py-2 px-3 text-center">Total Payouts</th>
								<th className="py-2 px-3 text-center">Net Total</th>
							</tr>
						</thead>
						<tbody>
							{allMembers.map(member => {
								const memberFees = currentYearData.transactions.filter(t => t.type === 'Fee' && (Array.isArray(t.team) ? t.team.includes(member.userId) : t.team === member.userId)).reduce((sum, t) => sum + Number(t.amount || 0), 0);
								const memberPayouts = currentYearData.transactions.filter(t => t.type === 'Payout' && (Array.isArray(t.team) ? t.team.includes(member.userId) : t.team === member.userId)).reduce((sum, t) => sum + Number(t.amount || 0), 0);
								const netTotal = memberPayouts - memberFees;
								const netColor = netTotal < 0 ? 'text-red-600' : 'text-green-600';
								return (
									<tr key={member.userId} className="even:bg-gray-50">
										<td className="py-2 px-3 font-semibold text-gray-800 whitespace-nowrap">{member.displayName}</td>
										<td className="py-2 px-3 text-center">${memberFees.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
										<td className="py-2 px-3 text-center">${memberPayouts.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
										<td className={`py-2 px-3 text-center font-bold ${netColor}`}>${netTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				{!isAdmin && (
					<div className="text-xs text-gray-500 mt-2">Login as commissioner to edit dues.</div>
				)}
			</div>
			
			<div className="mb-10 bg-white rounded-lg shadow-md p-6 border border-gray-100">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-blue-800">All Transactions ({selectedYear})</h3>
					<div className="flex gap-2">
						{isAdmin && (
							<button
								onClick={handleDeleteSelected}
								disabled={selectedTransactions.length === 0}
								className={`px-3 py-1 rounded-lg text-sm font-semibold transition duration-200 ${selectedTransactions.length > 0 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
							>
								Delete Selected ({selectedTransactions.length})
							</button>
						)}
						<button
							onClick={handleExport}
							className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-blue-600 transition duration-200"
						>
							Export to CSV
						</button>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<div>
						<label className="block text-xs font-semibold mb-1 text-gray-700">Filter by Type</label>
						<select
							className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							value={filters.type}
							onChange={e => {
								setFilters(f => ({ ...f, type: e.target.value }));
								setCurrentPage(1);
							}}
						>
							<option value="ALL">All Types</option>
							<option value="Fee">Fees</option>
							<option value="Payout">Payouts</option>
						</select>
					</div>
					<div>
						<label className="block text-xs font-semibold mb-1 text-gray-700">Filter by Team</label>
						<select
							className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							value={filters.team}
							onChange={e => {
								setFilters(f => ({ ...f, team: e.target.value }));
								setCurrentPage(1);
							}}
						>
							<option value="ALL">All Teams</option>
							{allMembers.map(m => (
								<option key={m.userId} value={m.userId}>{m.displayName}</option>
							))}
						</select>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
						<thead className="bg-blue-50">
							<tr>
								{isAdmin && <th className="py-2 px-3 text-center">
									<input 
										type="checkbox" 
										className="form-checkbox" 
										onChange={(e) => {
											if(e.target.checked) {
												setSelectedTransactions(paginatedTransactions);
											} else {
												setSelectedTransactions([]);
											}
										}}
										checked={allTransactionsSelected}
									/>
								</th>}
								<th className="py-2 px-3 text-left cursor-pointer hover:bg-blue-100" onClick={() => requestSort('date')}>
									<div className="flex items-center">
										Date
										{sortConfig.key === 'date' && (
											<span className="ml-1 text-gray-500">
												{sortConfig.direction === 'asc' ? '▲' : '▼'}
											</span>
										)}
									</div>
								</th>
								<th className="py-2 px-3 text-left cursor-pointer hover:bg-blue-100" onClick={() => requestSort('team')}>
									<div className="flex items-center">
										Team
										{sortConfig.key === 'team' && (
											<span className="ml-1 text-gray-500">
												{sortConfig.direction === 'asc' ? '▲' : '▼'}
											</span>
										)}
									</div>
								</th>
								<th className="py-2 px-3 text-center cursor-pointer hover:bg-blue-100" onClick={() => requestSort('type')}>
									<div className="flex items-center justify-center">
										Type
										{sortConfig.key === 'type' && (
											<span className="ml-1 text-gray-500">
												{sortConfig.direction === 'asc' ? '▲' : '▼'}
											</span>
										)}
									</div>
								</th>
								<th className="py-2 px-3 text-center cursor-pointer hover:bg-blue-100" onClick={() => requestSort('amount')}>
									<div className="flex items-center justify-center">
										Amount
										{sortConfig.key === 'amount' && (
											<span className="ml-1 text-gray-500">
												{sortConfig.direction === 'asc' ? '▲' : '▼'}
											</span>
										)}
									</div>
								</th>
								<th className="py-2 px-3 text-center cursor-pointer hover:bg-blue-100" onClick={() => requestSort('category')}>
									<div className="flex items-center justify-center">
										Category
										{sortConfig.key === 'category' && (
											<span className="ml-1 text-gray-500">
												{sortConfig.direction === 'asc' ? '▲' : '▼'}
											</span>
										)}
									</div>
								</th>
								<th className="py-2 px-3 text-center cursor-pointer hover:bg-blue-100" onClick={() => requestSort('description')}>
									<div className="flex items-center justify-center">
										Description
										{sortConfig.key === 'description' && (
											<span className="ml-1 text-gray-500">
												{sortConfig.direction === 'asc' ? '▲' : '▼'}
											</span>
										)}
									</div>
								</th>
								<th className="py-2 px-3 text-center cursor-pointer hover:bg-blue-100" onClick={() => requestSort('week')}>
									<div className="flex items-center justify-center">
										Week
										{sortConfig.key === 'week' && (
											<span className="ml-1 text-gray-500">
												{sortConfig.direction === 'asc' ? '▲' : '▼'}
											</span>
										)}
									</div>
								</th>
								{isAdmin && <th className="py-2 px-3 text-center">Actions</th>}
							</tr>
						</thead>
						<tbody>
							{paginatedTransactions.map((t) => {
								const displayDate = t.date ? (isNaN(new Date(t.date)) ? 'Invalid Date' : new Date(t.date).toLocaleString()) : '';
								return (
									// **FIX:** Use the unique 'id' as the key for React's rendering to prevent duplication.
									<tr key={t.id} className="even:bg-gray-50">
										{isAdmin && <td className="py-2 px-3 text-center">
											<input 
												type="checkbox" 
												className="form-checkbox" 
												// **FIX:** Use 'id' for comparison
												checked={selectedTransactions.some(selT => selT.id === t.id)}
												onChange={(e) => handleSelectTransaction(t, e.target.checked)}
											/>
										</td>}
										<td className="py-2 px-3 whitespace-nowrap">{displayDate}</td>
										<td className="py-2 px-3">
											{renderTeams(t.id, t.team, allMembers, expandedTransactionId, setExpandedTransactionId)}
										</td>
										<td className="py-2 px-3 text-center">{t.type}</td>
										<td className="py-2 px-3 text-center">${Number(t.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
										<td className="py-2 px-3 text-center">{t.category}</td>
										<td className="py-2 px-3 text-center">{t.description}</td>
										<td className="py-2 px-3 text-center">{t.week}</td>
										{isAdmin && (
											<td className="py-2 px-3 text-center">
												<div className="flex justify-center items-center gap-2">
													<button
														className="text-blue-600 hover:text-blue-800 font-bold text-lg"
														title="Edit transaction"
														onClick={() => handleEditTransaction(t)}
													>
														&#9998;
													</button>
													<button
														className="text-red-600 hover:text-red-800 font-bold text-lg"
														onClick={() => handleDeleteTransaction([t])}
													>
														&#10006;
													</button>
												</div>
											</td>
										)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<div className="flex justify-center items-center gap-2 mt-4">
					{Array.from({ length: totalPages }, (_, i) => (
						<button
							key={i}
							className={`px-3 py-1 rounded-lg transition duration-200 ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
							onClick={() => setCurrentPage(i + 1)}
							disabled={currentPage === i + 1}
						>
							{i + 1}
						</button>
					))}
				</div>
			</div>

			<div className="mb-10 bg-white rounded-lg shadow-md p-6 border border-gray-100">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-xl font-semibold text-red-800">Fees ({selectedYear})</h3>
					{isAdmin && (
						<button
							className={`rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold transition-transform duration-200 transform bg-blue-600 text-white hover:scale-110`}
							onClick={() => setShowPotentialForm('fees')}
							title="Add Fee"
						>
							+
						</button>
					)}
				</div>
				{currentYearData.potentialFees.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
							<thead className="bg-red-50">
								<tr>
									<th className="py-2 px-3 text-left">Description</th>
									<th className="py-2 px-3 text-center">Amount</th>
									{isAdmin && <th className="py-2 px-3 text-center">Actions</th>}
								</tr>
							</thead>
							<tbody>
								{currentYearData.potentialFees.map(item => (
									<tr key={item.id} className="even:bg-gray-50">
										<td className="py-2 px-3 font-semibold text-gray-800 whitespace-nowrap">{item.description}</td>
										<td className="py-2 px-3 text-center">${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
										{isAdmin && (
											<td className="py-2 px-3 text-center">
												<button
													className="text-red-600 hover:text-red-800 font-bold text-lg"
													onClick={() => handleDeletePotentialTransaction(item.id, 'fees')}
												>
													&#10006;
												</button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div className="text-center text-gray-500 py-4 italic">No fees for this year.</div>
				)}
			</div>

			<div className="mb-10 bg-white rounded-lg shadow-md p-6 border border-gray-100">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-xl font-semibold text-green-800">Payouts ({selectedYear})</h3>
					{isAdmin && (
						<button
							className={`rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold transition-transform duration-200 transform bg-blue-600 text-white hover:scale-110`}
							onClick={() => setShowPotentialForm('payouts')}
							title="Add Payout"
						>
							+
						</button>
					)}
				</div>
				{currentYearData.potentialPayouts.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
							<thead className="bg-green-50">
								<tr>
									<th className="py-2 px-3 text-left">Description</th>
									<th className="py-2 px-3 text-center">Amount</th>
									{isAdmin && <th className="py-2 px-3 text-center">Actions</th>}
								</tr>
							</thead>
							<tbody>
								{currentYearData.potentialPayouts.map(item => (
									<tr key={item.id} className="even:bg-gray-50">
										<td className="py-2 px-3 font-semibold text-gray-800 whitespace-nowrap">{item.description}</td>
										<td className="py-2 px-3 text-center">${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
										{isAdmin && (
											<td className="py-2 px-3 text-center">
												<button
													className="text-red-600 hover:text-red-800 font-bold text-lg"
													onClick={() => handleDeletePotentialTransaction(item.id, 'payouts')}
												>
													&#10006;
												</button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div className="text-center text-gray-500 py-4 italic">No payouts for this year.</div>
				)}
			</div>

			{showPotentialForm && (
				<div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-sm mx-auto">
						<h3 className="text-xl font-bold mb-4">Add {showPotentialForm === 'fees' ? 'Fee' : 'Payout'}</h3>
						<form onSubmit={(e) => handleAddPotentialTransaction(e, showPotentialForm)}>
							<div className="mb-4">
								<label className="block text-gray-700 text-sm font-bold mb-2">Description</label>
								<input
									type="text"
									className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
									value={potentialFormInput.description}
									onChange={(e) => setPotentialFormInput(p => ({ ...p, description: e.target.value }))}
									required
								/>
							</div>
							<div className="mb-4">
								<label className="block text-gray-700 text-sm font-bold mb-2">Amount ($)</label>
								<input
									type="number"
									min="0"
									step="0.01"
									className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
									value={potentialFormInput.amount}
									onChange={(e) => setPotentialFormInput(p => ({ ...p, amount: e.target.value }))}
									required
								/>
							</div>
							<div className="flex justify-end gap-2">
								<button
									type="button"
									className="bg-gray-400 text-white font-bold py-2 px-4 rounded hover:bg-gray-500 transition duration-200"
									onClick={() => {
										setShowPotentialForm(null);
										setPotentialFormInput({ description: '', amount: '' });
									}}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 transition duration-200"
								>
									Save
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default FinancialTracker;

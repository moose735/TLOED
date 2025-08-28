//src/components/FinancialTracker.js
import React, { useState, useMemo, useRef } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
	apiKey: 'AIzaSyDcuPXgRPIdX-NYblBqQkdXqrGiD6yobcA',
	authDomain: 'tloed-finance-tracker.firebaseapp.com',
	projectId: 'tloed-finance-tracker',
	storageBucket: 'tloed-finance-tracker.appspot.com',
	messagingSenderId: '220652845054',
	appId: '1:220652845054:web:2d2f498ce8158afa2cf2af',
	measurementId: 'G-0N3ZD0XNTC',
};

const COMMISH_UID = 'QzIJSZWBHgSzhmC6pOOiuJNxbI83';

// Initialize Firebase only once
if (!window._firebaseInitialized) {
	initializeApp(firebaseConfig);
	window._firebaseInitialized = true;
}
const db = getFirestore();

const DUE_TYPES = [
	{ key: 'entry', label: 'Entry Fee', help: 'Annual league buy-in' },
	{ key: 'trade', label: 'Trade Fee', help: 'Fee per trade' },
	{ key: 'waiver', label: 'Waiver/FA Fee', help: 'Fee per waiver/FA move' },
];

const FinancialTracker = () => {
	const { loading, error, usersData, historicalData } = useSleeperData();
	const [dues, setDues] = useState({}); // still editable, but not shown in table
	const [authUser, setAuthUser] = useState(null);
	const [login, setLogin] = useState({ email: '', password: '' });
	const [authError, setAuthError] = useState('');
	const [showTransactionForm, setShowTransactionForm] = useState(false);
	const [transaction, setTransaction] = useState({
		type: 'Fee',
		amount: '',
		category: '',
		description: '',
		week: '',
		team: 'ALL',
		team1: '',
		team2: ''
	});
	const [transactionMessage, setTransactionMessage] = useState({ text: '', type: '' });
	const [editingTransaction, setEditingTransaction] = useState(null); // State for editing

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

	// New state for transaction filters and sorting
	const [filters, setFilters] = useState({ type: 'ALL', team: 'ALL' });
	const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
	const [currentPage, setCurrentPage] = useState(1);
	const transactionsPerPage = 10;
	const [selectedTransactions, setSelectedTransactions] = useState([]); // State for multiselect delete

	const isAdmin = !!authUser && authUser.uid === COMMISH_UID;

	// Firebase Auth state listener
	React.useEffect(() => {
		const auth = getAuth();
		const unsub = auth.onAuthStateChanged(user => setAuthUser(user));
		return () => unsub();
	}, []);

	// Get all league members (owners)
	const allMembers = useMemo(() => {
		if (!usersData) return [];
		return usersData.map(u => ({
			userId: u.user_id,
			displayName: u.display_name || u.username || u.user_id,
		}));
	}, [usersData]);

	// Get all seasons
	const allSeasons = useMemo(() => Object.keys(historicalData?.rostersBySeason || {}).sort((a, b) => b - a), [historicalData]);
	// Year selection for per-year database
	const [selectedYear, setSelectedYear] = useState('');
	React.useEffect(() => {
		if (allSeasons.length > 0 && !selectedYear) setSelectedYear(allSeasons[0]);
	}, [allSeasons, selectedYear]);
	// Store transactions per year: { [year]: [ ...transactions ] }
	const [transactionsByYear, setTransactionsByYear] = useState({});
	const [firestoreLoading, setFirestoreLoading] = useState(true);
	const initialLoadRef = useRef(true);

	// Firestore: Real-time updates for all years on mount
	React.useEffect(() => {
		setFirestoreLoading(true);
		const docRef = doc(db, 'league_finances', 'main');
		const unsub = onSnapshot(docRef, (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setTransactionsByYear(data && data.transactionsByYear ? data.transactionsByYear : {});
			} else {
				setTransactionsByYear({});
			}
			setFirestoreLoading(false);
			initialLoadRef.current = false;
		}, (error) => {
			setTransactionsByYear({});
			setFirestoreLoading(false);
			initialLoadRef.current = false;
		});
		return () => unsub();
	}, []);

	// Firestore: Save transactionsByYear on change (not on initial load, only if admin)
	React.useEffect(() => {
		async function saveAllYears() {
			try {
				const docRef = doc(db, 'league_finances', 'main');
				await setDoc(docRef, { transactionsByYear }, { merge: true });
			} catch (e) {
				setTransactionMessage({ text: 'Error saving transaction.', type: 'error' });
			}
		}
		// Only save if not initial load, and there is at least one year and at least one transaction, and isAdmin
		if (!initialLoadRef.current && Object.keys(transactionsByYear).length > 0 && Object.values(transactionsByYear).some(arr => arr.length > 0) && isAdmin) {
			saveAllYears();
		}
	}, [transactionsByYear, isAdmin]);

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
				// Collect all scores for the week
				let scores = [];
				weekMatchups.forEach(m => {
					const team1 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === String(m.team1_roster_id));
					const team2 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === String(m.team2_roster_id));
					if (team1 && !isNaN(m.team1_score)) scores.push({ userId: team1.owner_id, score: m.team1_score });
					if (team2 && !isNaN(m.team2_score)) scores.push({ userId: team2.owner_id, score: m.team2_score });
				});
				// Sort and get top 2
				scores.sort((a, b) => b.score - a.score);
				const top2 = scores.slice(0, 2).map(s => s.userId);
				result[year][week] = top2;
			});
		});
		return result;
	}, [historicalData]);

	// Login form handler
	const handleLogin = async e => {
		e.preventDefault();
		setAuthError('');
		try {
			const auth = getAuth();
			await signInWithEmailAndPassword(auth, login.email, login.password);
		} catch (err) {
			setAuthError('Login failed. Please check your credentials.');
		}
	};

	// Logout handler
	const handleLogout = () => {
		const auth = getAuth();
		signOut(auth);
	};

	// Get transactions for selected year
	const transactions = transactionsByYear[selectedYear] || [];

	// Filter and sort transactions
	const filteredAndSortedTransactions = useMemo(() => {
		let filtered = transactions.filter(t => {
			const typeMatch = filters.type === 'ALL' || t.type === filters.type;
			const teamMatch = filters.team === 'ALL' || t.team === filters.team;
			return typeMatch && teamMatch;
		});

		if (sortConfig.key) {
			filtered.sort((a, b) => {
				let aValue = a[sortConfig.key];
				let bValue = b[sortConfig.key];
				// Custom sorting logic for different keys
				if (sortConfig.key === 'amount') {
					aValue = Number(aValue);
					bValue = Number(bValue);
				}
				if (sortConfig.key === 'date') {
					aValue = new Date(aValue);
					bValue = new Date(bValue);
				}
				if (sortConfig.key === 'team') {
					aValue = allMembers.find(m => m.userId === a.team)?.displayName || a.team;
					bValue = allMembers.find(m => m.userId === b.team)?.displayName || b.team;
				}
				
				if (aValue < bValue) {
					return sortConfig.direction === 'asc' ? -1 : 1;
				}
				if (aValue > bValue) {
					return sortConfig.direction === 'asc' ? 1 : -1;
				}
				return 0;
			});
		}
		
		return filtered;
	}, [transactions, filters, sortConfig, allMembers]);

	const requestSort = (key) => {
		let direction = 'asc';
		if (sortConfig.key === key && sortConfig.direction === 'asc') {
			direction = 'desc';
		}
		setSortConfig({ key, direction });
	};

	// Pagination
	const totalPages = Math.ceil(filteredAndSortedTransactions.length / transactionsPerPage);
	const paginatedTransactions = filteredAndSortedTransactions.slice((currentPage - 1) * transactionsPerPage, currentPage * transactionsPerPage);

	if (loading || firestoreLoading) return <div className="p-4 text-blue-600">Loading financial tracker...</div>;
	if (error) return <div className="p-4 text-red-600">Error loading data: {error.message}</div>;
	if (!usersData || !historicalData) return <div className="p-4 text-orange-600">No data available.</div>;

	// Calculate summary bubbles (per selected year)
	const totalFees = transactions.filter(t => t.type === 'Fee').reduce((sum, t) => sum + Number(t.amount || 0), 0);
	const totalPayouts = transactions.filter(t => t.type === 'Payout').reduce((sum, t) => sum + Number(t.amount || 0), 0);
	const leagueBank = totalFees - totalPayouts;

	// New function to handle CSV export
	const handleExport = () => {
		// Define columns for the CSV
		const columns = ["Date", "Team", "Type", "Amount", "Category", "Description", "Week"];
		// Map transactions to a CSV-friendly format
		const csvData = filteredAndSortedTransactions.map(t => [
			t.date ? new Date(t.date).toLocaleString() : '',
			allMembers.find(m => m.userId === t.team)?.displayName || t.team,
			t.type,
			Number(t.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}),
			t.category,
			t.description,
			t.week,
		]);

		// Create the CSV content string
		const csvContent = [
			columns.join(','), // Header row
			...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')) // Data rows with quotes to handle commas
		].join('\n');

		// Create a temporary link element to trigger the download
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
	const handleAddOrUpdateTransaction = (e) => {
		e.preventDefault();
		if (!isAdmin) return;

		setTransactionsByYear(prev => {
			const prevYearTx = prev[selectedYear] || [];
			let newTxs = [...prevYearTx];
			const now = new Date().toISOString();

			// If editing, find and replace the transaction
			if (editingTransaction) {
				const index = newTxs.findIndex(t => t.date === editingTransaction.date);
				if (index !== -1) {
					newTxs[index] = { ...transaction, date: editingTransaction.date }; // Keep original date
				}
				setEditingTransaction(null); // Exit edit mode
			} else {
				// If adding a new transaction
				if (transaction.category === 'Trade Fee') {
					// Add two separate transactions for a trade
					if (transaction.team1 && transaction.team2) {
						newTxs = [
							...newTxs,
							{ ...transaction, team: transaction.team1, date: now + '-1' },
							{ ...transaction, team: transaction.team2, date: now + '-2' }
						];
					}
				} else if (transaction.team === 'ALL') {
					// Add one transaction per team
					newTxs = [
						...newTxs,
						...allMembers.map((m, i) => ({ ...transaction, team: m.userId, date: now + '-' + i }))
					];
				} else {
					// Add a single transaction
					newTxs = [...newTxs, { ...transaction, date: now }];
				}
			}

			return { ...prev, [selectedYear]: newTxs };
		});

		// Reset form and clear messages
		setTransaction({ type: 'Fee', amount: '', category: '', description: '', week: '', team: 'ALL', team1: '', team2: '' });
		setTransactionMessage({ text: 'Transaction saved successfully!', type: 'success' });
		setShowTransactionForm(false);
	};

	// Handle editing a transaction
	const handleEditTransaction = (transactionToEdit) => {
		if (!isAdmin) return;
		setEditingTransaction(transactionToEdit);
		setTransaction({
			...transactionToEdit,
			team1: transactionToEdit.team, // Pre-fill team1 for editing single team transactions
			team2: '',
		});
		setShowTransactionForm(true);
		setTransactionMessage({ text: 'Editing transaction...', type: 'info' });
	};

	// Delete transaction handler (commish only)
	const handleDeleteTransaction = (transactionsToDelete) => {
		if (!isAdmin) return;
		
		setTransactionsByYear(prev => {
			const prevYearTx = prev[selectedYear] || [];
			const transactionDatesToDelete = new Set(transactionsToDelete.map(t => t.date));
			
			const newTxs = prevYearTx.filter(t => !transactionDatesToDelete.has(t.date));
			
			return { ...prev, [selectedYear]: newTxs };
		});
		setSelectedTransactions([]); // Clear selections
		setTransactionMessage({ text: 'Transaction(s) deleted successfully!', type: 'success' });
	};

	const handleSelectTransaction = (transaction, isChecked) => {
		if (isChecked) {
			setSelectedTransactions(prev => [...prev, transaction]);
		} else {
			setSelectedTransactions(prev => prev.filter(t => t.date !== transaction.date));
		}
	};
	
	const handleDeleteSelected = () => {
		if (selectedTransactions.length > 0) {
			handleDeleteTransaction(selectedTransactions);
		}
	};
	
	const allTransactionsSelected = selectedTransactions.length === paginatedTransactions.length && paginatedTransactions.length > 0;

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
							setCurrentPage(1); // Reset pagination on year change
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
				<div className="flex flex-col items-center bg-green-50 rounded-lg px-6 py-3 shadow-md text-green-800 min-w-[120px]">
					<span className="text-xs font-semibold uppercase tracking-wide">Total Fees</span>
					<span className="text-2xl font-bold">${totalFees.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
				</div>
				<div className="flex flex-col items-center bg-red-50 rounded-lg px-6 py-3 shadow-md text-red-800 min-w-[120px]">
					<span className="text-xs font-semibold uppercase tracking-wide">Total Payouts</span>
					<span className="text-2xl font-bold">${totalPayouts.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
				</div>
			</div>
			<div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
				<div>
					{authUser ? (
						<div className="flex items-center gap-3">
							<span className="text-green-700 font-semibold">Logged in as {authUser.email}</span>
							{isAdmin && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Commissioner</span>}
							<button onClick={handleLogout} className="ml-2 px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Logout</button>
						</div>
					) : (
						<form onSubmit={handleLogin} className="flex flex-col sm:flex-row gap-2 items-center">
							<input
								type="email"
								required
								placeholder="Commish Email"
								className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={login.email}
								onChange={e => setLogin(l => ({ ...l, email: e.target.value }))}
							/>
							<input
								type="password"
								required
								placeholder="Password"
								className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={login.password}
								onChange={e => setLogin(l => ({ ...l, password: e.target.value }))}
							/>
							<button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold transition duration-200">Login</button>
							{authError && <span className="text-red-600 text-xs ml-2">{authError}</span>}
						</form>
					)}
				</div>
			</div>

			{/* Commish-only transaction entry section */}
			<div className="mb-8 bg-white rounded-lg shadow-md p-6 border border-blue-200">
				<button
					className={`mb-4 px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 ${isAdmin ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
					onClick={() => isAdmin && setShowTransactionForm(v => !v)}
					disabled={!isAdmin}
				>
					{showTransactionForm ? 'Hide Transaction Entry' : 'Add Fee/Payout Transaction'}
				</button>
				{showTransactionForm && (
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
									if (!isAdmin) return;
									const newType = e.target.value;
									setTransaction(t => ({
										...t,
										type: newType,
										description: '',
										category: '',
										team: newType === 'Fee' ? 'ALL' : '',
										team1: '',
										team2: ''
									}));
								}}
								disabled={!isAdmin || editingTransaction}
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
								onChange={e => isAdmin && setTransaction(t => ({ ...t, amount: e.target.value }))}
								required
								disabled={!isAdmin}
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold mb-1 text-gray-700">Category</label>
							<select
								className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={transaction.category}
								onChange={e => {
									if (!isAdmin) return;
									const cat = e.target.value;
									let newTeam = transaction.team;
									let newDesc = transaction.description;
									let newTeam1 = transaction.team1;
									let newTeam2 = transaction.team2;

									// Reset team selections based on category type
									if (cat === 'Trade Fee') {
										newTeam = '';
										newTeam1 = '';
										newTeam2 = '';
									} else {
										newTeam1 = '';
										newTeam2 = '';
										if (transaction.type === 'Fee') {
											newTeam = 'ALL';
										} else {
											newTeam = '';
										}
									}

									// Auto-select team and description for weekly payouts
									if (transaction.type === 'Payout' && (cat === 'Weekly 1st' || cat === 'Weekly 2nd') && transaction.week && weeklyTopScorers[selectedYear]?.[transaction.week]) {
										const idx = cat === 'Weekly 1st' ? 0 : 1;
										const topUserId = weeklyTopScorers[selectedYear][transaction.week][idx];
										if (topUserId) {
											newTeam = topUserId;
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
									setTransaction(t => ({ ...t, category: cat, team: newTeam, description: newDesc, team1: newTeam1, team2: newTeam2 }));
								}}
								required
								disabled={!isAdmin}
							>
								<option value="">Select...</option>
								{(transaction.type === 'Fee' ? FEE_DESCRIPTIONS : PAYOUT_DESCRIPTIONS).map(opt => (
									<option key={opt} value={opt}>{opt}</option>
								))}
							</select>
						</div>
						{/* Conditional Team Boxes */}
						{transaction.category === 'Trade Fee' ? (
							<>
								<div>
									<label className="block text-xs font-semibold mb-1 text-gray-700">Team 1</label>
									<select
										className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
										value={transaction.team1}
										onChange={e => isAdmin && setTransaction(t => ({ ...t, team1: e.target.value }))}
										required
										disabled={!isAdmin}
									>
										<option value="">Select Team 1</option>
										{allMembers.map(m => (
											<option key={m.userId} value={m.userId}>{m.displayName}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs font-semibold mb-1 text-gray-700">Team 2</label>
									<select
										className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
										value={transaction.team2}
										onChange={e => isAdmin && setTransaction(t => ({ ...t, team2: e.target.value }))}
										required
										disabled={!isAdmin}
									>
										<option value="">Select Team 2</option>
										{allMembers.map(m => (
											<option key={m.userId} value={m.userId}>{m.displayName}</option>
										))}
									</select>
								</div>
							</>
						) : (
							<div>
								<label className="block text-xs font-semibold mb-1 text-gray-700">Team</label>
								<select
									className={`w-full border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isAdmin || (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && transaction.week) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
									value={transaction.team}
									onChange={e => isAdmin && setTransaction(t => ({ ...t, team: e.target.value }))}
									disabled={!isAdmin || (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && transaction.week) || editingTransaction}
									required
								>
									<option value="ALL">All Teams</option>
									{allMembers.map(m => (
										<option key={m.userId} value={m.userId}>{m.displayName}</option>
									))}
								</select>
							</div>
						)}
						<div>
							<label className="block text-xs font-semibold mb-1 text-gray-700">Description</label>
							<input
								type="text"
								className={`w-full border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isAdmin || (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && transaction.week) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
								value={transaction.description}
								onChange={e => {
									if (!isAdmin) return;
									if (!(transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && transaction.week)) {
										setTransaction(t => ({ ...t, description: e.target.value }));
									}
								}}
								placeholder="e.g. Paid for entry, Weekly winner, etc."
								required
								disabled={!isAdmin || (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && transaction.week)}
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
									if (!isAdmin) return;
									const newWeek = e.target.value;
									let newTeam = transaction.team;
									let newDesc = transaction.description;
									if (!newWeek) {
										newTeam = '';
										newDesc = '';
									} else if (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && weeklyTopScorers[selectedYear]?.[newWeek]) {
										const idx = transaction.category === 'Weekly 1st' ? 0 : 1;
										const topUserId = weeklyTopScorers[selectedYear][newWeek][idx];
										if (topUserId) {
											newTeam = topUserId;
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
								disabled={!isAdmin}
							/>
						</div>
						<div className="md:col-span-2 flex justify-end gap-2">
							{editingTransaction && (
								<button
									type="button"
									className="bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-500 transition duration-200"
									onClick={() => {
										setEditingTransaction(null);
										setTransaction({ type: 'Fee', amount: '', category: '', description: '', week: '', team: 'ALL', team1: '', team2: '' });
										setTransactionMessage({ text: 'Cancelled edit.', type: 'info' });
									}}
								>
									Cancel
								</button>
							)}
							<button type="submit" className={`bg-green-600 text-white px-6 py-2 rounded-lg font-semibold ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700 transition duration-200'}`} disabled={!isAdmin}>
								{editingTransaction ? 'Update Transaction' : 'Submit Transaction'}
							</button>
						</div>
					</form>
				)}
				{transactionMessage.text && (
					<div className={`mt-4 p-3 rounded-lg text-sm font-medium ${transactionMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
						{transactionMessage.text}
					</div>
				)}
			</div>

			{/* Member Dues & Transaction Table */}
			<div className="mb-10 bg-white rounded-lg shadow-md p-6 border border-gray-100">
				<h3 className="text-xl font-semibold mb-4 text-blue-800">League Members & Dues</h3>
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
								const memberFees = transactions.filter(t => t.type === 'Fee' && t.team === member.userId).reduce((sum, t) => sum + Number(t.amount || 0), 0);
								const memberPayouts = transactions.filter(t => t.type === 'Payout' && t.team === member.userId).reduce((sum, t) => sum + Number(t.amount || 0), 0);
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
			
			{/* All Transactions Table */}
			<div className="mb-10 bg-white rounded-lg shadow-md p-6 border border-gray-100">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-blue-800">All Transactions ({selectedYear})</h3>
					<div className="flex gap-2">
						<button
							onClick={handleDeleteSelected}
							disabled={selectedTransactions.length === 0}
							className={`px-3 py-1 rounded-lg text-sm font-semibold transition duration-200 ${selectedTransactions.length > 0 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
						>
							Delete Selected ({selectedTransactions.length})
						</button>
						<button
							onClick={handleExport}
							className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-blue-600 transition duration-200"
						>
							Export to CSV
						</button>
					</div>
				</div>

				{/* Filter controls for the transactions table */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<div>
						<label className="block text-xs font-semibold mb-1 text-gray-700">Filter by Type</label>
						<select
							className="w-full border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							value={filters.type}
							onChange={e => {
								setFilters(f => ({ ...f, type: e.target.value }));
								setCurrentPage(1); // Reset pagination
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
								setCurrentPage(1); // Reset pagination
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
								<th className="py-2 px-3 text-center">
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
								</th>
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
								const teamName = allMembers.find(m => m.userId === t.team)?.displayName || t.team;
								return (
									<tr key={t.date} className="even:bg-gray-50">
										<td className="py-2 px-3 text-center">
											<input 
												type="checkbox" 
												className="form-checkbox"
												checked={selectedTransactions.some(selT => selT.date === t.date)}
												onChange={(e) => handleSelectTransaction(t, e.target.checked)}
											/>
										</td>
										<td className="py-2 px-3 whitespace-nowrap">{t.date ? new Date(t.date).toLocaleString() : ''}</td>
										<td className="py-2 px-3 whitespace-nowrap">{teamName}</td>
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
														title="Delete transaction"
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
				{/* Pagination controls */}
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
		</div>
	);
};

export default FinancialTracker;

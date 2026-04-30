// src/components/FinancialTracker.js
import React, { useState, useMemo, useRef, useEffect } from 'react';
import logger from '../utils/logger';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getTransactionTotal } from '../utils/financialCalculations';
import { formatScore } from '../utils/formatUtils';
import { generateTransactionCountsFromSleeper, createTransactionCountSummary, createWeeklyTransactionReport } from '../utils/transactionIntegration';
import { fetchLeagueData, fetchRostersWithDetails } from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config';

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

// ── Shared dark style tokens ──────────────────────────────────────────────────
const card  = "bg-gray-800 border border-white/10 rounded-xl";
const cardSm = "bg-white/[0.03] border border-white/8 rounded-xl";
const input = "w-full bg-gray-900 border border-white/15 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-600";
const select = "w-full bg-gray-900 border border-white/15 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
const btnPrimary  = "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors";
const btnDanger   = "px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors";
const btnGhost    = "px-4 py-2 bg-white/8 hover:bg-white/12 text-gray-300 text-sm font-semibold rounded-lg border border-white/10 transition-colors";
const btnSuccess  = "px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors";
const thCell      = "py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider";
const thCellC     = "py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider";
const tdCell      = "py-2.5 px-3 text-sm text-gray-300";
const tdCellC     = "py-2.5 px-3 text-sm text-gray-300 text-center";

const FinancialTracker = () => {
	const { loading, error, usersData, historicalData } = useSleeperData();
	const [authUser, setAuthUser] = useState(null);
	const [db, setDb] = useState(null);
	const [auth, setAuth] = useState(null);
	const [login, setLogin] = useState({ email: '', password: '' });
	const [authError, setAuthError] = useState('');
	const [showCommishLogin, setShowCommishLogin] = useState(false);
	const [transaction, setTransaction] = useState({ type: 'Fee', amount: '', category: '', description: '', week: '', team: [], quantity: '' });
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
	const [importStatus, setImportStatus] = useState({ loading: false, message: '', type: '' });
	const [showImportPreview, setShowImportPreview] = useState(false);
	const [previewData, setPreviewData] = useState(null);
	const importRequestId = useRef(0);
	const [showBulkEntry, setShowBulkEntry] = useState(false);
	const [bulkTransactions, setBulkTransactions] = useState([{ id: Date.now(), type: 'Fee', amount: '', category: '', description: '', week: '', teams: [], quantity: '' }]);
	const [bulkDefaults, setBulkDefaults] = useState({ type: 'Fee', category: '', week: '', quantity: '', description: '', amount: '' });
	const [currentYearData, setCurrentYearData] = useState({ transactions: [], potentialFees: [], potentialPayouts: [] });
	const [firestoreLoading, setFirestoreLoading] = useState(true);
	const [expandedTransactionId, setExpandedTransactionId] = useState(null);

	const FEE_DESCRIPTIONS = ['Entry Fee', 'Trade Fee', 'Waiver/FA Fee', 'Other'];
	const PAYOUT_DESCRIPTIONS = ['Weekly 1st', 'Weekly 2nd', 'Playoff 1st', 'Playoff 2nd', 'Playoff 3rd', 'Total Points 1st', 'Total Points 2nd', 'Total Points 3rd', 'Bonus', 'Other'];
	const isAdmin = !!authUser && authUser.uid === COMMISH_UID;

	const allMembers = usersData ? usersData.map(u => ({ userId: u.user_id, displayName: u.display_name || u.username || u.user_id })) : [];
	const allSeasons = Object.keys(historicalData?.rostersBySeason || {}).sort((a, b) => b - a);

	// ── All logic untouched ───────────────────────────────────────────────────
	const weeklyTopScorers = useMemo(() => {
		const result = {};
		if (!historicalData) return result;
		Object.entries(historicalData.matchupsBySeason || {}).forEach(([year, matchups]) => {
			const byWeek = {};
			matchups.forEach(m => { if (!m.week) return; if (!byWeek[m.week]) byWeek[m.week] = []; byWeek[m.week].push(m); });
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
				result[year][week] = scores.slice(0, 2).map(s => s.userId);
			});
		});
		return result;
	}, [historicalData]);

	const totalPointsLeaders = useMemo(() => {
		const result = {};
		if (!historicalData?.matchupsBySeason || !historicalData?.rostersBySeason) return result;
		Object.keys(historicalData.matchupsBySeason).forEach(year => {
			const teamScores = {};
			const rosters = historicalData.rostersBySeason[year];
			if (!rosters) return;
			rosters.forEach(roster => { if (roster.owner_id) teamScores[roster.owner_id] = 0; });
			historicalData.matchupsBySeason[year].forEach(matchup => {
				const r1 = rosters.find(r => String(r.roster_id) === String(matchup.team1_roster_id));
				if (r1?.owner_id && !isNaN(matchup.team1_score)) teamScores[r1.owner_id] += matchup.team1_score;
				const r2 = rosters.find(r => String(r.roster_id) === String(matchup.team2_roster_id));
				if (r2?.owner_id && !isNaN(matchup.team2_score)) teamScores[r2.owner_id] += matchup.team2_score;
			});
			result[year] = Object.entries(teamScores).map(([userId, score]) => ({ userId, score })).sort((a, b) => b.score - a.score);
		});
		return result;
	}, [historicalData]);

	const sortData = (data, key, direction, allMembers) => {
		return [...data].sort((a, b) => {
			let aValue = a[key], bValue = b[key];
			if (key === 'amount') { aValue = Number(aValue); bValue = Number(bValue); }
			else if (key === 'date') { aValue = new Date(aValue); bValue = new Date(bValue); }
			else if (key === 'team') {
				const getName = id => allMembers.find(m => m.userId === id)?.displayName || id;
				aValue = Array.isArray(a.team) ? a.team.map(getName).join(', ') : getName(a.team);
				bValue = Array.isArray(b.team) ? b.team.map(getName).join(', ') : getName(b.team);
			}
			if (aValue < bValue) return direction === 'asc' ? -1 : 1;
			if (aValue > bValue) return direction === 'asc' ? 1 : -1;
			return 0;
		});
	};

	const filteredAndSortedTransactions = useMemo(() => {
		let filtered = currentYearData.transactions.filter(t => {
			const typeMatch = filters.type === 'ALL' || t.type === filters.type;
			const teamMatch = filters.team === 'ALL' || (Array.isArray(t.team) ? t.team.includes(filters.team) : t.team === filters.team);
			return typeMatch && teamMatch;
		});
		if (sortConfig.key) filtered = sortData(filtered, sortConfig.key, sortConfig.direction, allMembers);
		return filtered;
	}, [currentYearData, filters, sortConfig, allMembers]);

	const totalPages = Math.ceil(filteredAndSortedTransactions.length / transactionsPerPage);
	const paginatedTransactions = filteredAndSortedTransactions.slice((currentPage - 1) * transactionsPerPage, currentPage * transactionsPerPage);

	useEffect(() => {
		if (!window.firebaseApp) window.firebaseApp = initializeApp(firebaseConfig);
		const app = window.firebaseApp;
		const authInstance = getAuth(app);
		const dbInstance = getFirestore(app);
		setAuth(authInstance);
		setDb(dbInstance);
		const unsubAuth = onAuthStateChanged(authInstance, user => setAuthUser(user));
		return () => unsubAuth();
	}, []);

	useEffect(() => { if (allSeasons.length > 0 && !selectedYear) setSelectedYear(allSeasons[0]); }, [allSeasons, selectedYear]);

	useEffect(() => {
		if (!selectedYear || !db) return;
		setFirestoreLoading(true);
		const yearKey = String(selectedYear);
		const docRef = doc(db, 'league_finances', yearKey);
		(async () => {
			try {
				const snap = await getDoc(docRef);
				if (snap?.exists()) { const data = snap.data(); setCurrentYearData(data?.transactions ? data : { transactions: [], potentialFees: [], potentialPayouts: [] }); }
				else setCurrentYearData({ transactions: [], potentialFees: [], potentialPayouts: [] });
			} catch (e) { logger.error('Error doing initial getDoc:', e); }
		})();
		const unsub = onSnapshot(docRef, (docSnap) => {
			if (docSnap.exists()) { const data = docSnap.data(); setCurrentYearData(data?.transactions ? data : { transactions: [], potentialFees: [], potentialPayouts: [] }); }
			else setCurrentYearData({ transactions: [], potentialFees: [], potentialPayouts: [] });
			setFirestoreLoading(false);
		}, (err) => { logger.error("Error fetching Firestore data:", err); setFirestoreLoading(false); });
		return () => unsub();
	}, [selectedYear, db]);

	useEffect(() => { importRequestId.current += 1; setPreviewData(null); setShowImportPreview(false); setImportStatus({ loading: false, message: '', type: '' }); }, [selectedYear]);

	const transactionBank = currentYearData.transactions.filter(t => t.type === 'Fee' && (t.category === 'Trade Fee' || t.category === 'Waiver/FA Fee')).reduce((sum, t) => sum + getTransactionTotal(t), 0);
	const totalFees = currentYearData.transactions.filter(t => t.type === 'Fee').reduce((sum, t) => sum + getTransactionTotal(t), 0);
	const totalPayouts = currentYearData.transactions.filter(t => t.type === 'Payout').reduce((sum, t) => sum + Number(t.amount || 0), 0);
	const leagueBank = totalFees - totalPayouts;

	if (loading || firestoreLoading) return (
		<div className="flex items-center justify-center py-16">
			<div className="flex flex-col items-center gap-3">
				<svg className="animate-spin h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
				</svg>
				<p className="text-sm text-gray-400 animate-pulse">Loading financial tracker…</p>
			</div>
		</div>
	);
	if (error) return <div className="p-4 text-red-400 text-sm">Error loading data: {error.message}</div>;
	if (!usersData || !historicalData) return <div className="p-4 text-orange-400 text-sm">No data available.</div>;

	// ── All handlers untouched ────────────────────────────────────────────────
	const handleLogin = async e => {
		e.preventDefault();
		if (!auth) return;
		setAuthError('');
		try { await signInWithEmailAndPassword(auth, login.email, login.password); }
		catch (err) { setAuthError('Login failed. Please check your credentials.'); }
	};
	const handleLogout = () => { if (!auth) return; signOut(auth); };
	const requestSort = (key) => { let direction = 'asc'; if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
	const handleExport = () => {
		const columns = ["Date", "Team", "Type", "Amount", "Category", "Description", "Week", "Quantity"];
		const csvData = filteredAndSortedTransactions.map(t => {
			const teamNames = Array.isArray(t.team) ? t.team.map(id => allMembers.find(m => m.userId === id)?.displayName || id).join(', ') : allMembers.find(m => m.userId === t.team)?.displayName || t.team;
			const displayDate = t.date ? (isNaN(new Date(t.date)) ? 'Invalid Date' : new Date(t.date).toLocaleString()) : '';
			return [displayDate, teamNames, t.type, Number(t.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}), t.category, t.description, t.week, t.quantity || 1];
		});
		const csvContent = [columns.join(','), ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.setAttribute("href", url); link.setAttribute("download", `league_finances_${selectedYear}.csv`); link.style.visibility = 'hidden';
		document.body.appendChild(link); link.click(); document.body.removeChild(link);
	};
	const handleAddOrUpdateTransaction = async (e) => {
		e.preventDefault();
		if (!isAdmin || !db) return;
		if (transaction.team.length === 0) { setTransactionMessage({ text: 'Please select at least one team.', type: 'error' }); return; }
		let newTransactions, messageText;
		if (editingTransaction) {
			newTransactions = currentYearData.transactions.map(t => t.id === editingTransaction.id ? { ...transaction, id: editingTransaction.id, date: new Date().toISOString(), quantity: Number(transaction.quantity) || 1 } : t);
			messageText = 'Transaction updated successfully!'; setEditingTransaction(null);
		} else {
			const transactionsToAdd = [];
			if (transaction.category === 'Entry Fee') {
				transaction.team.forEach(teamId => { transactionsToAdd.push({ ...transaction, id: crypto.randomUUID(), quantity: 1, team: [teamId], date: new Date().toISOString() }); });
			} else {
				transactionsToAdd.push({ ...transaction, id: crypto.randomUUID(), team: transaction.team, quantity: Number(transaction.quantity) || 1, date: new Date().toISOString() });
			}
			newTransactions = [...currentYearData.transactions, ...transactionsToAdd];
			messageText = 'Transaction saved successfully!';
		}
		try {
			const docRef = doc(db, 'league_finances', String(selectedYear));
			await setDoc(docRef, { ...currentYearData, transactions: newTransactions }, { merge: true });
			setTransactionMessage({ text: messageText, type: 'success' });
		} catch (e) { logger.error("Error saving transaction: ", e); setTransactionMessage({ text: 'Error saving transaction.', type: 'error' }); }
		setTimeout(() => setTransactionMessage({ text: '', type: '' }), 3000);
		setShowTeamDropdown(false);
	};
	const handleEditTransaction = (t) => {
		if (!isAdmin) return;
		setEditingTransaction(t);
		setTransaction({ ...t, team: Array.isArray(t.team) ? t.team : [t.team], quantity: typeof t.quantity !== 'undefined' && t.quantity !== null ? String(t.quantity) : '' });
		setTransactionMessage({ text: 'Editing transaction...', type: 'info' });
	};
	const handleDeleteTransaction = async (transactionsToDelete) => {
		if (!isAdmin || !db) return;
		const idsToDelete = new Set(transactionsToDelete.map(t => t.id));
		const newTransactions = currentYearData.transactions.filter(t => !idsToDelete.has(t.id));
		try {
			const docRef = doc(db, 'league_finances', String(selectedYear));
			await setDoc(docRef, { ...currentYearData, transactions: newTransactions }, { merge: true });
			setTransactionMessage({ text: 'Transaction(s) deleted successfully!', type: 'success' });
		} catch (e) { logger.error("Error deleting transaction: ", e); setTransactionMessage({ text: 'Error deleting transaction.', type: 'error' }); }
		setSelectedTransactions([]);
	};
	const handleSelectTransaction = (t, isChecked) => { if (isChecked) setSelectedTransactions(prev => [...prev, t]); else setSelectedTransactions(prev => prev.filter(x => x.id !== t.id)); };
	const handleDeleteSelected = () => { if (selectedTransactions.length > 0) handleDeleteTransaction(selectedTransactions); };
	const allTransactionsSelected = selectedTransactions.length > 0 && selectedTransactions.length === paginatedTransactions.length;
	const handleAddPotentialTransaction = async (e, type) => {
		e.preventDefault();
		if (!isAdmin || !db) return;
		const newPotentialTx = { id: new Date().toISOString(), ...potentialFormInput };
		const newArr = type === 'fees' ? [...currentYearData.potentialFees, newPotentialTx] : [...currentYearData.potentialPayouts, newPotentialTx];
		try {
			const docRef = doc(db, 'league_finances', String(selectedYear));
			await setDoc(docRef, { ...currentYearData, [type === 'fees' ? 'potentialFees' : 'potentialPayouts']: newArr }, { merge: true });
			setTransactionMessage({ text: `Potential ${type.slice(0, -1)} added successfully!`, type: 'success' });
		} catch (e) { logger.error("Error saving potential transaction: ", e); setTransactionMessage({ text: `Error saving potential ${type.slice(0, -1)}.`, type: 'error' }); }
		setShowPotentialForm(null); setPotentialFormInput({ description: '', amount: '' });
	};
	const handleDeletePotentialTransaction = async (id, type) => {
		if (!isAdmin || !db) return;
		const newArr = currentYearData[type === 'fees' ? 'potentialFees' : 'potentialPayouts'].filter(t => t.id !== id);
		try {
			const docRef = doc(db, 'league_finances', String(selectedYear));
			await setDoc(docRef, { ...currentYearData, [type === 'fees' ? 'potentialFees' : 'potentialPayouts']: newArr }, { merge: true });
			setTransactionMessage({ text: `Potential ${type.slice(0, -1)} deleted successfully!`, type: 'success' });
		} catch (e) { logger.error("Error deleting potential transaction: ", e); setTransactionMessage({ text: `Error deleting potential ${type.slice(0, -1)}.`, type: 'error' }); }
	};
	const handleImportFromSleeper = async () => {
		if (!isAdmin || !selectedYear) { setImportStatus({ message: 'Please select a year and ensure you are logged in as admin', type: 'error' }); return; }
		const myRequestId = ++importRequestId.current;
		setImportStatus({ loading: true, message: 'Analyzing Sleeper transactions...', type: 'info' });
		try {
			const yearKey = String(selectedYear);
			let leagueIdToUse = historicalData?.leaguesMetadataBySeason?.[yearKey]?.league_id || historicalData?.leaguesMetadataBySeason?.[yearKey]?.leagueId || historicalData?.leaguesMetadataBySeason?.[yearKey]?.id || null;
			if (!leagueIdToUse) {
				try {
					const chain = await fetchLeagueData(CURRENT_LEAGUE_ID);
					if (Array.isArray(chain) && chain.length > 0) {
						const matched = chain.find(l => String(l.season || l.settings?.season || l.year) === yearKey || String(l.league_id || l.id || l.leagueId) === yearKey);
						if (matched) leagueIdToUse = matched.league_id || matched.id || matched.leagueId || null;
					}
				} catch (e) { logger.error('Error fetching league chain:', e); }
			}
			if (!leagueIdToUse) { setImportStatus({ message: 'You need previous league IDs to analyze that season.', type: 'error' }); setImportStatus(prev => ({ ...prev, loading: false })); return; }
			let rostersData = historicalData?.rostersBySeason?.[yearKey];
			if (!rostersData || !Array.isArray(rostersData) || rostersData.length === 0) {
				try { rostersData = await fetchRostersWithDetails(leagueIdToUse); }
				catch (e) { logger.error('Error fetching rosters:', e); setImportStatus({ message: `Failed to fetch roster data for ${selectedYear}`, type: 'error' }); return; }
			}
			const result = await generateTransactionCountsFromSleeper(leagueIdToUse, rostersData);
			if (myRequestId !== importRequestId.current) { logger.debug('Stale import response ignored'); return; }
			const summary = createTransactionCountSummary(result.counts, usersData);
			const weeklyReport = createWeeklyTransactionReport(result.counts, usersData);
			setPreviewData({ counts: result.counts, summary, weeklyReport, rawResult: result });
			setShowImportPreview(true);
			setImportStatus({ message: `Found ${result.summary.totalTrades} trades, ${result.summary.totalWaivers} waivers, ${result.summary.totalFreeAgents} FA pickups`, type: 'success' });
		} catch (error) { logger.error('Error importing transactions:', error); setImportStatus({ message: `Import failed: ${error.message}`, type: 'error' }); }
	};
	const addBulkTransaction = () => { setBulkTransactions(prev => [...prev, { id: Date.now() + Math.random(), type: 'Fee', amount: '', category: '', description: '', week: '', teams: [], quantity: 1 }]); };
	const applyBulkDefaultsToAll = () => { setBulkTransactions(prev => prev.map(t => ({ ...t, type: bulkDefaults.type || t.type, category: bulkDefaults.category || t.category, week: bulkDefaults.week || t.week, quantity: bulkDefaults.quantity || t.quantity, description: bulkDefaults.description || t.description, amount: bulkDefaults.amount || t.amount }))); };
	const removeBulkTransaction = (id) => { setBulkTransactions(prev => prev.filter(t => t.id !== id)); };
	const updateBulkTransaction = (id, field, value) => {
		setBulkTransactions(prev => prev.map(t => {
			if (t.id !== id) return t;
			let updated = { ...t, [field]: value };
			if (field === 'category' || field === 'week' || field === 'type') {
				const week = field === 'week' ? value : t.week;
				const category = field === 'category' ? value : t.category;
				const type = field === 'type' ? value : t.type;
				if (week && type === 'Payout' && (category === 'Weekly 1st' || category === 'Weekly 2nd') && weeklyTopScorers[selectedYear]?.[week]) {
					const idx = category === 'Weekly 1st' ? 0 : 1;
					const topUserId = weeklyTopScorers[selectedYear][week][idx];
					if (topUserId) {
						updated.teams = [topUserId];
						const matchups = historicalData.matchupsBySeason?.[selectedYear]?.filter(m => String(m.week) === String(week));
						let points = null;
						if (matchups) { for (const m of matchups) { if (historicalData.rostersBySeason?.[selectedYear]) { if (historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team1_roster_id) && r.owner_id === topUserId)) points = m.team1_score; if (historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team2_roster_id) && r.owner_id === topUserId)) points = m.team2_score; } } }
						if (points !== null && !isNaN(points)) updated.description = `${category} (${formatScore(Number(points ?? 0), 2)} pts)`;
					}
				}
				if (type === 'Payout' && category?.startsWith('Total Points')) {
					const leaders = totalPointsLeaders[selectedYear];
					let leaderIndex = -1;
					if (category === 'Total Points 1st') leaderIndex = 0;
					if (category === 'Total Points 2nd') leaderIndex = 1;
					if (category === 'Total Points 3rd') leaderIndex = 2;
					if (leaders?.[leaderIndex]) { const leader = leaders[leaderIndex]; updated.teams = [leader.userId]; updated.description = `${category} (${formatScore(Number(leader.score ?? 0), 2)} pts)`; }
				}
				if (type === 'Payout' && category && !category.startsWith('Weekly') && !category.startsWith('Total Points') && field === 'category') { updated.teams = []; updated.description = ''; }
				if (type === 'Fee' && field === 'type') { updated.teams = []; updated.description = ''; }
			}
			return updated;
		}));
	};
	const submitBulkTransactions = async (e) => {
		e.preventDefault();
		if (!isAdmin || !db) return;
		const validTransactions = bulkTransactions.filter(t => t.amount && t.category && t.teams.length > 0);
		if (validTransactions.length === 0) { setTransactionMessage({ text: 'Please fill out at least one complete transaction.', type: 'error' }); return; }
		try {
			const docRef = doc(db, 'league_finances', String(selectedYear));
			const newTransactions = validTransactions.map(bt => ({ id: `${Date.now()}_${Math.random()}`, type: bt.type, amount: Number(bt.amount), category: bt.category, description: bt.description, week: bt.week, team: bt.teams, quantity: Number(bt.quantity) || 1, date: new Date().toISOString().split('T')[0] }));
			await setDoc(docRef, { ...currentYearData, transactions: [...currentYearData.transactions, ...newTransactions] }, { merge: true });
			setTransactionMessage({ text: `Successfully added ${newTransactions.length} transactions!`, type: 'success' });
			setBulkTransactions([{ id: Date.now(), type: 'Fee', amount: '', category: '', description: '', week: '', teams: [], quantity: 1 }]);
		} catch (error) { logger.error('Error adding bulk transactions:', error); setTransactionMessage({ text: 'Error adding transactions.', type: 'error' }); }
	};
	const renderTeams = (transactionId, teams, allMembers, expandedId, setExpandedId) => {
		const teamNames = Array.isArray(teams) ? teams.map(id => allMembers.find(m => m.userId === id)?.displayName || id) : [allMembers.find(m => m.userId === teams)?.displayName || teams];
		if (teamNames.length > 3 && expandedId !== transactionId) {
			return (<div className="flex flex-col items-start"><span>{teamNames.slice(0, 3).join(', ')} ...</span><button onClick={() => setExpandedId(transactionId)} className="text-blue-400 hover:text-blue-300 text-xs mt-1">(+{teamNames.length - 3} more)</button></div>);
		}
		return (<div className="flex flex-col items-start"><span>{teamNames.join(', ')}</span>{teamNames.length > 3 && <button onClick={() => setExpandedId(null)} className="text-gray-500 hover:text-gray-300 text-xs mt-1">Show less</button>}</div>);
	};

	const fmtUSD = (n) => `$${n.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
	const SortArrow = ({col}) => sortConfig.key === col ? <span className="ml-1 text-gray-500">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span> : null;

	const msgBg = (type) => { if (type === 'success') return 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300'; if (type === 'error') return 'bg-red-500/15 border border-red-500/25 text-red-300'; return 'bg-blue-500/15 border border-blue-500/25 text-blue-300'; };

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="p-3 sm:p-5 space-y-5 max-w-6xl mx-auto">

			{/* Page header */}
			<div className="flex items-center gap-2 px-1">
				<div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
					<svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<h1 className="text-base font-bold text-white">League Financial Tracker</h1>
			</div>

			{/* Year + Summary row */}
			<div className="flex flex-wrap items-center gap-3">
				<select className={`${select} w-auto flex-shrink-0`} value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setCurrentPage(1); }}>
					{allSeasons.map(y => <option key={y} value={y}>{y}</option>)}
				</select>
				{/* Summary bubbles */}
				<div className="flex flex-wrap gap-2 flex-1">
					{[
						{ label: 'League Bank',      value: leagueBank,      color: 'blue' },
						{ label: 'Total Fees',        value: totalFees,        color: 'red' },
						{ label: 'Total Payouts',     value: totalPayouts,     color: 'emerald' },
						{ label: 'Transaction Bank',  value: transactionBank,  color: 'yellow' },
					].map(({ label, value, color }) => {
						const colors = { blue: 'bg-blue-500/15 border-blue-500/25 text-blue-300', red: 'bg-red-500/15 border-red-500/25 text-red-300', emerald: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300', yellow: 'bg-yellow-500/15 border-yellow-500/25 text-yellow-300' };
						return (
							<div key={label} className={`flex flex-col items-center px-4 py-2 rounded-lg border ${colors[color]} min-w-[110px]`}>
								<span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</span>
								<span className="text-lg font-bold tabular-nums">{fmtUSD(value)}</span>
							</div>
						);
					})}
				</div>
			</div>

			{/* Auth section */}
			<div className={`${card} p-4`}>
				{authUser ? (
					<div className="flex items-center gap-3 flex-wrap">
						<span className="text-sm text-emerald-400 font-medium">Logged in as {authUser.email}</span>
						{isAdmin && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">Commissioner</span>}
						<button onClick={handleLogout} className={`${btnGhost} ml-auto`}>Logout</button>
					</div>
				) : (
					<div className="space-y-3">
						<button onClick={() => setShowCommishLogin(!showCommishLogin)} className={`${btnPrimary} flex items-center gap-2 w-full justify-center`}>
							Commissioner Login
							<svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showCommishLogin ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>
						{showCommishLogin && (
							<form onSubmit={handleLogin} className="space-y-3 max-w-sm mx-auto">
								<input type="email" required placeholder="Commish Email" className={input} value={login.email} onChange={e => setLogin(l => ({ ...l, email: e.target.value }))} />
								<input type="password" required placeholder="Password" className={input} value={login.password} onChange={e => setLogin(l => ({ ...l, password: e.target.value }))} />
								<button type="submit" className={`${btnPrimary} w-full`}>Log In</button>
								{authError && <p className="text-xs text-red-400">{authError}</p>}
							</form>
						)}
					</div>
				)}
			</div>

			{/* Commish transaction entry */}
			{isAdmin && (
				<div className={`${card} p-4 space-y-4`}>
					<div className="flex gap-2">
						{['Single Entry', 'Bulk Entry'].map((label, i) => (
							<button key={label} onClick={() => setShowBulkEntry(i === 1)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${(i === 1) === showBulkEntry ? 'bg-blue-600 text-white' : 'bg-white/8 text-gray-400 hover:text-gray-200 border border-white/10'}`}>{label}</button>
						))}
					</div>

					{!showBulkEntry ? (
						/* Single entry form */
						<form onSubmit={handleAddOrUpdateTransaction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Type</label>
								<select className={select} value={transaction.type} onChange={e => setTransaction(t => ({ ...t, type: e.target.value, description: '', category: '', team: [] }))} disabled={!!editingTransaction}>
									<option value="Fee">Fee</option>
									<option value="Payout">Payout</option>
								</select>
							</div>
							<div>
								<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Amount ($)</label>
								<input type="number" min="0" step="0.01" className={input} value={transaction.amount} onChange={e => setTransaction(t => ({ ...t, amount: e.target.value }))} required />
							</div>
							<div>
								<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</label>
								<select className={select} value={transaction.category} onChange={e => {
									const cat = e.target.value; let newTeam = transaction.team, newDesc = transaction.description;
									if (cat === 'Trade Fee') newTeam = [];
									if (transaction.type === 'Payout' && cat.startsWith('Weekly') && transaction.week) {
										const idx = cat === 'Weekly 1st' ? 0 : 1;
										const topUserId = weeklyTopScorers[selectedYear]?.[transaction.week]?.[idx];
										if (topUserId) { newTeam = [topUserId]; const matchups = historicalData.matchupsBySeason?.[selectedYear]?.filter(m => String(m.week) === String(transaction.week)); let points = null; if (matchups) { for (const m of matchups) { if (historicalData.rostersBySeason?.[selectedYear]) { if (historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team1_roster_id) && r.owner_id === topUserId)) points = m.team1_score; if (historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team2_roster_id) && r.owner_id === topUserId)) points = m.team2_score; } } } if (points !== null && !isNaN(points)) newDesc = `${cat} (${formatScore(Number(points ?? 0), 2)} pts)`; }
									}
									if (transaction.type === 'Payout' && cat.startsWith('Total Points')) { const leaders = totalPointsLeaders[selectedYear]; let li = -1; if (cat === 'Total Points 1st') li = 0; if (cat === 'Total Points 2nd') li = 1; if (cat === 'Total Points 3rd') li = 2; if (leaders?.[li]) { newTeam = [leaders[li].userId]; newDesc = `${cat} (${formatScore(Number(leaders[li].score ?? 0), 2)} pts)`; } }
									setTransaction(t => ({ ...t, category: cat, team: newTeam, description: newDesc }));
								}} required>
									<option value="">Select…</option>
									{(transaction.type === 'Fee' ? FEE_DESCRIPTIONS : PAYOUT_DESCRIPTIONS).map(opt => <option key={opt} value={opt}>{opt}</option>)}
								</select>
							</div>
							<div className="relative">
								<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Team(s)</label>
								<button type="button" onClick={() => setShowTeamDropdown(!showTeamDropdown)} className="w-full bg-gray-900 border border-white/15 text-gray-200 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-1 focus:ring-blue-500">
									{transaction.team.length === allMembers.length ? 'All Teams' : transaction.team.length > 3 ? `${allMembers.find(m => m.userId === transaction.team[0])?.displayName || 'Team'}, ... (+${transaction.team.length - 1} more)` : transaction.team.length > 0 ? transaction.team.map(id => allMembers.find(m => m.userId === id)?.displayName).join(', ') : 'Select Team(s)'}
								</button>
								{showTeamDropdown && (
									<div className="absolute z-20 w-full mt-1 bg-gray-900 border border-white/15 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
										<label className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer text-sm text-gray-300">
											<input type="checkbox" checked={transaction.team.length === allMembers.length} onChange={e => setTransaction(t => ({ ...t, team: e.target.checked ? allMembers.map(m => m.userId) : [] }))} />
											<span>All Teams</span>
										</label>
										{allMembers.map(m => (
											<label key={m.userId} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer text-sm text-gray-300">
												<input type="checkbox" checked={transaction.team.includes(m.userId)} onChange={e => setTransaction(t => ({ ...t, team: e.target.checked ? [...t.team, m.userId] : t.team.filter(id => id !== m.userId) }))} />
												<span>{m.displayName}</span>
											</label>
										))}
									</div>
								)}
							</div>
							{(transaction.category === 'Waiver/FA Fee' || transaction.category === 'Trade Fee') && (
								<div>
									<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Quantity</label>
									<input type="number" min="1" step="1" className={input} value={transaction.quantity} onChange={e => setTransaction(t => ({ ...t, quantity: e.target.value }))} onFocus={e => e.target.select()} />
								</div>
							)}
							<div>
								<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
								<input type="text" className={`${input} ${(transaction.type === 'Payout' && ((transaction.category.startsWith('Weekly') && transaction.week) || transaction.category.startsWith('Total Points'))) ? 'opacity-50 cursor-not-allowed' : ''}`} value={transaction.description} onChange={e => { if (!(transaction.type === 'Payout' && ((transaction.category.startsWith('Weekly') && transaction.week) || transaction.category.startsWith('Total Points')))) setTransaction(t => ({ ...t, description: e.target.value })); }} placeholder="e.g. Paid for entry, Weekly winner…" disabled={(transaction.type === 'Payout' && ((transaction.category.startsWith('Weekly') && transaction.week) || transaction.category.startsWith('Total Points')))} />
							</div>
							<div>
								<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Week #</label>
								<input type="number" min="0" className={input} value={transaction.week} onChange={e => {
									const newWeek = e.target.value; let newTeam = transaction.team, newDesc = transaction.description;
									if (!newWeek) { newTeam = []; newDesc = ''; }
									else if (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && weeklyTopScorers[selectedYear]?.[newWeek]) {
										const idx = transaction.category === 'Weekly 1st' ? 0 : 1;
										const topUserId = weeklyTopScorers[selectedYear][newWeek][idx];
										if (topUserId) { newTeam = [topUserId]; const matchups = historicalData.matchupsBySeason?.[selectedYear]?.filter(m => String(m.week) === String(newWeek)); let points = null; if (matchups) { for (const m of matchups) { if (historicalData.rostersBySeason?.[selectedYear]) { if (historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team1_roster_id) && r.owner_id === topUserId)) points = m.team1_score; if (historicalData.rostersBySeason[selectedYear].find(r => String(r.roster_id) === String(m.team2_roster_id) && r.owner_id === topUserId)) points = m.team2_score; } } } if (points !== null && !isNaN(points)) newDesc = `${transaction.category} (${formatScore(Number(points ?? 0), 2)} pts)`; }
									}
									setTransaction(t => ({ ...t, week: newWeek, team: newTeam, description: newDesc }));
								}} placeholder="e.g. 1, 2…" />
							</div>
							<div className="sm:col-span-2 flex justify-end gap-2">
								{editingTransaction && <button type="button" className={btnGhost} onClick={() => { setEditingTransaction(null); setTransaction({ type: 'Fee', amount: '', category: '', description: '', week: '', team: [], quantity: 1 }); setTransactionMessage({ text: 'Cancelled edit.', type: 'info' }); }}>Cancel</button>}
								<button type="submit" className={btnSuccess}>{editingTransaction ? 'Update Transaction' : 'Submit Transaction'}</button>
							</div>
						</form>
					) : (
						/* Bulk entry */
						<div className="space-y-4">
							{/* Defaults row */}
							<div className={`${cardSm} p-3 space-y-3`}>
								<div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply Defaults to All Rows</div>
								<div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
									{[['type','Type',<select className={select} value={bulkDefaults.type} onChange={e => setBulkDefaults(d => ({...d,type:e.target.value}))}><option value="Fee">Fee</option><option value="Payout">Payout</option></select>],['category','Category',<select className={select} value={bulkDefaults.category} onChange={e => setBulkDefaults(d => ({...d,category:e.target.value}))}><option value="">Any</option>{(bulkDefaults.type==='Fee'?FEE_DESCRIPTIONS:PAYOUT_DESCRIPTIONS).map(o=><option key={o} value={o}>{o}</option>)}</select>],['week','Week',<input type="number" min="0" className={input} value={bulkDefaults.week} onChange={e => setBulkDefaults(d => ({...d,week:e.target.value}))} />],['quantity','Qty',<input type="number" min="1" className={input} value={bulkDefaults.quantity} onChange={e => setBulkDefaults(d => ({...d,quantity:e.target.value}))} onFocus={e => e.target.select()} />],['amount','Amount',<input type="number" step="0.01" className={input} value={bulkDefaults.amount} onChange={e => setBulkDefaults(d => ({...d,amount:e.target.value}))} />],['description','Desc',<input type="text" className={input} value={bulkDefaults.description} onChange={e => setBulkDefaults(d => ({...d,description:e.target.value}))} />]].map(([k,label,el])=>(
										<div key={k}><label className="block text-[10px] text-gray-600 mb-1">{label}</label>{el}</div>
									))}
								</div>
								<div className="flex justify-end"><button type="button" onClick={applyBulkDefaultsToAll} className={btnPrimary}>Apply to All</button></div>
							</div>
							<form onSubmit={submitBulkTransactions}>
								<div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
									{bulkTransactions.map((txn, index) => (
										<div key={txn.id} className={`${cardSm} p-3 space-y-3`}>
											<div className="flex items-center justify-between">
												<span className="text-xs font-semibold text-gray-400">Transaction #{index + 1}</span>
												{bulkTransactions.length > 1 && <button type="button" onClick={() => removeBulkTransaction(txn.id)} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10">Remove</button>}
											</div>
											<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
												<div><label className="block text-[10px] text-gray-600 mb-1">Type</label><select className={select} value={txn.type} onChange={e => updateBulkTransaction(txn.id,'type',e.target.value)}><option value="Fee">Fee</option><option value="Payout">Payout</option></select></div>
												<div><label className="block text-[10px] text-gray-600 mb-1">Amount ($)</label><input type="number" step="0.01" className={input} value={txn.amount} onChange={e => updateBulkTransaction(txn.id,'amount',e.target.value)} placeholder="0.00" /></div>
												<div><label className="block text-[10px] text-gray-600 mb-1">Category</label><select className={select} value={txn.category} onChange={e => updateBulkTransaction(txn.id,'category',e.target.value)}><option value="">Select…</option>{(txn.type==='Fee'?FEE_DESCRIPTIONS:PAYOUT_DESCRIPTIONS).map(o=><option key={o} value={o}>{o}</option>)}</select></div>
												<div><label className="block text-[10px] text-gray-600 mb-1">Week #</label><input type="number" min="0" className={input} value={txn.week} onChange={e => updateBulkTransaction(txn.id,'week',e.target.value)} /></div>
												<div><label className="block text-[10px] text-gray-600 mb-1">Quantity</label><input type="number" min="1" className={input} value={txn.quantity} onChange={e => updateBulkTransaction(txn.id,'quantity',e.target.value)} onFocus={e=>e.target.select()} /></div>
												<div><label className="block text-[10px] text-gray-600 mb-1">Description</label><input type="text" className={input} value={txn.description} onChange={e => updateBulkTransaction(txn.id,'description',e.target.value)} /></div>
											</div>
											<div>
												<label className="block text-[10px] text-gray-600 mb-1">Teams ({txn.teams.length} selected)</label>
												<div className="border border-white/10 rounded-lg p-2 max-h-28 overflow-y-auto bg-gray-900/40 space-y-1">
													{allMembers.map(member => (
														<label key={member.userId} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-1 py-0.5 rounded text-sm text-gray-300">
															<input type="checkbox" checked={txn.teams.includes(member.userId)} onChange={e => { const newTeams = e.target.checked ? [...txn.teams, member.userId] : txn.teams.filter(id => id !== member.userId); updateBulkTransaction(txn.id,'teams',newTeams); }} />
															{member.displayName}
														</label>
													))}
												</div>
												<div className="flex gap-2 mt-1.5">
													<button type="button" onClick={() => updateBulkTransaction(txn.id,'teams',allMembers.map(m=>m.userId))} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">All</button>
													<button type="button" onClick={() => updateBulkTransaction(txn.id,'teams',[])} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10">Clear</button>
												</div>
											</div>
										</div>
									))}
								</div>
								<div className="flex items-center justify-between mt-4 flex-wrap gap-3">
									<span className="text-xs text-gray-500">{bulkTransactions.filter(t => t.amount && t.category && t.teams.length > 0).length} of {bulkTransactions.length} ready</span>
									<div className="flex gap-2">
										<button type="button" onClick={addBulkTransaction} className={btnGhost}>+ Add Row</button>
										<button type="submit" className={btnSuccess} disabled={bulkTransactions.filter(t => t.amount && t.category && t.teams.length > 0).length === 0}>Submit All</button>
									</div>
								</div>
							</form>
						</div>
					)}

					{transactionMessage.text && (
						<div className={`mt-2 p-3 rounded-lg text-xs font-medium ${msgBg(transactionMessage.type)}`}>{transactionMessage.text}</div>
					)}
				</div>
			)}

			{/* Sleeper import */}
			{isAdmin && selectedYear && (
				<div className={`${card} p-4 space-y-4`}>
					<div className="flex items-center gap-2 border-b border-white/8 pb-3">
						<div className="w-5 h-5 rounded-md bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
							<svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
						</div>
						<span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Analyze Transactions from Sleeper</span>
					</div>
					<p className="text-xs text-gray-500">Get transaction counts (trades, waivers, FA pickups) from Sleeper for {selectedYear}.</p>
					<div className="flex items-center gap-3 flex-wrap">
						<button onClick={handleImportFromSleeper} disabled={importStatus.loading} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold rounded-lg transition-colors">
							{importStatus.loading ? 'Analyzing…' : 'Analyze Transactions'}
						</button>
						{importStatus.message && <div className={`p-2 rounded-lg text-xs ${msgBg(importStatus.type)}`}>{importStatus.message}</div>}
					</div>
					{showImportPreview && previewData && (
						<div className={`${cardSm} p-4 space-y-5`}>
							<h4 className="text-sm font-semibold text-gray-200">Transaction Analysis for {selectedYear}</h4>
							{/* Totals */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
								{[['Trades',previewData.rawResult.summary.totalTrades,'blue'],['Waiver Claims',previewData.rawResult.summary.totalWaivers,'emerald'],['FA Pickups',previewData.rawResult.summary.totalFreeAgents,'orange'],['All Transactions',previewData.rawResult.summary.totalTrades+previewData.rawResult.summary.totalWaivers+previewData.rawResult.summary.totalFreeAgents,'purple']].map(([label,val,c])=>{
									const colors={blue:'text-blue-300',emerald:'text-emerald-300',orange:'text-orange-300',purple:'text-purple-300'};
									return (<div key={label} className="bg-white/[0.03] border border-white/8 rounded-lg p-3 text-center"><div className={`text-2xl font-bold ${colors[c]}`}>{val}</div><div className="text-[10px] text-gray-600 mt-0.5">{label}</div></div>);
								})}
							</div>
							{/* By team */}
							<div>
								<div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By Team</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
									{Object.entries(previewData.summary).map(([ownerId, summary]) => (
										<div key={ownerId} className="bg-white/[0.03] border border-white/8 rounded-lg p-3">
											<div className="text-xs font-semibold text-gray-200">{summary.teamName}</div>
											<div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
												<div>Trades: {summary.trades} · Waivers: {summary.waivers} · FA: {summary.freeAgents}</div>
											</div>
											<div className="text-xs font-bold text-gray-300 mt-1.5 pt-1.5 border-t border-white/8">Total: {summary.totalTransactions}</div>
										</div>
									))}
								</div>
							</div>
							{/* Weekly breakdown */}
							<div>
								<div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Weekly Breakdown</div>
								<div className="max-h-80 overflow-y-auto space-y-2">
									{Object.entries(previewData.weeklyReport).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([week, wd]) => {
										const total = wd.trades.length + wd.waivers.length + wd.freeAgents.length;
										if (total === 0) return null;
										return (
											<div key={week} className="bg-white/[0.03] border border-white/8 rounded-lg p-3">
												<div className="flex items-center justify-between mb-2">
													<span className="text-xs font-semibold text-gray-200">Week {week}</span>
													<span className="text-[10px] text-gray-600">{total} txn{total!==1?'s':''}</span>
												</div>
												{wd.trades.length > 0 && <div className="mb-1.5"><div className="text-[10px] font-semibold text-blue-400 mb-0.5">Trades ({wd.trades.length})</div>{wd.trades.map((t,i)=><div key={i} className="text-[10px] text-gray-500 ml-2">• {t.teamNames.join(' ↔ ')}{t.playersTraded.adds>0&&<span> ({t.playersTraded.adds} players)</span>}</div>)}</div>}
												{wd.waivers.length > 0 && <div className="mb-1.5"><div className="text-[10px] font-semibold text-emerald-400 mb-0.5">Waivers ({wd.waivers.reduce((s,w)=>s+w.pickupCount,0)})</div>{Object.entries(wd.waivers.reduce((acc,w)=>{acc[w.teamName]=(acc[w.teamName]||0)+w.pickupCount;return acc},{})).map(([n,c])=><div key={n} className="text-[10px] text-gray-500 ml-2">• {n}: {c} pickup{c!==1?'s':''}</div>)}</div>}
												{wd.freeAgents.length > 0 && <div><div className="text-[10px] font-semibold text-orange-400 mb-0.5">FA ({wd.freeAgents.reduce((s,f)=>s+f.pickupCount,0)})</div>{Object.entries(wd.freeAgents.reduce((acc,f)=>{acc[f.teamName]=(acc[f.teamName]||0)+f.pickupCount;return acc},{})).map(([n,c])=><div key={n} className="text-[10px] text-gray-500 ml-2">• {n}: {c} pickup{c!==1?'s':''}</div>)}</div>}
											</div>
										);
									})}
								</div>
							</div>
							<div className="flex justify-end"><button onClick={() => { setShowImportPreview(false); setPreviewData(null); setImportStatus({ message:'', type:'' }); }} className={btnGhost}>Close</button></div>
						</div>
					)}
				</div>
			)}

			{/* Members & Dues */}
			<div className={`${card} p-4`}>
				<div className="flex items-center gap-2 border-b border-white/8 pb-3 mb-4">
					<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">League Members & Dues</span>
				</div>
				{/* Mobile */}
				<div className="sm:hidden space-y-2">
					{allMembers.map(member => {
						const memberFees = currentYearData.transactions.filter(t => t.type==='Fee' && (Array.isArray(t.team)?t.team.includes(member.userId):t.team===member.userId)).reduce((sum,t)=>{ const tc=Array.isArray(t.team)?t.team.length:1; return sum+(getTransactionTotal(t)/tc); },0);
						const memberTxnFees = currentYearData.transactions.filter(t=>t.type==='Fee'&&(t.category==='Trade Fee'||t.category==='Waiver/FA Fee')&&(Array.isArray(t.team)?t.team.includes(member.userId):t.team===member.userId)).reduce((sum,t)=>{ const tc=Array.isArray(t.team)?t.team.length:1; return sum+(getTransactionTotal(t)/tc); },0);
						const memberPayouts = currentYearData.transactions.filter(t=>t.type==='Payout'&&(Array.isArray(t.team)?t.team.includes(member.userId):t.team===member.userId)).reduce((sum,t)=>sum+Number(t.amount||0),0);
						const netTotal = memberPayouts - memberFees;
						const finalDues = memberPayouts - memberTxnFees;
						return (
							<div key={member.userId} className={`${cardSm} p-3`}>
								<div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-200">{member.displayName}</span><span className={`text-sm font-bold tabular-nums ${netTotal<0?'text-red-400':'text-emerald-400'}`}>{fmtUSD(netTotal)}</span></div>
								<div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-gray-500">
									<div>Fees: {fmtUSD(memberFees)}</div><div>Txn Fees: {fmtUSD(memberTxnFees)}</div>
									<div>Payouts: {fmtUSD(memberPayouts)}</div><div className={`font-semibold ${finalDues<0?'text-red-400':'text-emerald-400'}`}>Dues: {fmtUSD(finalDues)}</div>
								</div>
							</div>
						);
					})}
				</div>
				{/* Desktop */}
				<div className="hidden sm:block overflow-x-auto">
					<table className="min-w-full text-xs">
						<thead><tr className="border-b border-white/10"><th className={thCell}>Member</th><th className={thCellC}>Total Fees</th><th className={thCellC}>Transaction Fees</th><th className={thCellC}>Total Payouts</th><th className={thCellC}>Net Total</th><th className={thCellC}>Final Dues</th></tr></thead>
						<tbody className="divide-y divide-white/5">
							{allMembers.map(member => {
								const memberFees = currentYearData.transactions.filter(t=>t.type==='Fee'&&(Array.isArray(t.team)?t.team.includes(member.userId):t.team===member.userId)).reduce((sum,t)=>{ const tc=Array.isArray(t.team)?t.team.length:1; return sum+(getTransactionTotal(t)/tc); },0);
								const memberTxnFees = currentYearData.transactions.filter(t=>t.type==='Fee'&&(t.category==='Trade Fee'||t.category==='Waiver/FA Fee')&&(Array.isArray(t.team)?t.team.includes(member.userId):t.team===member.userId)).reduce((sum,t)=>{ const tc=Array.isArray(t.team)?t.team.length:1; return sum+(getTransactionTotal(t)/tc); },0);
								const memberPayouts = currentYearData.transactions.filter(t=>t.type==='Payout'&&(Array.isArray(t.team)?t.team.includes(member.userId):t.team===member.userId)).reduce((sum,t)=>sum+Number(t.amount||0),0);
								const netTotal = memberPayouts - memberFees;
								const finalDues = memberPayouts - memberTxnFees;
								return (
									<tr key={member.userId} className="hover:bg-white/[0.02] transition-colors">
										<td className="py-2.5 px-3 font-semibold text-gray-200">{member.displayName}</td>
										<td className={tdCellC}>{fmtUSD(memberFees)}</td>
										<td className={tdCellC}>{fmtUSD(memberTxnFees)}</td>
										<td className={tdCellC}>{fmtUSD(memberPayouts)}</td>
										<td className={`py-2.5 px-3 text-center font-bold tabular-nums ${netTotal<0?'text-red-400':'text-emerald-400'}`}>{fmtUSD(netTotal)}</td>
										<td className={`py-2.5 px-3 text-center font-bold tabular-nums ${finalDues<0?'text-red-400':'text-emerald-400'}`}>{fmtUSD(finalDues)}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				{!isAdmin && <p className="text-[10px] text-gray-600 mt-2">Login as commissioner to edit dues.</p>}
			</div>

			{/* All Transactions */}
			<div className={`${card} p-4`}>
				<div className="flex items-center justify-between mb-4 flex-wrap gap-2">
					<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All Transactions ({selectedYear})</span>
					<div className="flex gap-2 flex-wrap">
						{isAdmin && <button onClick={handleDeleteSelected} disabled={selectedTransactions.length===0} className={`${selectedTransactions.length>0?btnDanger:'px-4 py-2 bg-gray-800 text-gray-600 text-sm font-semibold rounded-lg cursor-not-allowed border border-white/5'}`}>Delete ({selectedTransactions.length})</button>}
						<button onClick={handleExport} className={btnPrimary}>Export CSV</button>
					</div>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
					{[['type','Filter by Type',['ALL','Fee','Payout']],['team','Filter by Team',null]].map(([key,label,opts])=>(
						<div key={key}>
							<label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
							<select className={select} value={filters[key]} onChange={e=>{ setFilters(f=>({...f,[key]:e.target.value})); setCurrentPage(1); }}>
								{opts ? opts.map(o=><option key={o} value={o}>{o==='ALL'?`All ${key==='type'?'Types':'Teams'}`:o}</option>) : [<option key="ALL" value="ALL">All Teams</option>,...allMembers.map(m=><option key={m.userId} value={m.userId}>{m.displayName}</option>)]}
							</select>
						</div>
					))}
				</div>
				{/* Mobile transactions */}
				<div className="sm:hidden space-y-2">
					{paginatedTransactions.map(t => (
						<div key={t.id} className={`${cardSm} p-3`}>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<div className="text-xs font-semibold text-gray-200 truncate">{renderTeams(t.id,t.team,allMembers,expandedTransactionId,setExpandedTransactionId)}</div>
									<div className="text-[10px] text-gray-600">{t.category} · {t.type}</div>
								</div>
								<div className="text-right flex-shrink-0">
									<div className="text-sm font-semibold text-gray-200 tabular-nums">{fmtUSD(Number(t.amount||0))}</div>
									<div className="text-[10px] text-gray-600">{t.week?`W${t.week}`:''}</div>
								</div>
							</div>
							<div className="mt-1 text-[10px] text-gray-500 truncate">{t.description}</div>
							{isAdmin && <div className="mt-2 flex justify-end gap-3"><button className="text-blue-400 hover:text-blue-300 text-base" title="Edit" onClick={() => handleEditTransaction(t)}>✎</button><button className="text-red-400 hover:text-red-300 text-base" onClick={() => handleDeleteTransaction([t])}>✖</button></div>}
						</div>
					))}
				</div>
				{/* Desktop transactions table */}
				<div className="hidden sm:block overflow-x-auto">
					<table className="min-w-full text-xs">
						<thead>
							<tr className="border-b border-white/10">
								{isAdmin && <th className={thCellC}><input type="checkbox" onChange={e => e.target.checked ? setSelectedTransactions(paginatedTransactions) : setSelectedTransactions([])} checked={allTransactionsSelected} /></th>}
								{[['date','Date'],['team','Team'],['type','Type'],null,['amount','Amount'],['category','Category'],['description','Description'],['week','Week']].map((col,i) => col ? (
									<th key={col[0]} className={`${thCell} cursor-pointer hover:text-gray-300`} onClick={() => requestSort(col[0])}>{col[1]}<SortArrow col={col[0]} /></th>
								) : <th key={i} className={thCellC}>Qty</th>)}
								{isAdmin && <th className={thCellC}>Actions</th>}
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{paginatedTransactions.map(t => {
								const displayDate = t.date ? (isNaN(new Date(t.date)) ? 'Invalid Date' : new Date(t.date).toLocaleString()) : '';
								return (
									<tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
										{isAdmin && <td className={tdCellC}><input type="checkbox" checked={selectedTransactions.some(s=>s.id===t.id)} onChange={e=>handleSelectTransaction(t,e.target.checked)} /></td>}
										<td className="py-2.5 px-3 text-gray-500 text-[11px] whitespace-nowrap">{displayDate}</td>
										<td className={tdCell}>{renderTeams(t.id,t.team,allMembers,expandedTransactionId,setExpandedTransactionId)}</td>
										<td className={tdCellC}>{t.type}</td>
										<td className={tdCellC}>{(t.category==='Waiver/FA Fee'||t.category==='Trade Fee')?(t.quantity||1):''}</td>
										<td className="py-2.5 px-3 text-gray-200 text-center font-semibold tabular-nums">{fmtUSD(Number(t.amount||0))}</td>
										<td className={tdCellC}>{t.category}</td>
										<td className="py-2.5 px-3 text-gray-400 max-w-xs truncate">{t.description}</td>
										<td className={tdCellC}>{t.week}</td>
										{isAdmin && <td className={tdCellC}><div className="flex justify-center gap-2"><button className="text-blue-400 hover:text-blue-300 text-base" title="Edit" onClick={() => handleEditTransaction(t)}>✎</button><button className="text-red-400 hover:text-red-300 text-base" onClick={() => handleDeleteTransaction([t])}>✖</button></div></td>}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				{/* Pagination */}
				<div className="flex items-center justify-center gap-3 mt-4">
					<button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${currentPage===1?'bg-white/5 text-gray-600 cursor-not-allowed':'bg-white/8 text-gray-300 hover:bg-white/12 border border-white/10'}`} onClick={() => setCurrentPage(Math.max(1,currentPage-1))} disabled={currentPage===1}>Prev</button>
					<select className="bg-gray-900 border border-white/15 text-gray-300 rounded-lg px-3 py-1.5 text-xs" value={currentPage} onChange={e => setCurrentPage(Number(e.target.value))}>
						{Array.from({length:totalPages},(_,i)=><option key={i} value={i+1}>Page {i+1} of {totalPages}</option>)}
					</select>
					<button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${currentPage===totalPages?'bg-white/5 text-gray-600 cursor-not-allowed':'bg-white/8 text-gray-300 hover:bg-white/12 border border-white/10'}`} onClick={() => setCurrentPage(Math.min(totalPages,currentPage+1))} disabled={currentPage===totalPages}>Next</button>
				</div>
			</div>

			{/* Fees reference */}
			{[['fees','red','Fees'],['payouts','emerald','Payouts']].map(([type,color,label])=>{
				const dataKey = type==='fees'?'potentialFees':'potentialPayouts';
				const accentHeader = color==='red'?'text-red-300':'text-emerald-300';
				return (
					<div key={type} className={`${card} p-4`}>
						<div className="flex items-center justify-between mb-4">
							<span className={`text-xs font-semibold uppercase tracking-wider ${accentHeader}`}>{label} ({selectedYear})</span>
							{isAdmin && <button onClick={() => setShowPotentialForm(type)} className={`w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold ${btnPrimary} p-0 leading-none`}>+</button>}
						</div>
						{currentYearData[dataKey]?.length > 0 ? (
							<table className="min-w-full text-xs">
								<thead><tr className="border-b border-white/10"><th className={thCell}>Description</th><th className={thCellC}>Amount</th>{isAdmin&&<th className={thCellC}>Actions</th>}</tr></thead>
								<tbody className="divide-y divide-white/5">
									{currentYearData[dataKey].map(item=>(
										<tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
											<td className={tdCell}>{item.description}</td>
											<td className={tdCellC}>{fmtUSD(Number(item.amount||0))}</td>
											{isAdmin&&<td className={tdCellC}><button className="text-red-400 hover:text-red-300 text-base" onClick={()=>handleDeletePotentialTransaction(item.id,type)}>✖</button></td>}
										</tr>
									))}
								</tbody>
							</table>
						) : <p className="text-center text-gray-600 text-xs py-4 italic">No {label.toLowerCase()} for this year.</p>}
					</div>
				);
			})}

			{/* Potential form modal */}
			{showPotentialForm && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPotentialForm(null)}>
					<div className={`${card} p-5 w-full max-w-sm`} onClick={e => e.stopPropagation()}>
						<h3 className="text-sm font-bold text-white mb-4">Add {showPotentialForm==='fees'?'Fee':'Payout'}</h3>
						<form onSubmit={e => handleAddPotentialTransaction(e, showPotentialForm)} className="space-y-3">
							<div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label><input type="text" className={input} value={potentialFormInput.description} onChange={e => setPotentialFormInput(p=>({...p,description:e.target.value}))} required /></div>
							<div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Amount ($)</label><input type="number" min="0" step="0.01" className={input} value={potentialFormInput.amount} onChange={e => setPotentialFormInput(p=>({...p,amount:e.target.value}))} required /></div>
							<div className="flex justify-end gap-2 pt-1">
								<button type="button" className={btnGhost} onClick={() => { setShowPotentialForm(null); setPotentialFormInput({description:'',amount:''}); }}>Cancel</button>
								<button type="submit" className={btnSuccess}>Save</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default FinancialTracker;
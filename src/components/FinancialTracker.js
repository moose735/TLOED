import React, { useState, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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
       });

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
	// (REMOVED) Track all transactions locally (no Firebase sync yet)
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

       // Firestore: Load transactions for all years on mount
       React.useEffect(() => {
	       let isMounted = true;
	       async function fetchAllYears() {
		       setFirestoreLoading(true);
		       try {
			       const docRef = doc(db, 'league_finances', 'main');
			       const docSnap = await getDoc(docRef);
			       if (docSnap.exists() && isMounted) {
				       const data = docSnap.data();
				       setTransactionsByYear(data && data.transactionsByYear ? data.transactionsByYear : {});
			       } else if (isMounted) {
				       setTransactionsByYear({});
			       }
		       } catch (e) {
			       if (isMounted) setTransactionsByYear({});
		       } finally {
			       if (isMounted) setFirestoreLoading(false);
		       }
	       }
	       fetchAllYears();
	       return () => { isMounted = false; };
       }, []);

	// Firestore: Save transactionsByYear on change
	React.useEffect(() => {
		async function saveAllYears() {
			try {
				const docRef = doc(db, 'league_finances', 'main');
				await setDoc(docRef, { transactionsByYear }, { merge: true });
			} catch (e) {
				// Optionally handle error
			}
		}
		// Only save if there is at least one year and at least one transaction
		if (Object.keys(transactionsByYear).length > 0 && Object.values(transactionsByYear).some(arr => arr.length > 0)) {
			saveAllYears();
		}
	}, [transactionsByYear]);

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

	if (loading || firestoreLoading) return <div className="p-4 text-blue-600">Loading financial tracker...</div>;
	if (error) return <div className="p-4 text-red-600">Error loading data: {error.message}</div>;
	if (!usersData || !historicalData) return <div className="p-4 text-orange-600">No data available.</div>;

	// Get transactions for selected year
	const transactions = transactionsByYear[selectedYear] || [];
	// Calculate summary bubbles (per selected year)
	const totalFees = transactions.filter(t => t.type === 'Fee').reduce((sum, t) => sum + Number(t.amount || 0), 0);
	const totalPayouts = transactions.filter(t => t.type === 'Payout').reduce((sum, t) => sum + Number(t.amount || 0), 0);
	const leagueBank = totalFees - totalPayouts;

       return (
	      <div className="p-4 max-w-5xl mx-auto">
		      <h2 className="text-2xl font-bold mb-6 text-center">League Financial Tracker</h2>
		      {/* Year Dropdown */}
		      <div className="flex flex-wrap justify-center gap-4 mb-6">
			      <label className="flex items-center gap-2 text-sm font-semibold">
				      <span>League Year:</span>
				      <select
					      className="border rounded px-2 py-1"
					      value={selectedYear}
					      onChange={e => setSelectedYear(e.target.value)}
				      >
					      {allSeasons.map(year => (
						      <option key={year} value={year}>{year}</option>
					      ))}
				      </select>
			      </label>
		      </div>
		      {/* Summary Bubbles */}
		      <div className="flex flex-wrap justify-center gap-4 mb-8">
			      <div className="flex flex-col items-center bg-blue-100 rounded-full px-6 py-3 shadow text-blue-900 min-w-[120px]">
				      <span className="text-xs font-semibold uppercase tracking-wide">League Bank</span>
				      <span className="text-xl font-bold">${leagueBank.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
			      </div>
			      <div className="flex flex-col items-center bg-green-100 rounded-full px-6 py-3 shadow text-green-900 min-w-[120px]">
				      <span className="text-xs font-semibold uppercase tracking-wide">Total Fees</span>
				      <span className="text-xl font-bold">${totalFees.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
			      </div>
			      <div className="flex flex-col items-center bg-red-100 rounded-full px-6 py-3 shadow text-red-900 min-w-[120px]">
				      <span className="text-xs font-semibold uppercase tracking-wide">Total Payouts</span>
				      <span className="text-xl font-bold">${totalPayouts.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
			      </div>
		      </div>
		      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
			      <div>
				      {authUser ? (
					      <div className="flex items-center gap-3">
						      <span className="text-green-700 font-semibold">Logged in as {authUser.email}</span>
						      {isAdmin && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Commissioner</span>}
						      <button onClick={handleLogout} className="ml-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm">Logout</button>
					      </div>
				      ) : (
					      <form onSubmit={handleLogin} className="flex flex-col sm:flex-row gap-2 items-center">
						      <input
							      type="email"
							      required
							      placeholder="Commish Email"
							      className="border rounded px-3 py-2 text-sm"
							      value={login.email}
							      onChange={e => setLogin(l => ({ ...l, email: e.target.value }))}
						      />
						      <input
							      type="password"
							      required
							      placeholder="Password"
							      className="border rounded px-3 py-2 text-sm"
							      value={login.password}
							      onChange={e => setLogin(l => ({ ...l, password: e.target.value }))}
						      />
						      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-semibold">Login</button>
						      {authError && <span className="text-red-600 text-xs ml-2">{authError}</span>}
					      </form>
				      )}
			      </div>
		      </div>

		      {/* Commish-only transaction entry section */}
	      {isAdmin && (
		      <div className="mb-8 bg-white rounded-lg shadow p-6 border border-blue-200">
			      <button
				      className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm"
				      onClick={() => setShowTransactionForm(v => !v)}
			      >
				      {showTransactionForm ? 'Hide Transaction Entry' : 'Add Fee/Payout Transaction'}
			      </button>
		      {showTransactionForm && (
			      <form
				      className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-blue-50 p-4 rounded"
				      onSubmit={e => {
					      e.preventDefault();
					      // Save transaction(s) to the selected year only
					      setTransactionsByYear(prev => {
						      const prevYearTx = prev[selectedYear] || [];
						      let newTxs = [];
						      const now = new Date().toISOString();
						      if (transaction.team === 'ALL') {
							      newTxs = [
								      ...prevYearTx,
								      ...allMembers.map(m => ({ ...transaction, team: m.userId, date: now }))
							      ];
						      } else {
							      newTxs = [...prevYearTx, { ...transaction, date: now }];
						      }
						      return { ...prev, [selectedYear]: newTxs };
					      });
					      setTransaction({ type: 'Fee', amount: '', category: '', description: '', week: '', team: 'ALL' });
					      setShowTransactionForm(false);
				      }}
			      >
				      <div>
					      <label className="block text-xs font-semibold mb-1">Type</label>
					      <select
						      className="w-full border rounded px-2 py-2"
						      value={transaction.type}
						      onChange={e => {
							      const newType = e.target.value;
							      setTransaction(t => ({
								      ...t,
								      type: newType,
								      // Reset description/category when type changes
								      description: '',
								      category: '',
							      }));
						      }}
					      >
						      <option value="Fee">Fee</option>
						      <option value="Payout">Payout</option>
					      </select>
				      </div>
				      <div>
					      <label className="block text-xs font-semibold mb-1">Amount ($)</label>
					      <input
						      type="number"
						      min="0"
						      step="0.01"
						      className="w-full border rounded px-2 py-2"
						      value={transaction.amount}
						      onChange={e => setTransaction(t => ({ ...t, amount: e.target.value }))}
						      required
					      />
				      </div>
				      <div>
					      <label className="block text-xs font-semibold mb-1">Team</label>
					      <select
						      className="w-full border rounded px-2 py-2"
						      value={transaction.team}
						      onChange={e => setTransaction(t => ({ ...t, team: e.target.value }))}
						      disabled={transaction.type === 'Payout' && (transaction.description === 'Weekly 1st' || transaction.description === 'Weekly 2nd') && transaction.week}
					      >
						      <option value="ALL">All Teams</option>
						      {allMembers.map(m => (
							      <option key={m.userId} value={m.userId}>{m.displayName}</option>
						      ))}
					      </select>
				      </div>
			      <div>
				      <label className="block text-xs font-semibold mb-1">Description</label>
				      <input
					      type="text"
					      className="w-full border rounded px-2 py-2"
					      value={transaction.description}
					      onChange={e => setTransaction(t => ({ ...t, description: e.target.value }))}
					      placeholder="e.g. Paid for entry, Weekly winner, etc."
					      required
				      />
			      </div>
			      <div className="md:col-span-2">
				      <label className="block text-xs font-semibold mb-1">Category</label>
				      <select
					      className="w-full border rounded px-2 py-2"
					      value={transaction.category}
					      onChange={e => {
						      const cat = e.target.value;
						      let newTeam = transaction.team;
						      let newDesc = transaction.description;
						      // Auto-select team and description for weekly payouts
						      if (transaction.type === 'Payout' && (cat === 'Weekly 1st' || cat === 'Weekly 2nd') && transaction.week && weeklyTopScorers[selectedYear]?.[transaction.week]) {
							      const idx = cat === 'Weekly 1st' ? 0 : 1;
							      const topUserId = weeklyTopScorers[selectedYear][transaction.week][idx];
							      if (topUserId) {
								      newTeam = topUserId;
								      // Find points for that user that week
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
			      <div>
				      <label className="block text-xs font-semibold mb-1">Week #</label>
				      <input
					      type="number"
					      min="0"
					      className="w-full border rounded px-2 py-2"
					      value={transaction.week}
					      onChange={e => {
						      const newWeek = e.target.value;
						      let newTeam = transaction.team;
						      let newDesc = transaction.description;
						      // Auto-select team and description for weekly payouts
						      if (transaction.type === 'Payout' && (transaction.category === 'Weekly 1st' || transaction.category === 'Weekly 2nd') && weeklyTopScorers[selectedYear]?.[newWeek]) {
							      const idx = transaction.category === 'Weekly 1st' ? 0 : 1;
							      const topUserId = weeklyTopScorers[selectedYear][newWeek][idx];
							      if (topUserId) {
								      newTeam = topUserId;
								      // Find points for that user that week
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
				      <div className="md:col-span-2 flex justify-end">
					      <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-semibold">Submit Transaction</button>
				      </div>
			      </form>
		      )}
		      </div>
	      )}

		      {/* Member Dues & Transaction Table */}
	      <div className="mb-10 bg-white rounded-lg shadow p-6 border border-gray-100">
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
						      // Calculate totals for this member
						      const memberFees = transactions.filter(t => t.type === 'Fee' && t.team === member.userId).reduce((sum, t) => sum + Number(t.amount || 0), 0);
						      const memberPayouts = transactions.filter(t => t.type === 'Payout' && t.team === member.userId).reduce((sum, t) => sum + Number(t.amount || 0), 0);
						      // Net total = payouts - fees
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

		      {/* Last 10 Transactions Section */}
		      <div className="mb-10 bg-white rounded-lg shadow p-6 border border-gray-100">
			      <h3 className="text-lg font-semibold mb-4 text-blue-800">Last 10 Transactions ({selectedYear})</h3>
			      <div className="overflow-x-auto">
				      <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
					      <thead className="bg-blue-50">
						      <tr>
							      <th className="py-2 px-3 text-left">Date</th>
							      <th className="py-2 px-3 text-left">Team</th>
							      <th className="py-2 px-3 text-center">Type</th>
							      <th className="py-2 px-3 text-center">Amount</th>
							      <th className="py-2 px-3 text-center">Category</th>
							      <th className="py-2 px-3 text-center">Description</th>
							      <th className="py-2 px-3 text-center">Week</th>
						      </tr>
					      </thead>
					      <tbody>
						      {[...transactions].slice(-10).reverse().map((t, idx) => {
							      const teamName = allMembers.find(m => m.userId === t.team)?.displayName || t.team;
							      return (
								      <tr key={idx} className="even:bg-gray-50">
									      <td className="py-2 px-3">{t.date ? new Date(t.date).toLocaleString() : ''}</td>
									      <td className="py-2 px-3">{teamName}</td>
									      <td className="py-2 px-3 text-center">{t.type}</td>
									      <td className="py-2 px-3 text-center">${Number(t.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
									      <td className="py-2 px-3 text-center">{t.category}</td>
									      <td className="py-2 px-3 text-center">{t.description}</td>
									      <td className="py-2 px-3 text-center">{t.week}</td>
								      </tr>
							      );
						      })}
					      </tbody>
				      </table>
			      </div>
		      </div>
			   {/* Weekly high scorer tables removed as requested, logic retained for auto-fill */}
			{/* TODO: Add yearly payouts and Firebase sync */}
		</div>
	);
};

export default FinancialTracker;
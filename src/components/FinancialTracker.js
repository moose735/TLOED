import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    signInAnonymously,
    signInWithCustomToken // Ensure this is imported if used
} from 'firebase/auth';
import {
    getFirestore, collection, addDoc, query, orderBy, onSnapshot,
    serverTimestamp, deleteDoc, doc, setDoc, getDoc, writeBatch
} from 'firebase/firestore';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Corrected import path

// Your web app's Firebase configuration - Directly using the provided config
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');


// Helper function to format currency
const formatCurrency = (value) => {
    if (typeof value === 'number') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
    return 'N/A';
};

// Exported helper function for calculating financial data for TeamDetailPage
export const calculateFinancialDataForTeamDetailPage = (transactions, getMappedTeamName) => {
    const yearlyTeamBalances = {};

    transactions.forEach(transaction => {
        const year = transaction.season ? parseInt(transaction.season) : (transaction.date?.toDate ? new Date(transaction.date.toDate()).getFullYear() : null);
        // Use getMappedTeamName to resolve the team name for calculation
        const team = getMappedTeamName(String(transaction.teamName || '').trim(), year); // Pass season to getMappedTeamName
        const amount = parseFloat(transaction.amount);
        const type = transaction.type;

        if (isNaN(year) || !team || isNaN(amount)) return;

        if (!yearlyTeamBalances[year]) {
            yearlyTeamBalances[year] = {};
        }
        if (!yearlyTeamBalances[year][team]) {
            yearlyTeamBalances[year][team] = { totalDebits: 0, totalCredits: 0 };
        }

        if (type === 'debit') {
            yearlyTeamBalances[year][team].totalDebits += amount;
        } else if (type === 'credit') {
            yearlyTeamBalances[year][team].totalCredits += amount;
        }
    });

    const financialDataArray = [];
    for (const year in yearlyTeamBalances) {
        for (const teamName in yearlyTeamBalances[year]) {
            const balances = yearlyTeamBalances[year][teamName];
            const netBalance = balances.totalCredits - balances.totalDebits;
            financialDataArray.push({
                year: parseInt(year),
                teamName: teamName,
                netBalance: netBalance
            });
        }
    }
    return financialDataArray;
};

// New component for the Overall Financial History Tab
const OverallFinancialHistoryTab = ({ allTransactions, getDisplayName, uniqueTeamsForOverallHistory }) => {
    // Calculate overall team financials across all seasons
    const overallTeamFinancials = useMemo(() => {
        if (typeof getDisplayName !== 'function') {
            return []; // Return empty if getDisplayName is not available
        }

        const teamStats = {};

        // Initialize teamStats for all unique teams to ensure all teams are listed
        uniqueTeamsForOverallHistory.forEach(team => {
            teamStats[team] = { name: team, totalDebits: 0, totalCredits: 0, netBalance: 0 };
        });

        allTransactions.forEach(t => {
            // Resolve team name for the transaction using getDisplayName and its season
            const transactionSeason = t.season ? parseInt(t.season) : (t.date?.toDate ? new Date(t.date.toDate()).getFullYear() : null);
            const displayTeam = getDisplayName(String(t.teamName || '').trim(), transactionSeason);
            const amount = parseFloat(t.amount);

            if (isNaN(amount)) return;

            // Handle 'All Teams' debits by dividing among all active teams
            if (t.teamName === 'All Teams' && t.type === 'debit' && t.teamsInvolvedCount > 0) {
                const perTeamAmount = amount / t.teamsInvolvedCount;
                uniqueTeamsForOverallHistory.forEach(individualTeam => {
                    if (teamStats[individualTeam]) {
                        teamStats[individualTeam].totalDebits += perTeamAmount;
                    }
                });
            } else if (displayTeam && teamStats[displayTeam]) { // For specific team transactions
                if (t.type === 'debit') {
                    teamStats[displayTeam].totalDebits += amount;
                } else if (t.type === 'credit') {
                    teamStats[displayTeam].totalCredits += amount;
                }
            }
        });

        // Calculate net balance for overall team stats
        Object.keys(teamStats).forEach(team => {
            teamStats[team].netBalance = teamStats[team].totalCredits - teamStats[team].totalDebits;
        });

        // Sort by team name before returning for display
        return Object.values(teamStats).sort((a, b) => a.name.localeCompare(b.name));
    }, [allTransactions, getDisplayName, uniqueTeamsForOverallHistory]);

    return (
        <section className="bg-white p-6 rounded-lg shadow-md mt-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Overall Financial History by Team</h3>

            {overallTeamFinancials.length === 0 ? (
                <p className="text-center text-gray-600">No financial data available across all seasons.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                        <thead className="bg-blue-100">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team Name</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Fees</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Payouts</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Overall Net Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overallTeamFinancials.map((data, index) => (
                                <tr key={data.name} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{data.name}</td>
                                    <td className="py-2 px-4 text-sm text-right text-red-700 border-b border-gray-200">{formatCurrency(data.totalDebits)}</td>
                                    <td className="py-2 px-4 text-sm text-right text-green-700 border-b border-gray-200">{formatCurrency(data.totalCredits)}</td>
                                    <td className={`py-2 px-4 text-sm text-right font-bold border-b border-gray-200 ${data.netBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                        {formatCurrency(data.netBalance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

// New component for Weekly Matchup History Tab
const WeeklyMatchupHistoryTab = () => { // Removed props, will use context
    const { loading, error, historicalData, getDisplayName } = useSleeperData();
    const [selectedSeasonForMatchups, setSelectedSeasonForMatchups] = useState(null);
    const [availableMatchupSeasons, setAvailableMatchupSeasons] = useState([]);
    const [filterMatchupTeam, setFilterMatchupTeam] = useState('');

    // Effect to populate seasons dropdown for matchups
    useEffect(() => {
        if (historicalData && historicalData.matchupsBySeason) {
            const years = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => b - a);
            setAvailableMatchupSeasons(years);
            if (years.length > 0 && selectedSeasonForMatchups === null) {
                setSelectedSeasonForMatchups(years[0]); // Default to most recent
            }
        } else {
            setAvailableMatchupSeasons([]);
            setSelectedSeasonForMatchups(null);
        }
    }, [historicalData, selectedSeasonForMatchups]);

    // Process matchup data for display
    const processedMatchups = useMemo(() => {
        // Ensure all necessary data and functions are available
        if (loading || error || !selectedSeasonForMatchups || !historicalData || !historicalData.matchupsBySeason || !historicalData.rostersBySeason || typeof getDisplayName !== 'function') {
            return [];
        }

        const matchupsForSeason = historicalData.matchupsBySeason[selectedSeasonForMatchups];
        const rostersForSeason = historicalData.rostersBySeason[selectedSeasonForMatchups];

        if (!matchupsForSeason || !rostersForSeason) {
            console.warn(`No matchup or roster data found for season ${selectedSeasonForMatchups}.`);
            return [];
        }

        const allMatchups = [];
        // Iterate through weeks in matchupsForSeason object
        Object.values(matchupsForSeason).forEach(weekMatchups => {
            // Ensure weekMatchups is an array before iterating
            if (Array.isArray(weekMatchups)) {
                weekMatchups.forEach(match => {
                    // Use owner_id from team_details if available, fallback to roster_id
                    const team1Id = match.team1_details?.owner_id || match.roster_id;
                    const team2Id = match.team2_details?.owner_id || match.matchup_id; // matchup_id is often the opponent's roster ID

                    const team1Name = getDisplayName(team1Id, selectedSeasonForMatchups);
                    const team2Name = getDisplayName(team2Id, selectedSeasonForMatchups);

                    // Filter by team if filterMatchupTeam is set
                    const teamFilterApplies = !filterMatchupTeam ||
                                              (team1Name && team1Name.toLowerCase().includes(filterMatchupTeam.toLowerCase())) ||
                                              (team2Name && team2Name.toLowerCase().includes(filterMatchupTeam.toLowerCase()));

                    if (teamFilterApplies) {
                        allMatchups.push({
                            week: match.week,
                            team1: team1Name,
                            team1Score: match.team1_points,
                            team2: team2Name,
                            team2Score: match.team2_points,
                        });
                    }
                });
            }
        });
        // Sort by week number
        return allMatchups.sort((a, b) => a.week - b.week);
    }, [selectedSeasonForMatchups, historicalData, getDisplayName, filterMatchupTeam, loading, error]);

    if (loading) return <p className="text-center text-blue-600">Loading matchup data...</p>;
    if (error) return <p className="text-center text-red-600">Error loading matchup data: {error.message}</p>;

    return (
        <section className="bg-white p-6 rounded-lg shadow-md mt-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Weekly Matchup History</h3>

            {availableMatchupSeasons.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-center items-center mb-4 p-2 bg-blue-50 rounded-lg shadow-sm gap-2">
                    <label htmlFor="matchupSeasonFilter" className="mr-2 font-semibold text-blue-700">Select Season:</label>
                    <select
                        id="matchupSeasonFilter"
                        value={selectedSeasonForMatchups || ''}
                        onChange={(e) => setSelectedSeasonForMatchups(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                        {availableMatchupSeasons.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <label htmlFor="filterMatchupTeam" className="mr-2 font-semibold text-blue-700">Filter by Team:</label>
                    <input
                        type="text"
                        id="filterMatchupTeam"
                        value={filterMatchupTeam}
                        onChange={(e) => setFilterMatchupTeam(e.target.value)}
                        placeholder="Search team name"
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
            )}

            {processedMatchups.length === 0 ? (
                <p className="text-center text-gray-600">No matchup data available for the selected season or filter.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                        <thead className="bg-blue-100">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Week</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team 1</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Score</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team 2</th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedMatchups.map((match, index) => (
                                <tr key={`${match.week}-${match.team1}-${match.team2}-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{match.week}</td>
                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{match.team1}</td>
                                    <td className="py-2 px-4 text-sm text-right text-gray-900 font-medium border-b border-gray-200">{match.team1Score?.toFixed(2) || 'N/A'}</td>
                                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{match.team2}</td>
                                    <td className="py-2 px-4 text-sm text-right text-gray-900 font-medium border-b border-gray-200">{match.team2Score?.toFixed(2) || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};


const FinancialTracker = () => {
    // Use the useSleeperData hook to get data from the context
    const { loading: sleeperLoading, error: sleeperError, historicalData, usersData, getDisplayName } = useSleeperData();

    const [transactions, setTransactions] = useState([]); // Transactions for the selected season (for main view)
    const [allTransactions, setAllTransactions] = useState([]); // All transactions (for overall history)

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('debit');
    const [category, setCategory] = useState('entry_fee');
    const [weeklyPointsWeek, setWeeklyPointsWeek] = useState('');
    const [sidePotName, setSidePotName] = useState('');

    const [teamName, setTeamName] = useState(''); // Will store user_id or 'ALL_TEAMS_MULTIPLIER'
    const [tradeTeams, setTradeTeams] = useState(['', '']); // Will store user_ids
    const [waiverEntries, setWaiverEntries] = useState([{ team: '', numPickups: 1 }]); // 'team' will store user_id

    const [tradeEntryMethod, setTradeEntryMethod] = useState('multi_team');
    const [numTrades, setNumTrades] = useState(1);

    const [loading, setLoading] = useState(true); // Combined with sleeperLoading
    const [error, setError] = useState(null); // Combined with sleeperError
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [uniqueTeams, setUniqueTeams] = useState([]); // Stores { label: 'Display Name', value: 'user_id' }
    const [weeklyHighScores, setWeeklyHighScores] = useState({});
    const [currentWeekForSelectedSeason, setCurrentWeekForSelectedSeason] = useState(0);

    const [selectedSeason, setSelectedSeason] = useState(null);
    const [availableSeasons, setAvailableSeasons] = useState([]);
    const [activeTeamsCount, setActiveTeams] = useState(0); // Renamed to avoid confusion with `activeTeamsCount` in the `OverallFinancialHistoryTab`

    const [isTeamAutoPopulated, setIsTeamAutoPopulated] = useState(false);
    const [autoPopulateWarning, setAutoPopulateWarning] = useState(null);

    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
    const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(null);
    const [showCommishLogin, setShowCommishLogin] = useState(false);

    const [filterTeam, setFilterTeam] = useState(''); // Stores display name for filter dropdown

    const [debitStructureData, setDebitStructureData] = useState([]);
    const [creditStructureData, setCreditStructureData] = useState([]);
    const [isEditingStructure, setIsEditingStructure] = useState(false);
    const [loadingStructure, setLoadingStructure] = useState(true);

    const [transactionPot, setTransactionPot] = useState(0);

    const [currentPage, setCurrentPage] = useState(1);
    const transactionsPerPage = 10;

    // New state for active tab
    const [activeTab, setActiveTab] = useState('transactions'); // 'transactions', 'overall_history', or 'matchup_history'

    // Use global variable for Commish UID
    const COMMISH_UID = typeof __commish_uid !== 'undefined' ? __commish_uid : null;
    const isCommish = userId && COMMISH_UID && userId === COMMISH_UID;


    const getCategoriesForType = useCallback((currentType) => {
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
    }, []);

    const defaultDebitStructure = useMemo(() => [
        { name: 'League Entry Fee', amount: '$70', description: 'Paid per team for entry.' },
        { name: 'Waivers/Free Agents', amount: '$1', description: 'Per transaction.' },
        { name: 'Trades', amount: '$2', description: 'Per team involved.' },
        { name: 'Other Fee', amount: '', description: 'Miscellaneous fees.' },
    ], []);

    const defaultCreditStructure = useMemo(() => [
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
    ], []);


    useEffect(() => {
        const categories = getCategoriesForType(type);
        if (categories.length > 0) {
            if (!categories.some(cat => cat.value === category)) {
                setCategory(categories[0].value);
            }
        } else {
            setCategory('');
        }
        if (!(type === 'debit' && category === 'trade_fee')) {
            setTradeTeams(['', '']);
            setNumTrades(1);
            setTradeEntryMethod('multi_team');
        }
        if (!(type === 'debit' && category === 'waiver_fa_fee')) {
            setWaiverEntries([{ team: '', numPickups: 1 }]);
        }
    }, [type, category, getCategoriesForType]);


    useEffect(() => {
        if (historicalData && historicalData.leaguesMetadataBySeason) {
            const yearsSet = new Set();
            let maxSeasonOverall = 0;

            Object.keys(historicalData.leaguesMetadataBySeason).forEach(yearStr => {
                const year = parseInt(yearStr);
                if (!isNaN(year)) {
                    yearsSet.add(year);
                    if (year > maxSeasonOverall) {
                        maxSeasonOverall = year;
                    }
                }
            });

            const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
            setAvailableSeasons(sortedYears);

            if (maxSeasonOverall > 0 && selectedSeason === null) {
                setSelectedSeason(sortedYears[0]); // Set to the most recent season by default
            }
        } else {
            setAvailableSeasons([]);
            setSelectedSeason(null);
        }
    }, [historicalData, selectedSeason]);


    useEffect(() => {
        // Add sleeperLoading and getDisplayName to the condition
        if (sleeperLoading || !isAuthReady || !selectedSeason || !historicalData || !historicalData.usersBySeason || !historicalData.matchupsBySeason || typeof getDisplayName !== 'function') {
            setUniqueTeams([]);
            setWeeklyHighScores({});
            setCurrentWeekForSelectedSeason(0);
            setActiveTeams(0);
            return;
        }

        const teamsMap = new Map(); // Map to store { display_name: user_id }
        const weeklyScores = {};
        let maxWeekForCurrentSelectedSeason = 0;

        const usersForSelectedSeason = historicalData.usersBySeason[selectedSeason];
        const matchupsForSelectedSeason = historicalData.matchupsBySeason[selectedSeason];


        if (usersForSelectedSeason && matchupsForSelectedSeason) {
            // Populate teamsMap with display names and user_ids
            if (Array.isArray(usersForSelectedSeason)) {
                usersForSelectedSeason.forEach(user => {
                    const displayName = getDisplayName(user.user_id, selectedSeason);
                    if (displayName && displayName !== 'Unknown User') {
                        teamsMap.set(displayName, user.user_id); // Store display name -> user_id
                    }
                });
            } else if (typeof usersForSelectedSeason === 'object' && usersForSelectedSeason !== null) {
                Object.values(usersForSelectedSeason).forEach(user => {
                    const displayName = getDisplayName(user.user_id, selectedSeason);
                    if (displayName && displayName !== 'Unknown User') {
                        teamsMap.set(displayName, user.user_id);
                    }
                });
            }

            // Iterate through matchups to find weekly high scores
            // matchupsForSelectedSeason is an object where keys are week numbers
            Object.values(matchupsForSelectedSeason).forEach(weekMatchups => {
                // Ensure weekMatchups is an array before iterating
                if (Array.isArray(weekMatchups)) {
                    weekMatchups.forEach(match => {
                        const week = match.week;
                        if (week) {
                            if (!weeklyScores[week]) {
                                weeklyScores[week] = [];
                            }
                            // Ensure team names are resolved using getDisplayName for the specific season
                            // Use owner_id if available, otherwise roster_id (though owner_id is preferred for display)
                            const team1Id = match.team1_details?.owner_id || match.roster_id;
                            const team2Id = match.team2_details?.owner_id || match.matchup_id;

                            const team1Name = getDisplayName(team1Id, selectedSeason);
                            const team2Name = getDisplayName(team2Id, selectedSeason);

                            if (team1Name && match.team1_points != null) {
                                weeklyScores[week].push({ team: team1Name, score: parseFloat(match.team1_points) });
                            }
                            if (team2Name && match.team2_points != null) {
                                weeklyScores[week].push({ team: team2Name, score: parseFloat(match.team2_points) });
                            }
                            if (week > maxWeekForCurrentSelectedSeason) {
                                maxWeekForCurrentSelectedSeason = week;
                            }
                        }
                    });
                }
            });
        }

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


        // Sort by display name, but store user_id for selection
        const sortedTeamsForSelect = Array.from(teamsMap.entries())
                                        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
                                        .map(([displayName, userId]) => ({ label: displayName, value: userId }));

        setUniqueTeams([{ label: 'All Teams (Multiplied)', value: 'ALL_TEAMS_MULTIPLIER' }, ...sortedTeamsForSelect]);
        setActiveTeams(sortedTeamsForSelect.length); // Count actual teams
    }, [selectedSeason, historicalData, getDisplayName, sleeperLoading, isAuthReady]); // Dependency updated

    useEffect(() => {
        setAutoPopulateWarning(null);
        setIsTeamAutoPopulated(false);

        if (!(type === 'debit' && category === 'trade_fee')) {
            setTradeTeams(['', '']);
            setNumTrades(1);
            setTradeEntryMethod('multi_team');
        }
        if (!(type === 'debit' && category === 'waiver_fa_fee')) {
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
                    // Store the actual team name (display name) as it's coming from weeklyHighScores
                    // The transaction will store this display name, and getDisplayName will handle it.
                    setTeamName(weekData.highest.team);
                    setDescription(`Payout: Weekly 1st Points - ${weekData.highest.team} (${weekData.highest.score} pts)`);
                    setIsTeamAutoPopulated(true);
                } else if (category === 'weekly_2nd_points' && weekData.secondHighest) {
                    // Store the actual team name (display name)
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
            setTeamName('');
            setDescription('');
        }
    }, [category, weeklyPointsWeek, weeklyHighScores, type, selectedSeason]);

    // Initialize Firebase and set up authentication
    useEffect(() => {
        let appInstance;
        let firestoreInstance;
        let firebaseAuthInstance;

        try {
            // Directly use the firebaseConfig object
            appInstance = initializeApp(firebaseConfig, firebaseConfig.appId); // Pass appId as the name
            firestoreInstance = getFirestore(appInstance);
            firebaseAuthInstance = getAuth(appInstance);

            setDb(firestoreInstance);
            setAuth(firebaseAuthInstance);

            const unsubscribe = onAuthStateChanged(firebaseAuthInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // Use __initial_auth_token if available, otherwise sign in anonymously
                    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (initialAuthToken) {
                        try {
                            await signInWithCustomToken(firebaseAuthInstance, initialAuthToken);
                            setUserId(firebaseAuthInstance.currentUser?.uid);
                        } catch (tokenSignInError) {
                            console.error("Custom token sign-in failed, falling back to anonymous:", tokenSignInError);
                            try {
                                await signInAnonymously(firebaseAuthInstance);
                                setUserId(firebaseAuthInstance.currentUser?.uid);
                            } catch (anonSignInError) {
                                setError(`Failed to sign in: ${anonSignInError.message}. View access may be limited.`);
                                setUserId(null);
                            }
                        }
                    } else {
                        try {
                            await signInAnonymously(firebaseAuthInstance);
                            setUserId(firebaseAuthInstance.currentUser?.uid);
                        } catch (anonSignInError) {
                            setError(`Failed to sign in: ${anonSignInError.message}. View access may be limited.`);
                                setUserId(null);
                        }
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (initError) {
            setError(`Firebase initialization failed: ${initError.message}`);
            setLoading(false);
            setIsAuthReady(true);
        }
    }, []); // Empty dependency array to run only once on mount

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError(null);
        if (!auth) {
            setLoginError("Authentication service not initialized.");
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            setEmail('');
            setPassword('');
            setError(null);
            setShowCommishLogin(false);
        } catch (error) {
            setLoginError(`Login failed: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setLoginError(null);
            setError(null);
        } catch (error) {
            setLoginError(`Logout failed: ${error.message}`);
        }
    };

    // Fetch transactions for the currently selected season (for main view)
    useEffect(() => {
        // Combine loading state from Sleeper data and Firebase
        setLoading(sleeperLoading || !isAuthReady);
        setError(sleeperError); // Prioritize Sleeper data error

        if (!db || !isAuthReady || selectedSeason === null || activeTab !== 'transactions' || sleeperLoading || sleeperError) {
            setTransactions([]);
            setTransactionPot(0);
            setSelectedTransactionIds([]);
            if (activeTab === 'transactions' && !sleeperLoading && !sleeperError) setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // Use the appId from firebaseConfig directly
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const transactionCollectionPath = `/artifacts/${appId}/public/data/financial_transactions`;

        const q = query(
            collection(db, transactionCollectionPath),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isAuthReady) return;
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const filteredBySeason = fetchedTransactions.filter(t =>
                selectedSeason === 0 || t.season === selectedSeason
            );
            setTransactions(filteredBySeason);

            const currentSeasonTransactionPot = filteredBySeason
                .filter(t =>
                    (t.category === 'waiver_fa_fee' || t.category === 'trade_fee')
                )
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            setTransactionPot(currentSeasonTransactionPot);

            setLoading(false);
            setSelectedTransactionIds([]);
        }, (firestoreError) => {
            setError(`Failed to load financial data: ${firestoreError.message}.`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, selectedSeason, activeTab, sleeperLoading, sleeperError]);


    // Fetch ALL transactions (for overall history tab)
    useEffect(() => {
        // Combine loading state from Sleeper data and Firebase
        setLoading(sleeperLoading || !isAuthReady);
        setError(sleeperError); // Prioritize Sleeper data error

        if (!db || !isAuthReady || activeTab !== 'overall_history' || sleeperLoading || sleeperError) {
            setAllTransactions([]);
            if (activeTab === 'overall_history' && !sleeperLoading && !sleeperError) setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const transactionCollectionPath = `/artifacts/${appId}/public/data/financial_transactions`;

        const q = query(
            collection(db, transactionCollectionPath),
            orderBy('date', 'asc') // Order by date ascending for consistent yearly calculations
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isAuthReady) return;
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllTransactions(fetchedTransactions);
            setLoading(false);
        }, (firestoreError) => {
            setError(`Failed to load overall financial data: ${firestoreError.message}.`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, activeTab, sleeperLoading, sleeperError]);

    // Fetch and listen for updates to the Fee/Payout structure for the SELECTED season
    useEffect(() => {
        if (!db || !isAuthReady || selectedSeason === null || sleeperLoading || sleeperError) {
            setLoadingStructure(false);
            setDebitStructureData(defaultDebitStructure);
            setCreditStructureData(defaultCreditStructure);
            return;
        }

        setLoadingStructure(true);
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const structureDocRef = doc(db, `/artifacts/${appId}/public/data/league_structure/${selectedSeason}`);

        const unsubscribe = onSnapshot(structureDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDebitStructureData(data.fees || defaultDebitStructure);
                setCreditStructureData(data.payouts || defaultCreditStructure);
            } else {
                // If no specific structure for the season, load defaults
                setDebitStructureData(defaultDebitStructure);
                setCreditStructureData(defaultCreditStructure);
            }
            setLoadingStructure(false);
            // Clear any previous error related to structure loading if successful
            setError(null);
        }, (firestoreError) => {
            // Log the error to the console for debugging
            console.warn(`Failed to load league structure for season ${selectedSeason}: ${firestoreError.message}. Displaying default structure.`);
            // Do NOT set the general error state for the UI to prevent it from displaying.
            setLoadingStructure(false);
            setDebitStructureData(defaultDebitStructure);
            setCreditStructureData(defaultCreditStructure);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, selectedSeason, defaultDebitStructure, defaultCreditStructure, sleeperLoading, sleeperError]);

    const handleAddTransaction = async (e) => {
        e.preventDefault();

        setError(null);
        setAutoPopulateWarning(null);

        if (!db || !userId) {
            setError("Database not ready or user not authenticated. Cannot add transaction.");
            return;
        }
        if (!isCommish) { setError("You do not have permission to add transactions."); return; }
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            setError("Please enter a valid positive amount.");
            return;
        }
        // For waiver/trade fees, description is auto-generated so no need to check if empty
        if (!description.trim() && category !== 'waiver_fa_fee' && !(category === 'trade_fee' && tradeEntryMethod === 'single_team')) {
            setError("Description cannot be empty.");
            return;
        }
        if (typeof getDisplayName !== 'function') {
            setError("Sleeper data not fully loaded. Please wait and try again.");
            return;
        }

        let transactionsToAdd = [];
        const transactionDate = serverTimestamp(); // Use a single timestamp for all related transactions

        if (type === 'debit' && category === 'trade_fee') {
            if (tradeEntryMethod === 'multi_team') {
                const validTradeTeams = tradeTeams.filter(teamId => teamId.trim() !== ''); // teamId is user_id
                if (validTradeTeams.length < 2) {
                    setError("Please select at least two teams for a trade fee.");
                    return;
                }
                if (new Set(validTradeTeams).size !== validTradeTeams.length) {
                    setError("Duplicate teams detected for trade fee. Please select unique teams.");
                    return;
                }

                for (const teamId of validTradeTeams) { // teamId is user_id
                    transactionsToAdd.push({
                        amount: parseFloat(amount),
                        description: description.trim(),
                        type: type, // 'debit'
                        teamName: teamId, // Store user_id
                        date: transactionDate,
                        userId: userId,
                        category: category,
                        season: selectedSeason, // Use selectedSeason for new transactions
                        weekNumber: currentWeekForSelectedSeason,
                        teamsInvolvedCount: 1,
                    });
                }
            } else if (tradeEntryMethod === 'single_team') {
                if (!teamName.trim()) { // teamName is user_id
                    setError("Please select a team for the single team trade entry.");
                    return;
                }
                if (isNaN(numTrades) || numTrades <= 0) {
                    setError("Please enter a valid positive number of trades.");
                    return;
                }
                transactionsToAdd.push({
                    amount: parseFloat(amount) * numTrades,
                    // Resolve display name for description, but store user_id in teamName
                    description: `Trade Fee: ${getDisplayName(teamName, selectedSeason)} - ${numTrades} trade(s)`,
                    type: type,
                    teamName: teamName, // Store user_id
                    date: transactionDate,
                    userId: userId,
                    category: category,
                    season: selectedSeason,
                    weekNumber: currentWeekForSelectedSeason,
                    numTrades: numTrades,
                    teamsInvolvedCount: 1,
                });
            }
        } else if (type === 'debit' && category === 'waiver_fa_fee') {
            if (waiverEntries.length === 0 || waiverEntries.some(entry => !entry.team || entry.numPickups <= 0)) {
                setError("Please add at least one valid waiver/FA entry with a team and positive number of pickups.");
                return;
            }
            const perPickupCost = parseFloat(amount);

            for (const entry of waiverEntries) {
                if (entry.team && entry.numPickups > 0) { // entry.team is user_id
                    transactionsToAdd.push({
                        amount: perPickupCost * entry.numPickups,
                        // Resolve display name for description, but store user_id in teamName
                        description: `Waiver/FA Fee: ${getDisplayName(entry.team, selectedSeason)} - ${entry.numPickups} pickup(s)`,
                        type: type,
                        teamName: entry.team, // Store user_id
                        date: transactionDate,
                        userId: userId,
                        category: category,
                        season: selectedSeason,
                        weekNumber: currentWeekForSelectedSeason,
                        numPickups: entry.numPickups,
                    });
                }
            }
            if (transactionsToAdd.length === 0) {
                setError("No valid waiver/FA entries to add.");
                return;
            }

        } else {
            if (!teamName.trim() && teamName !== 'ALL_TEAMS_MULTIPLIER') { // teamName is user_id or 'ALL_TEAMS_MULTIPLIER'
                setError("Please select an Associated Team.");
                return;
            }

            let finalAmount = parseFloat(amount);
            let finalTeamName = teamName; // This will be user_id or 'ALL_TEAMS_MULTIPLIER'
            let teamsInvolved = 1;

            if (type === 'debit' && teamName === 'ALL_TEAMS_MULTIPLIER') {
                if (activeTeamsCount === 0) {
                    setError("Cannot process 'All Teams' transaction: No active teams found in the selected season.");
                    return;
                }
                finalAmount = finalAmount * activeTeamsCount;
                finalTeamName = 'All Teams'; // Store literal 'All Teams'
                teamsInvolved = activeTeamsCount;
            } else if (type === 'credit' && teamName === 'ALL_TEAMS_MULTIPLIER') {
                finalTeamName = 'All Teams'; // Store literal 'All Teams'
            }

            transactionsToAdd.push({
                amount: finalAmount,
                description: description.trim(),
                type: type,
                teamName: finalTeamName, // Store user_id or 'All Teams'
                date: transactionDate,
                userId: userId,
                category: category,
                season: selectedSeason,
                weekNumber: currentWeekForSelectedSeason,
                teamsInvolvedCount: teamsInvolved,
            });

            if (type === 'credit') {
                if (category === 'weekly_1st_points' || category === 'weekly_2nd_points') {
                    if (!weeklyPointsWeek || isNaN(parseInt(weeklyPointsWeek))) {
                        setError("Please enter a valid week number for weekly points payouts.");
                        return;
                    }
                    const weekNum = parseInt(weeklyPointsWeek);
                    transactionsToAdd[0].weekNumber = weekNum;

                    const weekData = weeklyHighScores[weekNum];
                    if (weekData) {
                        if (category === 'weekly_1st_points' && weekData.highest) {
                            // weeklyHighScores.highest.team already contains the display name
                            transactionsToAdd[0].teamName = weekData.highest.team; // Store display name
                            transactionsToAdd[0].description = `Payout: Weekly 1st Points - ${weekData.highest.team} (${weekData.highest.score} pts)`;
                        } else if (category === 'weekly_2nd_points' && weekData.secondHighest) {
                            transactionsToAdd[0].teamName = weekData.secondHighest.team; // Store display name
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
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const transactionCollectionRef = collection(db, `/artifacts/${appId}/public/data/financial_transactions`);

            for (const transaction of transactionsToAdd) {
                await addDoc(transactionCollectionRef, transaction);
            }

            setAmount('');
            setDescription('');
            setType('debit');
            setCategory(getCategoriesForType('debit')[0].value);
            setTeamName('');
            setTradeTeams(['', '']);
            setWaiverEntries([{ team: '', numPickups: 1 }]);
            setWeeklyPointsWeek('');
            setSidePotName('');
            setNumTrades(1);
            setTradeEntryMethod('multi_team');
            setError(null);
            setAutoPopulateWarning(null);
        } catch (addError) {
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
        if (!isCommish) { setError("You do not have permission to delete transactions."); return; }

        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const transactionDocRef = doc(db, `/artifacts/${appId}/public/data/financial_transactions`, transactionToDelete.id);
            await deleteDoc(transactionDocRef);
            setError(null);
            setTransactionToDelete(null);
            setSelectedTransactionIds([]);
        } catch (deleteError) {
            setError(`Failed to delete transaction: ${deleteError.message}. Please check your permissions.`);
        }
    };

    const cancelDelete = () => {
        setShowConfirmDelete(false);
        setTransactionToDelete(null);
    };

    const handleAddWaiverEntry = () => {
        setWaiverEntries([...waiverEntries, { team: '', numPickups: 1 }]);
    };

    const handleRemoveWaiverEntry = (indexToRemove) => {
        setWaiverEntries(waiverEntries.filter((_, index) => index !== indexToRemove));
    };

    const handleWaiverEntryChange = (index, field, value) => {
        const newWaiverEntries = [...waiverEntries];
        if (field === 'numPickups') {
            newWaiverEntries[index][field] = parseInt(value) || 0;
        } else {
            newWaiverEntries[index][field] = value; // value will be user_id
        }
        setWaiverEntries(newWaiverEntries);
    };

    const isTeamSelectionDisabled = isTeamAutoPopulated || (type === 'debit' && (category === 'waiver_fa_fee'));

    const filteredTransactions = useMemo(() => {
        if (typeof getDisplayName !== 'function') {
            return []; // Return empty if getDisplayName is not available
        }
        return transactions.filter(t => {
            // Resolve the team name for filtering purposes
            const transactionSeason = t.season ? parseInt(t.season) : (t.date?.toDate ? new Date(t.date.toDate()).getFullYear() : null);
            const displayTeam = getDisplayName(t.teamName, transactionSeason); // Use getDisplayName from context
            if (filterTeam === '') {
                return true;
            } else if (filterTeam === 'All Teams') {
                return t.teamName === 'All Teams'; // Still filter by literal 'All Teams' stored
            } else {
                // Filter by specific team, also include 'All Teams' debits for individual team view
                return (displayTeam === filterTeam || (t.teamName === 'All Teams' && t.type === 'debit'));
            }
        });
    }, [transactions, filterTeam, getDisplayName]);

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
            setSelectedTransactionIds([]);
        } else {
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
        if (!isCommish) { setError("You do not have permission to delete transactions."); return; }

        try {
            const batch = writeBatch(db);
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            selectedTransactionIds.forEach(id => {
                const docRef = doc(db, `/artifacts/${appId}/public/data/financial_transactions`, id);
                batch.delete(docRef);
            });
            await batch.commit();
            setError(null);
            setSelectedTransactionIds([]);
        } catch (bulkDeleteError) {
            setError(`Failed to delete selected transactions: ${bulkDeleteError.message}.`);
        }
    };

    const cancelBulkDelete = () => {
        setShowConfirmBulkDelete(false);
    };

    const overallDebits = transactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const overallCredits = transactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const overallNetBalance = overallDebits - overallCredits;

    // Calculate team summary data for the CURRENTLY SELECTED season
    const teamSummary = useMemo(() => {
        if (typeof getDisplayName !== 'function') {
            return {}; // Return empty if getDisplayName is not available
        }
        const summary = {};
        // Initialize teamSummary with all unique display names, not user_ids
        uniqueTeams.filter(team => team.value !== 'ALL_TEAMS_MULTIPLIER').forEach(team => {
            summary[team.label] = { // Use label (display name) as key
                totalDebits: 0,
                totalCredits: 0,
                netBalance: 0,
                totalDebitsLessEntryFee: 0,
                winningsExtraFees: 0,
            };
        });

        transactions.forEach(t => {
            // Resolve the team name for summary calculation
            const transactionSeason = t.season ? parseInt(t.season) : (t.date?.toDate ? new Date(t.date.toDate()).getFullYear() : null);
            const displayTeamName = getDisplayName(t.teamName, transactionSeason); // Use getDisplayName from context

            if (t.teamName === 'All Teams' && t.type === 'debit' && t.teamsInvolvedCount > 0) {
                const perTeamAmount = t.amount / t.teamsInvolvedCount;
                // Iterate over actual display names for initialization
                uniqueTeams.filter(team => team.value !== 'ALL_TEAMS_MULTIPLIER').forEach(teamOption => {
                    if (summary[teamOption.label]) { // Use label (display name) for lookup
                        summary[teamOption.label].totalDebits += perTeamAmount;
                        if (t.category !== 'entry_fee') {
                            summary[teamOption.label].totalDebitsLessEntryFee += perTeamAmount;
                        }
                    }
                });
            } else if (summary[displayTeamName]) { // Use the resolved display name for lookup in teamSummary
                if (t.type === 'debit') {
                    summary[displayTeamName].totalDebits += (t.amount || 0);
                    if (t.category !== 'entry_fee') {
                        summary[displayTeamName].totalDebitsLessEntryFee += (t.amount || 0);
                    }
                } else if (t.type === 'credit') {
                    summary[displayTeamName].totalCredits += (t.amount || 0);
                }
            }
        });

        Object.keys(summary).forEach(team => {
            summary[team].netBalance = summary[team].totalCredits - summary[team].totalDebits;
            summary[team].winningsExtraFees = summary[team].totalCredits - summary[team].totalDebitsLessEntryFee;
        });
        return summary;
    }, [transactions, uniqueTeams, getDisplayName]);

    const handleAddTradeTeam = () => {
        setTradeTeams([...tradeTeams, '']);
    };

    const handleRemoveTradeTeam = (indexToRemove) => {
        setTradeTeams(tradeTeams.filter((_, index) => index !== indexToRemove));
    };

    const handleTradeTeamChange = (index, value) => {
        const newTradeTeams = [...tradeTeams];
        newTradeTeams[index] = value; // value is user_id
        setTradeTeams(newTradeTeams);
    };

    // `nonAllTeams` now refers to the objects { label, value } from uniqueTeams
    const nonAllTeamsOptions = uniqueTeams.filter(team => team.value !== 'ALL_TEAMS_MULTIPLIER');

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
        if (!db || !isCommish || selectedSeason === null) {
            setError("Cannot save structure: Not authenticated as commish, database not ready, or no season selected.");
            return;
        }
        setLoadingStructure(true);
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            // Sanitize structure data before saving
            const sanitizedDebitStructure = debitStructureData.map(item => {
                // Remove non-numeric characters (except period) for validation
                const cleanedValue = String(item.amount || '').replace(/[^0-9.]/g, '');
                const parsedValue = parseFloat(cleanedValue);

                return {
                    name: String(item.name || ''),
                    // Store the original amount string if it can be parsed as a number after cleaning, otherwise null
                    amount: isNaN(parsedValue) ? null : String(item.amount || ''),
                    description: String(item.description || ''),
                };
            });

            const sanitizedCreditStructure = creditStructureData.map(item => {
                const cleanedValue = String(item.amount || '').replace(/[^0-9.]/g, '');
                const parsedValue = parseFloat(cleanedValue);
                return {
                    name: String(item.name || ''),
                    amount: isNaN(parsedValue) ? null : String(item.amount || ''),
                    description: String(item.description || ''),
                };
            });

            const structureDocRef = doc(db, `/artifacts/${appId}/public/data/league_structure/${selectedSeason}`);
            await setDoc(structureDocRef, {
                fees: sanitizedDebitStructure,
                payouts: sanitizedCreditStructure,
                lastUpdated: serverTimestamp()
            });
            setIsEditingStructure(false);
            setError(null);
        } catch (saveError) {
            setError(`Failed to save league structure for season ${selectedSeason}: ${saveError.message}`);
        } finally {
            setLoadingStructure(false);
        }
    };

    const handleCancelEditStructure = () => {
        setIsEditingStructure(false);
        setError(null);
    };

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

    // Derive all unique team names (display names) for the Overall History tab
    const uniqueTeamsForOverallHistory = useMemo(() => {
        if (typeof getDisplayName !== 'function') {
            return []; // Return empty if getDisplayName is not available
        }
        const names = new Set();
        // Iterate through all historical data to gather all unique team names
        if (historicalData && historicalData.usersBySeason) {
            Object.values(historicalData.usersBySeason).forEach(usersInSeason => {
                if (Array.isArray(usersInSeason)) {
                    usersInSeason.forEach(user => {
                        const displayTeam = getDisplayName(user.user_id, user.season); // Pass season to getDisplayName
                        if (displayTeam && displayTeam !== 'Unknown User' && displayTeam !== 'All Teams') {
                            names.add(displayTeam);
                        }
                    });
                } else if (typeof usersInSeason === 'object' && usersInSeason !== null) {
                    Object.values(usersInSeason).forEach(user => {
                        const displayTeam = getDisplayName(user.user_id, user.season); // Pass season to getDisplayName
                        if (displayTeam && displayTeam !== 'Unknown User' && displayTeam !== 'All Teams') {
                            names.add(displayTeam);
                        }
                    });
                }
            });
        }
        // Also include any literal "All Teams" if it exists in transactions
        allTransactions.forEach(t => {
            if (t.teamName === 'All Teams') {
                names.add('All Teams');
            }
        });
        return Array.from(names).sort();
    }, [historicalData, allTransactions, getDisplayName]);

    return (
        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4 mx-auto">
            <h2 className="text-3xl font-extrabold text-blue-800 mb-6 text-center">
                League Financial Tracker
            </h2>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-6">
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-6 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${
                        activeTab === 'transactions' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Transactions
                </button>
                <button
                    onClick={() => setActiveTab('overall_history')}
                    className={`px-6 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${
                        activeTab === 'overall_history' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Overall Financial History
                </button>
                <button
                    onClick={() => setActiveTab('matchup_history')}
                    className={`px-6 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${
                        activeTab === 'matchup_history' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Weekly Matchups
                </button>
            </div>

            <div className="mb-4 text-center text-sm text-gray-600 p-2 bg-blue-50 rounded">
                {COMMISH_UID && isCommish && (
                    <span className="font-semibold mt-1">
                        You are logged in as the Commish.
                    </span>
                )}

                {isAuthReady && !isCommish && ( // Only show login form if not already commish
                    <div className="mt-4">
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
                                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-full max-w-xs"
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
                    </div>
                )}
                {isAuthReady && isCommish && ( // Show logout button only if commish is logged in
                    <div className="mt-4">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors"
                        >
                            Logout (Commish)
                        </button>
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

                    {activeTab === 'transactions' && (
                        <>
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
                                            setCurrentPage(1);
                                            setFilterTeam('');
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
                                    <p className="text-2xl font-bold text-red-900">{formatCurrency(overallDebits)}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg shadow-sm text-center">
                                    <h3 className="text-lg font-semibold text-green-700">Total Payouts</h3>
                                    <p className="text-2xl font-bold text-green-900">{formatCurrency(overallCredits)}</p>
                                </div>
                                <div className={`p-4 rounded-lg shadow-sm text-center ${overallNetBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <h3 className="text-lg font-semibold text-blue-700">League Bank</h3>
                                    <p className={`text-2xl font-bold ${overallNetBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>{formatCurrency(overallNetBalance)}</p>
                                </div>
                                <div className="bg-yellow-50 p-4 rounded-lg shadow-sm text-center">
                                    <h3 className="text-lg font-semibold text-yellow-700">Transaction Pot</h3>
                                    <p className="text-2xl font-bold text-yellow-900">{formatCurrency(transactionPot)}</p>
                                </div>
                            </div>

                            {/* Add New Transaction Form (Conditionally rendered for Commish) */}
                            {isCommish ? (
                                <section className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Add New Transaction ({selectedSeason || 'selected'})</h3>
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
                                                    <option value="debit">Fee</option>
                                                    <option value="credit">Payout</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                            <select
                                                id="category"
                                                value={category}
                                                onChange={(e) => {
                                                    setCategory(e.target.value);
                                                    setWeeklyPointsWeek('');
                                                    setSidePotName('');
                                                    setTeamName('');
                                                    setTradeTeams(['', '']);
                                                    setWaiverEntries([{ team: '', numPickups: 1 }]);
                                                    setDescription('');
                                                    setNumTrades(1);
                                                    setTradeEntryMethod('multi_team');
                                                }}
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            >
                                                {getCategoriesForType(type).map(cat => (
                                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                                ))}
                                            </select>
                                        </div>
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
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Teams Involved in Trade (Min 2)</label>
                                                        {tradeTeams.map((teamId, index) => (
                                                            <div key={index} className="flex items-center space-x-2">
                                                                <select
                                                                    value={teamId}
                                                                    onChange={(e) => handleTradeTeamChange(index, e.target.value)}
                                                                    required
                                                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                                >
                                                                    <option value="">Select Team</option>
                                                                    {nonAllTeamsOptions.map(optionTeam => (
                                                                        <option key={optionTeam.value} value={optionTeam.value}>{optionTeam.label}</option>
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
                                                                {nonAllTeamsOptions.map(team => (
                                                                    <option key={team.value} value={team.value}>{team.label}</option>
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
                                                            {nonAllTeamsOptions.map(optionTeam => (
                                                                <option key={optionTeam.value} value={optionTeam.value}>{optionTeam.label}</option>
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
                                            <div>
                                                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Associated Team</label>
                                                <select
                                                    id="teamName"
                                                    value={teamName} // This will be user_id or 'ALL_TEAMS_MULTIPLIER'
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
                                                    {uniqueTeams.map(teamOption => (
                                                        <option key={teamOption.value} value={teamOption.value}>
                                                            {teamOption.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {autoPopulateWarning && (
                                                    <p className="text-xs text-orange-600 mt-1">{autoPopulateWarning}</p>
                                                )}
                                                {isTeamAutoPopulated && teamName && (
                                                    <p className="text-xs text-gray-500 mt-1">Automatically determined: {getDisplayName(teamName, selectedSeason)}</p>
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
                                null
                            )}

                            {/* Transaction History Table */}
                            <section>
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Transaction History</h3>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="w-1/2">
                                        <label htmlFor="filterTeam" className="block text-sm font-medium text-gray-700 mb-1">Filter by Team:</label>
                                        <select
                                            id="filterTeam"
                                            value={filterTeam} // filterTeam holds display name
                                            onChange={(e) => {
                                                setFilterTeam(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm w-full"
                                        >
                                            <option value="">Show All Teams</option>
                                            {uniqueTeams.filter(team => team.value !== 'ALL_TEAMS_MULTIPLIER').map(team => (
                                                <option key={team.value} value={team.label}>{team.label}</option> // Option value is display name for filter
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
                                                    const transactionSeason = t.season ? parseInt(t.season) : (t.date?.toDate ? new Date(t.date.toDate()).getFullYear() : null);

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
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                                {getDisplayName && (getDisplayName(t.teamName, transactionSeason) || '-')}
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-right border-b border-gray-200">
                                                                <span className={`${t.type === 'debit' ? 'text-red-700' : 'text-green-700'} font-medium`}>
                                                                    {formatCurrency(parseFloat(displayAmount))}
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
                                                                {t.category ? t.category.replace(/_/g, ' ') : 'General'}
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                                {t.weekNumber === 0 ? 'Pre' : (t.weekNumber || '-')}
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
                                        {totalPages > 1 && (
                                            <div className="flex justify-center items-center space-x-2 mt-4">
                                                <button
                                                    onClick={handlePreviousPage}
                                                    disabled={currentPage === 1}
                                                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Previous
                                                </button>
                                                {[...Array(totalPages)].map((_, index) => (
                                                    <button
                                                        key={index + 1}
                                                        onClick={() => paginate(index + 1)}
                                                        className={`px-3 py-1 rounded-md ${
                                                            currentPage === index + 1 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                        }`}
                                                    >
                                                        {index + 1}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={handleNextPage}
                                                    disabled={currentPage === totalPages}
                                                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* Team Financial Summary Section (Current Season) */}
                            {Object.keys(teamSummary).length > 0 && (
                                <section className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Team Financial Summary (Current Season)</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                            <thead className="bg-blue-100">
                                                <tr>
                                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team Name</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Fees</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Payouts</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Net Balance</th>
                                                    <th className="py-3 px-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Winnings/(Extra Fees)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(teamSummary).sort(([teamA], [teamB]) => teamA.localeCompare(teamB)).map(([teamDisplayName, data], index) => (
                                                    <tr key={teamDisplayName} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{teamDisplayName}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-gray-900 font-medium border-b border-gray-200">{formatCurrency(data.totalDebits)}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-gray-900 font-medium border-b border-gray-200">{formatCurrency(data.totalCredits)}</td>
                                                        <td className={`py-2 px-4 text-sm text-right font-bold border-b border-gray-200 ${data.netBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                                            {formatCurrency(data.netBalance)}
                                                        </td>
                                                        <td className={`py-2 px-4 text-sm text-right font-bold border-b border-gray-200 ${data.winningsExtraFees >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                                            {formatCurrency(data.winningsExtraFees)}
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
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">League Fee & Payout Structure ({selectedSeason || 'selected'})</h3>
                                {isCommish && !isEditingStructure && (
                                    <div className="text-center mb-4">
                                        <button
                                            onClick={() => setIsEditingStructure(true)}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                        >
                                            Edit Structure
                                        </button>
                                    </div>
                                )}

                                {loadingStructure ? (
                                    <p className="text-center text-blue-600">Loading structure...</p>
                                ) : isEditingStructure ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xl font-semibold text-red-700 mb-3">Fees</h4>
                                            {debitStructureData.map((item, index) => (
                                                <div key={index} className="flex flex-col md:flex-row gap-2 mb-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => handleDebitStructureChange(index, 'name', e.target.value)}
                                                        placeholder="Fee Name"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.amount}
                                                        onChange={(e) => handleDebitStructureChange(index, 'amount', e.target.value)}
                                                        placeholder="Amount"
                                                        className="w-24 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => handleDebitStructureChange(index, 'description', e.target.value)}
                                                        placeholder="Description (optional)"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveDebitItem(index)}
                                                        className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={handleAddDebitItem}
                                                className="mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
                                            >
                                                Add Fee Item
                                            </button>
                                        </div>

                                        <div>
                                            <h4 className="text-xl font-semibold text-green-700 mb-3">Payouts</h4>
                                            {creditStructureData.map((item, index) => (
                                                <div key={index} className="flex flex-col md:flex-row gap-2 mb-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => handleCreditStructureChange(index, 'name', e.target.value)}
                                                        placeholder="Payout Name"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.amount}
                                                        onChange={(e) => handleCreditStructureChange(index, 'amount', e.target.value)}
                                                        placeholder="Amount (optional)"
                                                        className="w-24 px-3 py-2 border rounded-md"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => handleCreditStructureChange(index, 'description', e.target.value)}
                                                        placeholder="Description (optional)"
                                                        className="flex-1 px-3 py-2 border rounded-md"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCreditItem(index)}
                                                        className="p-2 bg-red-400 text-white rounded-md hover:bg-red-500"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={handleAddCreditItem}
                                                className="mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
                                            >
                                                Add Payout Item
                                            </button>
                                        </div>
                                        <div className="flex justify-center space-x-4 mt-6">
                                            <button
                                                type="button"
                                                onClick={handleSaveStructure}
                                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-md"
                                            >
                                                Save Structure
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCancelEditStructure}
                                                className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold rounded-md shadow-md"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xl font-semibold text-red-700 mb-3">Fees</h4>
                                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                {debitStructureData.map((item, index) => (
                                                    <li key={index}>
                                                        <strong>{item.name}:</strong> {item.amount}{item.description && ` - ${item.description}`}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-semibold text-green-700 mb-3">Payouts</h4>
                                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                {creditStructureData.map((item, index) => (
                                                    <li key={index}>
                                                        <strong>{item.name}:</strong> {item.amount}{item.description && ` - ${item.description}`}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {activeTab === 'overall_history' && (
                        <OverallFinancialHistoryTab
                            allTransactions={allTransactions}
                            getDisplayName={getDisplayName}
                            uniqueTeamsForOverallHistory={uniqueTeamsForOverallHistory}
                        />
                    )}

                    {activeTab === 'matchup_history' && (
                        <WeeklyMatchupHistoryTab />
                    )}
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

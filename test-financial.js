// Test script to verify financial calculations
import { calculateTeamFinancialTotals, getTransactionTotal, formatCurrency } from '../src/utils/financialCalculations.js';

// Mock data for testing
const mockTransactions = [
    {
        type: 'Fee',
        category: 'Entry Fee',
        amount: '100',
        team: ['user1'],
        quantity: 1
    },
    {
        type: 'Fee',
        category: 'Waiver/FA Fee',
        amount: '5',
        team: ['user1'],
        quantity: 3
    },
    {
        type: 'Payout',
        category: 'Weekly 1st',
        amount: '25',
        team: ['user1'],
        quantity: 1
    },
    {
        type: 'Fee',
        category: 'Trade Fee',
        amount: '10',
        team: ['user1', 'user2'],
        quantity: 1
    }
];

const mockUsersData = [
    {
        user_id: 'user1',
        display_name: 'Team Alpha',
        username: 'alpha'
    },
    {
        user_id: 'user2',
        display_name: 'Team Beta',
        username: 'beta'
    }
];

// Test calculations
console.log('Testing financial calculations...');

// Test Team Alpha
const teamAlphaResults = calculateTeamFinancialTotals(mockTransactions, 'Team Alpha', mockUsersData);
console.log('Team Alpha Financial Data:', teamAlphaResults);

// Expected: 
// - Entry Fee: $100
// - Waiver/FA Fee: $5 * 3 = $15
// - Trade Fee: $10 (shared cost)
// - Total Fees: $125
// - Total Payouts: $25
// - Net Total: $25 - $125 = -$100

console.log('Expected: Net Total should be -$100');
console.log('Actual Net Total:', formatCurrency(teamAlphaResults.netTotal));

// Test individual transaction totals
console.log('\nTesting individual transaction totals:');
mockTransactions.forEach((transaction, index) => {
    const total = getTransactionTotal(transaction);
    console.log(`Transaction ${index + 1} (${transaction.category}): ${formatCurrency(total)}`);
});
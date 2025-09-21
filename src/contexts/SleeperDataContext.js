import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import {
    fetchLeagueData,
    fetchUsersData,
    fetchRosterData,
    fetchNFLPlayers,
    fetchNFLState,
    fetchAllHistoricalMatchups,
    fetchAllDraftHistory, // Import the comprehensive draft history function
} from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config'; // Importing CURRENT_LEAGUE_ID from config.js

// IMPORT THE CALCULATION FUNCTION HERE
import { calculateAllLeagueMetrics } from '../utils/calculations';
// NEW: Import new calculation functions for overall draft metrics (from draftCalculations)
import { enrichPickForCalculations, calculatePlayerValue, calculatePickSlotValue, generateExpectedVorpByPickSlot, calculateVORPDelta } from '../utils/draftCalculations';
// NEW: Import player stats calculation functions (from sleeperPlayerStats)
import { fetchPlayerStats, fetchLeagueScoringSettings, fetchLeagueRosterSettings, calculateFantasyPoints, rankPlayersByFantasyPoints, calculateVORP } from '../utils/sleeperPlayerStats';


import logger from '../utils/logger';
import badgesUtil from '../utils/badges';

// 1. Create the Context
const SleeperDataContext = createContext();

// Default league ID for demonstration/fallback.
// If CURRENT_LEAGUE_ID from config.js is undefined, this ID will be used.
const FALLBACK_LEAGUE_ID = '1074092015093413888'; // Example ID, replace with a valid one if needed

// Small concurrency-limited mapper: runs asyncFn over items with at most `limit` concurrent promises
const pMapLimit = async (items = [], limit = 5, asyncFn) => {
    const results = new Array(items.length);
    let i = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
        while (i < items.length) {
            const idx = i++;
            try {
                results[idx] = await asyncFn(items[idx], idx);
            } catch (err) {
                results[idx] = undefined;
            }
        }
    });
    await Promise.all(workers);
    return results;
};

// --- NEW UTILITY FUNCTION TO FETCH TRANSACTIONS ---
// This function fetches transactions for a specific league and week.
    const fetchTransactions = async (leagueId, week) => {
    const url = `https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch transactions for week ${week}. Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
            logger.error(`Error fetching transactions for week ${week}:`, error);
        return [];
    }
};

// 2. Create the Provider Component
export const SleeperDataProvider = ({ children }) => {
    // State to hold all the fetched data
    const [leagueData, setLeagueData] = useState(null);
    const [usersData, setUsersData] = useState(null); // This holds current league's users
    const [rostersWithDetails, setRostersWithDetails] = useState(null); // This holds current league's rosters
    const [nflPlayers, setNflPlayers] = useState(null);
    const [nflState, setNflState] = useState(null);
    const [historicalMatchups, setHistoricalMatchups] = useState(null); // This holds historicalData with rostersBySeason AND usersBySeason

    // NEW STATES FOR DRAFT DATA (will be populated from fetchAllDraftHistory)
    const [draftsBySeason, setDraftsBySeason] = useState({});
    const [draftPicksBySeason, setDraftPicksBySeason] = useState({});

    // NEW STATE FOR PROCESSED SEASONAL RECORDS
    const [processedSeasonalRecords, setProcessedSeasonalRecords] = useState({});
    const [careerDPRData, setCareerDPRData] = useState(null);
    const [badgesByTeam, setBadgesByTeam] = useState({});
    const [recentBadges, setRecentBadges] = useState([]);
    
    // --- NEW: State for storing transactions ---
    const [transactions, setTransactions] = useState([]);

    // State for loading and error handling
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Hardcoded 2018-2021 Yahoo Data with Sleeper User IDs ---
    // This data has been parsed from the spreadsheet you provided and linked to Sleeper User IDs.
    // It will be merged with Sleeper data and used in all calculations.
    const hardcodedYahooData = {
        "2021": {
            // This is already flattened into a single array for the year 2021
            // IMPORTANT: Only include REGULAR SEASON matchups here. Playoff matchups are in winnersBracketBySeason and losersBracketBySeason.
            "matchupsBySeason": [
                // Week 1
                { "team1_roster_id": "1", "team1_score": 155.04, "team2_roster_id": "7", "team2_score": 175.4, "week": "1", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 123.47, "team2_roster_id": "10", "team2_score": 121.27, "week": "1", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 141.71, "team2_roster_id": "12", "team2_score": 135.24, "week": "1", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 151.61, "team2_roster_id": "5", "team2_score": 183.29, "week": "1", "year": "2021", "regSeason": true },
                { "team1_roster_id": "6", "team1_score": 136.88, "team2_roster_id": "11", "team2_score": 168.74, "week": "1", "year": "2021", "regSeason": true },
                { "team1_roster_id": "8", "team1_score": 135.89, "team2_roster_id": "9", "team2_score": 119.19, "week": "1", "year": "2021", "regSeason": true },
                // Week 2
                { "team1_roster_id": "1", "team1_score": 128.19, "team2_roster_id": "3", "team2_score": 179.42, "week": "2", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 125.49, "team2_roster_id": "8", "team2_score": 135.28, "week": "2", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 95.71, "team2_roster_id": "6", "team2_score": 128.81, "week": "2", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 142.02, "team2_roster_id": "11", "team2_score": 136.58, "week": "2", "year": "2021", "regSeason": true },
                { "team1_roster_id": "7", "team1_score": 147.1, "team2_roster_id": "12", "team2_score": 139.7, "week": "2", "year": "2021", "regSeason": true },
                { "team1_roster_id": "9", "team1_score": 182.01, "team2_roster_id": "10", "team2_score": 124.79, "week": "2", "year": "2021", "regSeason": true },
                // Week 3
                { "team1_roster_id": "1", "team1_score": 147.72, "team2_roster_id": "12", "team2_score": 117.53, "week": "3", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 153.86, "team2_roster_id": "9", "team2_score": 137.5, "week": "3", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 126.72, "team2_roster_id": "7", "team2_score": 118.27, "week": "3", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 126.08, "team2_roster_id": "11", "team2_score": 80.37, "week": "3", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 127.67, "team2_roster_id": "6", "team2_score": 165.55, "week": "3", "year": "2021", "regSeason": true },
                { "team1_roster_id": "8", "team1_score": 132.49, "team2_roster_id": "10", "team2_score": 134.76, "week": "3", "year": "2021", "regSeason": true },
                // Week 4
                { "team1_roster_id": "1", "team1_score": 95.22, "team2_roster_id": "8", "team2_score": 139.42, "week": "4", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 110.04, "team2_roster_id": "4", "team2_score": 151.08, "week": "4", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 134.74, "team2_roster_id": "7", "team2_score": 153.16, "week": "4", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 176.2, "team2_roster_id": "10", "team2_score": 110.68, "week": "4", "year": "2021", "regSeason": true },
                { "team1_roster_id": "6", "team1_score": 131.12, "team2_roster_id": "9", "team2_score": 142.27, "week": "4", "year": "2021", "regSeason": true },
                { "team1_roster_id": "11", "team1_score": 131.74, "team2_roster_id": "12", "team2_score": 168.68, "week": "4", "year": "2021", "regSeason": true },
                // Week 5
                { "team1_roster_id": "1", "team1_score": 141.51, "team2_roster_id": "12", "team2_score": 114.22, "week": "5", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 189.6, "team2_roster_id": "7", "team2_score": 111.37, "week": "5", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 168.61, "team2_roster_id": "10", "team2_score": 112.88, "week": "5", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 189.37, "team2_roster_id": "9", "team2_score": 170.56, "week": "5", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 135.89, "team2_roster_id": "11", "team2_score": 118.72, "week": "5", "year": "2021", "regSeason": true },
                { "team1_roster_id": "6", "team1_score": 182.28, "team2_roster_id": "8", "team2_score": 141.35, "week": "5", "year": "2021", "regSeason": true },
                // Week 6
                { "team1_roster_id": "1", "team1_score": 165.57, "team2_roster_id": "9", "team2_score": 147.1, "week": "6", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 156.76, "team2_roster_id": "8", "team2_score": 150.17, "week": "6", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 176.81, "team2_roster_id": "6", "team2_score": 115.06, "week": "6", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 98.65, "team2_roster_id": "5", "team2_score": 167.96, "week": "6", "year": "2021", "regSeason": true },
                { "team1_roster_id": "7", "team1_score": 96.52, "team2_roster_id": "12", "team2_score": 120.88, "week": "6", "year": "2021", "regSeason": true },
                { "team1_roster_id": "10", "team1_score": 119.58, "team2_roster_id": "11", "team2_score": 158.65, "week": "6", "year": "2021", "regSeason": true },
                // Week 7
                { "team1_roster_id": "1", "team1_score": 102.87, "team2_roster_id": "2", "team2_score": 102.36, "week": "7", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 161.6, "team2_roster_id": "9", "team2_score": 127.68, "week": "7", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 131.19, "team2_roster_id": "11", "team2_score": 148.13, "week": "7", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 128.2, "team2_roster_id": "12", "team2_score": 100.82, "week": "7", "year": "2021", "regSeason": true },
                { "team1_roster_id": "6", "team1_score": 123.52, "team2_roster_id": "10", "team2_score": 166.75, "week": "7", "year": "2021", "regSeason": true },
                { "team1_roster_id": "7", "team1_score": 123.8, "team2_roster_id": "8", "team2_score": 136.57, "week": "7", "year": "2021", "regSeason": true },
                // Week 8
                { "team1_roster_id": "1", "team1_score": 122.39, "team2_roster_id": "10", "team2_score": 162.99, "week": "8", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 120.4, "team2_roster_id": "9", "team2_score": 135.55, "week": "8", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 85.95, "team2_roster_id": "8", "team2_score": 138, "week": "8", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 93.82, "team2_roster_id": "12", "team2_score": 153.63, "week": "8", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 123.2, "team2_roster_id": "7", "team2_score": 114.23, "week": "8", "year": "2021", "regSeason": true },
                { "team1_roster_id": "6", "team1_score": 133.31, "team2_roster_id": "11", "team2_score": 147.93, "week": "8", "year": "2021", "regSeason": true },
                // Week 9
                { "team1_roster_id": "1", "team1_score": 77.36, "team2_roster_id": "11", "team2_score": 144.56, "week": "9", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 104.29, "team2_roster_id": "3", "team2_score": 119.83, "week": "9", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 169.03, "team2_roster_id": "6", "team2_score": 103.37, "week": "9", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 127.32, "team2_roster_id": "9", "team2_score": 119.24, "week": "9", "year": "2021", "regSeason": true },
                { "team1_roster_id": "7", "team1_score": 107.79, "team2_roster_id": "10", "team2_score": 89.49, "week": "9", "year": "2021", "regSeason": true },
                { "team1_roster_id": "8", "team1_score": 194.81, "team2_roster_id": "12", "team2_score": 84.42, "week": "9", "year": "2021", "regSeason": true },
                // Week 10
                { "team1_roster_id": "1", "team1_score": 147.35, "team2_roster_id": "5", "team2_score": 164.05, "week": "10", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 136.31, "team2_roster_id": "6", "team2_score": 134.48, "week": "10", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 114.71, "team2_roster_id": "4", "team2_score": 101.82, "week": "10", "year": "2021", "regSeason": true },
                { "team1_roster_id": "7", "team1_score": 108.14, "team2_roster_id": "11", "team2_score": 102.18, "week": "10", "year": "2021", "regSeason": true },
                { "team1_roster_id": "8", "team1_score": 92.51, "team2_roster_id": "10", "team2_score": 119.01, "week": "10", "year": "2021", "regSeason": true },
                { "team1_roster_id": "9", "team1_score": 102.42, "team2_roster_id": "12", "team2_score": 107.53, "week": "10", "year": "2021", "regSeason": true },
                // Week 11
                { "team1_roster_id": "1", "team1_score": 107.51, "team2_roster_id": "3", "team2_score": 173.96, "week": "11", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 132.54, "team2_roster_id": "10", "team2_score": 94.17, "week": "11", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 110.36, "team2_roster_id": "7", "team2_score": 145.77, "week": "11", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 154.05, "team2_roster_id": "8", "team2_score": 199.61, "week": "11", "year": "2021", "regSeason": true },
                { "team1_roster_id": "6", "team1_score": 119.34, "team2_roster_id": "12", "team2_score": 122.8, "week": "11", "year": "2021", "regSeason": true },
                { "team1_roster_id": "9", "team1_score": 142.6, "team2_roster_id": "11", "team2_score": 103.52, "week": "11", "year": "2021", "regSeason": true },
                // Week 12
                { "team1_roster_id": "1", "team1_score": 175.69, "team2_roster_id": "7", "team2_score": 90.75, "week": "12", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 158.17, "team2_roster_id": "11", "team2_score": 104.14, "week": "12", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 159.93, "team2_roster_id": "12", "team2_score": 78.49, "week": "12", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 111.52, "team2_roster_id": "8", "team2_score": 144.08, "week": "12", "year": "2021", "regSeason": true },
                { "team1_roster_id": "5", "team1_score": 171.34, "team2_roster_id": "6", "team2_score": 116, "week": "12", "year": "2021", "regSeason": true },
                { "team1_roster_id": "9", "team1_score": 102.64, "team2_roster_id": "10", "team2_score": 114.13, "week": "12", "year": "2021", "regSeason": true },
                // Week 13
                { "team1_roster_id": "1", "team1_score": 103.23, "team2_roster_id": "4", "team2_score": 106.89, "week": "13", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 138.67, "team2_roster_id": "5", "team2_score": 127.8, "week": "13", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 163.2, "team2_roster_id": "11", "team2_score": 87.06, "week": "13", "year": "2021", "regSeason": true },
                { "team1_roster_id": "6", "team1_score": 110.88, "team2_roster_id": "7", "team2_score": 103.77, "week": "13", "year": "2021", "regSeason": true },
                { "team1_roster_id": "8", "team1_score": 142.74, "team2_roster_id": "9", "team2_score": 167.3, "week": "13", "year": "2021", "regSeason": true },
                { "team1_roster_id": "10", "team1_score": 124.58, "team2_roster_id": "12", "team2_score": 141.24, "week": "13", "year": "2021", "regSeason": true },
                // Week 14
                { "team1_roster_id": "1", "team1_score": 147.16, "team2_roster_id": "6", "team2_score": 123.3, "week": "14", "year": "2021", "regSeason": true },
                { "team1_roster_id": "2", "team1_score": 167.62, "team2_roster_id": "12", "team2_score": 125.51, "week": "14", "year": "2021", "regSeason": true },
                { "team1_roster_id": "3", "team1_score": 143.5, "team2_roster_id": "5", "team2_score": 163.4, "week": "14", "year": "2021", "regSeason": true },
                { "team1_roster_id": "4", "team1_score": 105.78, "team2_roster_id": "10", "team2_score": 132.44, "week": "14", "year": "2021", "regSeason": true },
                { "team1_roster_id": "7", "team1_score": 102.73, "team2_roster_id": "9", "team2_score": 154.67, "week": "14", "year": "2021", "regSeason": true },
                { "team1_roster_id": "8", "team1_score": 156.33, "team2_roster_id": "11", "team2_score": 122.83, "week": "14", "year": "2021", "regSeason": true }
            ],
            "rostersBySeason": [
                { "roster_id": "1", "owner_id": "783790952367169536", "metadata": { "team_name": "Ainsworth" } },
                { "roster_id": "2", "owner_id": "783761299275382784", "metadata": { "team_name": "Bjarnar" } },
                { "roster_id": "3", "owner_id": "783789717920534528", "metadata": { "team_name": "Blumbergs" } },
                { "roster_id": "4", "owner_id": "783789669597999104", "metadata": { "team_name": "Boilard" } },
                { "roster_id": "5", "owner_id": "783767734491127808", "metadata": { "team_name": "Dembski" } },
                { "roster_id": "6", "owner_id": "467074573125283840", "metadata": { "team_name": "Irwin" } },
                { "roster_id": "7", "owner_id": "783778036578418688", "metadata": { "team_name": "Meer" } },
                { "roster_id": "8", "owner_id": "783763304463147008", "metadata": { "team_name": "Neufeglise" } },
                { "roster_id": "9", "owner_id": "783758716272009216", "metadata": { "team_name": "O'Donoghue" } },
                { "roster_id": "10", "owner_id": "783754997035876352", "metadata": { "team_name": "Randall" } },
                { "roster_id": "11", "owner_id": "783761892693905408", "metadata": { "team_name": "Schmitt" } },
                { "roster_id": "12", "owner_id": "787044291066380288", "metadata": { "team_name": "Tomczak" } }
            ],
            "usersBySeason": [
                { "user_id": "783790952367169536", "display_name": "Kurt's WAP" },
                { "user_id": "783761299275382784", "display_name": "Bohan's Bitches" },
                { "user_id": "783789717920534528", "display_name": "Hangin' With Hernandez" },
                { "user_id": "783789669597999104", "display_name": "Camel Toe Hounds" },
                { "user_id": "783767734491127808", "display_name": "Balls Mafia" },
                { "user_id": "467074573125283840", "display_name": "No Romo" },
                { "user_id": "783778036578418688", "display_name": "Christian McCockherpussy" },
                { "user_id": "783763304463147008", "display_name": "The Wolf of Waller Street" },
                { "user_id": "783758716272009216", "display_name": "O'D's Danglers" },
                { "user_id": "783754997035876352", "display_name": "The Team of Constant Sorrow" },
                { "user_id": "783761892693905408", "display_name": "Matt's O'DUI" },
                { "user_id": "787044291066380288", "display_name": "Michael Vick's Vet Clinic" }
            ],
            "leaguesMetadataBySeason": {
                "settings": {
                    "playoff_start_week": 15,
                    // ADDED DEFAULT SCORING SETTINGS FOR 2021 YAHOO DATA
                    "scoring_settings": {
                        "pass_yd": 0.04, "pass_td": 4, "pass_int": -1,
                        "rush_yd": 0.1, "rush_td": 6,
                        "rec_yd": 0.1, "rec": 0.5, "rec_td": 6,
                        "fum_lost": -2
                    },
                    // ADDED DEFAULT ROSTER SETTINGS FOR 2021 YAHOO DATA
                    "roster_positions": ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN", "BN"]
                },
                "season": "2021"
            },
            "winnersBracketBySeason": [
                // Week 15 / Round 1
                { "m": 1, "r": 1, "w": "8", "l": "9", "t1": "8", "t2": "9", "t1_score": 123.49, "t2_score": 113.36, "week": 15, "playoffs": true },
                { "m": 2, "r": 1, "w": "1", "l": "2", "t1": "2", "t2": "1", "t1_score": 142.05, "t2_score": 148.61, "week": 15, "playoffs": true },
                // Week 16 / Semifinals
                { "m": 3, "r": 2, "w": "5", "l": "8", "t1": "5", "t2": "8", "t1_score": 174.09, "t2_score": 114.70, "week": 16, "playoffs": true },
                { "m": 4, "r": 2, "w": "1", "l": "3", "t1": "1", "t2": "3", "t1_score": 163.38, "t2_score": 142.81, "week": 16, "playoffs": true },
                // Week 17 / Championship
                { "m": 5, "r": 3, "p": 1, "w": "1", "l": "5", "t1": "5", "t2": "1", "t1_score": 96.58, "t2_score": 134.51, "week": 17, "playoffs": true },
                // Week 17 / 3rd Place Game (Added)
                { "m": 6, "r": 3, "p": 3, "w": "3", "l": "8", "t1": "8", "t2": "3", "t1_score": 159.89, "t2_score": 163.10, "week": 17, "playoffs": true },
                // Week 16 / 5th Place Game - MOVED FROM LOSERS BRACKET
                { "m": 7, "r": 2, "p": 5, "w": "2", "l": "9", "t1": "9", "t2": "2", "t1_score": 113.09, "t2_score": 143.89, "week": 16, "playoffs": true }
            ],
            "losersBracketBySeason": [
                // Week 15 matches (Round 1 of losers bracket)
                { "m": 2, "r": 1, "w": "11", "l": "4", "t1": "11", "t2": "4", "t1_score": 97.93, "t2_score": 86.30, "week": 15, "playoffs": true }, // Schmitt vs Boilard
                { "m": 3, "r": 1, "w": "6", "l": "7", "t1": "7", "t2": "6", "t1_score": 76.62, "t2_score": 81.32, "week": 15, "playoffs": true }, // Meer vs Irwin
                // Week 16 matches (Round 2 of losers bracket)
                { "m": 4, "r": 2, "w": "10", "l": "11", "t1": "10", "t2": "11", "t1_score": 83.46, "t2_score": 26.22, "week": 16, "playoffs": true }, // Randall vs Schmitt
                { "m": 5, "r": 2, "w": "12", "l": "6", "t1": "6", "t2": "12", "t1_score": 37.26, "t2_score": 49.31, "week": 16, "playoffs": true }, // Irwin vs Tomczak
                { "m": 6, "r": 2, "p": 11, "w": "7", "l": "4", "t1": "7", "t2": "4", "t1_score": 111.27, "t2_score": 102.74, "week": 16, "playoffs": true }, // 11th place game: Meer vs Boilard
                // Week 17 matches (Round 3 of losers bracket)
                { "m": 7, "r": 3, "p": 7, "w": "12", "l": "10", "t1": "10", "t2": "12", "t1_score": 13.66, "t2_score": 47.98, "week": 17, "playoffs": true }, // 7th place game: Randall vs Tomczak
                { "m": 8, "r": 3, "p": 9, "w": "6", "l": "11", "t1": "11", "t2": "6", "t1_score": 9.40, "t2_score": 51.56, "week": 17, "playoffs": true } // 9th place game: Schmitt vs Irwin
            ]
        }
    };


    // Memoize the getTeamName function so it's stable across renders
    const getTeamName = useMemo(() => {
        const yearSpecificUserMap = new Map();
        const yearSpecificRosterMap = new Map(); // New map for roster details per year

        // Ensure historicalMatchups?.usersBySeason defaults to an empty object if undefined
        const allHistoricalUsers = {
            ...(historicalMatchups?.usersBySeason || {}),
            "2021": hardcodedYahooData["2021"]?.usersBySeason || [] // Ensure 2021 Yahoo users are considered
        };
        const allHistoricalRosters = {
            ...(historicalMatchups?.rostersBySeason || {}),
            "2021": hardcodedYahooData["2021"]?.rostersBySeason || [] // Ensure 2021 Yahoo rosters are considered
        };


        if (allHistoricalUsers) {
            Object.entries(allHistoricalUsers).forEach(([year, seasonUsers]) => {
                const userMapForYear = new Map();
                if (Array.isArray(seasonUsers)) {
                    seasonUsers.forEach(user => {
                        userMapForYear.set(user.user_id, user);
                    });
                }
                yearSpecificUserMap.set(year, userMapForYear);
            });
        }

        if (allHistoricalRosters) {
            Object.entries(allHistoricalRosters).forEach(([year, seasonRosters]) => {
                const rosterMapForYear = new Map();
                if (Array.isArray(seasonRosters)) {
                    seasonRosters.forEach(roster => {
                        rosterMapForYear.set(roster.roster_id, roster);
                    });
                }
                rosterMapForYear.set(year, rosterMapForYear);
            });
        }


        const currentLeagueUserMap = new Map();
        if (usersData) { // usersData holds the current league's user information
            usersData.forEach(user => {
                currentLeagueUserMap.set(user.user_id, user);
            });
        }

        return (ownerId, year = null) => {
            // Helper to find name from a user object
            const getNameFromUser = (user) => {
                if (user?.metadata?.team_name) {
                    return user.metadata.team_name;
                }
                if (user?.display_name) {
                    return user.display_name;
                }
                return null; // No name found in this user object
            };

            let resolvedName = `Unknown Team (ID: ${ownerId})`; // Default fallback

            // If year is null, we want the MOST CURRENT team name
            if (year === null) {
                // 1. Try to get name from current league's usersData first (most current)
                const currentUser = currentLeagueUserMap.get(ownerId);
                const currentName = getNameFromUser(currentUser);
                if (currentName) {
                    resolvedName = currentName;
                } else {
                    // 2. If not found in current data, search historical data from most recent year backwards
                    const sortedYearsDesc = Array.from(yearSpecificUserMap.keys()).sort((a, b) => parseInt(b) - parseInt(a));
                    for (const historicalYear of sortedYearsDesc) {
                        const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                        const userInHistoricalYear = userMapInHistoricalYear.get(ownerId);
                        const historicalName = getNameFromUser(userInHistoricalYear);
                        if (historicalName) {
                            resolvedName = historicalName;
                            break; // Found a name, break the loop
                        }
                    }
                }

                // 3. Fallback to careerDPRData's teamName if available and not generic
                if (resolvedName.startsWith('Unknown Team (ID:')) { // Only try this if still unknown
                    const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                    if (careerTeam && careerTeam.teamName && !careerTeam.teamName.startsWith('Unknown Team (ID:')) {
                        resolvedName = careerTeam.teamName;
                    }
                }
            } else {
                // If a specific year is provided, prioritize that year's name
                if (yearSpecificUserMap.has(String(year))) {
                    const userMapForYear = yearSpecificUserMap.get(String(year));
                    const userInSpecificYear = userMapForYear.get(ownerId);
                    const specificYearName = getNameFromUser(userInSpecificYear);
                    if (specificYearName) {
                        resolvedName = specificYearName;
                    }
                }

                // Fallback for historical lookups if specific year data is missing in that year,
                // try to get a name from ANY historical year (most recent first)
                if (resolvedName.startsWith('Unknown Team (ID:')) { // Only try this if still unknown
                    const sortedYearsDesc = Array.from(yearSpecificUserMap.keys()).sort((a, b) => parseInt(b) - parseInt(a));
                    for (const historicalYear of sortedYearsDesc) {
                        const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                        const userInHistoricalYear = userMapInHistoricalYear.get(ownerId);
                        const historicalName = getNameFromUser(userInHistoricalYear);
                        if (historicalName) {
                            resolvedName = historicalName;
                            break; // Found a name, break the loop
                        }
                    }
                }

                // Fallback to current league data if no historical name is found
                if (resolvedName.startsWith('Unknown Team (ID:')) { // Only try this if still unknown
                    const currentUser = currentLeagueUserMap.get(ownerId);
                    const currentName = getNameFromUser(currentUser);
                    if (currentName) {
                        resolvedName = currentName;
                    }
                }

                // Fallback to careerDPRData if historical year-specific or current names not found
                if (resolvedName.startsWith('Unknown Team (ID:')) { // Only try this if still unknown
                    const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                    if (careerTeam && careerTeam.teamName && !careerTeam.teamName.startsWith('Unknown Team (ID:')) {
                        resolvedName = careerTeam.teamName;
                    }
                }
            }

            return resolvedName;
        };
    }, [usersData, historicalMatchups, careerDPRData]);


    // This function now returns both team name and avatar URL
    const getTeamDetails = useMemo(() => {
        return (ownerId, year) => {
            let user = null;
            // Prefer historical data for the specific year if available
            if (historicalMatchups && historicalMatchups.usersBySeason && historicalMatchups.usersBySeason[year] && ownerId) {
                user = historicalMatchups.usersBySeason[year].find(u => u.user_id === ownerId);
            }

            // Fallback to current league's user data if no specific year data is found
            if (!user && usersData && ownerId) {
                user = usersData.find(u => u.user_id === ownerId);
            }

            if (user) {
                return {
                    name: user.metadata?.team_name || user.display_name,
                    // Use team logo from metadata.avatar if available, otherwise fallback to profile avatar
                    avatar: user.metadata?.avatar || (user.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : `https://sleepercdn.com/avatars/default_avatar.png`)
                };
            }

            // Fallback for hardcoded data or missing users
            if (typeof ownerId === 'string' && !/^\d+$/.test(ownerId)) {
                return { name: ownerId, avatar: `https://sleepercdn.com/avatars/default_avatar.png` };
            }

            return { name: `Team (ID: ${ownerId})`, avatar: `https://sleepercdn.com/avatars/default_avatar.png` };
        };
    }, [usersData, historicalMatchups]);


    useEffect(() => {
        const loadAllSleeperData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Determine which league ID to use
                const leagueIdToFetch = CURRENT_LEAGUE_ID || FALLBACK_LEAGUE_ID;

                if (!leagueIdToFetch) {
                    setError(new Error("No league ID provided or fallback ID is invalid. Please set CURRENT_LEAGUE_ID in config.js or ensure FALLBACK_LEAGUE_ID is valid."));
                    setLoading(false);
                    return; // Stop execution if no valid league ID
                }

                if (!CURRENT_LEAGUE_ID) {
                    logger.warn(`SleeperDataContext: CURRENT_LEAGUE_ID is undefined in config.js. Using fallback ID: ${FALLBACK_LEAGUE_ID}`);
                }

                const [
                    leagues,
                    users,
                    rosters, // This is raw rosters
                    players,
                    state,
                    historicalDataFromSleeperAPI, // Renamed 'matchups' to be more descriptive
                    allHistoricalDraftsRaw, // NEW: Fetch all historical draft data
                ] = await Promise.all([
                    fetchLeagueData(leagueIdToFetch), // Use the determined league ID
                    fetchUsersData(leagueIdToFetch),
                    fetchRosterData(leagueIdToFetch), // Fetch raw roster data
                    fetchNFLPlayers(),
                    fetchNFLState(),
                    fetchAllHistoricalMatchups(), // This fetches historical data, potentially nested by week
                    fetchAllDraftHistory(), // NEW: Fetch all historical draft data
                ]);

                // Crucial check: If initial league data is null, something is wrong with the ID or API.
                if (!leagues) {
                    setError(new Error(`Failed to fetch initial league data for ID: ${leagueIdToFetch}. Please check the league ID in config.js or the fallback ID.`));
                    setLoading(false);
                    return; // Stop if initial league data is null
                }

                setLeagueData(leagues);
                setUsersData(users);
                setRostersWithDetails(rosters); // Set raw rosters here
                setNflPlayers(players);
                setNflState(state);

                // --- NEW: FETCH TRANSACTIONS ---
                let allTransactions = [];
                // Only fetch transactions if nflState and its week property are available
                if (state && state.week) {
                    const weeks = Array.from({ length: state.week }, (_, i) => i + 1);
                    // Fetch up to 4 weeks concurrently to avoid hammering the API while reducing total time
                    const txResults = await pMapLimit(weeks, 4, async (weekNum) => {
                        try {
                            return await fetchTransactions(leagueIdToFetch, weekNum);
                        } catch (err) {
                            return [];
                        }
                    });
                    // Flatten results
                    allTransactions = txResults.flat().filter(Boolean);
                }
                setTransactions(allTransactions);
                logger.debug("SleeperDataContext: Fetched transactions (count):", allTransactions.length);
                // --- END: FETCH TRANSACTIONS ---

                // --- START: Process Draft Data for DraftAnalysis Component ---
                // allHistoricalDraftsRaw is structured as { [season]: { drafts: [{ draft_object, picks: [...] }], tradedPicks: [...] } }
                const processedDraftsBySeason = {};
                const processedDraftPicksBySeason = {};

                if (allHistoricalDraftsRaw) {
                    for (const season in allHistoricalDraftsRaw) {
                        if (allHistoricalDraftsRaw.hasOwnProperty(season)) {
                            const seasonData = allHistoricalDraftsRaw[season];
                            // Assuming each season has one main draft for analysis, take the first complete one
                            // or the first available if no complete draft
                            const mainDraft = seasonData.drafts?.find(d => d.status === 'complete') || seasonData.drafts?.[0];

                            if (mainDraft) {
                                processedDraftsBySeason[season] = mainDraft;
                                processedDraftPicksBySeason[season] = mainDraft.picks || []; // Use the enriched picks directly
                            }
                        }
                    }
                }
                setDraftsBySeason(processedDraftsBySeason);
                setDraftPicksBySeason(processedDraftPicksBySeason);
                // --- END: Process Draft Data ---


                // --- START: Process and Flatten Sleeper historical matchups ---
                const flattenedSleeperMatchupsBySeason = {};
                if (historicalDataFromSleeperAPI?.matchupsBySeason) {
                    Object.entries(historicalDataFromSleeperAPI.matchupsBySeason).forEach(([year, weeklyMatchupsObject]) => {
                        // Ensure weeklyMatchupsObject is an object before trying to get its values
                        if (typeof weeklyMatchupsObject === 'object' && weeklyMatchupsObject !== null && !Array.isArray(weeklyMatchupsObject)) {
                            // It's an object keyed by week, so flatten its values
                            flattenedSleeperMatchupsBySeason[year] = Object.values(weeklyMatchupsObject).flat();
                        } else if (Array.isArray(weeklyMatchupsObject)) {
                            // It's already a flat array for the year, use it as is
                            flattenedSleeperMatchupsBySeason[year] = weeklyMatchupsObject;
                        } else {
                            // Handle unexpected structure, e.g., default to empty array
                            flattenedSleeperMatchupsBySeason[year] = [];
                        }
                    });
                }
                // --- END: Process and Flatten Sleeper historical matchups ---


                // Merge Sleeper historical data with hardcoded Yahoo data
                const mergedHistoricalData = {
                    // Use the flattened Sleeper matchups, then override/add 2021 Yahoo data
                    // IMPORTANT: Only merge regular season matchups from hardcodedYahooData["2021"].matchupsBySeason
                    matchupsBySeason: { ...(flattenedSleeperMatchupsBySeason || {}), "2021": hardcodedYahooData["2021"]?.matchupsBySeason || [] },
                    rostersBySeason: { ...(historicalDataFromSleeperAPI?.rostersBySeason || {}), "2021": hardcodedYahooData["2021"]?.rostersBySeason || [] },
                    usersBySeason: { ...(historicalDataFromSleeperAPI?.usersBySeason || {}), "2021": hardcodedYahooData["2021"]?.usersBySeason || [] },
                    leaguesMetadataBySeason: { ...(historicalDataFromSleeperAPI?.leaguesMetadataBySeason || {}), "2021": hardcodedYahooData["2021"]?.leaguesMetadataBySeason || {} },
                    // These bracket data sets are the SOLE source of playoff game information for 2021
                    winnersBracketBySeason: { ...(historicalDataFromSleeperAPI?.winnersBracketBySeason || {}), "2021": hardcodedYahooData["2021"]?.winnersBracketBySeason || [] },
                    losersBracketBySeason: { ...(historicalDataFromSleeperAPI?.losersBracketBySeason || {}), "2021": hardcodedYahooData["2021"]?.losersBracketBySeason || [] },
                    // IMPORTANT: Pass the processed draft data into historicalData
                    draftsBySeason: processedDraftsBySeason,
                    draftPicksBySeason: processedDraftPicksBySeason,
                    // Include traded picks per season (if present in the raw fetch)
                    tradedPicksBySeason: (() => {
                        const t = {};
                        if (allHistoricalDraftsRaw) {
                            for (const s in allHistoricalDraftsRaw) {
                                if (!allHistoricalDraftsRaw.hasOwnProperty(s)) continue;
                                const seasonData = allHistoricalDraftsRaw[s];
                                t[s] = seasonData.tradedPicks || seasonData.traded_picks || [];
                            }
                        }
                        return t;
                    })(),
                };
                setHistoricalMatchups(mergedHistoricalData); // Update historicalMatchups state with the merged data


                if (mergedHistoricalData && Object.keys(mergedHistoricalData.matchupsBySeason).length > 0) {
                    const { seasonalMetrics, careerDPRData: calculatedCareerDPRData } = calculateAllLeagueMetrics(
                        mergedHistoricalData,
                        { draftsBySeason: processedDraftsBySeason, draftPicksBySeason: processedDraftPicksBySeason }, // Pass the newly populated draft data
                        getTeamName,
                        state // Pass nflStateData
                    );
                    setProcessedSeasonalRecords(seasonalMetrics);
                    setCareerDPRData(calculatedCareerDPRData);
                    // Heavy badge computation (player stat fetches and badge scoring) is deferred to an explicit
                    // on-demand function `computeBadgesNow`. Deferring this reduces initial app load time.
                    // Keep placeholders in state so consumers don't break.
                    setBadgesByTeam({});
                    setRecentBadges([]);
                } else {
                    setProcessedSeasonalRecords({});
                    setCareerDPRData(null);
                }

                setLoading(false);

                // --- DEBUGGING START: Log final state before context provides it ---
                logger.debug('SleeperDataContext: Final nflPlayers state:', players);
                logger.debug('SleeperDataContext: Final draftsBySeason state:', processedDraftsBySeason);
                logger.debug('SleeperDataContext: Final draftPicksBySeason state:', processedDraftPicksBySeason);
                logger.debug('SleeperDataContext: Final historicalMatchups (merged historicalData) state:', mergedHistoricalData);
                // --- DEBUGGING END --

            } catch (err) {
                logger.error("Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, []); // Empty dependency array means this effect runs once on mount

    // computeBadgesNow: run heavy player stat fetches and compute badges on-demand
    const computeBadgesNow = async (options = {}) => {
        // guard: require historicalMatchups to be present
        if (!historicalMatchups || !historicalMatchups.matchupsBySeason || Object.keys(historicalMatchups.matchupsBySeason).length === 0) {
            return { badgesByTeam: {}, recentBadges: [] };
        }

        // Indicate badges computation in progress (does not flip global `loading`)
        try {
            const mergedHistoricalData = historicalMatchups;
            // Build playerSeasonPoints for top-positional calculations
            const playerSeasonPoints = {};
            mergedHistoricalData.playerSeasonPoints = playerSeasonPoints;

            const seasonsWithPicks = Object.keys(draftPicksBySeason || {});
            for (const s of seasonsWithPicks) {
                const season = String(s);
                const picks = draftPicksBySeason[season] || [];
                const uniquePlayerIds = Array.from(new Set(picks.map(p => (p && (p.player_id || p.playerId || p.player || (p.metadata && (p.metadata.player_id || p.metadata.id))))).filter(Boolean)));
                playerSeasonPoints[season] = playerSeasonPoints[season] || {};
                // Fetch player stats with limited concurrency
                await pMapLimit(uniquePlayerIds, 5, async (pid) => {
                    try {
                        const samplePick = picks.find(pk => {
                            const id = (pk && (pk.player_id || pk.playerId || pk.player || (pk.metadata && (pk.metadata.player_id || pk.metadata.id))));
                            return String(id) === String(pid);
                        }) || {};
                        const playerName = samplePick.player_name || (samplePick.metadata && (samplePick.metadata.name || `${samplePick.metadata.first_name || ''} ${samplePick.metadata.last_name || ''}`)) || 'Unknown Player';
                        const pos = (samplePick.player_position || samplePick.player_pos || (samplePick.metadata && samplePick.metadata.position) || '').toString().toUpperCase();
                        let scoringSettings = (mergedHistoricalData.leaguesMetadataBySeason && mergedHistoricalData.leaguesMetadataBySeason[season] && mergedHistoricalData.leaguesMetadataBySeason[season].settings && mergedHistoricalData.leaguesMetadataBySeason[season].settings.scoring_settings) || (leagueData && leagueData.settings && leagueData.settings.scoring_settings) || {};
                        if (!scoringSettings || Object.keys(scoringSettings).length === 0) {
                            const kickerDefaults = { fgm:3, fg:3, fg_0_19:3, fg_20_29:3, fg_30_39:3, fg_40_49:3, fg_50p:4, xp:1, xpmade:1, xp_made:1 };
                            scoringSettings = Object.assign({}, kickerDefaults, scoringSettings || {});
                        }
                        const stats = await fetchPlayerStats(pid, season, 'regular', playerName);
                        const totalPoints = stats ? calculateFantasyPoints(stats, scoringSettings, pos) : 0;
                        playerSeasonPoints[season][pid] = { playerId: pid, playerName, position: pos, totalPoints };
                    } catch (errInner) {
                        try { const logger = require('../utils/logger').default; logger.warn(`Failed to fetch/calc points for player ${pid} in season ${s}:`, errInner); } catch(e){}
                    }
                });
            }

            // Now compute badges using the badges utility
            const { badgesByTeam: bbt, recentBadges: rb } = badgesUtil.computeBadges({
                historicalData: mergedHistoricalData,
                processedSeasonalRecords,
                draftPicksBySeason,
                transactions,
                usersData,
                getTeamName,
                ...options
            });
            setBadgesByTeam(bbt || {});
            setRecentBadges(rb || []);

            // expose to window for dev debugging
            try { if (typeof window !== 'undefined') window.__computedBadges = { badgesByTeam: bbt || {}, recentBadges: rb || {}, historicalData: mergedHistoricalData }; } catch(e){}

            return { badgesByTeam: bbt || {}, recentBadges: rb || [] };
        } catch (err) {
            try { const logger = require('../utils/logger').default; logger.error('computeBadgesNow failed:', err); } catch(e){}
            setBadgesByTeam({});
            setRecentBadges([]);
            return { badgesByTeam: {}, recentBadges: [] };
        }
    };

    // Utility: Get 1st and 2nd highest scorers per week for a given season
    const getWeeklyHighScores = (season) => {
        const result = {};
        if (!historicalMatchups || !historicalMatchups.matchupsBySeason || !historicalMatchups.matchupsBySeason[season]) return result;
        const matchups = historicalMatchups.matchupsBySeason[season];
        // Group all scores by week
        const scoresByWeek = {};
        matchups.forEach(match => {
            const week = match.week || match.weekNumber;
            if (!week) return;
            if (!scoresByWeek[week]) scoresByWeek[week] = [];
            // Team 1
            if (match.team1_roster_id && match.team1_score != null) {
                scoresByWeek[week].push({
                    teamId: match.team1_roster_id,
                    score: parseFloat(match.team1_score),
                });
            }
            // Team 2
            if (match.team2_roster_id && match.team2_score != null) {
                scoresByWeek[week].push({
                    teamId: match.team2_roster_id,
                    score: parseFloat(match.team2_score),
                });
            }
        });
        // For each week, find top 2
        Object.entries(scoresByWeek).forEach(([week, scores]) => {
            if (scores.length === 0) return;
            const sorted = scores.sort((a, b) => b.score - a.score);
            result[week] = {
                first: sorted[0],
                second: sorted.length > 1 ? sorted.find(s => s.score < sorted[0].score) || null : null
            };
        });
        return result;
    };

    // Compose all draft history structures for consumers
    // Keep per-season structures but also provide a flattened array `allDraftHistory` for convenience
    const draftHistoryBySeason = useMemo(() => ({
        draftsBySeason,
        draftPicksBySeason,
        // expose traded picks per season for consumers
        tradedPicksBySeason: (() => {
            // try to derive from draftsBySeason if available, otherwise empty
            const t = {};
            if (draftsBySeason) {
                Object.keys(draftsBySeason).forEach(s => { t[s] = draftsBySeason[s]?.tradedPicks || [] });
            }
            // also include the processed state if we set it elsewhere
            if (historicalMatchups && historicalMatchups.tradedPicksBySeason) {
                Object.assign(t, historicalMatchups.tradedPicksBySeason);
            }
            return t;
        })()
    }), [draftsBySeason, draftPicksBySeason, historicalMatchups]);

    // Flatten picks across all seasons to a simple array for components that expect a list of picks
    const allDraftHistory = useMemo(() => {
        try {
            const seasonPicksArrays = Object.values(draftPicksBySeason || {});
            // flatten and ensure we have an array
            const flat = Array.isArray(seasonPicksArrays) ? seasonPicksArrays.flat() : [];
            return flat || [];
        } catch (e) {
            return [];
        }
    }, [draftPicksBySeason]);

    // Helper: Get scheduled matchups for the upcoming week in the current season
    const getUpcomingWeekMatchups = (season, week) => {
        if (!historicalMatchups || !historicalMatchups.matchupsBySeason || !historicalMatchups.matchupsBySeason[season]) return [];
        return historicalMatchups.matchupsBySeason[season].filter(m => parseInt(m.week) === week);
    };

    // Helper: Get the most recent/current league object and season string
    const currentLeagueData = Array.isArray(leagueData) && leagueData.length > 0
        ? leagueData[0]
        : leagueData;
    const currentSeason = currentLeagueData?.season || (Array.isArray(leagueData) && leagueData.length > 0 ? leagueData[0]?.season : null);

    // The context value that will be supplied to any descendants of this provider
    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalData: historicalMatchups,
        draftsBySeason,
        draftPicksBySeason,
        // Per-season and flattened draft history
        draftHistoryBySeason,
        allDraftHistory,
        processedSeasonalRecords,
    badgesByTeam,
    recentBadges,
        careerDPRData,
        transactions,
        loading,
        error,
        currentSeason, // EXPORT THE CURRENT SEASON
        getTeamName,
        getTeamDetails, // EXPORT THE NEW FUNCTION
        computeBadgesNow,
    }), [
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups,
        draftsBySeason,
        draftPicksBySeason,
        draftHistoryBySeason,
        allDraftHistory,
        processedSeasonalRecords,
        careerDPRData,
        transactions,
        loading,
        error,
        currentSeason, // ADD TO DEPENDENCY ARRAY
        getTeamName,
        getTeamDetails, // ADD TO DEPENDENCY ARRAY
        computeBadgesNow,
    ]);

    return (
        <SleeperDataContext.Provider value={contextValue}>
            {children}
        </SleeperDataContext.Provider>
    );
};

// 5. Create a Custom Hook to consume the context
export const useSleeperData = () => {
    const context = useContext(SleeperDataContext);
    if (context === undefined) {
        throw new Error('useSleeperData must be used within a SleeperDataProvider');
    }
    return context;
};

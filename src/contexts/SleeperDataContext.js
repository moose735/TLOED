// src/contexts/SleeperDataContext.js
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import {
    fetchLeagueData,
    fetchUsersData,
    fetchRosterData, // Changed from fetchRostersWithDetails to fetchRosterData
    fetchNFLPlayers,
    fetchNFLState,
    fetchAllHistoricalMatchups,
    fetchAllDraftHistory,
} from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config';

// IMPORT THE CALCULATION FUNCTION HERE
import { calculateAllLeagueMetrics } from '../utils/calculations';

// 1. Create the Context
const SleeperDataContext = createContext();

// 2. Create the Provider Component
export const SleeperDataProvider = ({ children }) => {
    // State to hold all the fetched data
    const [leagueData, setLeagueData] = useState(null);
    const [usersData, setUsersData] = useState(null); // This holds current league's users
    const [rostersWithDetails, setRostersWithDetails] = useState(null); // This holds current league's rosters
    const [nflPlayers, setNflPlayers] = useState(null);
    const [nflState, setNflState] = useState(null);
    const [historicalMatchups, setHistoricalMatchups] = useState(null); // This holds historicalData with rostersBySeason AND usersBySeason
    const [allDraftHistory, setAllDraftHistory] = useState(null);

    // NEW STATE FOR PROCESSED SEASONAL RECORDS
    const [processedSeasonalRecords, setProcessedSeasonalRecords] = useState({});
    const [careerDPRData, setCareerDPRData] = useState(null);

    // State for loading and error handling
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Hardcoded 2021 Yahoo Data with Sleeper User IDs ---
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
                "settings": { "playoff_start_week": 15 },
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
                yearSpecificRosterMap.set(year, rosterMapForYear);
            });
        }


        const currentLeagueUserMap = new Map();
        if (usersData) { // usersData holds the current league's user information
            usersData.forEach(user => {
                currentLeagueUserMap.set(user.user_id, user);
            });
        }

        return (ownerId, year = null) => {
            // console.log(`[getTeamName] Resolving name for ownerId: ${ownerId}, year: ${year}`); // Removed excessive log
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
                    // console.log(`[getTeamName] Found current name: ${resolvedName}`); // Removed excessive log
                } else {
                    // 2. If not found in current data, search historical data from most recent year backwards
                    const sortedYearsDesc = Array.from(yearSpecificUserMap.keys()).sort((a, b) => parseInt(b) - parseInt(a));
                    for (const historicalYear of sortedYearsDesc) {
                        const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                        const userInHistoricalYear = userMapInHistoricalYear.get(ownerId);
                        const historicalName = getNameFromUser(userInHistoricalYear);
                        if (historicalName) {
                            resolvedName = historicalName;
                            // console.log(`[getTeamName] Found historical name for year ${historicalYear}: ${resolvedName}`); // Removed excessive log
                            break; // Found a name, break the loop
                        }
                    }
                }

                // 3. Fallback to careerDPRData's teamName if available and not generic
                if (resolvedName.startsWith('Unknown Team (ID:')) { // Only try this if still unknown
                    const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                    if (careerTeam && careerTeam.teamName && !careerTeam.teamName.startsWith('Unknown Team (ID:')) {
                        resolvedName = careerTeam.teamName;
                        // console.log(`[getTeamName] Fallback to careerDPRData name: ${resolvedName}`); // Removed excessive log
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
                        // console.log(`[getTeamName] Found year-specific name for ${year}: ${resolvedName}`); // Removed excessive log
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
                            // console.log(`[getTeamName] Fallback to any historical name for year ${historicalYear}: ${resolvedName}`); // Removed excessive log
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
                        // console.log(`[getTeamName] Fallback to current league name: ${resolvedName}`); // Removed excessive log
                    }
                }

                // Fallback to careerDPRData if historical year-specific or current names not found
                if (resolvedName.startsWith('Unknown Team (ID:')) { // Only try this if still unknown
                    const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                    if (careerTeam && careerTeam.teamName && !careerTeam.teamName.startsWith('Unknown Team (ID:')) {
                        resolvedName = careerTeam.teamName;
                        // console.log(`[getTeamName] Fallback to careerDPRData name as last resort: ${resolvedName}`); // Removed excessive log
                    }
                }
            }

            console.log(`[getTeamName] Final name for ownerId ${ownerId} (year ${year}): ${resolvedName}`); // Keep final log
            return resolvedName;
        };
    }, [usersData, historicalMatchups, careerDPRData]);


    useEffect(() => {
        const loadAllSleeperData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [
                    leagues,
                    users,
                    rosters, // This is raw rosters
                    players,
                    state,
                    historicalDataFromSleeperAPI, // Renamed 'matchups' to be more descriptive
                    draftHistory
                ] = await Promise.all([
                    fetchLeagueData(CURRENT_LEAGUE_ID),
                    fetchUsersData(CURRENT_LEAGUE_ID),
                    fetchRosterData(CURRENT_LEAGUE_ID), // Fetch raw roster data
                    fetchNFLPlayers(),
                    fetchNFLState(),
                    fetchAllHistoricalMatchups(), // This fetches historical data, potentially nested by week
                    fetchAllDraftHistory(),
                ]);

                setLeagueData(leagues);
                setUsersData(users);
                setRostersWithDetails(rosters); // Set raw rosters here
                setNflPlayers(players);
                setNflState(state);
                setAllDraftHistory(draftHistory);

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
                            console.warn(`SleeperDataContext: Unexpected matchupsBySeason structure for year ${year}:`, weeklyMatchupsObject);
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
                };
                setHistoricalMatchups(mergedHistoricalData);

                // Condensed debug logs for merged data structure
                console.log("SleeperDataContext: Merged historical data keys:");
                console.log("  matchupsBySeason (years):", Object.keys(mergedHistoricalData.matchupsBySeason));
                console.log("  rostersBySeason (years):", Object.keys(mergedHistoricalData.rostersBySeason));
                console.log("  usersBySeason (years):", Object.keys(mergedHistoricalData.usersBySeason));
                console.log("  winnersBracketBySeason (years):", Object.keys(mergedHistoricalData.winnersBracketBySeason));
                console.log("  losersBracketBySeason (years):", Object.keys(mergedHistoricalData.losersBracketBySeason));


                if (mergedHistoricalData && Object.keys(mergedHistoricalData.matchupsBySeason).length > 0) {
                    // Pass nflState to calculateAllLeagueMetrics
                    const { seasonalMetrics, careerDPRData: calculatedCareerDPRData } = calculateAllLeagueMetrics(mergedHistoricalData, draftHistory, getTeamName, state);
                    console.log("SleeperDataContext: Calculated seasonalMetrics (first 5 entries per year):");
                    Object.entries(seasonalMetrics).forEach(([year, metrics]) => {
                        console.log(`  Year ${year}:`, Object.values(metrics).slice(0, 5));
                    });
                    setProcessedSeasonalRecords(seasonalMetrics);
                    setCareerDPRData(calculatedCareerDPRData);
                } else {
                    console.warn("SleeperDataContext: mergedHistoricalData is empty or null, cannot calculate seasonal metrics.");
                    setProcessedSeasonalRecords({});
                    setCareerDPRData(null);
                }

                setLoading(false);
            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, []); // This effect now runs only once on mount.


    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalData: historicalMatchups, // Provide the merged historical data
        allDraftHistory,
        processedSeasonalRecords,
        careerDPRData,
        loading,
        error,
        getTeamName,
    }), [
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups, // Dependency for merged data
        allDraftHistory,
        processedSeasonalRecords,
        careerDPRData,
        loading,
        error,
        getTeamName,
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

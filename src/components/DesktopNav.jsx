import React from 'react';

const NavItem = ({ label, onClick }) => (
    <li
        className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/8 cursor-pointer rounded-lg mx-0.5 transition-colors duration-150 whitespace-nowrap"
        onClick={onClick}
    >
        {label}
    </li>
);

const DropdownItem = ({ label, onClick }) => (
    <li
        className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/8 cursor-pointer rounded-lg transition-colors duration-150 whitespace-nowrap"
        onClick={onClick}
    >
        {label}
    </li>
);

const Dropdown = ({ label, isOpen, onToggle, children }) => (
    <li
        className={`relative px-3 py-2 text-sm font-medium cursor-pointer rounded-lg mx-0.5 transition-colors duration-150 select-none whitespace-nowrap flex items-center gap-1 ${
            isOpen ? 'text-white bg-white/8' : 'text-gray-300 hover:text-white hover:bg-white/8'
        }`}
        onClick={onToggle}
    >
        {label}
        <svg
            className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {isOpen && (
            <ul className="absolute left-0 top-full mt-1.5 bg-gray-800 border border-white/10 shadow-xl rounded-xl py-1.5 min-w-[180px] z-50">
                {children}
            </ul>
        )}
    </li>
);

export default function DesktopNav({ handleTabClick, handleSubTabClick, openSubMenu, toggleSubMenu, NAV_CATEGORIES }) {
    return (
        <ul className="hidden md:flex md:flex-row md:items-center md:justify-center py-1.5 px-2">

            <NavItem label="Dashboard" onClick={() => handleTabClick(NAV_CATEGORIES.HOME.tab)} />

            <Dropdown label="Games" isOpen={openSubMenu === 'games'} onToggle={() => toggleSubMenu('games')}>
                <DropdownItem label="Gamecenter"   onClick={e => { e.stopPropagation(); handleTabClick(NAV_CATEGORIES.GAMECENTER.tab); }} />
                <DropdownItem label="Sportsbook"   onClick={e => { e.stopPropagation(); handleTabClick(NAV_CATEGORIES.SPORTSBOOK.tab); }} />
                <DropdownItem label="Head-to-Head" onClick={e => { e.stopPropagation(); handleTabClick(NAV_CATEGORIES.HEAD_TO_HEAD.tab); }} />
                <DropdownItem label="Mini-Games"   onClick={e => { e.stopPropagation(); handleTabClick(NAV_CATEGORIES.MINIGAMES.tab); }} />
            </Dropdown>

            <Dropdown label="League" isOpen={openSubMenu === 'league'} onToggle={() => toggleSubMenu('league')}>
                <DropdownItem label="Hall of Champions" onClick={e => { e.stopPropagation(); handleTabClick('hallOfChampions'); }} />
                <DropdownItem label="Keepers"           onClick={e => { e.stopPropagation(); handleTabClick('keepers'); }} />
                <DropdownItem label="League History"    onClick={e => { e.stopPropagation(); handleTabClick('leagueHistory'); }} />
                <DropdownItem label="Record Book"       onClick={e => { e.stopPropagation(); handleTabClick('recordBook'); }} />
                <DropdownItem label="Player History"    onClick={e => { e.stopPropagation(); handleTabClick('playerHistory'); }} />
                <DropdownItem label="Season Breakdown"  onClick={e => { e.stopPropagation(); handleTabClick('seasonBreakdown'); }} />
                <DropdownItem label="Finances"          onClick={e => { e.stopPropagation(); handleTabClick('financials'); }} />
                <DropdownItem label="Memes & Memories"  onClick={e => { e.stopPropagation(); handleTabClick('memesAndMemories'); }} />
            </Dropdown>

            <NavItem label="Teams" onClick={() => handleTabClick('teamsOverview')} />

            <Dropdown label="Analysis" isOpen={openSubMenu === 'analysis'} onToggle={() => toggleSubMenu('analysis')}>
                <DropdownItem label="Draft"         onClick={e => { e.stopPropagation(); handleTabClick('draftAnalysis'); }} />
                <DropdownItem label="DPR Analysis"  onClick={e => { e.stopPropagation(); handleTabClick('dprAnalysis'); }} />
                <DropdownItem label="Luck Rating"   onClick={e => { e.stopPropagation(); handleTabClick('luckRating'); }} />
                <DropdownItem label="Trade History" onClick={e => { e.stopPropagation(); handleTabClick('tradeHistory'); }} />
            </Dropdown>

        </ul>
    );
}
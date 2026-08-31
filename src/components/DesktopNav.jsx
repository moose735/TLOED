import React from 'react';

const NavItem = ({ label, onClick }) => (
    <li
        className="px-3 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-red-500/10 cursor-pointer rounded-lg mx-0.5 transition-all duration-150 whitespace-nowrap border border-transparent hover:border-red-400/30"
        onClick={onClick}
    >
        {label}
    </li>
);

const DropdownItem = ({ label, onClick }) => (
    <li
        className="px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-red-500/10 cursor-pointer rounded-lg transition-all duration-150 whitespace-nowrap border border-transparent hover:border-red-400/30"
        onClick={onClick}
    >
        {label}
    </li>
);

const Dropdown = ({ label, isOpen, onToggle, children }) => (
    <li
        className={`relative px-3 py-2 text-sm font-medium cursor-pointer rounded-lg mx-0.5 transition-all duration-150 select-none whitespace-nowrap flex items-center gap-1 border ${
            isOpen ? 'text-white bg-red-500/10 border-red-400/40 shadow-[0_0_0_1px_rgba(220,38,38,0.18)]' : 'text-slate-200 hover:text-white hover:bg-red-500/10 border-transparent hover:border-red-400/30'
        }`}
        onClick={onToggle}
    >
        {label}
        <svg
            className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-red-300' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {isOpen && (
            <ul className="absolute left-0 top-full mt-1.5 bg-slate-900/95 border border-red-400/30 shadow-2xl rounded-xl py-1.5 min-w-[180px] z-50 backdrop-blur-sm">
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
                <DropdownItem label="Memes & Memories"  onClick={e => { e.stopPropagation(); handleTabClick('memesAndMemories'); }} />
            </Dropdown>

            <NavItem label="Finances" onClick={() => handleTabClick('financials')} />
            <NavItem label="Teams" onClick={() => handleTabClick('teamsOverview')} />

            <Dropdown label="Analysis" isOpen={openSubMenu === 'analysis'} onToggle={() => toggleSubMenu('analysis')}>
                <DropdownItem label="Draft"         onClick={e => { e.stopPropagation(); handleTabClick('draftAnalysis'); }} />
                <DropdownItem label="DPR Analysis"  onClick={e => { e.stopPropagation(); handleTabClick('dprAnalysis'); }} />
                <DropdownItem label="Luck Rating"   onClick={e => { e.stopPropagation(); handleTabClick('luckRating'); }} />
            </Dropdown>

        </ul>
    );
}
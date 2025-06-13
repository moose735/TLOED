// App.js
import React from 'react';
// Corrected import path for PowerRankings component
import PowerRankings from './lib/PowerRankings';

const App = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      {/* Tailwind CSS CDN for styling */}
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />

      <header className="w-full max-w-4xl bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-xl shadow-lg mb-8 text-center">
        <h1 className="text-4xl font-extrabold mb-2">Fantasy League Dashboard</h1>
        <p className="text-xl">Your central hub for league insights!</p>
      </header>

      <main className="w-full max-w-4xl">
        {/* Render the PowerRankings component */}
        <PowerRankings />
      </main>

      <footer className="mt-8 text-center text-gray-600 text-sm pb-8">
        <p>This site displays league data powered by Google Apps Script.</p>
        <p className="mt-2">
          For Apps Script deployment instructions, visit:{" "}
          <a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Google Apps Script Web Apps Guide
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App;

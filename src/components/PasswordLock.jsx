import React, { useState, useEffect } from 'react';

export default function PasswordLock({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const CORRECT_PASSWORD = 'gobonas';

  useEffect(() => {
    // Check if user is already authenticated
    const stored = localStorage.getItem('tloed_authenticated');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
    setMounted(true);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('tloed_authenticated', 'true');
      setPassword('');
      setError('');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('tloed_authenticated');
  };

  if (!mounted) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">TLOED</h1>
            <p className="text-gray-600">Fantasy League Dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm font-medium text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Logout button in corner */}
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 z-40 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
        title="Logout"
      >
        Logout
      </button>
      {children}
    </>
  );
}

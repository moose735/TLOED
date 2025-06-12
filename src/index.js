import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Import your main App component

// Get the root DOM element where the React app will be mounted
const rootElement = document.getElementById('root');

// Create a React root and render the App component into it
// ReactDOM.createRoot is the recommended way for React 18+
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/*
      React.StrictMode is a tool for highlighting potential problems in an application.
      It activates additional checks and warnings for its descendants.
      It does NOT render any visible UI.
    */}
    <App />
  </React.StrictMode>
);

// If you ever needed to render your app manually or for development testing,
// you might have used something like:
// ReactDOM.render(<App />, document.getElementById('root'));
// But for React 18+, createRoot is preferred.

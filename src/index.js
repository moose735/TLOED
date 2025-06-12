import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css'; // <--- THIS LINE IS IMPORTANT FOR YOUR CSS
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

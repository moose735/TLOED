// Lightweight logger utility to gate verbose logs in the browser.
// Usage: import logger from '../utils/logger'; logger.debug('msg');
const isBrowser = typeof window !== 'undefined';

function shouldEnableVerbose() {
  // Prefer an explicit build-time env var when available (create-react-app style)
  try {
    if (process && process.env && process.env.REACT_APP_VERBOSE_LOGS) {
      const v = String(process.env.REACT_APP_VERBOSE_LOGS).toLowerCase();
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    }
  } catch (e) {
    // ignore
  }

  // Fallback to runtime localStorage toggle for dev:
  if (isBrowser) {
    try {
      const stored = window.localStorage.getItem('debugLogs');
      if (stored !== null) {
        const s = String(stored).toLowerCase();
        return s === '1' || s === 'true';
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  return false; // default: verbose off
}

const VERBOSE = shouldEnableVerbose();

const logger = {
  debug: (...args) => {
    if (VERBOSE && console && console.debug) console.debug(...args);
  },
  info: (...args) => {
    if (VERBOSE && console && console.info) console.info(...args);
  },
  warn: (...args) => {
    if (console && console.warn) console.warn(...args);
  },
  error: (...args) => {
    if (console && console.error) console.error(...args);
  }
};

export default logger;

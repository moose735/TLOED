// Logger disabled: all methods are no-ops to remove verbose logging across the app.
// The project historically imported `logger` widely; returning a no-op stub
// ensures we don't need to edit every import site while fulfilling the
// user's request to remove logger usage/effects.
const noop = () => {};
const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop
};

export default logger;

// src/utils/formatUtils.js

export const formatNumber = (num, decimals = 2) => {
    if (typeof num !== 'number' || isNaN(num)) {
        return 'N/A';
    }
    return num.toFixed(decimals);
};

// Format a score or points value consistently. Returns 'N/A' for invalid numbers.
// By default scores/points are shown with 2 decimals. Use decimals=3 for DPR/luck when needed.
export const formatScore = (value, decimals = 2) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
};

// src/utils/formatUtils.js

export const formatNumber = (num, decimals = 2) => {
    if (typeof num !== 'number' || isNaN(num)) {
        return 'N/A';
    }
    return num.toFixed(decimals);
};

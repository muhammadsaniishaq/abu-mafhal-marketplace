// src/utils/helpers.js

/**
 * Parses a price string or number into a valid float.
 * Handles currency symbols, commas, and invalid inputs.
 * @param {string|number} price 
 * @returns {number}
 */
export const parsePrice = (price) => {
    if (typeof price === 'number') return isNaN(price) ? 0 : price;
    if (typeof price === 'string') {
        // Remove everything except numbers and decimal point
        // Handle commas (e.g., 4,000.00 -> 4000.00)
        const clean = price.replace(/,/g, '').replace(/[^\d.]/g, '');
        const val = parseFloat(clean);
        return isNaN(val) ? 0 : val;
    }
    return 0;
};

/**
 * Formats a number as a currency string.
 * @param {number} amount 
 * @param {string} currency 
 * @returns {string}
 */
export const formatCurrency = (amount, currency = '₦') => {
    const val = typeof amount === 'number' ? amount : parsePrice(amount);
    return `${currency}${val.toLocaleString('en-NG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
};

import React, { createContext, useContext, useState } from 'react';

const TransactionTotalsContext = createContext(null);

export const TransactionTotalsProvider = ({ children }) => {
  const [transactionTotals, setTransactionTotals] = useState([]);

  return (
    <TransactionTotalsContext.Provider value={{ transactionTotals, setTransactionTotals }}>
      {children}
    </TransactionTotalsContext.Provider>
  );
};

export const useTransactionTotals = () => {
  const ctx = useContext(TransactionTotalsContext);
  if (!ctx) return { transactionTotals: [], setTransactionTotals: () => {} };
  return ctx;
};

export default TransactionTotalsContext;

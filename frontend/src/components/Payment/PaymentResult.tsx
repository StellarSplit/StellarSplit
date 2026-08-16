import React, { useEffect } from "react";
import type { PaymentResult as PaymentResultData } from "../../types/payment";
import { useAnnounce } from "../../hooks/useAccessibility";

interface Props {
  result: PaymentResultData;
  onRetry: () => void;
  onBackToSplit: (splitId?: string) => void;
}

export const PaymentResult: React.FC<Props> = ({ result, onRetry, onBackToSplit }) => {
  const { announce } = useAnnounce();

  // Announce the payment outcome to screen readers whenever it changes.
  useEffect(() => {
    if (result.success) {
      announce(`Payment successful. Transaction hash ${result.txHash}`);
    } else {
      announce(`Payment failed. ${result.error ?? "Unknown error"}`);
    }
  }, [result.success, result.txHash, result.error, announce]);

  if (result.success) {
    return (
      <div>
        <h2>Payment Successful</h2>
        <p>Transaction Hash: {result.txHash}</p>
        <button onClick={() => onBackToSplit(result.txHash)}>Back to Split</button>
      </div>
    );
  }
  return (
    <div>
      <h2>Payment Failed</h2>
      <p>Error: {result.error}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
};
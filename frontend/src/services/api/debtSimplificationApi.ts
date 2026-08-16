/**
 * Debt Simplification API client.
 *
 * Wraps GET /debt-simplification/user/:walletAddress, mapping the backend's
 * SimplifiedDebt response shape to the frontend's DebtBalance[] type used
 * by the DebtTracker widget.
 */
import { apiClient } from "../../utils/api-client";
import type { DebtBalance } from "../../types/analytics";

/** Raw shape returned by the backend's /debt-simplification endpoint. */
export interface SimplifiedDebtResponse {
  userId: string;
  name: string;
  amount: number;
  direction: "owe" | "owed";
}

/**
 * Fetch real debt balances for a given wallet address.
 *
 * @param walletAddress - The connected Freighter wallet address.
 * @param signal        - Optional AbortSignal for request cancellation.
 * @returns A promise that resolves to an array of DebtBalance items.
 */
export async function fetchDebtBalancesByWallet(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<DebtBalance[]> {
  const response = await apiClient.get<SimplifiedDebtResponse[]>(
    `/debt-simplification/user/${walletAddress}`,
    { signal },
  );
  return response.data.map((debt) => ({
    userId: debt.userId,
    name: debt.name,
    amount: debt.amount,
    direction: debt.direction,
  }));
}
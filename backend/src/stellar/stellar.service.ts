import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Horizon, Networks } from '@stellar/stellar-sdk';
import { HorizonApi } from '@stellar/stellar-sdk/lib/horizon/horizon_api';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly horizonServer: Horizon.Server;

  constructor(private readonly configService: ConfigService) {
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      (this.configService.get<string>('STELLAR_NETWORK') === 'mainnet'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org');

    this.horizonServer = new Horizon.Server(horizonUrl);
  }

  /**
   * Verify a Stellar transaction by its hash
   * @param txHash The transaction hash to verify
   * @returns Transaction details or null if not found
   */
  async verifyTransaction(txHash: string): Promise<{
    valid: boolean;
    amount: number;
    asset: string;
    sender: string;
    receiver: string;
    timestamp: string;
    sourceAmount?: number;
    sourceAsset?: string;
    isPathPayment?: boolean;
    path?: string[];
  } | null> {
    try {
      this.logger.log(`Verifying transaction: ${txHash}`);
      
      // Fetch the transaction from Horizon
      const transaction = await this.horizonServer.transactions()
        .transaction(txHash)
        .call();

      // Check if transaction exists and is successful
      if (!transaction) {
        this.logger.warn(`Transaction not found: ${txHash}`);
        return null;
      }

      // Verify transaction is successful (not failed)
      if (transaction.successful !== true) {
        this.logger.warn(`Transaction failed: ${txHash}`);
        return {
          valid: false,
          amount: 0,
          asset: '',
          sender: '',
          receiver: '',
          timestamp: transaction.created_at,
        };
      }

      // Parse transaction operations to find payment details
      const operations = await this.horizonServer.operations()
        .forTransaction(txHash)
        .limit(100) // Limit to reasonable number of operations
        .call();

      // Find the payment operation (typically the first one)
      const paymentOp = operations.records.find((op: HorizonApi.BaseOperationResponse) => 
        op.type === 'payment' || op.type === 'path_payment_strict_receive' || op.type === 'path_payment_strict_send'
      );

      if (!paymentOp) {
        this.logger.warn(`No payment operation found in transaction: ${txHash}`);
        return {
          valid: false,
          amount: 0,
          asset: '',
          sender: transaction.source_account,
          receiver: '',
          timestamp: transaction.created_at,
        };
      }

      // Extract details based on operation type
      let amount = 0;
      let asset = '';
      let receiver = '';
      let sourceAmount: number | undefined;
      let sourceAsset: string | undefined;
      let isPathPayment = false;
      let path: string[] | undefined;

      if (paymentOp.type === 'payment') {
        const paymentOperation = paymentOp as HorizonApi.PaymentOperationResponse;
        amount = parseFloat(paymentOperation.amount);
        asset = paymentOperation.asset_type === 'native' 
          ? 'XLM' 
          : `${paymentOperation.asset_code}:${paymentOperation.asset_issuer}`;
        receiver = paymentOperation.to;
      } else if (paymentOp.type.includes('path_payment')) {
        isPathPayment = true;
        // For path payments, extract both source and destination details
        if (paymentOp.type === 'path_payment_strict_receive') {
          const strictReceiveOp = paymentOp as any; // Using any due to SDK type inconsistencies
          amount = parseFloat(strictReceiveOp.amount);
          asset = (strictReceiveOp.dest_asset_type || strictReceiveOp.asset_type) === 'native'
            ? 'XLM'
            : `${strictReceiveOp.dest_asset_code || strictReceiveOp.asset_code}:${strictReceiveOp.dest_asset_issuer || strictReceiveOp.asset_issuer}`;
          receiver = strictReceiveOp.to;
          sourceAmount = parseFloat(strictReceiveOp.source_amount);
          sourceAsset = strictReceiveOp.source_asset_type === 'native'
            ? 'XLM'
            : `${strictReceiveOp.source_asset_code}:${strictReceiveOp.source_asset_issuer}`;
          
          // Extract path
          if (strictReceiveOp.path && strictReceiveOp.path.length > 0) {
            path = strictReceiveOp.path.map((p: any) => 
              p.asset_type === 'native' ? 'XLM' : `${p.asset_code}:${p.asset_issuer}`
            );
          }
        } else if (paymentOp.type === 'path_payment_strict_send') {
          const strictSendOp = paymentOp as any; // Using any due to SDK type inconsistencies
          amount = parseFloat(strictSendOp.destination_amount || strictSendOp.amount);
          asset = (strictSendOp.destination_asset_type || strictSendOp.asset_type) === 'native'
            ? 'XLM'
            : `${strictSendOp.destination_asset_code || strictSendOp.asset_code}:${strictSendOp.destination_asset_issuer || strictSendOp.asset_issuer}`;
          receiver = strictSendOp.destination || strictSendOp.to;
          sourceAmount = parseFloat(strictSendOp.amount || strictSendOp.source_amount);
          sourceAsset = strictSendOp.asset_type === 'native'
            ? 'XLM'
            : `${strictSendOp.asset_code}:${strictSendOp.asset_issuer}`;
          
          // Extract path
          if (strictSendOp.path && strictSendOp.path.length > 0) {
            path = strictSendOp.path.map((p: any) => 
              p.asset_type === 'native' ? 'XLM' : `${p.asset_code}:${p.asset_issuer}`
            );
          }
        }
      }

      this.logger.log(
        `Successfully verified transaction: ${txHash}, amount: ${amount} ${asset}${isPathPayment ? ` (path payment from ${sourceAmount} ${sourceAsset})` : ''}`,
      );

      return {
        valid: true,
        amount,
        asset,
        sender: transaction.source_account,
        receiver,
        timestamp: transaction.created_at,
        sourceAmount,
        sourceAsset,
        isPathPayment,
        path,
      };
    } catch (error) {
      this.logger.error(`Error verifying transaction ${txHash}:`, error);
      return null;
    }
  }

  getNetworkPassphrase(): string {
    return (
      this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ||
      (this.configService.get<string>('NODE_ENV') === 'production'
        ? Networks.PUBLIC
        : Networks.TESTNET)
    );
  }

  /**
   * Get account details from Stellar
   * @param accountId The Stellar account ID
   * @returns Account details
   */
  async getAccountDetails(accountId: string) {
    try {
      return await this.horizonServer.accounts().accountId(accountId).call();
    } catch (error) {
      this.logger.error(`Error fetching account details for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Check if an account exists and is active
   * @param accountId The Stellar account ID
   * @returns Boolean indicating if account exists and is active
   */
  async isAccountActive(accountId: string): Promise<boolean> {
    try {
      const account = await this.getAccountDetails(accountId);
      return !!account && account.subentry_count >= 0;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }
}
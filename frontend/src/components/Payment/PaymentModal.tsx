import { X, ShieldCheck } from 'lucide-react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/format';
import { useMemo, useState } from 'react';
import { QRCodeGenerator } from './QRCodeGenerator';
import { QRCodeScanner } from './QRCodeScanner';
import { PaymentURIHandler } from './PaymentURIHandler';
import type { ParsedStellarPaymentURI } from '../../utils/stellar/paymentUri';
import { usePaymentCheckout } from '../../hooks/usePaymentCheckout';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    currency: string;
    destination: string;
    splitId: string;
    onConfirm: () => void;
    onConfirmScannedPayment?: (payment: ParsedStellarPaymentURI) => Promise<void> | void;
    isProcessing?: boolean;
}

export const PaymentModal = ({
    isOpen,
    onClose,
    amount,
    currency,
    destination,
    splitId,
    onConfirm,
    onConfirmScannedPayment,
    isProcessing: externalIsProcessing
}: PaymentModalProps) => {
    const { t } = useTranslation();
    const { prefersReducedMotion } = useAccessibility();
    const {
        canTransact,
        connect,
        walletError: error,
        hasFreighter,
        isConnected,
        isConnecting,
        isRefreshing,
        publicKey,
        refresh,
        requiredNetworkLabel,
        walletNetworkLabel,
        isProcessing: checkoutIsProcessing,
    } = usePaymentCheckout();
    const isProcessing = externalIsProcessing || checkoutIsProcessing;
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannedPaymentUri, setScannedPaymentUri] = useState<string | null>(null);
    const paymentRequest = useMemo(
        () => ({
            destination,
            amount,
            memo: splitId,
            memoType: 'text' as const,
            message: t('split.paymentMemo', { splitId }),
            splitId,
        }),
        [amount, destination, splitId, t],
    );
    const accountLabel = publicKey ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : null;

    if (!isOpen) return null;

    const handleBackdropClick = () => {
        onClose();
    };

    const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
        >
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
                onClick={handleBackdropClick}
                onKeyDown={handleBackdropKeyDown}
                tabIndex={-1}
                aria-hidden="true"
            />
            <div className={`relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-xl ${prefersReducedMotion ? "" : "animate-in fade-in zoom-in-95 duration-200"}`}>
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-full p-1"
                    aria-label={t('common.close')}
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-300 shadow-sm">
                        <ShieldCheck size={32} aria-hidden="true" />
                    </div>
                    <h2 id="payment-modal-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('split.confirmPayment')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('split.youAreSending')}</p>
                    <div className="text-4xl font-black text-gray-900 dark:text-gray-100 mt-2 tracking-tight">
                        {formatCurrency(amount, currency)}
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    <div 
                        className="p-3 border-2 border-purple-100 dark:border-purple-900 rounded-xl flex items-center gap-3 cursor-pointer bg-purple-50/50 dark:bg-purple-900/20"
                        role="button"
                        tabIndex={0}
                        aria-label={t('split.freighterWallet')}
                    >
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-xs">F</span>
                        </div>
                        <div className="flex-1">
                            <span className="font-bold text-gray-900 dark:text-gray-100 text-sm block">
                                {t('split.freighterWallet')}
                            </span>
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                {isConnected && accountLabel
                                    ? `${t('split.connected')} • ${accountLabel}`
                                    : hasFreighter
                                        ? t('split.expectedNetwork', { network: requiredNetworkLabel })
                                        : t('split.freighterNotDetected')}
                            </span>
                        </div>
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-white ${canTransact ? 'bg-purple-600' : 'bg-gray-300'}`} aria-hidden="true">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {!hasFreighter ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {t('split.installFreighterToSettle')}
                        </div>
                    ) : null}

                    {hasFreighter && isConnected && !canTransact ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {t('split.networkSwitchSignModal', {
                                wallet: walletNetworkLabel ?? '',
                                required: requiredNetworkLabel ?? '',
                            })}
                        </div>
                    ) : null}

                    {error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {!canTransact ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {!isConnected ? (
                                <button
                                    type="button"
                                    onClick={() => void connect()}
                                    disabled={isConnecting || isRefreshing || !hasFreighter}
                                    className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isConnecting ? t('split.connecting') : t('split.connectFreighter')}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => void refresh()}
                                disabled={isRefreshing}
                                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isRefreshing ? t('split.refreshing') : t('split.refreshWallet')}
                            </button>
                        </div>
                    ) : null}
                </div>

                <QRCodeGenerator
                    paymentRequest={paymentRequest}
                    title={t('split.sharePaymentQr')}
                />

                <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                    {t('split.scanQrToPay')}
                </button>

                {scannedPaymentUri ? (
                    <div className="mt-3">
                        <PaymentURIHandler
                            paymentURI={scannedPaymentUri}
                            onPay={onConfirmScannedPayment}
                        />
                    </div>
                ) : null}

                <button
                    onClick={onConfirm}
                    disabled={isProcessing || !canTransact}
                    className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all flex items-center justify-center disabled:opacity-75 disabled:cursor-wait focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                    aria-busy={isProcessing || isConnecting || isRefreshing}
                >
                    {isProcessing ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" aria-hidden="true" />
                            {t('split.processing')}
                        </>
                    ) : !canTransact ? (
                        t('split.resolveWalletToContinue')
                    ) : (
                        t('split.confirmPayment')
                    )}
                </button>
            </div>

            <QRCodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onConfirm={(payment) => {
                    setScannedPaymentUri(payment.uri);
                    setIsScannerOpen(false);
                }}
            />
        </div>
    );
};

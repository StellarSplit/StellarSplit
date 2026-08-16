import { X, Copy, QrCode, Share2 } from 'lucide-react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { useTranslation } from 'react-i18next';
import { shareOrCopy, copyToClipboard } from '../../utils/browserShare';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    splitLink: string;
}

export const ShareModal = ({ isOpen, onClose, splitLink }: ShareModalProps) => {
    const { t } = useTranslation();
    const { prefersReducedMotion } = useAccessibility();

    if (!isOpen) return null;

    // Issue #488 — use browserShare adapter instead of raw browser APIs
    const handleCopy = async () => {
        await copyToClipboard(splitLink);
    };

    const handleShare = async () => {
        await shareOrCopy({
            title: t('split.shareTitle'),
            text: t('split.shareText'),
            url: splitLink,
        });
    };

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
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
        >
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
                onClick={handleBackdropClick}
                onKeyDown={handleBackdropKeyDown}
                tabIndex={-1}
                aria-hidden="true"
            />
            <div className={`relative bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl w-full max-w-sm p-6 shadow-xl ${prefersReducedMotion ? "" : "animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95 duration-300"}`}>

                <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 md:hidden" aria-hidden="true" />

                <div className="flex justify-between items-center mb-6">
                    <h2 id="share-modal-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('common.shareSplit')}</h2>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        aria-label="Close share modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 mb-6 flex items-center justify-center border-2 border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="text-center">
                        <div className="w-48 h-48 bg-gray-900 rounded-xl flex items-center justify-center mb-4 mx-auto text-white shadow-lg overflow-hidden relative" aria-label="QR Code">
                            {/* Placeholder for QR Code - ideally use qrcode.react here */}
                            <QrCode size={120} strokeWidth={1.5} aria-hidden="true" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
                                <span className="text-xs text-white px-2 text-center">{splitLink}</span>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('split.scanToJoin')}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={handleCopy} 
                        className="flex-1 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-gray-200 dark:active:bg-gray-500 text-gray-900 dark:text-gray-100 font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 border border-gray-100 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        aria-label="Copy link to clipboard"
                    >
                        <Copy size={18} aria-hidden="true" /> {t('split.copyLink')}
                    </button>
                    <button 
                        onClick={handleShare} 
                        className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                        aria-label="Share split link"
                    >
                        <Share2 size={18} aria-hidden="true" /> {t('common.share')}
                    </button>
                </div>
            </div>
        </div>
    );
};

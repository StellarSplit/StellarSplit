/**
 * PaymentStatusFeed.tsx
 * Location: frontend/src/components/Payment/PaymentStatusFeed.tsx
 *
 * Renders an accessible, animated live ticker of incoming payment events.
 * Integrates with usePaymentFeed and handles the split-completion banner.
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X, Zap } from 'lucide-react';
import type {
    PaymentStatusEvent,
    SplitCompletionEvent,
    FeedStatus,
} from '../../hooks/usePaymentFeed';
import { useAccessibility, useAnnounce } from '../../hooks/useAccessibility';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenAddress(address: string, chars = 4): string {
    if (!address || address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

function relativeTime(isoTimestamp: string): string {
    const diff = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
}

const STATUS_COLORS: Record<string, string> = {
    confirmed: 'text-green-600 dark:text-green-400',
    pending: 'text-yellow-600 dark:text-yellow-400',
    processing: 'text-blue-600 dark:text-blue-400',
    failed: 'text-red-600 dark:text-red-400',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PaymentRowProps {
    event: PaymentStatusEvent;
    isHighlighted: boolean;
    prefersReducedMotion?: boolean;
}

function PaymentRow({ event, isHighlighted, prefersReducedMotion = false }: PaymentRowProps) {
    const label = event.payerLabel || shortenAddress(event.payerId);
    const statusColor = STATUS_COLORS[event.status] ?? 'text-gray-500';

    return (
        <li
            className={[
                'flex items-center justify-between gap-3 rounded-xl px-4 py-3',
                'border',
                prefersReducedMotion ? '' : 'transition-all duration-500',
                isHighlighted
                    ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20 payment-flash'
                    : 'border-transparent bg-white/60 dark:bg-white/5',
            ].join(' ')}
        >
            {/* Left: payer + status */}
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {label}
                </span>
                <span className={`text-xs font-medium capitalize ${statusColor}`}>
                    {event.status}
                </span>
            </div>

            {/* Right: amount + time */}
            <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {event.amount.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-gray-500">{event.currency}</span>
                </span>
                <span className="text-xs text-gray-400">{relativeTime(event.timestamp)}</span>
            </div>
        </li>
    );
}

// ─── Celebration Banner ───────────────────────────────────────────────────────

interface CelebrationBannerProps {
    event: SplitCompletionEvent;
    onDismiss: () => void;
    prefersReducedMotion?: boolean;
}

function CelebrationBanner({ event, onDismiss, prefersReducedMotion = false }: CelebrationBannerProps) {
    // Focus the dismiss button automatically for keyboard users
    const btnRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        btnRef.current?.focus();
    }, []);

    return (
        <>
            {/* CSS-only confetti overlay — suppressed via prefers-reduced-motion or JS hook */}
            {!prefersReducedMotion && (
                <div className="confetti-overlay" aria-hidden="true">
                    {Array.from({ length: 30 }).map((_, i) => (
                        <span
                            key={i}
                            className="confetti-piece"
                            style={
                                {
                                    '--delay': `${(i * 0.12).toFixed(2)}s`,
                                    '--left': `${Math.floor(Math.random() * 100)}%`,
                                    '--hue': `${Math.floor(Math.random() * 360)}`,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                </div>
            )}

            {/* Banner */}
            <div
                role="status"
                aria-live="assertive"
                aria-atomic="true"
                className="relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-500 px-5 py-4 shadow-lg"
            >
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="shrink-0 text-white" size={28} />
                    <div>
                        <p className="text-base font-bold text-white">🎉 All settled!</p>
                        <p className="text-xs text-white/80">
                            {event.totalAmount.toFixed(2)} {event.currency} collected in full.
                        </p>
                    </div>
                </div>
                <button
                    ref={btnRef}
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss celebration banner"
                    className="shrink-0 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                    <X size={18} />
                </button>
            </div>
        </>
    );
}

// ─── Connection Badge ─────────────────────────────────────────────────────────

function ConnectionBadge({ status, prefersReducedMotion = false }: { status: FeedStatus; prefersReducedMotion?: boolean }) {
    const map: Record<FeedStatus, { label: string; color: string }> = {
        connected: { label: 'Live', color: 'bg-green-500' },
        connecting: { label: 'Connecting', color: 'bg-yellow-400' },
        disconnected: { label: 'Offline', color: 'bg-gray-400' },
        error: { label: 'Error', color: 'bg-red-500' },
    };
    const { label, color } = map[status];

    return (
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`inline-block h-2 w-2 rounded-full ${color} ${!prefersReducedMotion && status === 'connected' ? 'animate-pulse' : ''}`} />
            {label}
        </span>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface PaymentStatusFeedProps {
    events: PaymentStatusEvent[];
    latestEvent: PaymentStatusEvent | null;
    completionEvent: SplitCompletionEvent | null;
    status: FeedStatus;
}

export function PaymentStatusFeed({
    events,
    latestEvent,
    completionEvent,
    status,
}: PaymentStatusFeedProps) {
    const [highlightedTxHash, setHighlightedTxHash] = useState<string | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const { prefersReducedMotion } = useAccessibility();
    const { announce } = useAnnounce();

    // Flash the row that just arrived
    useEffect(() => {
        if (!latestEvent) return;
        setHighlightedTxHash(latestEvent.txHash);
        const timer = window.setTimeout(() => setHighlightedTxHash(null), 1800);
        return () => clearTimeout(timer);
    }, [latestEvent]);

    // Re-show banner if a new completion arrives, and announce it
    useEffect(() => {
        if (completionEvent) {
            setIsDismissed(false);
            announce(`All settled! ${completionEvent.totalAmount.toFixed(2)} ${completionEvent.currency} collected in full.`);
        }
    }, [completionEvent, announce]);

    return (
        <section aria-label="Live payment updates" className="mt-6 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <Zap size={15} className="text-purple-500" />
                    Payment Activity
                </h2>
                <ConnectionBadge status={status} prefersReducedMotion={prefersReducedMotion} />
            </div>

            {/* Celebration banner */}
            {completionEvent && !isDismissed && (
                <CelebrationBanner
                    event={completionEvent}
                    onDismiss={() => setIsDismissed(true)}
                    prefersReducedMotion={prefersReducedMotion}
                />
            )}

            {/* Event list */}
            {events.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-700">
                    Payments will appear here in real time.
                </p>
            ) : (
                <ul
                    aria-live="polite"
                    aria-label="Payment updates"
                    aria-relevant="additions"
                    className="space-y-2"
                >
                    {events.map((event) => (
                        <PaymentRow
                            key={`${event.txHash}-${event.timestamp}`}
                            event={event}
                            isHighlighted={event.txHash === highlightedTxHash}
                            prefersReducedMotion={prefersReducedMotion}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}
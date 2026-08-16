import { useState } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { useTranslation } from 'react-i18next';
import { UserPlus, Trash2, Percent, Sliders } from 'lucide-react';
import type { WizardParticipant, WizardState, SplitMethod } from '../../../types/wizard';

interface ParticipantsStepProps {
    value: Pick<WizardState, 'participants' | 'splitMethod' | 'totalAmount'>;
    onChange: (patch: Partial<WizardState>) => void;
    errors: Record<string, string>;
}

const generateId = () => Math.random().toString(36).slice(2, 9);

const emptyParticipant = (): WizardParticipant => ({
    id: generateId(),
    name: '',
    walletAddress: '',
    email: '',
    percentage: 0,
    customAmount: 0,
});

const showExtraField = (method: SplitMethod) =>
    method === 'percentage' || method === 'custom';

export const ParticipantsStep = ({ value, onChange, errors }: ParticipantsStepProps) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [touchedWallets, setTouchedWallets] = useState<Set<string>>(new Set());

    const markWalletTouched = (id: string) => {
        setTouchedWallets((prev) => new Set(prev).add(id));
    };

    const getWalletError = (participant: WizardParticipant): string | undefined => {
        const wallet = participant.walletAddress?.trim() ?? '';
        if (!wallet || !touchedWallets.has(participant.id)) return undefined;
        return errors[`wallet-${participant.id}`] ||
            (!StrKey.isValidEd25519PublicKey(wallet)
                ? t('wizard.validation.invalidWalletAddress')
                : undefined);
    };

    const updateParticipant = (id: string, patch: Partial<WizardParticipant>) => {
        onChange({
            participants: value.participants.map((p) =>
                p.id === id ? { ...p, ...patch } : p
            ),
        });
    };

    const addParticipant = () => {
        const p = emptyParticipant();
        onChange({ participants: [...value.participants, p] });
        setExpanded(p.id);
    };

    const removeParticipant = (id: string) => {
        onChange({ participants: value.participants.filter((p) => p.id !== id) });
        if (expanded === id) setExpanded(null);
    };

    const totalPercentage = value.participants.reduce(
        (acc, p) => acc + (p.percentage ?? 0), 0
    );
    const totalCustom = value.participants.reduce(
        (acc, p) => acc + (p.customAmount ?? 0), 0
    );

    return (
        <div className="space-y-6" role="group" aria-labelledby="participants-heading">
            <div>
                <h2 id="participants-heading" className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('wizard.participants.title')}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('wizard.participants.subtitle')}</p>
            </div>

            {errors.participants && (
                <p id="participants-error" className="text-xs text-red-500" role="alert">{errors.participants}</p>
            )}

            {/* Participant cards */}
            <div className="space-y-3" role="list" aria-label="Participants list">
                {value.participants.map((p, index) => {
                    const walletError = getWalletError(p);
                    return (
                    <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm" role="listitem">
                        {/* Card header */}
                        <div
                            className="flex items-center gap-3 p-4 cursor-pointer select-none"
                            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                            role="button"
                            aria-expanded={expanded === p.id}
                            aria-controls={`participant-${p.id}-details`}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setExpanded(expanded === p.id ? null : p.id);
                                }
                            }}
                        >
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 flex items-center justify-center text-sm font-bold shrink-0" aria-hidden="true">
                                {p.name ? p.name.charAt(0).toUpperCase() : index + 1}
                            </div>
                            <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {p.name || t('wizard.participants.participantN', { n: index + 1 })}
                            </span>
                            {showExtraField(value.splitMethod) && (
                                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 shrink-0 mr-2">
                                    {value.splitMethod === 'percentage'
                                        ? `${p.percentage ?? 0}%`
                                        : `${value.splitMethod === 'custom' ? (p.customAmount ?? 0).toFixed(2) : ''}`}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeParticipant(p.id); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                aria-label={`${t('wizard.participants.remove')} ${p.name || `participant ${index + 1}`}`}
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>

                        {/* Expanded fields */}
                        {expanded === p.id && (
                            <div 
                                id={`participant-${p.id}-details`}
                                className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3 bg-gray-50 dark:bg-gray-700/50"
                            >
                                <div className="space-y-1">
                                    <label 
                                        htmlFor={`participant-${p.id}-name`}
                                        className="block text-xs font-medium text-gray-600 dark:text-gray-300"
                                    >
                                        {t('wizard.participants.name')} 
                                        <span className="text-red-400" aria-hidden="true">*</span>
                                        <span className="sr-only"> (required)</span>
                                    </label>
                                    <input
                                        id={`participant-${p.id}-name`}
                                        type="text"
                                        value={p.name}
                                        onChange={(e) => updateParticipant(p.id, { name: e.target.value })}
                                        placeholder={t('wizard.participants.namePlaceholder')}
                                        aria-required="true"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label 
                                        htmlFor={`participant-${p.id}-wallet`}
                                        className="block text-xs font-medium text-gray-600 dark:text-gray-300"
                                    >
                                        {t('wizard.participants.walletAddress')}
                                    </label>
                                    <input
                                        id={`participant-${p.id}-wallet`}
                                        type="text"
                                        value={p.walletAddress ?? ''}
                                        onChange={(e) => updateParticipant(p.id, { walletAddress: e.target.value })}
                                        onBlur={() => markWalletTouched(p.id)}
                                        placeholder={t('wizard.participants.walletPlaceholder')}
                                        aria-invalid={walletError ? 'true' : undefined}
                                        aria-describedby={walletError ? `wallet-${p.id}-error` : undefined}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm placeholder-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono ${
                                            walletError
                                                ? 'border-red-400 dark:border-red-500 text-red-900 dark:text-red-100'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100'
                                        }`}
                                    />
                                    {walletError && (
                                        <p id={`wallet-${p.id}-error`} className="text-xs text-red-500" role="alert">
                                            {walletError}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label 
                                        htmlFor={`participant-${p.id}-email`}
                                        className="block text-xs font-medium text-gray-600 dark:text-gray-300"
                                    >
                                        {t('wizard.participants.email')}
                                    </label>
                                    <input
                                        id={`participant-${p.id}-email`}
                                        type="email"
                                        value={p.email ?? ''}
                                        onChange={(e) => updateParticipant(p.id, { email: e.target.value })}
                                        placeholder={t('wizard.participants.emailPlaceholder')}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                </div>

                                {value.splitMethod === 'percentage' && (
                                    <div className="space-y-1">
                                        <label 
                                            htmlFor={`participant-${p.id}-percentage`}
                                            className="block text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1"
                                        >
                                            <Percent size={11} aria-hidden="true" /> {t('wizard.participants.percentage')}
                                        </label>
                                        <input
                                            id={`participant-${p.id}-percentage`}
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={p.percentage ?? 0}
                                            onChange={(e) =>
                                                updateParticipant(p.id, { percentage: parseFloat(e.target.value) || 0 })
                                            }
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                        />
                                    </div>
                                )}

                                {value.splitMethod === 'custom' && (
                                    <div className="space-y-1">
                                        <label 
                                            htmlFor={`participant-${p.id}-custom`}
                                            className="block text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1"
                                        >
                                            <Sliders size={11} aria-hidden="true" /> {t('wizard.participants.customAmount')}
                                        </label>
                                        <input
                                            id={`participant-${p.id}-custom`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={p.customAmount ?? 0}
                                            onChange={(e) =>
                                                updateParticipant(p.id, { customAmount: parseFloat(e.target.value) || 0 })
                                            }
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>

            {/* Percentage / custom totals */}
            {value.splitMethod === 'percentage' && value.participants.length > 0 && (
                <div 
                    className={`text-xs font-semibold px-3 py-2 rounded-lg ${totalPercentage === 100 ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}
                    role="status"
                    aria-live="polite"
                >
                    {t('wizard.participants.totalPct')}: {totalPercentage}% {totalPercentage !== 100 && `(${t('wizard.participants.mustEqual100')})`}
                </div>
            )}
            {value.splitMethod === 'custom' && value.participants.length > 0 && (
                <div 
                    className={`text-xs font-semibold px-3 py-2 rounded-lg ${Math.abs(totalCustom - value.totalAmount) < 0.01 ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}
                    role="status"
                    aria-live="polite"
                >
                    {t('wizard.participants.totalCustom')}: {totalCustom.toFixed(2)} / {value.totalAmount.toFixed(2)}
                </div>
            )}

            {/* Add participant button */}
            <button
                type="button"
                onClick={addParticipant}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-semibold text-sm transition-colors min-h-[44px]"
                aria-describedby="participants-count"
            >
                <UserPlus size={16} aria-hidden="true" />
                {t('wizard.participants.addParticipant')}
            </button>
            <span id="participants-count" className="sr-only">
                {value.participants.length} participants added
            </span>
        </div>
    );
};
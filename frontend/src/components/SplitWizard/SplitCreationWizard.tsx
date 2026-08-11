import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, ArrowLeft, ArrowRight, CheckCircle, X } from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { SplitMethodStep } from './steps/SplitMethodStep';
import { ParticipantsStep } from './steps/ParticipantsStep';
import { ItemsStep } from './steps/ItemsStep';
import { TaxTipStep } from './steps/TaxTipStep';
import { ReviewStep } from './steps/ReviewStep';
import {
    validateBasicInfo,
    validateParticipants,
    validateItems,
} from './validators';
import { useWallet } from '../../hooks/use-wallet';
import type { WizardState } from '../../types/wizard';
import { INITIAL_WIZARD_STATE } from '../../types/wizard';
import { calculateWizardSplit } from '../../utils/split-calculations';
import {
    createActivityRecord,
    createSplit,
    getApiErrorMessage,
    getApiFieldErrors,
} from '../../utils/api-client';
import { storeSplitParticipantDirectory } from '../../utils/session';
import { draftRegistry } from '../../services/draftRegistry';

const loadDraft = (): WizardState => {
    draftRegistry.migrateWizardDraft();
    const data = draftRegistry.load('wizard');
    return data || INITIAL_WIZARD_STATE;
};

export const SplitCreationWizard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const announceRef = useRef<HTMLDivElement>(null);
    const { activeUserId } = useWallet();

    const [wizardState, setWizardState] = useState<WizardState>(loadDraft);
    const [currentStep, setCurrentStep] = useState(0);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [resumeBanner, setResumeBanner] = useState(
        searchParams.get('resume') === 'true' && draftRegistry.load('wizard') !== null,
    );

    const isItemized = wizardState.splitMethod === 'itemized';

    const ALL_STEPS = [
        { label: t('wizard.steps.basicInfo') },
        { label: t('wizard.steps.splitMethod') },
        { label: t('wizard.steps.participants') },
        ...(isItemized ? [{ label: t('wizard.steps.items') }] : []),
        { label: t('wizard.steps.taxTip') },
        { label: t('wizard.steps.review') },
    ];

    // Map logical step index to a stable step id
    const STEP_IDS = [
        'basicInfo',
        'splitMethod',
        'participants',
        ...(isItemized ? ['items'] : []),
        'taxTip',
        'review',
    ];

    const currentStepId = STEP_IDS[currentStep];
    const totalSteps = ALL_STEPS.length;

    // Announce step changes to screen readers
    useEffect(() => {
        if (announceRef.current) {
            announceRef.current.textContent = `Step ${currentStep + 1} of ${totalSteps}: ${ALL_STEPS[currentStep].label}`;
        }
    }, [currentStep, totalSteps, ALL_STEPS]);

    // Auto-save draft on every state change
    useEffect(() => {
        draftRegistry.save('wizard', wizardState, 'wizard', wizardState.title || 'Split Wizard Draft');
    }, [wizardState]);

    const patch = useCallback((p: Partial<WizardState>) => {
        setWizardState((prev) => ({ ...prev, ...p }));
        setErrors({});
    }, []);

    const generateUuid = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
            const random = Math.random() * 16 | 0;
            const value = char === 'x' ? random : (random & 0x3 | 0x8);
            return value.toString(16);
        });
    };

    const ensureUuid = (value: string) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
            ? value
            : generateUuid();
    };

    const validateCurrentStep = (): boolean => {
        let stepErrors: Record<string, string> = {};

        if (currentStepId === 'basicInfo') {
            stepErrors = validateBasicInfo(wizardState, t);
        } else if (currentStepId === 'participants') {
            stepErrors = validateParticipants(wizardState, t);
        } else if (currentStepId === 'items') {
            stepErrors = validateItems(wizardState, t);
        }

        setErrors(stepErrors);
        return Object.keys(stepErrors).length === 0;
    };

    const handleNext = () => {
        if (!validateCurrentStep()) return;
        if (currentStep < totalSteps - 1) {
            setCurrentStep((s) => s + 1);
            setErrors({});
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep((s) => s - 1);
            setErrors({});
        }
    };

    const handleSaveDraft = () => {
        draftRegistry.save('wizard', wizardState, 'wizard', wizardState.title || 'Split Wizard Draft');
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
    };

    const handleSubmit = async () => {
        if (!validateCurrentStep()) return;
        if (!activeUserId) {
            setErrors({
                submit: 'Connect your wallet before creating a split.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const participantsWithApiIds = wizardState.participants.map((participant) => ({
                ...participant,
                apiId: ensureUuid(participant.id),
            }));

            const calculation = calculateWizardSplit({
                ...wizardState,
                participants: participantsWithApiIds.map((participant) => ({
                    ...participant,
                    id: participant.apiId,
                })),
            });

            const shareMap = new Map(
                calculation.shares.map((share) => [share.participantId, share.total]),
            );

            const createdSplit = await createSplit({
                totalAmount: calculation.grandTotal,
                description: wizardState.title.trim(),
                creatorWalletAddress: activeUserId,
                preferredCurrency: wizardState.currency,
                participants: participantsWithApiIds.map((participant) => ({
                    userId: participant.apiId,
                    amountOwed: shareMap.get(participant.apiId) ?? 0,
                    walletAddress: participant.walletAddress?.trim() || undefined,
                })),
                items: wizardState.splitMethod === 'itemized'
                    ? wizardState.items.map((item) => ({
                        name: item.name.trim(),
                        quantity: 1,
                        unitPrice: item.price,
                        totalPrice: item.price,
                        assignedToIds: (item.assignedTo.length > 0 ? item.assignedTo : participantsWithApiIds.map((participant) => participant.id))
                            .map((participantId) => {
                                const participant = participantsWithApiIds.find((candidate) => candidate.id === participantId);
                                return participant?.apiId;
                            })
                            .filter((participantId): participantId is string => Boolean(participantId)),
                    }))
                    : undefined,
            });

            storeSplitParticipantDirectory(
                createdSplit.id,
                participantsWithApiIds.reduce<Record<string, { name: string; email?: string; walletAddress?: string }>>(
                    (directory, participant) => {
                        directory[participant.apiId] = {
                            name: participant.name.trim() || participant.apiId,
                            email: participant.email?.trim() || undefined,
                            walletAddress: participant.walletAddress?.trim() || undefined,
                        };
                        return directory;
                    },
                    {},
                ),
            );

            await createActivityRecord({
                userId: activeUserId,
                activityType: 'split_created',
                splitId: createdSplit.id,
                metadata: {
                    title: wizardState.title.trim(),
                    totalAmount: calculation.grandTotal,
                    currency: wizardState.currency,
                    participantCount: wizardState.participants.length,
                },
            }).catch(() => undefined);

            draftRegistry.delete('wizard');
            navigate(`/split/${createdSplit.id}`);
        } catch (error) {
            const fieldErrors = getApiFieldErrors(error);
            setErrors(
                Object.keys(fieldErrors).length > 0
                    ? fieldErrors
                    : { submit: getApiErrorMessage(error) },
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStep = () => {
        switch (currentStepId) {
            case 'basicInfo':
                return (
                    <BasicInfoStep
                        value={wizardState}
                        onChange={patch}
                        errors={errors}
                    />
                );
            case 'splitMethod':
                return (
                    <SplitMethodStep
                        value={wizardState}
                        onChange={patch}
                    />
                );
            case 'participants':
                return (
                    <ParticipantsStep
                        value={wizardState}
                        onChange={patch}
                        errors={errors}
                    />
                );
            case 'items':
                return (
                    <ItemsStep
                        value={wizardState}
                        onChange={patch}
                        errors={errors}
                    />
                );
            case 'taxTip':
                return (
                    <TaxTipStep
                        value={wizardState}
                        onChange={patch}
                        errors={errors}
                    />
                );
            case 'review':
                return <ReviewStep value={wizardState} />;
            default:
                return null;
        }
    };

    const isLastStep = currentStep === totalSteps - 1;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Live region for step announcements */}
            <div
                ref={announceRef}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            />

            {/* Resume banner */}
            {resumeBanner && (
                <div className="max-w-lg mx-auto px-4 pt-4">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <span>Resuming your saved draft</span>
                        <button
                            type="button"
                            onClick={() => setResumeBanner(false)}
                            className="p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Dismiss resume banner"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        aria-label={t('common.backToDashboard')}
                    >
                        <ArrowLeft size={20} aria-hidden="true" />
                    </button>
                    <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {t('wizard.pageTitle')}
                    </h1>
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all
                            ${draftSaved
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        aria-pressed={draftSaved}
                    >
                        <Save size={13} aria-hidden="true" />
                        {draftSaved ? t('wizard.draftSaved') : t('wizard.saveDraft')}
                    </button>
                </div>
                <StepIndicator steps={ALL_STEPS} currentStep={currentStep} />
            </div>

            {/* Step content */}
            <div className="max-w-lg mx-auto px-4 py-6">
                {errors.submit ? (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errors.submit}
                    </div>
                ) : null}
                {renderStep()}
            </div>

            {/* Navigation footer */}
            <div className="sticky bottom-0 z-20 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    {currentStep > 0 && (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                            <ArrowLeft size={16} aria-hidden="true" />
                            {t('wizard.back')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={isLastStep ? handleSubmit : handleNext}
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse">{t('wizard.creating')}</span>
                        ) : isLastStep ? (
                            <>
                                <CheckCircle size={16} aria-hidden="true" />
                                {t('wizard.createSplit')}
                            </>
                        ) : (
                            <>
                                {t('wizard.next')}
                                <ArrowRight size={16} aria-hidden="true" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

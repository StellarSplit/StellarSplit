import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { validateBasicInfo, validateParticipants, validateItems } from './validators';
import type { WizardState } from '../../types/wizard';
import { INITIAL_WIZARD_STATE } from '../../types/wizard';

const t = (key: string) => key;
const navigateMock = vi.fn();
const createSplitMock = vi.fn();
const createActivityRecordMock = vi.fn();

// ── Validator unit tests ──────────────────────────────────────────────────────

describe('validateBasicInfo', () => {
    it('returns errors when fields are empty', () => {
        const errors = validateBasicInfo(INITIAL_WIZARD_STATE, t);
        expect(errors.title).toBeDefined();
        expect(errors.totalAmount).toBeDefined();
    });

    it('passes when all required fields are filled', () => {
        const errors = validateBasicInfo(
            { title: 'Dinner', currency: 'USD', totalAmount: 100 },
            t
        );
        expect(Object.keys(errors).length).toBe(0);
    });

    it('rejects a totalAmount of zero', () => {
        const errors = validateBasicInfo(
            { title: 'Dinner', currency: 'USD', totalAmount: 0 },
            t
        );
        expect(errors.totalAmount).toBeDefined();
    });
});

describe('validateParticipants', () => {
    const base: WizardState = {
        ...INITIAL_WIZARD_STATE,
        participants: [
            { id: '1', name: 'Alice', walletAddress: 'GCSHT2OAA4HAGDYSJFR4RR5WGK3IMCBNTPVP3XTEY3IYNNUZ33U3DPN3', percentage: 50, customAmount: 0 },
            { id: '2', name: 'Bob', walletAddress: 'GAYDMBV2QPNNFQQRLELQ4PPGMO7NHCHKMJ5QDMI6OABGQWEDONV7PKOV', percentage: 50, customAmount: 0 },
        ],
        totalAmount: 100,
    };

    it('passes for equal split with 2 named participants', () => {
        const errors = validateParticipants({ ...base, splitMethod: 'equal' }, t);
        expect(Object.keys(errors).length).toBe(0);
    });

    it('fails when fewer than 2 participants', () => {
        const errors = validateParticipants(
            { ...base, participants: [{ id: '1', name: 'Alice' }], splitMethod: 'equal' },
            t
        );
        expect(errors.participants).toBeDefined();
    });

    it('fails when percentages do not sum to 100', () => {
        const errors = validateParticipants(
            {
                ...base,
                splitMethod: 'percentage',
                participants: [
                    { id: '1', name: 'Alice', percentage: 40 },
                    { id: '2', name: 'Bob', percentage: 40 },
                ],
            },
            t
        );
        expect(errors.participants).toBeDefined();
    });

    it('passes when percentages sum to 100', () => {
        const errors = validateParticipants({ ...base, splitMethod: 'percentage' }, t);
        expect(Object.keys(errors).length).toBe(0);
    });

    it('fails when custom amounts do not match total', () => {
        const errors = validateParticipants(
            {
                ...base,
                splitMethod: 'custom',
                participants: [
                    { id: '1', name: 'Alice', customAmount: 30 },
                    { id: '2', name: 'Bob', customAmount: 30 },
                ],
                totalAmount: 100,
            },
            t
        );
        expect(errors.participants).toBeDefined();
    });

    it('rejects a participant with a malformed Stellar wallet address', () => {
        const errors = validateParticipants(
            {
                ...base,
                splitMethod: 'equal',
                participants: [
                    { id: '1', name: 'Alice', walletAddress: 'GA5X6M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5M5' },
                    { id: '2', name: 'Bob', walletAddress: '' },
                ],
            },
            t
        );
        expect(errors['wallet-1']).toBeDefined();
        expect(errors['wallet-1']).toBe('wizard.validation.invalidWalletAddress');
    });

    it('passes participants with valid Stellar public keys', () => {
        const errors = validateParticipants(
            {
                ...base,
                splitMethod: 'equal',
                participants: [
                    { id: '1', name: 'Alice', walletAddress: 'GCSHT2OAA4HAGDYSJFR4RR5WGK3IMCBNTPVP3XTEY3IYNNUZ33U3DPN3' },
                    { id: '2', name: 'Bob', walletAddress: 'GAYDMBV2QPNNFQQRLELQ4PPGMO7NHCHKMJ5QDMI6OABGQWEDONV7PKOV' },
                ],
            },
            t
        );
        expect(errors['wallet-1']).toBeUndefined();
        expect(errors['wallet-2']).toBeUndefined();
    });

    it('ignores empty wallet address fields', () => {
        const errors = validateParticipants(
            {
                ...base,
                splitMethod: 'equal',
                participants: [
                    { id: '1', name: 'Alice' },
                    { id: '2', name: 'Bob', walletAddress: '' },
                ],
            },
            t
        );
        expect(errors['wallet-1']).toBeUndefined();
        expect(errors['wallet-2']).toBeUndefined();
    });
});

describe('validateItems', () => {
    it('fails when items list is empty', () => {
        const errors = validateItems({ items: [] }, t);
        expect(errors.items).toBeDefined();
    });

    it('fails when an item has no name', () => {
        const errors = validateItems(
            { items: [{ id: '1', name: '', price: 10, assignedTo: [] }] },
            t
        );
        expect(errors.items).toBeDefined();
    });

    it('fails when an item has zero price', () => {
        const errors = validateItems(
            { items: [{ id: '1', name: 'Steak', price: 0, assignedTo: [] }] },
            t
        );
        expect(errors.items).toBeDefined();
    });

    it('passes for a valid item', () => {
        const errors = validateItems(
            { items: [{ id: '1', name: 'Steak', price: 25, assignedTo: [] }] },
            t
        );
        expect(Object.keys(errors).length).toBe(0);
    });
});

// ── Wizard navigation smoke test ─────────────────────────────────────────────

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock('../../hooks/use-wallet', () => ({
    useWallet: () => ({
        activeUserId: 'GAYDMBV2QPNNFQQRLELQ4PPGMO7NHCHKMJ5QDMI6OABGQWEDONV7PKOV',
    }),
}));

vi.mock('../../utils/api-client', () => ({
    createSplit: (...args: unknown[]) => createSplitMock(...args),
    createActivityRecord: (...args: unknown[]) => createActivityRecordMock(...args),
    getApiErrorMessage: (error: unknown) =>
        error instanceof Error ? error.message : 'Request failed',
    getApiFieldErrors: () => ({}),
}));

import { SplitCreationWizard } from './SplitCreationWizard';

describe('SplitCreationWizard navigation', () => {
    beforeEach(() => {
        localStorage.clear();
        navigateMock.mockReset();
        createSplitMock.mockReset();
        createActivityRecordMock.mockReset();
        createActivityRecordMock.mockResolvedValue(undefined);
    });

    it('renders the wizard on step 1', () => {
        render(
            <MemoryRouter>
                <SplitCreationWizard />
            </MemoryRouter>
        );
        expect(screen.getByText('wizard.pageTitle')).toBeDefined();
    });

    it('shows validation errors when Next is clicked with empty BasicInfo', () => {
        render(
            <MemoryRouter>
                <SplitCreationWizard />
            </MemoryRouter>
        );
        const nextBtn = screen.getByText('wizard.next');
        fireEvent.click(nextBtn);
        expect(screen.getByText('wizard.validation.titleRequired')).toBeDefined();
    });

    it('advances to step 2 when BasicInfo is valid', () => {
        render(
            <MemoryRouter>
                <SplitCreationWizard />
            </MemoryRouter>
        );
        const titleInput = screen.getByPlaceholderText('wizard.basicInfo.splitTitlePlaceholder');
        fireEvent.change(titleInput, { target: { value: 'Dinner' } });

        const amountInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(amountInput, { target: { value: '100' } });

        fireEvent.click(screen.getByText('wizard.next'));
        expect(screen.getByText('wizard.splitMethod.title')).toBeDefined();
    });

    it('can navigate back from step 2 to step 1', () => {
        render(
            <MemoryRouter>
                <SplitCreationWizard />
            </MemoryRouter>
        );
        const titleInput = screen.getByPlaceholderText('wizard.basicInfo.splitTitlePlaceholder');
        fireEvent.change(titleInput, { target: { value: 'Dinner' } });
        const amountInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(amountInput, { target: { value: '100' } });
        fireEvent.click(screen.getByText('wizard.next'));

        // Back to step 1
        fireEvent.click(screen.getByText('wizard.back'));
        expect(screen.getByText('wizard.basicInfo.title')).toBeDefined();
    });

    it('restores a saved draft from localStorage', () => {
        const draft: WizardState = {
            ...INITIAL_WIZARD_STATE,
            title: 'Saved Draft Title',
            totalAmount: 250,
        };
        localStorage.setItem('splitwizard_draft', JSON.stringify(draft));

        render(
            <MemoryRouter>
                <SplitCreationWizard />
            </MemoryRouter>
        );
        const input = screen.getByDisplayValue('Saved Draft Title');
        expect(input).toBeDefined();
    });

    it('submits a real split payload and navigates to the created split', async () => {
        createSplitMock.mockResolvedValue({ id: 'split-123' });

        render(
            <MemoryRouter>
                <SplitCreationWizard />
            </MemoryRouter>
        );

        fireEvent.change(
            screen.getByPlaceholderText('wizard.basicInfo.splitTitlePlaceholder'),
            { target: { value: 'Dinner with friends' } },
        );
        fireEvent.change(screen.getByPlaceholderText('0.00'), {
            target: { value: '120' },
        });
        fireEvent.click(screen.getByText('wizard.next'));

        fireEvent.click(screen.getByText('wizard.next'));

        fireEvent.click(screen.getByText('wizard.participants.addParticipant'));
        fireEvent.change(screen.getByPlaceholderText('wizard.participants.namePlaceholder'), {
            target: { value: 'Alice' },
        });
        // Fill in wallet address for Alice
        const walletInputs = screen.getAllByPlaceholderText('wizard.participants.walletPlaceholder');
        fireEvent.change(walletInputs[0], { target: { value: 'GCSHT2OAA4HAGDYSJFR4RR5WGK3IMCBNTPVP3XTEY3IYNNUZ33U3DPN3' } });
        fireEvent.click(screen.getByText('wizard.participants.addParticipant'));
        fireEvent.change(screen.getByPlaceholderText('wizard.participants.namePlaceholder'), {
            target: { value: 'Bob' },
        });
        // Fill in wallet address for Bob
        fireEvent.change(walletInputs[0], { target: { value: 'GAYDMBV2QPNNFQQRLELQ4PPGMO7NHCHKMJ5QDMI6OABGQWEDONV7PKOV' } });
        fireEvent.click(screen.getByText('wizard.next'));

        fireEvent.click(screen.getByText('wizard.next'));
        fireEvent.click(screen.getByText('wizard.createSplit'));

        expect(createSplitMock).toHaveBeenCalledTimes(1);
        expect(createSplitMock).toHaveBeenCalledWith(
            expect.objectContaining({
                description: 'Dinner with friends',
                creatorWalletAddress: 'GAYDMBV2QPNNFQQRLELQ4PPGMO7NHCHKMJ5QDMI6OABGQWEDONV7PKOV',
                preferredCurrency: 'USD',
                totalAmount: 120,
                participants: expect.arrayContaining([
                    expect.objectContaining({ amountOwed: 60 }),
                ]),
            }),
        );
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/split/split-123');
        });
        expect(localStorage.getItem('splitwizard_draft')).toBeNull();
    });
});

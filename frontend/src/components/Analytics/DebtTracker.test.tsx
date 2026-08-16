import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DebtTracker } from './DebtTracker';
import type { DebtBalance } from '../../types/analytics';

vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="responsive-container" style={{ width: 500, height: 240 }}>
                {children}
            </div>
        ),
    };
});

const mockData: DebtBalance[] = [
    { userId: 'u1', name: 'Alice', amount: 45.0, direction: 'owe' },
    { userId: 'u2', name: 'Bob', amount: 120.5, direction: 'owed' },
];

describe('DebtTracker', () => {
    it('renders the chart title', () => {
        render(<DebtTracker data={mockData} />);
        expect(screen.getByText('Debt Tracker')).toBeDefined();
    });

    it('renders summary cards', () => {
        render(<DebtTracker data={mockData} />);
        expect(screen.getByText('Owed to You')).toBeDefined();
        expect(screen.getByText('You Owe')).toBeDefined();
        expect(screen.getByText('Net Balance')).toBeDefined();
    });

    it('calculates net balance correctly', () => {
        render(<DebtTracker data={mockData} />);
        // 120.50 - 45.00 = 75.50
        expect(screen.getByText('+$75.50')).toBeDefined();
    });

    it('has the correct id for export', () => {
        const { container } = render(<DebtTracker data={mockData} />);
        expect(container.querySelector('#debt-tracker')).not.toBeNull();
    });

    it('shows loading skeleton when loading is true', () => {
        const { container } = render(<DebtTracker data={[]} loading={true} />);
        expect(container.querySelector('#debt-tracker')).not.toBeNull();
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(screen.queryByText('Debt Tracker')).toBeNull();
    });

    it('shows empty state when data is empty', () => {
        render(<DebtTracker data={[]} />);
        expect(screen.getByText('Debt Tracker')).toBeDefined();
        expect(screen.getByText(/all settled up/)).toBeDefined();
    });

    it('shows error state with retry button', () => {
        const onRetry = vi.fn();
        render(<DebtTracker data={[]} error="Failed to load" onRetry={onRetry} />);
        expect(screen.getByText('Debt Tracker')).toBeDefined();
        expect(screen.getByText('Failed to load')).toBeDefined();
        expect(screen.getByText('Try again')).toBeDefined();
    });

    it('shows loading state over empty state when both are set', () => {
        const { container } = render(<DebtTracker data={[]} loading={true} error={null} />);
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(screen.queryByText(/all settled up/)).toBeNull();
    });
});
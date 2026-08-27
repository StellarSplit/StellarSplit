import { Injectable } from '@nestjs/common';
import { Split } from '../../entities/split.entity';
import { HistoricalRatesService } from '../historical-rates.service';

@Injectable()
export class QBOExporterService {
    constructor(private readonly ratesService: HistoricalRatesService) { }

    async generate(splits: Split[]): Promise<string> {
        // Basic QBO format (CSV-based import for QuickBooks Online)
        const headers = ['Date', 'Description', 'Amount'];
        const dates = splits.map((s) => s.createdAt);
        const ratesMap = await this.ratesService.getXlmPricesForDates(dates);

        const rows = splits.map((split) => {
            const dateStr = this.ratesService.toDateString(split.createdAt);
            const rate = ratesMap.get(dateStr);

            let amountStr = '';
            let description = split.description || 'StellarSplit Transaction';

            if (rate !== null && rate !== undefined) {
                const fiatAmount = Number(split.totalAmount) * rate;
                amountStr = (-fiatAmount).toFixed(2);
            } else {
                description = `${description} (rate unavailable)`;
            }

            return [
                split.createdAt.toLocaleDateString('en-US'),
                description,
                amountStr,
            ].join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }
}

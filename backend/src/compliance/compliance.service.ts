import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ExpenseCategory } from './entities/expense-category.entity';
import { TaxExportRequest, ExportStatus, ExportFormat } from './entities/tax-export-request.entity';
import { Split } from '../entities/split.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RequestExportDto } from './dto/request-export.dto';

@Injectable()
export class ComplianceService {
    constructor(
        @InjectRepository(ExpenseCategory)
        private categoryRepo: Repository<ExpenseCategory>,
        @InjectRepository(TaxExportRequest)
        private exportRepo: Repository<TaxExportRequest>,
        @InjectRepository(Split)
        private splitRepo: Repository<Split>,
        @InjectQueue('compliance-export')
        private exportQueue: Queue,
    ) { }

    async createCategory(userId: string, data: Partial<ExpenseCategory>) {
        const category = this.categoryRepo.create({ ...data, userId });
        return this.categoryRepo.save(category);
    }

    async getCategories(userId: string) {
        return this.categoryRepo.find({ where: { userId } });
    }

    async assignCategoryToSplit(splitId: string, categoryId: string) {
        const split = await this.splitRepo.findOne({ where: { id: splitId } });
        if (!split) throw new NotFoundException('Split not found');

        const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
        if (!category) throw new NotFoundException('Category not found');

        split.categoryId = categoryId;
        return this.splitRepo.save(split);
    }

    async requestExport(userId: string, data: RequestExportDto) {
        const request = this.exportRepo.create({
            userId,
            exportFormat: data.exportFormat,
            periodStart: new Date(data.periodStart),
            periodEnd: new Date(data.periodEnd),
            filters: data.filters,
            status: ExportStatus.QUEUED,
        });

        const savedRequest = await this.exportRepo.save(request);

        await this.exportQueue.add('generate-export', {
            requestId: savedRequest.id,
        });

        return savedRequest;
    }

    async getExportStatus(requestId: string) {
        const request = await this.exportRepo.findOne({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Export request not found');
        return request;
    }

    async getSummary(userId: string, year: number) {
        const start = new Date(`${year}-01-01`);
        const end = new Date(`${year}-12-31`);

        const splits = await this.splitRepo.find({
            where: {
                creatorWalletAddress: userId, // Assuming creator is the one reporting
                createdAt: Between(start, end),
            },
            relations: ['category'],
        });

        const summary: Record<string, { total: number; deductible: number }> = {};

        for (const split of splits) {
            const categoryName = split.category?.name || 'Uncategorized';
            if (!summary[categoryName]) {
                summary[categoryName] = { total: 0, deductible: 0 };
            }

            const amount = Number(split.totalAmount);
            summary[categoryName].total += amount;
            if (split.category?.taxDeductible) {
                summary[categoryName].deductible += amount;
            }
        }

        return summary;
    }

    async downloadExport(requestId: string, userId: string) {
        const request = await this.exportRepo.findOne({ where: { id: requestId, userId } });
        if (!request) throw new NotFoundException('Export request not found or access denied');
        if (request.status !== ExportStatus.READY) throw new BadRequestException('Export not ready');

        // Return the file content or stream
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'exports', `tax-export-${requestId}.${request.exportFormat.toLowerCase()}`);
        if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');

        return {
            fileName: `tax-export-${requestId}.${request.exportFormat.toLowerCase()}`,
            content: fs.readFileSync(filePath),
            mimeType: this.getMimeType(request.exportFormat),
        };
    }

    private getMimeType(format: ExportFormat): string {
        switch (format) {
            case ExportFormat.CSV: return 'text/csv';
            case ExportFormat.PDF: return 'application/pdf';
            case ExportFormat.QBO: return 'application/octet-stream';
            case ExportFormat.JSON: return 'application/json';
            case ExportFormat.OFX: return 'application/xml';
            default: return 'application/octet-stream';
        }
    }
}

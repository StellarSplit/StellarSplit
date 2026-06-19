import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceService } from './compliance.service';
import { TaxExportRequest, ExportStatus, ExportFormat } from './entities/tax-export-request.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { Split } from '../entities/split.entity';
import { getQueueToken } from '@nestjs/bull';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let exportRepo: Repository<TaxExportRequest>;
  let categoryRepo: Repository<ExpenseCategory>;
  let splitRepo: Repository<Split>;
  let exportQueue: { add: jest.Mock };

  beforeEach(async () => {
    exportQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        {
          provide: getRepositoryToken(TaxExportRequest),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(ExpenseCategory),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Split),
          useClass: Repository,
        },
        {
          provide: getQueueToken('compliance-export'),
          useValue: exportQueue,
        },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
    exportRepo = module.get<Repository<TaxExportRequest>>(getRepositoryToken(TaxExportRequest));
    categoryRepo = module.get<Repository<ExpenseCategory>>(getRepositoryToken(ExpenseCategory));
    splitRepo = module.get<Repository<Split>>(getRepositoryToken(Split));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestExport', () => {
    it('should create export request with QUEUED status', async () => {
      const mockRequest = {
        id: 'test-id',
        userId: 'user-1',
        exportFormat: ExportFormat.CSV,
        periodStart: new Date('2023-01-01'),
        periodEnd: new Date('2023-12-31'),
        status: ExportStatus.QUEUED,
      };
      jest.spyOn(exportRepo, 'create').mockReturnValue(mockRequest as any);
      jest.spyOn(exportRepo, 'save').mockResolvedValue(mockRequest as any);

      const result = await service.requestExport('user-1', {
        exportFormat: ExportFormat.CSV,
        periodStart: '2023-01-01',
        periodEnd: '2023-12-31',
      });

      expect(result.status).toBe(ExportStatus.QUEUED);
      expect(exportQueue.add).toHaveBeenCalledWith('generate-export', {
        requestId: mockRequest.id,
      });
    });
  });

  describe('getExportStatus', () => {
    it('should return READY status', async () => {
      const mockRequest = { id: 'test-id', status: ExportStatus.READY };
      jest.spyOn(exportRepo, 'findOne').mockResolvedValue(mockRequest as any);

      const result = await service.getExportStatus('test-id');
      expect(result.status).toBe(ExportStatus.READY);
    });

    it('should return FAILED status', async () => {
      const mockRequest = { id: 'test-id', status: ExportStatus.FAILED };
      jest.spyOn(exportRepo, 'findOne').mockResolvedValue(mockRequest as any);

      const result = await service.getExportStatus('test-id');
      expect(result.status).toBe(ExportStatus.FAILED);
    });
  });
});

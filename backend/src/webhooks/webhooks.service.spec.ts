import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhooksService } from './webhooks.service';
import { Webhook, WebhookEventType } from './webhook.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WebhooksService', () => {
  let service: WebhooksService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(Webhook),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a webhook successfully', async () => {
      const createDto: CreateWebhookDto = {
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.SPLIT_CREATED],
      };

      mockRepository.create.mockImplementation((data) => ({
        id: 'webhook-123',
        ...data,
      }));
      mockRepository.save.mockImplementation(async (data) => ({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: createDto.userId,
        url: createDto.url,
        events: createDto.events,
        secret: expect.stringMatching(/^[a-f0-9]{64}$/),
        isActive: true,
        failureCount: 0,
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.secret).toHaveLength(64);
      expect(result.secret).toMatch(/^[a-f0-9]+$/);
    });

    it('should ignore client-supplied secrets and generate its own', async () => {
      const createDto = {
        userId: 'user-123',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.SPLIT_CREATED],
        secret: 'a',
      } as CreateWebhookDto & { secret: string };

      mockRepository.create.mockImplementation((data) => ({
        id: 'webhook-123',
        ...data,
      }));
      mockRepository.save.mockImplementation(async (data) => data);

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      expect(result.secret).not.toBe(createDto.secret);
    });

    it('should throw BadRequestException for invalid URL', async () => {
      const createDto: CreateWebhookDto = {
        userId: 'user-123',
        url: 'invalid-url',
        events: [WebhookEventType.SPLIT_CREATED],
      };

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all webhooks', async () => {
      const webhooks = [
        { id: 'webhook-1', userId: 'user-1' },
        { id: 'webhook-2', userId: 'user-2' },
      ];

      mockRepository.find.mockResolvedValue(webhooks);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        relations: ['deliveries'],
      });
      expect(result).toEqual(webhooks);
    });

    it('should filter by userId when provided', async () => {
      const webhooks = [{ id: 'webhook-1', userId: 'user-1' }];

      mockRepository.find.mockResolvedValue(webhooks);

      const result = await service.findAll('user-1');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        relations: ['deliveries'],
      });
      expect(result).toEqual(webhooks);
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id', async () => {
      const webhook = { id: 'webhook-123', userId: 'user-1' };

      mockRepository.findOne.mockResolvedValue(webhook);

      const result = await service.findOne('webhook-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
        relations: ['deliveries'],
      });
      expect(result).toEqual(webhook);
    });

    it('should throw NotFoundException if webhook not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a webhook successfully', async () => {
      const webhook = {
        id: 'webhook-123',
        userId: 'user-1',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.SPLIT_CREATED],
        secret: 'old-secret',
        isActive: true,
      };

      const updateDto: UpdateWebhookDto = {
        url: 'https://newurl.com/webhook',
        isActive: false,
      };

      mockRepository.findOne.mockResolvedValue(webhook);
      mockRepository.save.mockResolvedValue({ ...webhook, ...updateDto });

      const result = await service.update('webhook-123', updateDto);

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.url).toBe(updateDto.url);
      expect(result.isActive).toBe(updateDto.isActive);
    });

    it('should reject weak webhook secrets during rotation', async () => {
      const webhook = {
        id: 'webhook-123',
        userId: 'user-1',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.SPLIT_CREATED],
        secret: 'old-secret',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(webhook);

      await expect(
        service.update('webhook-123', { secret: 'a' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should accept strong webhook secrets during rotation', async () => {
      const webhook = {
        id: 'webhook-123',
        userId: 'user-1',
        url: 'https://example.com/webhook',
        events: [WebhookEventType.SPLIT_CREATED],
        secret: 'old-secret',
        isActive: true,
      };
      const strongSecret = '0123456789abcdef0123456789abcdef';

      mockRepository.findOne.mockResolvedValue(webhook);
      mockRepository.save.mockResolvedValue({
        ...webhook,
        secret: strongSecret,
      });

      const result = await service.update('webhook-123', {
        secret: strongSecret,
      });

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ secret: strongSecret }),
      );
      expect(result.secret).toBe(strongSecret);
    });
  });

  describe('remove', () => {
    it('should delete a webhook', async () => {
      const webhook = { id: 'webhook-123' };

      mockRepository.findOne.mockResolvedValue(webhook);
      mockRepository.remove.mockResolvedValue(webhook);

      await service.remove('webhook-123');

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.remove).toHaveBeenCalledWith(webhook);
    });
  });

  describe('incrementFailureCount', () => {
    it('should increment failure count', async () => {
      const webhook = {
        id: 'webhook-123',
        failureCount: 5,
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(webhook);
      mockRepository.save.mockResolvedValue({
        ...webhook,
        failureCount: 6,
      });

      await service.incrementFailureCount('webhook-123');

      expect(webhook.failureCount).toBe(6);
    });

    it('should deactivate webhook after 10 failures', async () => {
      const webhook = {
        id: 'webhook-123',
        failureCount: 9,
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(webhook);
      mockRepository.save.mockResolvedValue({
        ...webhook,
        failureCount: 10,
        isActive: false,
      });

      await service.incrementFailureCount('webhook-123');

      expect(webhook.failureCount).toBe(10);
      expect(webhook.isActive).toBe(false);
    });
  });
});

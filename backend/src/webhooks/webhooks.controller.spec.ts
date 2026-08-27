import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookPolicyService } from './webhook-policy.service';
import { TestWebhookDispatcher } from './test-webhook-dispatcher';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { WebhookEventType } from './webhook.entity';

describe('WebhooksController', () => {
  let controller: WebhooksController;

  const mockWebhooksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findByUserId: jest.fn(),
  };

  const mockDeliveryService = {
    getDeliveryLogs: jest.fn(),
    getRecentDeliveries: jest.fn(),
    getDeliveryStats: jest.fn(),
  };

  const mockPolicyService = {
    assertOwnership: jest.fn(),
  };

  const mockTestDispatcher = {
    dispatchTest: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    walletAddress: 'WALLET123',
    raw: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
      
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
                                                                   { provide: WebhookPolicyService, useValue: mockPolicyService },
        {
          provide: WebhookDeliveryService,
          useValue: mockDeliveryService,
        },
        {
          provide: TestWebhookDispatcher,
          useValue: mockTestDispatcher,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a webhook and set userId from auth', async () => {
      const createDto: CreateWebhookDto = {
        url: 'https://example.com/webhook',
        events: [WebhookEventType.SPLIT_CREATED],
      };

      const webhook = {
        id: 'webhook-123',
        userId: mockUser.id,
        ...createDto,
        secret: 'generated-secret',
      };
      mockWebhooksService.create.mockResolvedValue(webhook);

      const result = await controller.create(createDto, mockUser);

      expect(createDto.userId).toBe(mockUser.id);
      expect(mockWebhooksService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(webhook);
    });
  });

  describe('findAll', () => {
    it('should return webhooks for the authenticated user', async () => {
      const webhooks = [{ id: 'webhook-1', userId: mockUser.id }];
      mockWebhooksService.findByUserId.mockResolvedValue(webhooks);

      const result = await controller.findAll(mockUser);

      expect(mockWebhooksService.findByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(webhooks);
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id and check ownership', async () => {
      const webhook = { id: 'webhook-123', userId: mockUser.id };
      mockWebhooksService.findOne.mockResolvedValue(webhook);

      const result = await controller.findOne('webhook-123', mockUser);

      expect(mockWebhooksService.findOne).toHaveBeenCalledWith('webhook-123');
      expect(mockPolicyService.assertOwnership).toHaveBeenCalledWith(mockUser, webhook);
      expect(result).toEqual(webhook);
    });
  });

  describe('update', () => {
    it('should update a webhook and check ownership', async () => {
      const updateDto: UpdateWebhookDto = { url: 'https://newurl.com/webhook' };
      const webhook = { id: 'webhook-123', userId: mockUser.id };
      const updatedWebhook = { ...webhook, ...updateDto };

      mockWebhooksService.findOne.mockResolvedValue(webhook);
      mockWebhooksService.update.mockResolvedValue(updatedWebhook);

      const result = await controller.update('webhook-123', updateDto, mockUser);

      expect(mockWebhooksService.findOne).toHaveBeenCalledWith('webhook-123');
      expect(mockPolicyService.assertOwnership).toHaveBeenCalledWith(mockUser, webhook);
      expect(mockWebhooksService.update).toHaveBeenCalledWith('webhook-123', updateDto);
      expect(result).toEqual(updatedWebhook);
    });
  });

  describe('remove', () => {
    it('should delete a webhook and check ownership', async () => {
      const webhook = { id: 'webhook-123', userId: mockUser.id };
      mockWebhooksService.findOne.mockResolvedValue(webhook);
      mockWebhooksService.remove.mockResolvedValue(undefined);

      await controller.remove('webhook-123', mockUser);

      expect(mockWebhooksService.findOne).toHaveBeenCalledWith('webhook-123');
      expect(mockPolicyService.assertOwnership).toHaveBeenCalledWith(mockUser, webhook);
      expect(mockWebhooksService.remove).toHaveBeenCalledWith('webhook-123');
    });
  });

  describe('testWebhook', () => {
    it('should trigger a test webhook and check ownership', async () => {
      const testDto: TestWebhookDto = {
        eventType: WebhookEventType.SPLIT_CREATED,
        payload: { test: true },
      };
      const webhook = { id: 'webhook-123', userId: mockUser.id };

      mockWebhooksService.findOne.mockResolvedValue(webhook);
      mockTestDispatcher.dispatchTest.mockResolvedValue(undefined);

      const result = await controller.testWebhook('webhook-123', testDto, mockUser);

      expect(mockWebhooksService.findOne).toHaveBeenCalledWith('webhook-123');
      expect(mockPolicyService.assertOwnership).toHaveBeenCalledWith(mockUser, webhook);
      expect(mockTestDispatcher.dispatchTest).toHaveBeenCalledWith(webhook, testDto.eventType, testDto.payload);
      expect(result.message).toBe('Test webhook triggered');
    });
  });

  describe('getDeliveries', () => {
    it('should return delivery logs and check ownership', async () => {
      const deliveries = [{ id: 'delivery-1' }];
      const webhook = { id: 'webhook-123', userId: mockUser.id };

      mockWebhooksService.findOne.mockResolvedValue(webhook);
      mockDeliveryService.getRecentDeliveries.mockResolvedValue(deliveries);

      const result = await controller.getDeliveries('webhook-123', mockUser);

      expect(mockPolicyService.assertOwnership).toHaveBeenCalledWith(mockUser, webhook);
      expect(mockDeliveryService.getRecentDeliveries).toHaveBeenCalledWith('webhook-123', 50);
      expect(result).toEqual(deliveries);
    });
  });

  describe('getStats', () => {
    it('should return delivery statistics and check ownership', async () => {
      const stats = { total: 100, success: 95, failed: 5, pending: 0, successRate: 95.0 };
      const webhook = { id: 'webhook-123', userId: mockUser.id };

      mockWebhooksService.findOne.mockResolvedValue(webhook);
      mockDeliveryService.getDeliveryStats.mockResolvedValue(stats);

      const result = await controller.getStats('webhook-123', mockUser);

      expect(mockPolicyService.assertOwnership).toHaveBeenCalledWith(mockUser, webhook);
      expect(mockDeliveryService.getDeliveryStats).toHaveBeenCalledWith('webhook-123');
      expect(result).toEqual(stats);
    });
  });
});

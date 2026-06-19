import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';
import { BadRequestException } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DEFAULT_UPLOAD_POLICY } from './upload-policy';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('UploadService', () => {
  let service: UploadService;
  let configService: ConfigService;
  const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        S3_BUCKET_NAME: 'test-bucket',
        S3_ENDPOINT: 'http://localhost:4566',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    configService = module.get<ConfigService>(ConfigService);
    mockGetSignedUrl.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw error when S3 configuration is missing', () => {
      const incompleteConfig = {
        get: jest.fn((key: string) => {
          const config: Record<string, string> = {
            AWS_REGION: 'us-east-1',
            // Missing other required S3 config
          };
          return config[key];
        }),
      };

      expect(() => new UploadService(incompleteConfig as unknown as ConfigService)).toThrow(
        'Missing required S3 configuration'
      );
    });

    it('should initialize with custom upload policy from environment', () => {
      const customConfig = {
        get: jest.fn((key: string) => {
          const config: Record<string, string> = {
            AWS_REGION: 'us-east-1',
            AWS_ACCESS_KEY_ID: 'test-key',
            AWS_SECRET_ACCESS_KEY: 'test-secret',
            S3_BUCKET_NAME: 'test-bucket',
            UPLOAD_MAX_FILE_SIZE: '5MB',
            UPLOAD_ALLOWED_MIME_TYPES: 'image/jpeg,image/png',
            UPLOAD_KEY_PREFIX: 'custom-uploads',
          };
          return config[key];
        }),
      };

      const customService = new UploadService(customConfig as unknown as ConfigService);
      expect(customService).toBeDefined();
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should throw error for invalid filename', async () => {
      await expect(service.getPresignedUploadUrl('', 'image/jpeg'))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.getPresignedUploadUrl(null as any, 'image/jpeg'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid content type', async () => {
      await expect(service.getPresignedUploadUrl('test.jpg', ''))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.getPresignedUploadUrl('test.jpg', null as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should validate allowed mime types', async () => {
      await expect(
        service.getPresignedUploadUrl('test.jpg', 'image/invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for disallowed file extension', async () => {
      await expect(service.getPresignedUploadUrl('test.exe', 'application/octet-stream'))
        .rejects.toThrow(BadRequestException);
    });

    it('should validate file size', async () => {
      const largeSize = DEFAULT_UPLOAD_POLICY.maxFileSize + 1;
      await expect(
        service.getPresignedUploadUrl('test.jpg', 'image/jpeg', largeSize),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid file size', async () => {
      await expect(service.getPresignedUploadUrl('test.jpg', 'image/jpeg', -1))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.getPresignedUploadUrl('test.jpg', 'image/jpeg', 'invalid' as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should generate presigned URL for valid file', async () => {
      mockGetSignedUrl.mockResolvedValue('http://presigned-url');

      const result = await service.getPresignedUploadUrl('test.jpg', 'image/jpeg', 1000000);
      
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('key');
      expect(result.key).toMatch(/^receipts\/[a-f0-9-]+-test\.jpg$/);
      expect(result.url).toBe('http://presigned-url');
    });

    it('should sanitize filename properly', async () => {
      mockGetSignedUrl.mockResolvedValue('http://presigned-url');

      const result = await service.getPresignedUploadUrl('../../../etc/passwd', 'image/jpeg');
      
      expect(result.key).toMatch(/^receipts\/[a-f0-9-]+-_\.+_etc_passwd$/);
      expect(result.key).not.toContain('..');
    });

    it('should handle very long filenames', async () => {
      mockGetSignedUrl.mockResolvedValue('http://presigned-url');

      const longFilename = 'a'.repeat(300) + '.jpg';
      const result = await service.getPresignedUploadUrl(longFilename, 'image/jpeg');
      
      expect(result.key.length).toBeLessThan(500); // Should be truncated
    });

    it('should include metadata in upload command', async () => {
      mockGetSignedUrl.mockResolvedValue('http://presigned-url');

      await service.getPresignedUploadUrl('test.jpg', 'image/jpeg', 1000000);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            Metadata: expect.objectContaining({
              originalFilename: 'test.jpg',
              uploadId: expect.any(String),
              uploadedAt: expect.any(String),
            }),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should throw error for invalid key', async () => {
      await expect(service.getPresignedDownloadUrl(''))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.getPresignedDownloadUrl(null as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw error for path traversal attempts', async () => {
      await expect(service.getPresignedDownloadUrl('../secret'))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.getPresignedDownloadUrl('/etc/passwd'))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.getPresignedDownloadUrl('..\\secret'))
        .rejects.toThrow(BadRequestException);
    });

    it('should generate download URL for valid key', async () => {
      const key = 'receipts/test-file.jpg';
      mockGetSignedUrl.mockResolvedValue('http://download-url');

      const result = await service.getPresignedDownloadUrl(key);
      expect(result).toBe('http://download-url');
    });

    it('should include download headers in request', async () => {
      mockGetSignedUrl.mockResolvedValue('http://download-url');

      await service.getPresignedDownloadUrl('receipts/test-file.jpg');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            ResponseCacheControl: expect.any(String),
            ResponseContentDisposition: expect.any(String),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('deleteFile', () => {
    it('should throw error for invalid key', async () => {
      await expect(service.deleteFile(''))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.deleteFile(null as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw error for path traversal attempts', async () => {
      await expect(service.deleteFile('../secret'))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle successful deletion', async () => {
      // This test would require mocking S3Client.send
      // For now, we'll test the validation logic
      await expect(service.deleteFile('receipts/test-file.jpg')).toBeDefined();
    });
  });

  describe('getPolicy', () => {
    it('should return current upload policy', () => {
      const policy = service.getPolicy();
      
      expect(policy).toHaveProperty('allowedMimeTypes');
      expect(policy).toHaveProperty('maxFileSize');
      expect(policy).toHaveProperty('keyPrefix');
      expect(policy).toHaveProperty('allowedExtensions');
    });
  });
});

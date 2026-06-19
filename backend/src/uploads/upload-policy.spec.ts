import { BadRequestException } from '@nestjs/common';
import { UploadPolicyValidator, DEFAULT_UPLOAD_POLICY } from './upload-policy';

describe('UploadPolicyValidator', () => {
  let validator: UploadPolicyValidator;

  beforeEach(() => {
    validator = new UploadPolicyValidator();
  });

  describe('validateMimeType', () => {
    it('should allow valid MIME types', () => {
      expect(() => validator.validateMimeType('image/jpeg')).not.toThrow();
      expect(() => validator.validateMimeType('image/png')).not.toThrow();
      expect(() => validator.validateMimeType('application/pdf')).not.toThrow();
    });

    it('should throw error for invalid MIME types', () => {
      expect(() => validator.validateMimeType('text/plain')).toThrow(BadRequestException);
      expect(() => validator.validateMimeType('application/octet-stream')).toThrow(BadRequestException);
      expect(() => validator.validateMimeType('video/mp4')).toThrow(BadRequestException);
    });

    it('should include allowed types in error message', () => {
      try {
        validator.validateMimeType('text/plain');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain('image/jpeg');
        expect((error as BadRequestException).message).toContain('image/png');
        expect((error as BadRequestException).message).toContain('application/pdf');
      }
    });
  });

  describe('validateFileSize', () => {
    it('should allow files within size limit', () => {
      expect(() => validator.validateFileSize(1000)).not.toThrow();
      expect(() => validator.validateFileSize(DEFAULT_UPLOAD_POLICY.maxFileSize - 1)).not.toThrow();
    });

    it('should throw error for oversized files', () => {
      expect(() => validator.validateFileSize(DEFAULT_UPLOAD_POLICY.maxFileSize + 1)).toThrow(BadRequestException);
    });

    it('should include size limit in error message', () => {
      try {
        validator.validateFileSize(DEFAULT_UPLOAD_POLICY.maxFileSize + 1);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain(DEFAULT_UPLOAD_POLICY.maxFileSize.toString());
      }
    });
  });

  describe('validateFileExtension', () => {
    it('should allow valid extensions', () => {
      expect(() => validator.validateFileExtension('test.jpg')).not.toThrow();
      expect(() => validator.validateFileExtension('test.jpeg')).not.toThrow();
      expect(() => validator.validateFileExtension('test.png')).not.toThrow();
      expect(() => validator.validateFileExtension('test.pdf')).not.toThrow();
    });

    it('should throw error for invalid extensions', () => {
      expect(() => validator.validateFileExtension('test.exe')).toThrow(BadRequestException);
      expect(() => validator.validateFileExtension('test.bat')).toThrow(BadRequestException);
      expect(() => validator.validateFileExtension('test.txt')).toThrow(BadRequestException);
    });

    it('should handle uppercase extensions', () => {
      expect(() => validator.validateFileExtension('test.JPG')).not.toThrow();
      expect(() => validator.validateFileExtension('test.PDF')).not.toThrow();
    });

    it('should include allowed extensions in error message', () => {
      try {
        validator.validateFileExtension('test.exe');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain('.jpg');
        expect((error as BadRequestException).message).toContain('.png');
        expect((error as BadRequestException).message).toContain('.pdf');
      }
    });
  });

  describe('sanitizeFilename', () => {
    it('should preserve valid filenames', () => {
      expect(validator.sanitizeFilename('test.jpg')).toBe('test.jpg');
      expect(validator.sanitizeFilename('my-file_123.png')).toBe('my-file_123.png');
    });

    it('should replace invalid characters', () => {
      expect(validator.sanitizeFilename('test<script>.jpg')).toBe('test_script_.jpg');
      expect(validator.sanitizeFilename('test@file.jpg')).toBe('test_file.jpg');
      expect(validator.sanitizeFilename('test file.jpg')).toBe('test_file.jpg');
    });

    it('should prevent path traversal', () => {
      expect(validator.sanitizeFilename('../../../etc/passwd')).toBe('___etc_passwd');
      expect(validator.sanitizeFilename('..\\..\\windows\\system32')).toBe('____windows_system32');
      expect(validator.sanitizeFilename('/etc/passwd')).toBe('_etc_passwd');
    });

    it('should truncate long filenames', () => {
      const longFilename = 'a'.repeat(300) + '.jpg';
      const result = validator.sanitizeFilename(longFilename);
      expect(result.length).toBeLessThanOrEqual(DEFAULT_UPLOAD_POLICY.filenameSanitization.maxLength);
    });

    it('should handle empty or invalid filenames', () => {
      expect(validator.sanitizeFilename('')).toBe('file');
      expect(validator.sanitizeFilename('!!!')).toBe('file');
    });

    it('should preserve file extension', () => {
      expect(validator.sanitizeFilename('test.jpg')).toBe('test.jpg');
      expect(validator.sanitizeFilename('test@file.jpeg')).toBe('test_file.jpeg');
    });
  });

  describe('generateObjectKey', () => {
    it('should generate proper object key format', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const filename = 'test.jpg';
      const key = validator.generateObjectKey(filename, uuid);
      
      expect(key).toBe(`${DEFAULT_UPLOAD_POLICY.keyPrefix}/${uuid}-${filename}`);
    });

    it('should work with sanitized filenames', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const filename = 'test<script>.jpg';
      const sanitizedFilename = validator.sanitizeFilename(filename);
      const key = validator.generateObjectKey(sanitizedFilename, uuid);
      
      expect(key).toBe(`${DEFAULT_UPLOAD_POLICY.keyPrefix}/${uuid}-${sanitizedFilename}`);
    });
  });

  describe('getDownloadHeaders', () => {
    it('should return proper download headers', () => {
      const headers = validator.getDownloadHeaders();
      
      expect(headers).toHaveProperty('Cache-Control', DEFAULT_UPLOAD_POLICY.downloadHeaders.cacheControl);
      expect(headers).toHaveProperty('Content-Disposition', DEFAULT_UPLOAD_POLICY.downloadHeaders.contentDisposition);
    });
  });

  describe('getUploadExpiration', () => {
    it('should return upload expiration time', () => {
      const expiration = validator.getUploadExpiration();
      expect(expiration).toBe(DEFAULT_UPLOAD_POLICY.urlExpiration.upload);
    });
  });

  describe('getDownloadExpiration', () => {
    it('should return download expiration time', () => {
      const expiration = validator.getDownloadExpiration();
      expect(expiration).toBe(DEFAULT_UPLOAD_POLICY.urlExpiration.download);
    });
  });

  describe('with custom policy', () => {
    let customValidator: UploadPolicyValidator;
    const customPolicy = {
      ...DEFAULT_UPLOAD_POLICY,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      keyPrefix: 'custom-uploads'
    };

    beforeEach(() => {
      customValidator = new UploadPolicyValidator(customPolicy);
    });

    it('should use custom file size limit', () => {
      expect(() => customValidator.validateFileSize(4 * 1024 * 1024)).not.toThrow();
      expect(() => customValidator.validateFileSize(6 * 1024 * 1024)).toThrow(BadRequestException);
    });

    it('should use custom MIME types', () => {
      expect(() => customValidator.validateMimeType('image/jpeg')).not.toThrow();
      expect(() => customValidator.validateMimeType('application/pdf')).toThrow(BadRequestException);
    });

    it('should use custom key prefix', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const filename = 'test.jpg';
      const key = customValidator.generateObjectKey(filename, uuid);
      
      expect(key).toBe(`${customPolicy.keyPrefix}/${uuid}-${filename}`);
    });
  });
});

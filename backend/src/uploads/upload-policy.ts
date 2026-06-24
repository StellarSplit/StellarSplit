import { BadRequestException } from '@nestjs/common';

export interface UploadPolicy {
  allowedMimeTypes: string[];
  maxFileSize: number;
  keyPrefix: string;
  allowedExtensions: string[];
  filenameSanitization: {
    maxLength: number;
    allowedChars: RegExp;
    replacementChar: string;
  };
  downloadHeaders: {
    cacheControl: string;
    contentDisposition: string;
  };
  urlExpiration: {
    upload: number;
    download: number;
  };
}

export const DEFAULT_UPLOAD_POLICY: UploadPolicy = {
  allowedMimeTypes: [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf'
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  keyPrefix: 'receipts',
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
  filenameSanitization: {
    maxLength: 255,
    allowedChars: /^[a-zA-Z0-9._-]$/,
    replacementChar: '_'
  },
  downloadHeaders: {
    cacheControl: 'max-age=31536000', // 1 year
    contentDisposition: 'inline'
  },
  urlExpiration: {
    upload: 3600, // 1 hour
    download: 3600 // 1 hour
  }
};

export class UploadPolicyValidator {
  constructor(private policy: UploadPolicy = DEFAULT_UPLOAD_POLICY) {}

  validateMimeType(mimeType: string): void {
    if (!this.policy.allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `File type ${mimeType} is not allowed. Allowed types: ${this.policy.allowedMimeTypes.join(', ')}`
      );
    }
  }

  validateFileSize(fileSize: number): void {
    if (fileSize > this.policy.maxFileSize) {
      throw new BadRequestException(
        `File size ${fileSize} exceeds maximum allowed size of ${this.policy.maxFileSize} bytes`
      );
    }
  }

  validateFileExtension(filename: string): void {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (!this.policy.allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        `File extension ${ext} is not allowed. Allowed extensions: ${this.policy.allowedExtensions.join(', ')}`
      );
    }
  }

  sanitizeFilename(filename: string): string {
    const replacement = this.policy.filenameSanitization.replacementChar;

    // Neutralize path-traversal tokens ("../") so the dot-dot sequence cannot
    // survive into the object key, then map any remaining path separators and
    // disallowed characters to the replacement char.
    let cleaned = filename
      .replace(/\.\.\//g, replacement) // collapse "../" traversal tokens
      .replace(/[/\\]/g, replacement) // remaining path separators
      .replace(/\.\./g, replacement) // any leftover dot-dot sequences
      .replace(/[^a-zA-Z0-9._-]/g, replacement); // anything outside the allowed set

    // Truncate if too long
    cleaned =
      cleaned.length > this.policy.filenameSanitization.maxLength
        ? cleaned.substring(0, this.policy.filenameSanitization.maxLength)
        : cleaned;

    // Ensure something meaningful survived. The `allowedChars` regex matches a
    // single permitted character; we apply it per-character (it is intentionally
    // non-global so `.test` stays stateless) to confirm at least one character
    // is both allowed AND not merely the replacement char. A result made up
    // entirely of replacement characters (e.g. "!!!" -> "___") carries no usable
    // original content and falls back to a safe default.
    const hasMeaningfulChar = cleaned
      .split('')
      .some(
        (char) =>
          char !== replacement &&
          this.policy.filenameSanitization.allowedChars.test(char),
      );

    if (!cleaned || !hasMeaningfulChar) {
      return 'file';
    }

    return cleaned;
  }

  generateObjectKey(sanitizedFilename: string, uuid: string): string {
    return `${this.policy.keyPrefix}/${uuid}-${sanitizedFilename}`;
  }

  getDownloadHeaders(): Record<string, string> {
    return {
      'Cache-Control': this.policy.downloadHeaders.cacheControl,
      'Content-Disposition': this.policy.downloadHeaders.contentDisposition
    };
  }

  getUploadExpiration(): number {
    return this.policy.urlExpiration.upload;
  }

  getDownloadExpiration(): number {
    return this.policy.urlExpiration.download;
  }
}

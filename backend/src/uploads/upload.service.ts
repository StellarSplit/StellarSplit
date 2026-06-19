import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { UploadPolicyValidator, DEFAULT_UPLOAD_POLICY, UploadPolicy } from './upload-policy';

@Injectable()
export class UploadService implements OnModuleInit {
    private readonly logger = new Logger(UploadService.name);
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly policyValidator: UploadPolicyValidator;

    constructor(private readonly configService: ConfigService) {
        this.validateS3Configuration();

        const region = this.configService.get<string>('AWS_REGION')!;
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID')!;
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!;

        this.s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            endpoint: this.configService.get<string>('S3_ENDPOINT'),
            forcePathStyle: true,
        });
        this.bucketName = this.configService.get<string>('S3_BUCKET_NAME')!;
        
        // Initialize policy validator
        const uploadPolicy = this.getUploadPolicy();
        this.policyValidator = new UploadPolicyValidator(uploadPolicy);
    }

    onModuleInit() {
        this.logger.log('UploadService initialized with S3 configuration');
    }

    private validateS3Configuration(): void {
        const requiredVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'];
        const missing = requiredVars.filter(varName => !this.configService.get<string>(varName));
        
        if (missing.length > 0) {
            throw new Error(`Missing required S3 configuration: ${missing.join(', ')}`);
        }
    }

    private getUploadPolicy(): UploadPolicy {
        // Allow policy customization via environment variables if needed
        const customPolicy: Partial<UploadPolicy> = {};
        
        const maxFileSize = this.configService.get<string>('UPLOAD_MAX_FILE_SIZE');
        if (maxFileSize) {
            customPolicy.maxFileSize = this.parseFileSize(maxFileSize);
        }
        
        const allowedMimes = this.configService.get<string>('UPLOAD_ALLOWED_MIME_TYPES');
        if (allowedMimes) {
            customPolicy.allowedMimeTypes = allowedMimes.split(',').map(mime => mime.trim());
        }
        
        const keyPrefix = this.configService.get<string>('UPLOAD_KEY_PREFIX');
        if (keyPrefix) {
            customPolicy.keyPrefix = keyPrefix;
        }
        
        return { ...DEFAULT_UPLOAD_POLICY, ...customPolicy };
    }

    private parseFileSize(sizeStr: string): number {
        const units: Record<string, number> = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024
        };
        
        const match = sizeStr.match(/^([0-9]+)\s*(B|KB|MB|GB)$/i);
        if (!match) {
            throw new Error(`Invalid file size format: ${sizeStr}. Use format like '10MB', '1GB', etc.`);
        }
        
        const [, size, unit] = match;
        return parseInt(size) * units[unit.toUpperCase()];
    }

    async getPresignedUploadUrl(fileName: string, contentType: string, fileSize?: number): Promise<{ url: string; key: string }> {
        // Validate inputs
        if (!fileName || typeof fileName !== 'string') {
            throw new BadRequestException('Filename is required and must be a string');
        }
        
        if (!contentType || typeof contentType !== 'string') {
            throw new BadRequestException('Content type is required and must be a string');
        }

        // Validate file extension
        this.policyValidator.validateFileExtension(fileName);
        
        // Validate MIME type
        this.policyValidator.validateMimeType(contentType);

        // Validate file size if provided
        if (fileSize !== undefined) {
            if (typeof fileSize !== 'number' || fileSize < 0) {
                throw new BadRequestException('File size must be a positive number');
            }
            this.policyValidator.validateFileSize(fileSize);
        }

        // Sanitize filename and generate object key
        const sanitizedFileName = this.policyValidator.sanitizeFilename(fileName);
        const uuid = uuidv4();
        const key = this.policyValidator.generateObjectKey(sanitizedFileName, uuid);
        
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
            ContentLength: fileSize,
            Metadata: {
                originalFilename: fileName,
                uploadId: uuid,
                uploadedAt: new Date().toISOString()
            }
        });

        const url = await getSignedUrl(this.s3Client, command, { 
            expiresIn: this.policyValidator.getUploadExpiration() 
        });
        
        this.logger.log(`Generated presigned upload URL for key: ${key}`);
        return { url, key };
    }

    async getPresignedDownloadUrl(key: string): Promise<string> {
        if (!key || typeof key !== 'string') {
            throw new BadRequestException('Object key is required and must be a string');
        }
        
        // Validate key format to prevent path traversal
        if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
            throw new BadRequestException('Invalid object key format');
        }

        const headers = this.policyValidator.getDownloadHeaders();
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ResponseCacheControl: headers['Cache-Control'],
            ResponseContentDisposition: headers['Content-Disposition'],
        });

        const url = await getSignedUrl(this.s3Client, command, { 
            expiresIn: this.policyValidator.getDownloadExpiration() 
        });
        
        this.logger.log(`Generated presigned download URL for key: ${key}`);
        return url;
    }

    async deleteFile(key: string): Promise<void> {
        if (!key || typeof key !== 'string') {
            throw new BadRequestException('Object key is required and must be a string');
        }
        
        // Validate key format to prevent path traversal
        if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
            throw new BadRequestException('Invalid object key format');
        }

        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        try {
            await this.s3Client.send(command);
            this.logger.log(`Successfully deleted file: ${key}`);
        } catch (err) {
            this.logger.error(`Failed to delete file ${key} from S3:`, err);
            throw err;
        }
    }

    getPolicy(): UploadPolicy {
        return this.policyValidator['policy'];
    }
}

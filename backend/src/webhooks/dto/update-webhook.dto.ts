import {
  IsString,
  IsUrl,
  IsArray,
  IsBoolean,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WebhookEventType } from '../webhook.entity';

export class UpdateWebhookDto {
  @ApiProperty({
    description: 'Webhook endpoint URL',
    example: 'https://example.com/webhooks',
    required: false,
  })
  @IsUrl({ require_protocol: true })
  @IsOptional()
  url?: string;

  @ApiProperty({
    description: 'Array of event types to subscribe to',
    enum: WebhookEventType,
    isArray: true,
    required: false,
  })
  @IsArray()
  @IsOptional()
  events?: WebhookEventType[];

  @ApiProperty({
    description:
      'Optional replacement secret for HMAC signature verification. Must be at least 32 non-repeating characters. New webhooks receive a server-generated secret.',
    required: false,
  })
  @IsString()
  @MinLength(32)
  @Matches(/^(?!(.)\1+$).+$/, {
    message: 'secret must not be a repeated single character',
  })
  @IsOptional()
  secret?: string;

  @ApiProperty({
    description: 'Whether the webhook is active',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

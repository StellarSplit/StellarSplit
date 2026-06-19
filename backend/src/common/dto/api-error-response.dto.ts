import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiPropertyOptional({ example: 400 })
  statusCode?: number;

  @ApiPropertyOptional({ example: 'VALIDATION_ERROR' })
  code?: string;

  @ApiProperty({
    description: 'Human-readable error details or structured validation payload',
    oneOf: [
      { type: 'string', example: 'Resource not found' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['format must be one of the supported values'],
      },
      {
        type: 'object',
        additionalProperties: true,
        example: { message: 'Invitation expired', code: 'INVITE_EXPIRED' },
      },
    ],
  })
  message!: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-03-26T19:45:00.000Z' })
  timestamp?: string;

  @ApiPropertyOptional({ example: '/api/export/create' })
  path?: string;

  @ApiPropertyOptional({ description: 'Optional correlation ID for tracing' })
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Optional extra error context' })
  details?: unknown;
}

export class UpdatedCountResponseDto {
  @ApiProperty({ example: 3 })
  updated!: number;
}

export class CountResponseDto {
  @ApiProperty({ example: 5 })
  count!: number;
}

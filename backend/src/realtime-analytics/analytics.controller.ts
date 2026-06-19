// Analytics read endpoints for dashboard consumers
import { Controller, Get, Post, Query, Body, Param, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsIngestService } from './analytics-ingest.service';
import { AnalyticsEventType } from './analytics-events';
// #465: Replace raw SQL string interpolation with typed, validated query builders
import {
  buildMetricsQuery,
  buildFunnelQuery,
  buildRetentionQuery,
  buildTrendsQuery,
  type TrendInterval,
} from './query-builder';
// #480: Extract request and response contracts from the controller
import {
  QueryMetricsDto,
  QueryFunnelDto,
  QueryRetentionDto,
  QueryTrendsDto,
} from './dto/query-metrics.dto';
import {
  HealthStatusDto,
  MetricsResponseDto,
  FunnelResponseDto,
  RetentionResponseDto,
  TrendsResponseDto,
} from './dto/analytics-response.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsIngest: AnalyticsIngestService) {}

  /**
   * Health check for analytics service
   * Returns operational status and feature availability
   */
  @Get('health')
  @ApiOperation({ summary: 'Check analytics service health' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Analytics service status', type: HealthStatusDto })
  getHealth(): HealthStatusDto {
    return {
      operational: this.analyticsIngest.isOperational(),
      features: this.analyticsIngest.getFeatures(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Query metrics with filters
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Query analytics metrics' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Metrics data' })
  async queryMetrics(@Query() query: QueryMetricsDto): Promise<MetricsResponseDto> {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dateTo = query.dateTo ? new Date(query.dateTo) : new Date();

    return this.analyticsIngest.queryAnalytics<MetricsResponseDto>(
      buildMetricsQuery({ dateFrom, dateTo, eventType: query.eventType }),
    );
  }

  /**
   * Query funnel analysis
   */
  @Post('funnel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query funnel analysis' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Funnel conversion data' })
  async queryFunnel(@Body() query: QueryFunnelDto): Promise<FunnelResponseDto> {
    const eventTypes = query.eventTypes || [
      AnalyticsEventType.USER_REGISTERED,
      AnalyticsEventType.SPLIT_CREATED,
      AnalyticsEventType.PAYMENT_INITIATED,
      AnalyticsEventType.PAYMENT_COMPLETED,
    ];

    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = query.dateTo ? new Date(query.dateTo) : new Date();

    return this.analyticsIngest.queryAnalytics<FunnelResponseDto>(
      buildFunnelQuery({ eventTypes, dateFrom, dateTo }),
    );
  }

  /**
   * Query retention analysis
   */
  @Get('retention')
  @ApiOperation({ summary: 'Query retention analysis' })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'periods', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Retention cohort data' })
  async queryRetention(@Query() query: QueryRetentionDto): Promise<RetentionResponseDto> {
    const eventType = query.eventType || AnalyticsEventType.USER_REGISTERED;
    const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periods = query.periods || 7;

    return this.analyticsIngest.queryAnalytics<RetentionResponseDto>(
      buildRetentionQuery({ eventType, startDate, periods }),
    );
  }

  /**
   * Query trends over time
   */
  @Get('trends')
  @ApiOperation({ summary: 'Query event trends over time' })
  @ApiQuery({ name: 'eventTypes', required: false, type: [String] })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'interval', required: false, enum: ['hour', 'day', 'week', 'month'] })
  @ApiResponse({ status: HttpStatus.OK, description: 'Time series data' })
  async queryTrends(@Query() query: QueryTrendsDto): Promise<TrendsResponseDto> {
    const eventTypes = query.eventTypes || [AnalyticsEventType.SPLIT_CREATED];
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dateTo = query.dateTo ? new Date(query.dateTo) : new Date();
    const interval = query.interval || 'day';

    return this.analyticsIngest.queryAnalytics<TrendsResponseDto>(
      buildTrendsQuery({ eventTypes, dateFrom, dateTo, interval: interval as TrendInterval }),
    );
  }

  /**
   * Get daily summary for dashboard
   */
  @Get('dashboard/daily')
  @ApiOperation({ summary: 'Get daily summary for dashboard' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Daily summary' })
  async getDailySummary(@Query('date') date?: string): Promise<MetricsResponseDto> {
    const targetDate = date ? new Date(date) : new Date();
    return this.analyticsIngest.getDailyMetrics(targetDate) as Promise<MetricsResponseDto>;
  }

  // #465: Private query-builder methods replaced by the typed query-builder module.
  // No raw SQL string interpolation of request values occurs in this controller.
}

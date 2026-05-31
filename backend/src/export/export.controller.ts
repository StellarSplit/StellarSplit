import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Delete,
  Res,
} from "@nestjs/common";
import {
  ApiResponse,
  ApiBadRequestResponse,
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiOkResponse,
  ApiParam,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response as ExpressResponse } from "express-serve-static-core";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ExportService } from "./export.service";
import { respondWithDownload } from "./export-download.responder";
import {
  CreateExportDto,
  ScheduleExportDto,
  CreateExportTemplateDto,
} from "./dto/export-request.dto";
import {
  ExportJob,
  ExportFormat,
  ReportType,
} from "./entities/export-job.entity";
import { ExportTemplate } from "./entities/export-template.entity";
import {
  ExportEligibilityResponseDto,
  ExportFormatsResponseDto,
  ExportJobListResponseDto,
  ExportJobResponseDto,
  ExportStatsResponseDto,
  ExportTemplateResponseDto,
  ReportTypesResponseDto,
} from "./dto/export-response.dto";
import { ApiErrorResponseDto } from "../common/dto/api-error-response.dto";

// Typed authenticated request so every @Request() req is strongly typed
interface AuthRequest {
  user: { id: string };
}

@ApiTags("Export & Reporting")
@Controller("export")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post("create")
  @ApiOperation({
    summary: "Create a new export",
    description: "Create an export job for expense data in various formats",
  })
  @ApiResponse({
    status: 201,
    description: "Export job created successfully",
    type: ExportJobResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid request parameters", type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid authentication", type: ApiErrorResponseDto })
  async createExport(
    @Request() req: AuthRequest,
    @Body() createExportDto: CreateExportDto,
  ): Promise<ExportJob> {
    return this.exportService.createExport(req.user.id, createExportDto);
  }

  @Get("status/:id")
  @ApiOperation({
    summary: "Get export job status",
    description: "Get the status and details of an export job",
  })
  @ApiParam({ name: "id", description: "Export job ID" })
  @ApiOkResponse({ description: "Export job details", type: ExportJobResponseDto })
  @ApiNotFoundResponse({ description: "Export job not found", type: ApiErrorResponseDto })
  async getExportStatus(
    @Request() req: AuthRequest,
    @Param("id") id: string,
  ): Promise<ExportJob> {
    return this.exportService.getExportStatus(id, req.user.id);
  }

  @Get("download/:id")
  @ApiOperation({
    summary: "Download export file",
    description: "Download the generated export file",
  })
  @ApiParam({ name: "id", description: "Export job ID" })
  @ApiResponse({
    status: 200,
    description: "File download",
    content: {
      "application/octet-stream": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  @ApiNotFoundResponse({ description: "Export not found or expired", type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: "Export exists but the download has expired", type: ApiErrorResponseDto })
  async downloadExport(
    @Request() req: AuthRequest,
    @Param("id") id: string,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const ctx = await this.exportService.downloadExport(id, req.user.id);
    // Issue #510 — delegate all header/delivery mechanics to the responder
    respondWithDownload(res, ctx);
  }

  @Get("list")
  @ApiOperation({
    summary: "List export jobs",
    description: "Get paginated list of user's export jobs",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20, max: 100)",
  })
  @ApiOkResponse({ description: "List of export jobs", type: ExportJobListResponseDto })
  async listExports(
    @Request() req: AuthRequest,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.exportService.listExports(req.user.id, page, limit);
  }

  @Post(":id/retry")
  @ApiOperation({
    summary: "Retry a failed export",
    description: "Re-queue an export that failed, expired, or was cancelled",
  })
  async retryExport(
    @Request() req: AuthRequest,
    @Param("id") id: string,
  ): Promise<ExportJob> {
    return this.exportService.retryExport(id, req.user.id);
  }

  @Post(":id/cancel")
  @ApiOperation({
    summary: "Cancel an export",
    description: "Cancel an export that is still queued or processing",
  })
  async cancelExport(
    @Request() req: AuthRequest,
    @Param("id") id: string,
  ): Promise<ExportJob> {
    return this.exportService.cancelExport(id, req.user.id);
  }

  @Post("templates")
  @ApiOperation({
    summary: "Create export template",
    description: "Create a reusable export template",
  })
  @ApiResponse({
    status: 201,
    description: "Template created successfully",
    type: ExportTemplateResponseDto,
  })
  async createTemplate(
    @Request() req: AuthRequest,
    @Body() createTemplateDto: CreateExportTemplateDto,
  ): Promise<ExportTemplate> {
    return this.exportService.createTemplate(req.user.id, createTemplateDto);
  }

  @Get("templates")
  @ApiOperation({
    summary: "List export templates",
    description: "Get all export templates for the user",
  })
  @ApiOkResponse({ description: "List of export templates", type: [ExportTemplateResponseDto] })
  async listTemplates(@Request() req: AuthRequest): Promise<ExportTemplate[]> {
    return this.exportService.listTemplates(req.user.id);
  }

  @Delete("templates/:id")
  @ApiOperation({
    summary: "Delete export template",
    description: "Delete a specific export template",
  })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template deleted successfully" })
  @ApiNotFoundResponse({ description: "Template not found", type: ApiErrorResponseDto })
  async deleteTemplate(
    @Request() req: AuthRequest,
    @Param("id") id: string,
  ): Promise<void> {
    return this.exportService.deleteTemplate(id, req.user.id);
  }

  @Post("schedule")
  @ApiOperation({
    summary: "Schedule recurring export",
    description: "Schedule an export to run automatically on a schedule",
  })
  @ApiResponse({
    status: 201,
    description: "Export scheduled successfully",
    type: ExportTemplateResponseDto,
  })
  async scheduleExport(
    @Request() req: AuthRequest,
    @Body() scheduleExportDto: ScheduleExportDto,
  ): Promise<ExportTemplate> {
    return this.exportService.scheduleExport(req.user.id, scheduleExportDto);
  }

  @Get("formats")
  @ApiOperation({
    summary: "Get available export formats",
    description: "Get list of all supported export formats",
  })
  @ApiOkResponse({ description: "Available export formats", type: ExportFormatsResponseDto })
  getExportFormats() {
    return {
      formats: [
        {
          value: ExportFormat.CSV,
          label: "CSV",
          description: "Comma-separated values, compatible with Excel",
          mimeType: "text/csv",
        },
        {
          value: ExportFormat.PDF,
          label: "PDF",
          description: "Portable Document Format, printable report",
          mimeType: "application/pdf",
        },
        {
          value: ExportFormat.JSON,
          label: "JSON",
          description: "JavaScript Object Notation, for API integration",
          mimeType: "application/json",
        },
        {
          value: ExportFormat.QBO,
          label: "QuickBooks (QBO)",
          description: "QuickBooks Online format for accounting software",
          mimeType: "application/x-qb",
        },
        {
          value: ExportFormat.OFX,
          label: "OFX",
          description: "Open Financial Exchange, banking standard",
          mimeType: "application/x-ofx",
        },
        {
          value: ExportFormat.XLSX,
          label: "Excel (XLSX)",
          description: "Microsoft Excel format with formatting",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    };
  }

  @Get("report-types")
  @ApiOperation({
    summary: "Get available report types",
    description: "Get list of all supported report types",
  })
  @ApiOkResponse({ description: "Available report types", type: ReportTypesResponseDto })
  getReportTypes() {
    return {
      reportTypes: [
        {
          value: ReportType.MONTHLY_SUMMARY,
          label: "Monthly Summary",
          description: "Monthly breakdown of expenses and settlements",
        },
        {
          value: ReportType.ANNUAL_TAX_REPORT,
          label: "Annual Tax Report",
          description: "Tax-compliant report for business expenses",
        },
        {
          value: ReportType.CATEGORY_BREAKDOWN,
          label: "Category Breakdown",
          description: "Analysis of expenses by category",
        },
        {
          value: ReportType.PARTNER_WISE_SUMMARY,
          label: "Partner-wise Summary",
          description: "Summary of balances with each partner",
        },
        {
          value: ReportType.PAYMENT_HISTORY,
          label: "Payment History",
          description: "Chronological timeline of all transactions",
        },
        {
          value: ReportType.CUSTOM,
          label: "Custom Report",
          description: "Custom filtered transaction list",
        },
      ],
    };
  }

  @Get("eligibility")
  @ApiOperation({
    summary: "Check export eligibility",
    description: "Check if user can create an export and view limits",
  })
  @ApiOkResponse({ description: "Eligibility status and limits", type: ExportEligibilityResponseDto })
  async checkEligibility(@Request() req: AuthRequest) {
    return this.exportService.checkEligibility(req.user.id);
  }

  @Get("stats")
  @ApiOperation({
    summary: "Get export statistics",
    description: "Get statistics about user's export usage",
  })
  @ApiOkResponse({ description: "Export statistics", type: ExportStatsResponseDto })
  async getExportStats(@Request() req: AuthRequest) {
    const exports = await this.exportService.listExports(req.user.id, 1, 1000);

    // Use Record<string, number> so enum keys are valid index signatures
    const formatDistribution = exports.jobs.reduce<Record<string, number>>(
      (acc, job) => {
        acc[job.format] = (acc[job.format] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const reportTypeDistribution = exports.jobs.reduce<Record<string, number>>(
      (acc, job) => {
        acc[job.reportType] = (acc[job.reportType] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      totalExports: exports.total,
      completedExports: exports.jobs.filter((job) => job.status === "COMPLETED")
        .length,
      failedExports: exports.jobs.filter((job) => job.status === "FAILED")
        .length,
      pendingExports: exports.jobs.filter(
        (job) => job.status === "PENDING" || job.status === "PROCESSING",
      ).length,
      formatDistribution,
      reportTypeDistribution,
    };
  }
}

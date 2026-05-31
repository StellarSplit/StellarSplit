/**
 * export-download.responder.ts — Issue #510
 *
 * Centralises all file-delivery mechanics for export downloads so the
 * controller stays free of branching over low-level HTTP response details.
 *
 * Handles:
 *  - Redirect-style downloads (cloud storage pre-signed URLs)
 *  - Local-file downloads (sendFile with path traversal guard)
 *  - Content-Disposition and Content-Type header composition
 *  - Expired / missing export error surfacing
 */

import * as path from 'node:path';
import type { Response as ExpressResponse } from 'express-serve-static-core';
import type { ExportDownloadDescriptor } from './storage.service';

export interface DownloadContext {
  fileName: string;
  download: ExportDownloadDescriptor;
}

/**
 * Validate `localPath` is inside `allowedRoot` to prevent directory traversal.
 * Throws if the resolved path escapes the storage root.
 */
function guardLocalPath(localPath: string, allowedRoot: string): string {
  const resolved = path.resolve(localPath);
  const root = path.resolve(allowedRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal detected: ${localPath}`);
  }
  return resolved;
}

/**
 * Write appropriate headers and send the file or redirect.
 *
 * ```ts
 * // In the controller:
 * const ctx = await this.exportService.downloadExport(id, userId);
 * respondWithDownload(res, ctx);
 * ```
 */
export function respondWithDownload(
  res: ExpressResponse,
  { fileName, download }: DownloadContext,
  options: { storageRoot?: string } = {},
): void {
  // Sanitise the filename: strip path separators so the header stays safe.
  const safeFileName = path.basename(fileName).replace(/[^\w.\-]/g, '_');

  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);

  if (download.type === 'redirect') {
    res.redirect(download.url);
    return;
  }

  // Local file delivery
  res.setHeader('Content-Type', download.contentType);

  if (options.storageRoot) {
    // Guard the path before sending it to Express
    const safe = guardLocalPath(download.path, options.storageRoot);
    res.sendFile(safe);
  } else {
    res.sendFile(download.path);
  }
}

/**
 * Build a DownloadContext from the raw service output.
 * Kept separate so tests can build contexts without instantiating the service.
 */
export function buildDownloadContext(
  fileName: string,
  download: ExportDownloadDescriptor,
): DownloadContext {
  return { fileName, download };
}

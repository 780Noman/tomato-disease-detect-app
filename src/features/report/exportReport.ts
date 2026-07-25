import { buildReportHtml } from './reportHtml';
import type { SavedScan } from '@/features/history/types';

export class ReportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ReportError';
  }
}

/** Reads the scan photo as a data URI so the PDF is self-contained. */
async function imageDataUri(imagePath: string): Promise<string | null> {
  try {
    const { File } = await import('expo-file-system');
    const file = new File(imagePath);
    if (!file.exists) return null;
    const base64 = await file.base64();
    const extension = imagePath.split('.').pop()?.toLowerCase();
    const mime = extension === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    // A missing photo must not block the report; the HTML says so instead.
    return null;
  }
}

/**
 * Renders the scan to PDF and opens the share sheet. Works offline — no
 * network is involved at any step.
 */
export async function exportScanReport(scan: SavedScan): Promise<string> {
  const html = buildReportHtml(scan, await imageDataUri(scan.imagePath));

  let uri: string;
  try {
    const { printToFileAsync } = await import('expo-print');
    const result = await printToFileAsync({ html });
    uri = result.uri;
  } catch (error) {
    throw new ReportError('The PDF could not be created on this device.', { cause: error });
  }

  try {
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share scan report',
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (error) {
    throw new ReportError('The PDF was created but the share sheet could not be opened.', {
      cause: error,
    });
  }
  return uri;
}

import { useCallback, useState } from 'react';

import { exportScanReport, ReportError } from './exportReport';
import type { SavedScan } from '@/features/history/types';

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

export function useExportReport(): {
  status: ExportStatus;
  error: string | null;
  exportReport: (scan: SavedScan) => Promise<void>;
} {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const exportReport = useCallback(async (scan: SavedScan) => {
    setStatus('exporting');
    setError(null);
    try {
      await exportScanReport(scan);
      setStatus('done');
    } catch (caught) {
      setStatus('error');
      setError(
        caught instanceof ReportError
          ? caught.message
          : 'The report could not be exported. No file was created.',
      );
    }
  }, []);

  return { status, error, exportReport };
}

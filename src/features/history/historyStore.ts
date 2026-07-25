import { create } from 'zustand';

import { getScanRepository } from './repository';
import { deleteScanImage } from './scanImage';
import type { NewScan, SavedScan } from './types';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface HistoryState {
  readonly status: Status;
  readonly scans: readonly SavedScan[];
  readonly error: string | null;
  load: () => Promise<void>;
  save: (scan: NewScan) => Promise<SavedScan | null>;
  remove: (id: number) => Promise<void>;
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'The scan history database could not be read on this device.';
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  status: 'idle',
  scans: [],
  error: null,

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const repository = await getScanRepository();
      set({ status: 'ready', scans: await repository.list(), error: null });
    } catch (error) {
      set({ status: 'error', error: toMessage(error) });
    }
  },

  save: async (scan) => {
    try {
      const repository = await getScanRepository();
      const saved = await repository.save(scan);
      set({ scans: [saved, ...get().scans], status: 'ready', error: null });
      return saved;
    } catch (error) {
      set({ status: 'error', error: toMessage(error) });
      return null;
    }
  },

  remove: async (id) => {
    const existing = get().scans.find((s) => s.id === id);
    try {
      const repository = await getScanRepository();
      await repository.delete(id);
      if (existing !== undefined) {
        // Best-effort image cleanup; the row is already gone either way.
        await deleteScanImage(existing.imagePath).catch(() => undefined);
      }
      set({ scans: get().scans.filter((s) => s.id !== id), error: null });
    } catch (error) {
      set({ status: 'error', error: toMessage(error) });
    }
  },
}));

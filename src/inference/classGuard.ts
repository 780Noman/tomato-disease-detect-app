import { InferenceError } from './errors';
import { CLASS_ORDER_VERIFIED } from '@/config/classes';

/**
 * The hard runtime guard from CLAUDE.md §4: real providers call this before
 * touching the network or the model. While the class index order is
 * unverified, a real diagnosis would be a coin toss with confident styling —
 * so the app refuses, loudly, with a developer-facing error.
 */
export function assertClassOrderVerified(): void {
  if (!CLASS_ORDER_VERIFIED) {
    throw new InferenceError('class-order-unverified');
  }
}

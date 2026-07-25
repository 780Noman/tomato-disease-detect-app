import { CLASS_INFO, CLASS_ORDER_VERIFIED } from '@/config/classes';
import { persistScanImage } from '@/features/history/scanImage';
import type { NewScan } from '@/features/history/types';
import type { Classification } from '@/inference';

/**
 * Builds the persistable scan from a live classification, copying the photo
 * into app storage first so history survives camera-cache cleanup.
 *
 * `classOrderVerified` is recorded per scan: a scan taken while the order is
 * unverified stays marked that way forever, and can never be silently
 * reinterpreted as trustworthy later.
 */
export async function buildScanToSave(
  imageUri: string,
  result: Classification,
  createdAt: number,
): Promise<NewScan> {
  const imagePath = await persistScanImage(imageUri, createdAt);
  return {
    createdAt,
    imagePath,
    topClass: result.top.classCode,
    category: CLASS_INFO[result.top.classCode].category,
    confidence: result.top.probability,
    lowConfidence: result.lowConfidence,
    scores: result.scores,
    provider: result.provider,
    modelVersion: result.modelVersion,
    classOrderVerified: CLASS_ORDER_VERIFIED,
  };
}

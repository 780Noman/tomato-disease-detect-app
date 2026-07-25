/**
 * Copies a captured photo into app storage so a saved scan keeps its image
 * after the camera cache is cleared. Dynamic import keeps expo-file-system
 * out of the test/mock path.
 */
const SCANS_DIRECTORY = 'scans';

export async function persistScanImage(sourceUri: string, createdAt: number): Promise<string> {
  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, SCANS_DIRECTORY);
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
  const extension = sourceUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const safeExtension = /^[a-z0-9]{1,5}$/.test(extension) ? extension : 'jpg';
  const target = new File(directory, `scan-${createdAt}.${safeExtension}`);
  new File(sourceUri).copy(target);
  return target.uri;
}

export async function deleteScanImage(imagePath: string): Promise<void> {
  const { File } = await import('expo-file-system');
  const file = new File(imagePath);
  if (file.exists) {
    file.delete();
  }
}

import type { AssetUriResolver } from './resolveModelUri';

/**
 * The production asset resolver, backed by expo-asset.
 *
 * `Asset.downloadAsync()` copies the asset into the app's cache directory and
 * sets `localUri` to a real `file://` path. On Android release builds it does
 * this by looking the flattened resource name up in `res/raw` and streaming it
 * out of the APK (expo-asset's AssetModule.kt handles the scheme-less name
 * case explicitly), which is precisely what fast-tflite cannot do itself.
 * The copy is cached, so it happens once per install, not once per scan.
 *
 * The import is dynamic so neither expo-asset nor its native module is pulled
 * into the mock/test path. Jest cannot execute this function; the pure logic
 * around it is tested in resolveModelUri.test.ts.
 */
export const resolveExpoAssetUri: AssetUriResolver = async (moduleId) => {
  const { Asset } = await import('expo-asset');
  const asset = await Asset.fromModule(moduleId).downloadAsync();
  return asset.localUri;
};

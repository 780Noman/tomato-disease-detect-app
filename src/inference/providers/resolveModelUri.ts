/**
 * Turns the configured model source into an absolute URI the native loader can
 * actually open.
 *
 * WHY THIS EXISTS — the bug it fixes (device-verified 2026-08-09):
 *
 * react-native-fast-tflite accepts a `require('model.tflite')` asset id and
 * resolves it with `Image.resolveAssetSource(id).uri`, then hands that string
 * straight to Java's `URL(..)` (HybridAssetLoader.kt).
 *
 *   - Metro dev server: uri is `http://<host>:8081/assets/...` → URL() works.
 *   - Release APK:      RN flattens bundled assets into `res/raw/` and the uri
 *                       becomes a bare resource name — `assets_model_tomato_model_mobile`.
 *                       No scheme, no extension. `URL()` throws
 *                       `MalformedURLException: no protocol`.
 *
 * This is long-standing React Native behaviour (facebook/react-native#18216,
 * #24963), not a bug we can fix upstream — fast-tflite 3.0.1 is the latest
 * release. So the app never passes the asset id to the library. It resolves the
 * asset to a real `file://` path first (see expoAssetUri.ts) and passes
 * `{ url }`, which takes the same code path in dev and in release. The dev/
 * release divergence is exactly what hid this failure until an APK was built.
 */

import { InferenceError } from '../errors';

/**
 * Materialises a bundled Metro asset on the device filesystem and returns its
 * `file://` URI, or null if it could not be materialised.
 *
 * Injected rather than imported so the logic below is unit-testable: the real
 * implementation needs native modules that do not exist under Jest.
 */
export type AssetUriResolver = (moduleId: number) => Promise<string | null>;

/** RFC 3986 scheme: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":" */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

function schemeError(uri: string, origin: string): InferenceError {
  return new InferenceError(
    'model-not-loaded',
    `${origin} produced "${uri}", which has no URI scheme. The native loader requires an absolute file:// or http(s):// URI. On Android release builds a bare name like "assets_model_tomato_model_mobile" means a bundled asset id reached the loader unresolved.`,
  );
}

/**
 * @param source `MODEL_SOURCE` — a Metro asset id, an absolute URI, or unset.
 * @param resolveAssetUri Resolver used only for the asset-id case.
 * @throws InferenceError('model-not-loaded') with a message naming the actual
 *   cause. Never returns a string the native loader would reject.
 */
export async function resolveModelUri(
  source: number | string | undefined,
  resolveAssetUri: AssetUriResolver,
): Promise<string> {
  if (source === undefined) {
    throw new InferenceError(
      'model-not-loaded',
      'MODEL_SOURCE is not set (src/inference/modelConfig.ts), so there is no model to load.',
    );
  }

  if (typeof source === 'string') {
    if (!HAS_SCHEME.test(source)) {
      throw schemeError(source, 'MODEL_SOURCE');
    }
    return source;
  }

  const resolved = await resolveAssetUri(source);
  if (resolved === null || resolved.length === 0) {
    throw new InferenceError(
      'model-not-loaded',
      `The bundled model asset (id ${source}) could not be copied out of the app package, so it cannot be read. The build may be missing assets/model/Tomato_Model_Mobile.tflite.`,
    );
  }
  if (!HAS_SCHEME.test(resolved)) {
    throw schemeError(resolved, 'The asset resolver');
  }
  return resolved;
}

/**
 * Sets `android:largeHeap="true"` on the application element.
 *
 * Why this is needed, not cosmetic: react-native-fast-tflite loads a model by
 * reading the whole file into a single Java byte array
 * (HybridAssetLoader.kt -> URL(..).readBytes()) before copying it into an
 * off-heap ArrayBuffer. Our model is 141 MB, so that is one 141 MB allocation
 * on the Dalvik heap. Many mid-range Android devices cap an app's heap
 * (dalvik.vm.heapgrowthlimit) at 128-256 MB, where that allocation throws
 * OutOfMemoryError. largeHeap raises the cap to dalvik.vm.heapsize.
 *
 * This mitigates the symptom. The real fix is a quantised (int8) model, which
 * is research-side work — see CLAUDE.md section 4.
 *
 * expo-build-properties has no largeHeap option, hence this local plugin.
 */
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidLargeHeap(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidConfig.modResults);
    application.$['android:largeHeap'] = 'true';
    return androidConfig;
  });
};

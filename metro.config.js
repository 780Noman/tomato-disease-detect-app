// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.tflite` must be treated as an asset so the model can be `require()`d and
// bundled into the build — required by react-native-fast-tflite. Without this
// Metro fails to resolve the model file.
config.resolver.assetExts.push('tflite');

module.exports = config;

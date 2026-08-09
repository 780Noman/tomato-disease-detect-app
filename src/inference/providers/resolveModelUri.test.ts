import { resolveModelUri, type AssetUriResolver } from './resolveModelUri';

const neverCalled: AssetUriResolver = () => {
  throw new Error('resolver should not have been called');
};

describe('resolveModelUri', () => {
  it('reports the unset source instead of loading nothing', async () => {
    await expect(resolveModelUri(undefined, neverCalled)).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
  });

  it('passes an absolute file URI straight through', async () => {
    await expect(resolveModelUri('file:///data/model.tflite', neverCalled)).resolves.toBe(
      'file:///data/model.tflite',
    );
  });

  it('passes an http URI straight through', async () => {
    await expect(resolveModelUri('https://example.com/model.tflite', neverCalled)).resolves.toBe(
      'https://example.com/model.tflite',
    );
  });

  it('rejects a configured source that is not an absolute URI', async () => {
    await expect(resolveModelUri('models/model.tflite', neverCalled)).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
  });

  it('resolves an asset id through the injected resolver', async () => {
    const resolver = jest
      .fn<Promise<string | null>, [number]>()
      .mockResolvedValue('file:///cache/ExponentAsset-abc.tflite');
    await expect(resolveModelUri(7, resolver)).resolves.toBe(
      'file:///cache/ExponentAsset-abc.tflite',
    );
    expect(resolver).toHaveBeenCalledWith(7);
  });

  it('fails loudly when the asset cannot be materialised on disk', async () => {
    await expect(resolveModelUri(7, () => Promise.resolve(null))).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
  });

  it('fails loudly on an empty resolved URI', async () => {
    await expect(resolveModelUri(7, () => Promise.resolve(''))).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
  });

  it('rejects the Android release-build resource name that caused the original bug', async () => {
    // This is the exact string Image.resolveAssetSource returns from a release
    // APK. Passing it to the native loader throws MalformedURLException, so it
    // must be caught here, with a message that names the cause.
    const resolver = () => Promise.resolve('assets_model_tomato_model_mobile');
    await expect(resolveModelUri(7, resolver)).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
    await expect(resolveModelUri(7, resolver)).rejects.toThrow(/no URI scheme/);
  });
});

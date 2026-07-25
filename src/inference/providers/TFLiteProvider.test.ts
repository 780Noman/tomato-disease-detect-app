import { TFLiteProvider, type TfliteModel } from './TFLiteProvider';

// The real guard's blocking is covered in RemoteProvider.guard.test.ts;
// here it is bypassed to exercise the wiring behind it.
jest.mock('../classGuard', () => ({ assertClassOrderVerified: jest.fn() }));

// Image preprocessing needs native modules; the tensor is stubbed. The pure
// packing logic has its own tests in preprocess/pixels.test.ts.
jest.mock('../preprocess/prepareModelInput', () => ({
  prepareModelInput: jest.fn().mockResolvedValue(new Float32Array(224 * 224 * 3)),
}));

const mockRun = jest.fn<Promise<ArrayBuffer[]>, [ArrayBuffer[]]>();
const stubModel: TfliteModel = { run: mockRun };

async function loadedProvider(): Promise<TFLiteProvider> {
  const provider = new TFLiteProvider(() => Promise.resolve(stubModel));
  await provider.load();
  return provider;
}

describe('TFLiteProvider (guard bypassed)', () => {
  beforeEach(() => {
    mockRun.mockReset();
  });

  it('fails loudly with model-not-loaded while MODEL_SOURCE is unset (default loader)', async () => {
    const provider = new TFLiteProvider();
    await expect(provider.load()).rejects.toMatchObject({ code: 'model-not-loaded' });
    expect(provider.isReady()).toBe(false);
  });

  it('refuses to run before load', async () => {
    const provider = new TFLiteProvider(() => Promise.resolve(stubModel));
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
  });

  it('runs the inspected contract end to end: [1,6] softmax out, ranked result', async () => {
    mockRun.mockResolvedValue([new Float32Array([0.02, 0.05, 0.8, 0.06, 0.04, 0.03]).buffer]);
    const provider = await loadedProvider();

    const result = await provider.run({ imageUri: 'file:///leaf.jpg' });
    expect(result.top.classCode).toBe('tomato__LM');
    expect(result.scores).toHaveLength(6);
    expect(result.provider).toBe('tflite');

    // The input tensor honours the inspected contract: 224*224*3 float32.
    // (toString check instead of instanceof — jest realms give ArrayBuffer
    // a different identity across module registries.)
    const [inputs] = mockRun.mock.calls[0] as [ArrayBuffer[]];
    expect(Object.prototype.toString.call(inputs[0])).toBe('[object ArrayBuffer]');
    expect(inputs[0]?.byteLength).toBe(224 * 224 * 3 * 4);
  });

  it('rejects an output tensor of the wrong length instead of misdiagnosing', async () => {
    mockRun.mockResolvedValue([new Float32Array([0.5, 0.5]).buffer]);
    const provider = await loadedProvider();
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('maps a native inference crash to model-not-loaded, never a result', async () => {
    mockRun.mockRejectedValue(new Error('native crash'));
    const provider = await loadedProvider();
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
  });

  it('dispose() releases the model', async () => {
    const provider = await loadedProvider();
    expect(provider.isReady()).toBe(true);
    await provider.dispose();
    expect(provider.isReady()).toBe(false);
  });
});

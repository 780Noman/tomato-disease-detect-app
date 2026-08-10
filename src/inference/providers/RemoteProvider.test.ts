import { AxiosError, type AxiosInstance } from 'axios';

import { RemoteProvider } from './RemoteProvider';

// Behaviour beyond the guard is tested with the guard bypassed; the real
// guard's blocking behaviour is covered in RemoteProvider.guard.test.ts.
jest.mock('../classGuard', () => ({ assertClassOrderVerified: jest.fn() }));

const mockPost = jest.fn();
// load() also fires a best-effort GET /health to wake a sleeping Space.
const mockGet = jest.fn();
jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      create: () => ({ post: mockPost, get: mockGet }) as unknown as AxiosInstance,
    },
  };
});

const GOOD_RESPONSE = {
  data: {
    probabilities: {
      tomato__JAS_MIT: 0.02,
      tomato__K: 0.05,
      tomato__LM: 0.8,
      tomato__MIT: 0.06,
      tomato__N: 0.04,
      tomato__N_K: 0.03,
    },
    model_version: 'fold3-b0',
  },
};

function makeAxiosError(overrides: Partial<AxiosError>): AxiosError {
  const error = new AxiosError('boom');
  Object.assign(error, overrides);
  return error;
}

describe('RemoteProvider (guard bypassed)', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: { status: 'ok' } });
  });

  it('pings /health on load to wake a sleeping server, without awaiting it', async () => {
    const provider = new RemoteProvider('http://server');
    await provider.load();
    expect(mockGet).toHaveBeenCalledWith('/health', expect.objectContaining({ timeout: 5_000 }));
  });

  it('loads successfully even when the wake ping fails outright', async () => {
    // The wake call is an optimisation. If it could fail load(), it would take
    // diagnosis down with it — worse than not having it.
    mockGet.mockImplementation(() => {
      throw new Error('no network');
    });
    const provider = new RemoteProvider('http://server');
    await expect(provider.load()).resolves.toBeUndefined();
    expect(provider.isReady()).toBe(true);
  });

  it('maps the response by class NAME and returns a full ranked vector', async () => {
    mockPost.mockResolvedValue(GOOD_RESPONSE);
    const provider = new RemoteProvider('http://server');
    await provider.load();

    const result = await provider.run({ imageUri: 'file:///leaf.jpg' });
    expect(result.top.classCode).toBe('tomato__LM');
    expect(result.top.probability).toBe(0.8);
    expect(result.scores).toHaveLength(6);
    expect(result.modelVersion).toBe('fold3-b0');
    expect(result.provider).toBe('remote');
  });

  it('rejects a response containing an unknown class name', async () => {
    mockPost.mockResolvedValue({
      data: { probabilities: { ...GOOD_RESPONSE.data.probabilities, healthy: 0.0 } },
    });
    const provider = new RemoteProvider('http://server');
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('rejects a response missing a class', async () => {
    const { tomato__N_K: _dropped, ...partial } = GOOD_RESPONSE.data.probabilities;
    mockPost.mockResolvedValue({ data: { probabilities: partial } });
    const provider = new RemoteProvider('http://server');
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('maps a timeout to the timeout error', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ECONNABORTED' }));
    const provider = new RemoteProvider('http://server');
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('maps no-response to server-unreachable', async () => {
    mockPost.mockRejectedValue(makeAxiosError({}));
    const provider = new RemoteProvider('http://server');
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'server-unreachable',
    });
  });

  it('maps 503 to model-not-loaded (the server degraded mode)', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({ response: { status: 503 } as AxiosError['response'] }),
    );
    const provider = new RemoteProvider('http://server');
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'model-not-loaded',
    });
  });

  it('maps other HTTP failures to server-error', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({ response: { status: 500 } as AxiosError['response'] }),
    );
    const provider = new RemoteProvider('http://server');
    await expect(provider.run({ imageUri: 'file:///leaf.jpg' })).rejects.toMatchObject({
      code: 'server-error',
    });
  });
});

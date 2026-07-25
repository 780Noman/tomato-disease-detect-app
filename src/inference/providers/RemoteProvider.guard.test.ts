import { RemoteProvider } from './RemoteProvider';
import { TFLiteProvider } from './TFLiteProvider';
import { assertClassOrderVerified } from '../classGuard';
import { CLASS_ORDER_VERIFIED } from '@/config/classes';

/**
 * THE §4 GUARD, both directions.
 *
 * The class order is now verified (confirmed against the dataset folder names
 * sorted alphabetically), so the guard must let real providers through. The
 * mechanism still has to work if the flag is ever set back to false — that is
 * covered below with the config mocked, so the safety net stays tested rather
 * than becoming dead code the day the flag flipped.
 */
describe('class-order guard — verified state', () => {
  it('the flag really is verified', () => {
    expect(CLASS_ORDER_VERIFIED).toBe(true);
  });

  it('no longer throws, so real providers are unblocked', () => {
    expect(() => assertClassOrderVerified()).not.toThrow();
  });

  it('lets RemoteProvider.load() through', async () => {
    const provider = new RemoteProvider('http://127.0.0.1:8000');
    await expect(provider.load()).resolves.toBeUndefined();
    expect(provider.isReady()).toBe(true);
  });

  it('lets TFLiteProvider past the guard (it then fails on the absent model, not the guard)', async () => {
    const provider = new TFLiteProvider();
    await expect(provider.load()).rejects.toMatchObject({ code: 'model-not-loaded' });
  });
});

describe('class-order guard — mechanism still blocks when unverified', () => {
  // require() rather than import(): Jest cannot execute dynamic import()
  // without --experimental-vm-modules, and the module registry has to be
  // reloaded to re-evaluate the flag.
  function guardWithFlag(verified: boolean): () => void {
    let assert: () => void = () => undefined;
    jest.isolateModules(() => {
      jest.doMock('@/config/classes', () => {
        const actual = jest.requireActual<typeof import('@/config/classes')>('@/config/classes');
        return { ...actual, CLASS_ORDER_VERIFIED: verified };
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- see comment above
      assert = (require('../classGuard') as typeof import('../classGuard'))
        .assertClassOrderVerified;
    });
    return assert;
  }

  afterEach(() => {
    jest.dontMock('@/config/classes');
  });

  it('throws class-order-unverified when the flag is false', () => {
    expect(() => guardWithFlag(false)()).toThrow(
      expect.objectContaining({ code: 'class-order-unverified' }),
    );
  });

  it('passes when the flag is true', () => {
    expect(() => guardWithFlag(true)()).not.toThrow();
  });
});

import { RemoteProvider } from './RemoteProvider';
import { TFLiteProvider } from './TFLiteProvider';

/**
 * THE §4 CONTRACT: while CLASS_ORDER_VERIFIED is false, both real providers
 * refuse to run — no network call, no model load, no diagnosis. This file
 * uses the REAL guard (no mocks). If someone flips the flag without model
 * metadata, the classes.test.ts flag assertion fails instead.
 */
describe('class-order guard (real, unmocked)', () => {
  it('blocks RemoteProvider.load and .run while unverified', async () => {
    const provider = new RemoteProvider('http://127.0.0.1:8000');
    await expect(provider.load()).rejects.toMatchObject({ code: 'class-order-unverified' });
    await expect(provider.run({ imageUri: 'file:///x.jpg' })).rejects.toMatchObject({
      code: 'class-order-unverified',
    });
  });

  it('blocks TFLiteProvider.load and .run while unverified', async () => {
    const provider = new TFLiteProvider();
    await expect(provider.load()).rejects.toMatchObject({ code: 'class-order-unverified' });
    await expect(provider.run({ imageUri: 'file:///x.jpg' })).rejects.toMatchObject({
      code: 'class-order-unverified',
    });
  });
});

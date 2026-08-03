module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 20000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Jest has no asset pipeline and must not read the 141 MB model.
    '\\.tflite$': '<rootDir>/src/test/tfliteAssetStub.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'App.tsx',
    '!src/dev/**',
    '!src/test/**',
    '!src/**/*.d.ts',
  ],
};

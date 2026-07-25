module.exports = {
  preset: 'jest-expo',
  testTimeout: 20000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'App.tsx',
    '!src/dev/**',
    '!src/test/**',
    '!src/**/*.d.ts',
  ],
};

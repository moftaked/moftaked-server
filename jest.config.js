module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageProvider: 'v8',
  verbose: true
};
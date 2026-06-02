const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/tests/services-integration/**/*.integration.test.ts'],
  testTimeout: 30000,
  collectCoverage: false,
  maxWorkers: 1,
  forceExit: true,
};

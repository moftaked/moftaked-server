const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/tests/services-integration/**/*.integration.test.ts'],
  testTimeout: 30000,
  // Don't collect coverage for integration tests — unit tests handle that
  collectCoverage: false,
};
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/electron-app/src/renderer/$1',
    '^@components/(.*)$': '<rootDir>/electron-app/src/renderer/components/$1',
    '^@modules/(.*)$': '<rootDir>/electron-app/src/renderer/modules/$1',
    '^@services/(.*)$': '<rootDir>/electron-app/src/renderer/services/$1',
    '^@utils/(.*)$': '<rootDir>/electron-app/src/renderer/utils/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testMatch: [
    '**/__tests__/**/*.js?(x)',
    '**/?(*.)+(spec|test).js?(x)'
  ],
  collectCoverageFrom: [
    'electron-app/src/**/*.{js,jsx}',
    '!electron-app/src/**/*.test.{js,jsx}',
    '!electron-app/src/renderer/index.jsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};


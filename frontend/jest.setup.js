require('@testing-library/jest-dom');

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

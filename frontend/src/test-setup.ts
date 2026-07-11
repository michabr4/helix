// Global test setup for Vitest + jsdom
// Polyfill fetch for jsdom (Node 18+ has it, but jsdom needs the global)
import "@testing-library/jest-dom";

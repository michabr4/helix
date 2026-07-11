/** @type {import('jest').Config} */
module.exports = {
  // No jest-expo preset — our unit tests are pure Node (path/fs checks).
  // React Native component rendering tests belong in Detox E2E.
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  // Don't transform node_modules
  transformIgnorePatterns: ["node_modules/"],
  testMatch: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};

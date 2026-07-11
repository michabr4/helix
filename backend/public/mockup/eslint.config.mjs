import globals from "globals";

/* Plain browser <script> files (IIFE, no bundler) — no lint coverage existed at all until this
   pass converted 405 pre-existing `var` to let/const. Kept deliberately minimal: enforce the one
   rule this file was just brought into compliance with, not a general style rulebook. */
export default [
  {
    files: ["mockup-hub.js", "theme-init.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: { ...globals.browser }
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error"
    }
  }
];

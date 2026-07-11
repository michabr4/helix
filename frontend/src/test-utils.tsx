import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

// Suppress React Router v6 future-flag warnings in test output
const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (msg.includes("React Router Future Flag Warning")) return;
  originalWarn(...args);
};

// Wrap components that need a router context
export function renderWithRouter(ui: ReactElement, options?: RenderOptions & { initialEntries?: string[] }) {
  const { initialEntries = ["/"], ...rest } = options ?? {};
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
    rest
  );
}

export * from "@testing-library/react";

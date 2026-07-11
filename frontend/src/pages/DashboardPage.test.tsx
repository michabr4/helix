import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../test-utils";
import { DashboardPage } from "./DashboardPage";

// Mock the api module — tests run without a real backend
vi.mock("../api", () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  getAccessToken: vi.fn().mockReturnValue("mock-token")
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    renderWithRouter(<DashboardPage />);
    // Page renders — exact content depends on API response
    expect(document.body).toBeTruthy();
  });
});

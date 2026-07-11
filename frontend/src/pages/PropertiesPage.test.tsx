import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test-utils";
import { PropertiesPage } from "./PropertiesPage";

vi.mock("../api", () => ({
  apiGet: vi.fn().mockResolvedValue([
    { property_id: "1", name: "Bellagio", property_type: "casino" }
  ]),
  getAccessToken: vi.fn().mockReturnValue("mock-token")
}));

describe("PropertiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading", async () => {
    renderWithRouter(<PropertiesPage />);
    await waitFor(() => expect(screen.getByText("Properties")).toBeInTheDocument());
  });
});

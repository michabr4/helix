import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test-utils";
import { DevicesPage } from "./DevicesPage";

vi.mock("../api", () => ({
  apiGet: vi.fn().mockResolvedValue([
    { device_id: "1", hostname: "sw-core-01", ip_address: "10.1.1.1", status: "active" }
  ]),
  getAccessToken: vi.fn().mockReturnValue("mock-token")
}));

describe("DevicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading", async () => {
    renderWithRouter(<DevicesPage />);
    await waitFor(() => expect(screen.getByText("Devices")).toBeInTheDocument());
  });
});

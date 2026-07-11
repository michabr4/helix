import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test-utils";
import { IncidentsPage } from "./IncidentsPage";

vi.mock("../api", () => ({
  apiGet: vi.fn().mockResolvedValue([
    { incident_id: "1", incident_number: "INC-001", title: "Test incident", priority: "P2", status: "open" }
  ]),
  getAccessToken: vi.fn().mockReturnValue("mock-token")
}));

describe("IncidentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading", async () => {
    renderWithRouter(<IncidentsPage />);
    await waitFor(() => expect(screen.getByText("Incidents")).toBeInTheDocument());
  });
});

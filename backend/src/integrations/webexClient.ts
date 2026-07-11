export type CreateWebexRoomResult =
  | { ok: true; id: string; title: string }
  | { ok: false; status: number; message: string };

export class WebexClient {
  constructor(private readonly botToken: string) {}

  async createRoom(title: string): Promise<CreateWebexRoomResult> {
    const token = (this.botToken || "").trim();
    if (!token) {
      return { ok: false, status: 503, message: "Webex bot token is not configured" };
    }
    const response = await fetch("https://webexapis.com/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title })
    });
    if (!response.ok) {
      let message = response.statusText || "Webex API error";
      try {
        const err = (await response.json()) as { message?: string; errors?: unknown };
        if (typeof err.message === "string" && err.message) message = err.message;
      } catch {
        /* ignore non-JSON error body */
      }
      return { ok: false, status: response.status, message };
    }
    const json = (await response.json()) as { id?: string; title?: string };
    if (!json.id || !json.title) {
      return { ok: false, status: 502, message: "Webex API returned an unexpected payload" };
    }
    return { ok: true, id: json.id, title: json.title };
  }
}

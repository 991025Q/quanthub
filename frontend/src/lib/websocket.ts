/**
 * WebSocket 管理
 */

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8002";

export class WSClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private path: string, private onMessage: (data: unknown) => void) {}

  connect() {
    const token = localStorage.getItem("access_token");
    this.ws = new WebSocket(`${WS_BASE}${this.path}?token=${token}`);

    this.ws.onopen = () => console.log(`[WS] Connected: ${this.path}`);
    this.ws.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(event.data));
      } catch {
        console.warn("[WS] Failed to parse message");
      }
    };
    this.ws.onclose = () => {
      console.log("[WS] Disconnected, reconnecting in 5s...");
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export type LiveMessage = { type: string; payload?: any };

type Handlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (msg: LiveMessage) => void;
};

export class LiveSocket {
  private ws?: WebSocket;
  private handlers: Handlers;

  constructor(handlers: Handlers = {}) {
    this.handlers = handlers;
  }

  start() {
    // ใช้ path เดิมที่ server.js เปิด WS ไว้
    this.ws = new WebSocket(`ws://${location.host}/ws`);

    this.ws.onopen = () => this.handlers.onOpen?.();
    this.ws.onclose = () => this.handlers.onClose?.();
    this.ws.onmessage = (ev) => {
      try {
        const msg: LiveMessage = JSON.parse(ev.data);
        this.handlers.onMessage?.(msg);
      } catch {
        // ignore malformed
      }
    };
  }

  stop() {
    this.ws?.close();
    this.ws = undefined;
  }

  send(type: string, payload?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, payload }));
  }
}

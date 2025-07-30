import { type User } from '@portal/shared';

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
}

export class CustomerSupportChat {
  state: DurableObjectState;
  sessions: Map<string, WebSocket>;
  messages: ChatMessage[];
  user: User | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
    this.messages = [];
    this.state.storage.get<ChatMessage[]>("messages").then(messages => {
      this.messages = messages || [];
    });
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const user_id = url.searchParams.get('user_id');
    const isAdmin = url.searchParams.get('admin') === 'true';

    if (!user_id) {
      return new Response("user_id is required", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    await this.handleSession(server, user_id, isAdmin);

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(ws: WebSocket, user_id: string, isAdmin: boolean) {
    ws.accept();
    this.sessions.set(isAdmin ? 'admin' : user_id, ws);

    ws.send(JSON.stringify({ type: 'history', messages: this.messages }));

    ws.addEventListener("message", async (msg) => {
      const data = JSON.parse(msg.data as string);
      const chatMessage: ChatMessage = {
        user: isAdmin ? 'Admin' : 'Customer',
        message: data.message,
        timestamp: Date.now(),
      };
      this.messages.push(chatMessage);

      // Broadcast to all connected clients (customer and admin)
      for (const session of this.sessions.values()) {
        session.send(JSON.stringify({ type: 'message', message: chatMessage }));
      }

      await this.state.storage.put("messages", this.messages);
    });
  }
}

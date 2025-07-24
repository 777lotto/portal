// 777lotto/portal/portal-fold/packages/durable-chat/src/server/index.ts
import type { ChatMessage, User } from '@portal/shared';
import { jwtVerify } from 'jose';
import { nanoid } from 'nanoid';

interface Env {
  CHAT_ROOM: DurableObjectNamespace;
  JWT_SECRET: string;
}

interface ChatSession {
  websocket: WebSocket;
  user: User;
}

export class ChatRoom {
  state: DurableObjectState;
  env: Env;
  sessions: ChatSession[] = [];
  messages: ChatMessage[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.storage.get<ChatMessage[]>("messages").then(messages => {
      this.messages = messages || [];
    });
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const token = new URL(request.url).searchParams.get('token');
    if (!token) {
      return new Response("Authentication failed: Missing token", { status: 401 });
    }

    let user: User;
    try {
      const secret = new TextEncoder().encode(this.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      user = payload as User;
    } catch (e) {
      console.error("JWT Verification failed:", e);
      return new Response("Authentication failed: Invalid token", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.handleSession(server, user);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  handleSession(websocket: WebSocket, user: User) {
    websocket.accept();
    const session: ChatSession = { websocket, user };
    this.sessions.push(session);

    websocket.send(JSON.stringify({ type: "all", messages: this.messages }));

    websocket.addEventListener("message", async (event) => {
      try {
        const parsed = JSON.parse(event.data as string);
        if (parsed.content) {
          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: parsed.content,
            user: user.role === 'admin' ? 'Support' : (user.name || 'Customer'),
            role: user.role === 'admin' ? "assistant" : "user",
          };
          this.messages.push(chatMessage);
          this.broadcast(JSON.stringify({ type: "add", ...chatMessage }));
          await this.state.storage.put("messages", this.messages);
        }
      } catch (e) {
        console.error("Failed to process message:", e);
      }
    });

    websocket.addEventListener("close", () => {
      this.sessions = this.sessions.filter(s => s.websocket !== websocket);
    });
    websocket.addEventListener("error", () => {
      this.sessions = this.sessions.filter(s => s.websocket !== websocket);
    });
  }

  broadcast(message: string) {
    for (const session of this.sessions) {
      try {
        session.websocket.send(message);
      } catch (e) {
        // Remove dead connections
        this.sessions = this.sessions.filter(s => s !== session);
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.pathname.split('/').pop();

    if (!roomId) {
      return new Response('Room not specified', { status: 400 });
    }

    const id = env.CHAT_ROOM.idFromName(roomId);
    const stub = env.CHAT_ROOM.get(id);
    return stub.fetch(request);
  }
};

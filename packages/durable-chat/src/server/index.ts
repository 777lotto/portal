import { Hono } from 'hono';
import {
  type Connection,
  Server,
  type WSMessage,
} from "partyserver";
import type { ChatMessage, Message, User } from '@portal/shared';
import { jwtVerify } from 'jose';

interface Env {
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace;
  JWT_SECRET: string;
}

// The Hono app is now only used if you decide to add non-DO routes to this worker.
const app = new Hono<{ Bindings: Env }>();

export class ChatRoom extends Server<Env> {
  messages: ChatMessage[] = [];

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.ctx.storage.get<ChatMessage[]>("messages").then(messages => {
      this.messages = messages || [];
    });
  }

  // --- NEW: Custom fetch handler to correctly manage WebSocket connections ---
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // This is the key part: we manually handle the WebSocket connection
    // and then pass it to the partyserver library's connection manager.
    await this.handleConnection(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async onConnect(connection: Connection) {
    // Authenticate the user
    const token = new URL(connection.url).searchParams.get('token');
    if (!token) {
      connection.close(1002, "Authentication failed: Missing token");
      return;
    }

    try {
      const secret = new TextEncoder().encode(this.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      connection.state = payload as User;
    } catch (e) {
      console.error("JWT Verification failed:", e);
      connection.close(1002, "Authentication failed: Invalid token");
      return;
    }

    connection.send(
      JSON.stringify({
        type: "all",
        messages: this.messages,
      } satisfies Message),
    );
  }

  async onMessage(connection: Connection, message: WSMessage) {
    const parsed = JSON.parse(message as string) as Message;
    const user = connection.state as User;

    if (parsed.type === "add") {
      const chatMessage: ChatMessage = {
        id: parsed.id,
        content: parsed.content,
        user: user.role === 'admin' ? 'Support' : user.name, // Display 'Support' for admin users
        role: user.role === 'admin' ? "assistant" : "user",
      };
      this.messages.push(chatMessage);
      this.broadcast(JSON.stringify({ type: "add", ...chatMessage }));
      await this.ctx.storage.put("messages", this.messages);
    }
  }
}

// The default export now includes the ChatRoom class itself
export default {
  fetch: app.fetch,
  ChatRoom: ChatRoom
};

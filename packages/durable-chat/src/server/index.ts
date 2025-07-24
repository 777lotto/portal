import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/cloudflare-workers';
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

const app = new Hono<{ Bindings: Env }>();

app.get('/api/chat/:room', upgradeWebSocket(async (c) => {
  const room = c.req.param('room');
  const durableObject = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(room));
  return durableObject.fetch(c.req.raw);
}));

export class ChatRoom extends Server<Env> {
  messages: ChatMessage[] = [];

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.ctx.storage.get<ChatMessage[]>("messages").then(messages => {
      this.messages = messages || [];
    });
  }

  async onConnect(connection: Connection) {
    // Authenticate the user
    const token = new URL(connection.url).searchParams.get('token');
    if (!token) {
      connection.close(1002, "Authentication failed");
      return;
    }

    try {
      const secret = new TextEncoder().encode(this.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      connection.state = payload as User;
    } catch (e) {
      connection.close(1002, "Authentication failed");
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
        user: user.name,
        role: "user",
      };
      this.messages.push(chatMessage);
      this.broadcast(JSON.stringify({ type: "add", ...chatMessage }));
      await this.ctx.storage.put("messages", this.messages);
    }
  }
}

export default {
  fetch: app.fetch,
};

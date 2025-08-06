// packages/durable-chat/src/server/index.ts
import type { ChatMessage, User, Env } from '@portal/shared';
import { jwtVerify } from 'jose';
import { nanoid } from 'nanoid';

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
    // Load existing messages from storage
    this.state.storage.get<ChatMessage[]>("messages").then(messages => {
      this.messages = messages || [];
    });
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // Authenticate the user via JWT from the query parameter
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

    // Create the WebSocket pair and handle the session
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

    // Send the existing message history to the newly connected client
    websocket.send(JSON.stringify({ type: "all", messages: this.messages }));

    websocket.addEventListener("message", async (event) => {
        try {
            const { content, attachment } = JSON.parse(event.data as string);
            if (content || attachment) {
                const chatMessage: ChatMessage = {
                    id: nanoid(8),
                    content,
                    user: user.role === 'admin' ? 'Support' : (user.name || 'Customer'),
                    role: user.role === 'admin' ? "assistant" : "user",
                    attachment,
                };
                this.messages.push(chatMessage);
                this.broadcast(JSON.stringify({ type: "add", ...chatMessage }));
                await this.state.storage.put("messages", this.messages);

                // *** NOTIFICATION LOGIC ADDED HERE ***
                // Create a UI notification for the new message
                await this.createMessageNotification(chatMessage, user);
            }
        } catch (e) {
            console.error("Failed to process message:", e);
        }
    });

    // Handle session cleanup on close or error
    const closeOrErrorHandler = () => {
      this.sessions = this.sessions.filter(s => s.websocket !== websocket);
    };
    websocket.addEventListener("close", closeOrErrorHandler);
    websocket.addEventListener("error", closeOrErrorHandler);
  }

  /**
   * Fetches the user IDs of all administrators from the database.
   * @returns A promise that resolves to an array of admin user IDs.
   */
  private async getAdminUserIds(): Promise<number[]> {
    try {
      const { results } = await this.env.DB.prepare("SELECT id FROM users WHERE role = 'admin'").all<{ id: number }>();
      return results.map(r => r.id);
    } catch (e) {
      console.error("Failed to fetch admin users from DB:", e);
      return [];
    }
  }

  /**
   * Creates a UI notification in the database for a new chat message.
   * @param chatMessage The chat message that was just sent.
   * @param sender The user who sent the message.
   */
  private async createMessageNotification(chatMessage: ChatMessage, sender: User) {
    const activeUserIds = new Set(this.sessions.map(s => s.user.id));
    const message = `You have a new message from ${chatMessage.user}.`;
    const link = `/chat/${this.state.id.toString()}`; // Link to the specific chat room

    let recipientUserIds: number[] = [];

    if (sender.role === 'admin') {
      // If an admin sent the message, the recipient is the customer.
      // The customer's user_id is the name of the Durable Object room.
      const customerUserId = parseInt(this.state.id.toString(), 10);
      if (!isNaN(customerUserId)) {
        recipientUserIds.push(customerUserId);
      }
    } else {
      // If a customer sent the message, the recipients are all admins.
      recipientUserIds = await this.getAdminUserIds();
    }

    // Filter out the sender and any users who are currently active in the chat
    const userIdsToNotify = recipientUserIds.filter(id => id !== sender.id && !activeUserIds.has(id));

    if (userIdsToNotify.length === 0) {
      return; // No one to notify
    }

    // Create a batch of notification insert statements
    const statements = userIdsToNotify.map(userId =>
      this.env.DB.prepare(
        `INSERT INTO notifications (user_id, type, message, link, channels, status) VALUES (?, 'new_message', ?, ?, ?, 'sent')`
      ).bind(userId, message, link, JSON.stringify(['ui']))
    );

    try {
      await this.env.DB.batch(statements);
    } catch (e) {
      console.error("Failed to create batch message notifications:", e);
    }
  }

  broadcast(message: string) {
    // Send a message to all connected clients, removing any that have disconnected.
    this.sessions = this.sessions.filter(session => {
      try {
        session.websocket.send(message);
        return true;
      } catch (e) {
        // This session is likely disconnected, so we filter it out.
        return false;
      }
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // The room ID is the last part of the path, e.g., /chat/123 -> 123
    const roomId = url.pathname.split('/').pop();

    if (!roomId) {
      return new Response('Room not specified', { status: 400 });
    }

    // Get a unique durable object ID from the room name
    const id = env.CHAT_ROOM.idFromName(roomId);
    const stub = env.CHAT_ROOM.get(id);
    return stub.fetch(request);
  }
};

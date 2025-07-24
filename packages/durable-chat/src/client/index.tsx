import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../../shared/src";

function App() {
  const { room } = useParams();
  const [token, setToken] = useState<string | null>(localStorage.getItem('portal_token'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const socket = usePartySocket({
    host: `chat.777.foo/api/chat/${room}?token=${token}`,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        setMessages((messages) => [...messages, message]);
      } else if (message.type === "all") {
        setMessages(message.messages);
      }
    },
    onClose: () => {
      setToken(null);
      localStorage.removeItem('portal_token');
    }
  });

  if (!token) {
    return (
      <div className="container">
        <h2>Enter Your Portal Auth Token</h2>
        <p>You can get this by logging into the main portal and copying it from your browser's local storage.</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("token") as HTMLInputElement;
          localStorage.setItem('portal_token', input.value);
          setToken(input.value);
        }}>
          <input type="text" name="token" className="u-full-width" />
          <button type="submit" className="button-primary">Join Chat</button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat container">
      {messages.map((message) => (
        <div key={message.id} className="row message">
          <div className="two columns user">{message.user}</div>
          <div className="ten columns">{message.content}</div>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const content = e.currentTarget.elements.namedItem(
            "content",
          ) as HTMLInputElement;
          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: content.value,
            user: "You",
            role: "user",
          };
          socket.send(
            JSON.stringify({
              type: "add",
              ...chatMessage,
            } satisfies Message),
          );
          content.value = "";
        }}
      >
        <input
          type="text"
          name="content"
          className="ten columns my-input-text"
          placeholder="Type a message..."
          autoComplete="off"
        />
        <button type="submit" className="send-message two columns">
          Send
        </button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);

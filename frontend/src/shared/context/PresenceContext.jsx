import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const PresenceContext = createContext(null);

export function PresenceProvider({ children }) {
  const [presence, setPresence] = useState({});
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    const presenceSocket = io(import.meta.env.VITE_BACKEND_URL, {
      transports: ["websocket"],
      auth: {
        token,
      },
    });

    setSocket(presenceSocket);

    presenceSocket.on("presence_update", ({ userId, status }) => {
      setPresence((currentPresence) => ({
        ...currentPresence,
        [userId]: status,
      }));
    });

    presenceSocket.on("connect_error", (error) => {
      console.error("Presence socket connection failed:", error.message);
    });

    return () => {
      presenceSocket.disconnect();
      setSocket(null);
    };
  }, []);

  const getPresence = (userId) => {
    return presence[userId] || "offline";
  };

  const notifyStatusChanged = () => {
    if (socket?.connected) {
      socket.emit("status_changed");
    }
  };

  return (
    <PresenceContext.Provider
      value={{
        presence,
        getPresence,
        notifyStatusChanged,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);

  if (!context) {
    throw new Error("usePresence must be used inside PresenceProvider");
  }

  return context;
}

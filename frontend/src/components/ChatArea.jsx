import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Message from "./Message";
import MessageInput from "./MessageInput";
import { authFetch } from "../utils/authFetch";

function ChatArea({ selectedChat }) {
  const user = JSON.parse(localStorage.getItem("user"));

  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  /*
    Socket.IO connection
  */
  useEffect(() => {
    const token = localStorage.getItem("token");

    const newSocket = io("http://localhost:5000", {
      auth: {
        token,
      },
    });

    newSocket.on("connect", () => {
      console.log("Authenticated socket connected:", newSocket.id);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    newSocket.on("new_message", (newMessage) => {
      setMessages((currentMessages) => {
        /*
          Public room
        */
        if (selectedChat?.type === "room") {
          if (newMessage.room === selectedChat.room && !newMessage.recipient) {
            return [...currentMessages, newMessage];
          }

          return currentMessages;
        }

        /*
          DM
        */
        if (selectedChat?.type === "dm") {
          const currentUserId = user.id;
          const otherUserId = selectedChat.user._id;

          const isDM =
            newMessage.recipient &&
            ((newMessage.sender?._id === currentUserId &&
              newMessage.recipient._id === otherUserId) ||
              (newMessage.sender?._id === otherUserId &&
                newMessage.recipient._id === currentUserId));

          if (isDM) {
            return [...currentMessages, newMessage];
          }
        }

        return currentMessages;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [selectedChat, user.id]);

  /*
    Fetch messages when a conversation is selected.
  */
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);

      try {
        let url = "http://localhost:5000/api/messages";

        if (selectedChat.type === "dm") {
          url = `http://localhost:5000/api/messages/dm/${selectedChat.user._id}`;
        }

        const response = await authFetch(url);
        const data = await response.json();

        if (response.ok) {
          setMessages(data.messages || []);
        } else {
          console.error(data.message);
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [selectedChat]);

  /*
    Scroll to newest message.
  */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /*
    Welcome screen when no chat is selected.
  */
  if (!selectedChat) {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-chime-gold text-4xl shadow-sm">
              🔔
            </div>

            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-chime-text">
              Welcome to Chime
            </h1>

            <p className="mt-3 text-sm leading-6 text-chime-secondary sm:text-base">
              A friendly place to connect and chat. Search for someone in the
              sidebar and start a conversation.
            </p>

            <p className="mt-2 text-sm text-chime-secondary">
              Your conversations will appear here.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const chatName =
    selectedChat.type === "dm" ? selectedChat.user.username : "General";

  const chatSubtitle =
    selectedChat.type === "dm" ? "Direct message" : "Public room";

  /*
    A DM can remain visible after unfriending,
    but new messages are only allowed while friends.
  */
  const canMessage =
    selectedChat.type === "room" || selectedChat.isFriend !== false;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
      {/* Chat Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-stone-200 bg-chime-background px-6">
        {selectedChat.type === "dm" && (
          <div className="mr-3 h-9 w-9 shrink-0 rounded-full bg-chime-gold" />
        )}

        {selectedChat.type === "room" && (
          <span className="mr-3 text-xl text-chime-secondary">#</span>
        )}

        <div className="min-w-0">
          <h2 className="truncate font-bold text-chime-text">{chatName}</h2>

          <p className="text-sm text-chime-secondary">{chatSubtitle}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-chime-secondary">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-chime-gold text-2xl">
                {selectedChat.type === "dm" ? "💬" : "#"}
              </div>

              <h3 className="mt-4 font-bold text-chime-text">
                {selectedChat.type === "dm"
                  ? `Start chatting with ${chatName}`
                  : "Welcome to General"}
              </h3>

              <p className="mt-1 text-sm text-chime-secondary">
                {selectedChat.type === "dm"
                  ? canMessage
                    ? "Send a message to start the conversation."
                    : "You are no longer friends with this user."
                  : "This is the beginning of this room."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const senderId = message.sender?._id || null;

              const isDeletedUser = !message.sender;

              const senderUsername = isDeletedUser
                ? "Deleted User"
                : message.sender.username;

              const isOwnMessage = !isDeletedUser && senderId === user.id;

              const previousMessage = messages[index - 1];

              const previousSenderId = previousMessage?.sender?._id || null;

              const previousIsDeletedUser = !previousMessage?.sender;

              const isSameSender =
                previousMessage &&
                ((isDeletedUser && previousIsDeletedUser) ||
                  (!isDeletedUser &&
                    !previousIsDeletedUser &&
                    previousSenderId === senderId));

              const timeDifference = previousMessage
                ? new Date(message.createdAt) -
                  new Date(previousMessage.createdAt)
                : null;

              const isWithinOneMinute =
                timeDifference !== null &&
                timeDifference >= 0 &&
                timeDifference <= 60 * 1000;

              const isGrouped = isSameSender && isWithinOneMinute;

              return (
                <Message
                  key={message._id}
                  username={senderUsername}
                  time={new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  content={message.content}
                  avatarColor="bg-chime-bright"
                  isOwnMessage={isOwnMessage}
                  isGrouped={isGrouped}
                />
              );
            })}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="shrink-0">
        {selectedChat.type === "dm" && !canMessage ? (
          <div className="border-t border-stone-200 bg-chime-background px-6 py-4 text-center">
            <p className="text-sm font-medium text-chime-secondary">
              You are no longer friends with {chatName}.
            </p>

            <p className="mt-1 text-xs text-chime-secondary">
              Your conversation history is still available, but you cannot send
              new messages unless you become friends again.
            </p>
          </div>
        ) : (
          <MessageInput socket={socket} selectedChat={selectedChat} />
        )}
      </div>
    </main>
  );
}

export default ChatArea;

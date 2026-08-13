import { useState } from "react";

function MessageInput({ socket, selectedChat }) {
  const [content, setContent] = useState("");

  const handleSend = (event) => {
    event.preventDefault();

    if (!content.trim()) {
      return;
    }

    if (!socket || !socket.connected) {
      console.error("Socket is not connected");
      return;
    }

    /*
      DM
    */
    if (selectedChat?.type === "dm") {
      socket.emit("send_message", {
        content: content.trim(),
        recipient: selectedChat.user._id,
      });
    } else if (selectedChat?.type === "room") {

    /*
      Public room
    */
      socket.emit("send_message", {
        content: content.trim(),
        room: selectedChat.room || "general",
      });
    }

    setContent("");
  };

  return (
    <div className="border-t border-stone-200 bg-chime-background p-4">
      <form onSubmit={handleSend} className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Send a message..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-chime-chat px-4 py-3 text-sm text-chime-text outline-none placeholder:text-chime-secondary focus:border-chime-gold"
        />

        <button
          type="submit"
          className="shrink-0 rounded-xl bg-chime-gold px-5 py-3 font-semibold text-chime-text hover:bg-chime-bright"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default MessageInput;

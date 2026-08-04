import Message from "./Message";
import MessageInput from "./MessageInput";

function ChatArea() {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-chime-chat">
      {/* Chat Header */}
      <header className="flex h-16 items-center border-b border-stone-200 bg-chime-background px-6">
        <div>
          <h2 className="font-bold text-chime-text">General</h2>

          <p className="text-sm text-chime-secondary">Public room</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <Message
          username="Alex"
          time="2:30 PM"
          content="Hey everyone! Welcome to Chime 👋"
          avatarColor="bg-chime-bright"
        />
      </div>

      {/* Message Input */}
      <MessageInput />
    </main>
  );
}

export default ChatArea;

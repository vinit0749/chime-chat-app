function MessageInput() {
  return (
    <div className="border-t border-stone-200 bg-chime-background p-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Send a message..."
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-chime-chat px-4 py-3 text-sm text-chime-text outline-none placeholder:text-chime-secondary focus:border-chime-gold"
        />

        <button className="shrink-0 rounded-xl bg-chime-gold px-5 py-3 font-semibold text-chime-text hover:bg-chime-bright">
          Send
        </button>
      </div>
    </div>
  );
}

export default MessageInput;

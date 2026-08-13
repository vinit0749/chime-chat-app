function Message({
  username,
  time,
  content,
  avatarColor = "bg-chime-gold",
  isOwnMessage,
  isGrouped,
}) {
  return (
    <div
      className={`flex gap-3 ${
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      } ${isGrouped ? "mb-1" : "mb-4"}`}
    >
      {/* Avatar */}
      <div
        className={`h-10 w-10 shrink-0 rounded-full ${avatarColor} ${
          isGrouped ? "invisible" : ""
        }`}
      />

      {/* Message Content */}
      <div
        className={`min-w-0 max-w-[70%] ${
          isOwnMessage ? "text-right" : "text-left"
        }`}
      >
        {/* Username + Time */}
        {!isGrouped && (
          <div
            className={`mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
              isOwnMessage ? "justify-end" : "justify-start"
            }`}
          >
            <p className="font-bold text-chime-text">{username}</p>

            <span className="text-xs text-chime-secondary">{time}</span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`inline-block rounded-2xl border px-4 py-2 text-sm leading-relaxed shadow-sm ${
            isOwnMessage
              ? "rounded-tr-md border-chime-gold bg-chime-gold text-chime-text"
              : "rounded-tl-md border-stone-200 bg-chime-background text-chime-text"
          }`}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

export default Message;

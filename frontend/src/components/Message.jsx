function Message({ username, time, content, avatarColor = "bg-chime-gold" }) {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className={`h-10 w-10 shrink-0 rounded-full ${avatarColor}`} />

      {/* Message Content */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-bold text-chime-text">{username}</p>

          <span className="text-xs text-chime-secondary">{time}</span>
        </div>

        <p className="mt-1 break-words text-chime-text">{content}</p>
      </div>
    </div>
  );
}

export default Message;

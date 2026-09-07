import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

function MessageSearch({
  value,
  onChange,
  onSearch,
  onClose,
  searchResults,
  searchResultIndex,
  onNext,
  onPrevious,
  isSearching,
}) {
  const resultCount = searchResults.length;
  const currentResult = searchResultIndex >= 0 ? searchResultIndex + 1 : 0;

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch();
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-stone-100 px-2.5 sm:gap-2 sm:px-3">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search messages..."
          autoFocus
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-chime-text outline-none placeholder:text-chime-secondary"
        />

        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-stone-200 hover:text-chime-text"
            aria-label="Clear search"
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}

        <button
          type="button"
          onClick={onSearch}
          disabled={!value.trim() || isSearching}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-stone-200 hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Search messages"
        >
          <Search size={17} strokeWidth={2} />
        </button>
      </div>

      {value && !isSearching && resultCount > 0 && (
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <span className="mr-0.5 whitespace-nowrap text-[11px] font-medium text-chime-secondary sm:mr-1 sm:text-xs">
            {currentResult} / {resultCount}
          </span>

          <button
            type="button"
            onClick={onPrevious}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-stone-100 hover:text-chime-text sm:h-8 sm:w-8"
            aria-label="Previous search result"
            disabled={resultCount === 0}
          >
            <ChevronUp size={17} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={onNext}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-stone-100 hover:text-chime-text sm:h-8 sm:w-8"
            aria-label="Next search result"
            disabled={resultCount === 0}
          >
            <ChevronDown size={17} strokeWidth={2} />
          </button>
        </div>
      )}

      {value && !isSearching && resultCount === 0 && (
        <span className="hidden shrink-0 whitespace-nowrap text-xs text-chime-secondary sm:block">
          No results
        </span>
      )}

      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-chime-secondary transition hover:bg-stone-100 hover:text-chime-text sm:h-9 sm:w-9"
        aria-label="Close search"
      >
        <X size={19} strokeWidth={2} />
      </button>
    </div>
  );
}

export default MessageSearch;

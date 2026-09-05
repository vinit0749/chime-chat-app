import { useEffect, useRef, useState } from "react";
import { authFetch } from "../../../shared/utils/authFetch";

function useSidebarSearch({
  onOpenUserProfile,
  onSelectChat,
  mobile = false,
  onClose,
  findConversation,
  isFriend,
}) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchRef = useRef(null);

  useEffect(() => {
    const searchUsers = async () => {
      if (!search.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const response = await authFetch(
          `http://localhost:5000/api/users/search?q=${encodeURIComponent(
            search.trim(),
          )}`,
        );

        if (response.status === 401) return;

        const data = await response.json();

        if (response.ok) {
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error("User search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(searchUsers, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const clearSearch = () => {
    setSearch("");
    setSearchResults([]);
  };

  const handleOpenSearchProfile = (person) => {
    if (!person?._id || !onOpenUserProfile) return;

    onOpenUserProfile(person._id);

    clearSearch();

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleMessageSearchUser = (person) => {
    if (!person?._id) return;

    const conversation = findConversation(person._id);
    const chatUser = conversation || person;

    onSelectChat({
      type: "dm",
      user: chatUser,
      isFriend: isFriend(person._id),
    });

    clearSearch();

    if (mobile && onClose) {
      onClose();
    }
  };

  return {
    search,
    setSearch,
    searchResults,
    isSearching,
    searchRef,
    clearSearch,
    handleOpenSearchProfile,
    handleMessageSearchUser,
  };
}

export default useSidebarSearch;

import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import {
  ArrowLeft,
  Camera,
  Save,
  User,
  UserPlus,
  UserMinus,
  X,
  Check,
  ChevronDown,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { authFetch } from "../../../shared/utils/authFetch";
import { usePresence } from "../../../shared/context/PresenceContext";

function Profile({ userId, onBack }) {
  const isOwnProfile = !userId;
  const { getPresence } = usePresence();

  const [profile, setProfile] = useState({
    username: "",
    displayName: "",
    bio: "",
    profilePicture: "",
    status: "online",
  });

  const [originalProfile, setOriginalProfile] = useState({
    username: "",
    displayName: "",
    bio: "",
    profilePicture: "",
    status: "online",
  });

  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [removingPicture, setRemovingPicture] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const mobileStatusDropdownRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const url = isOwnProfile
          ? `${import.meta.env.VITE_BACKEND_URL}/api/users/me`
          : `${import.meta.env.VITE_BACKEND_URL}/api/users/${userId}`;

        const response = await authFetch(url);
        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to load profile.");
          return;
        }

        const userProfile = {
          username: data.user.username || "",
          displayName: data.user.displayName || "",
          bio: data.user.bio || "",
          profilePicture: data.user.profilePicture || "",
          status: data.user.status || "online",
        };

        setProfile(userProfile);
        setOriginalProfile(userProfile);

        if (!isOwnProfile) {
          const friendsResponse = await authFetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/friends`,
          );

          if (friendsResponse.ok) {
            const friendsData = await friendsResponse.json();
            const friends = friendsData.friends || [];

            setIsFriend(
              friends.some((friend) => String(friend._id) === String(userId)),
            );
          }
        } else {
          setIsFriend(false);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, isOwnProfile]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedDesktopDropdown = statusDropdownRef.current?.contains(
        event.target,
      );

      const clickedMobileDropdown = mobileStatusDropdownRef.current?.contains(
        event.target,
      );

      if (!clickedDesktopDropdown && !clickedMobileDropdown) {
        setStatusOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setStatusOpen(false);
        setShowDeleteModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile((currentProfile) => ({
      ...currentProfile,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleStatusChange = (status) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      status,
    }));

    setStatusOpen(false);
    setError("");
    setSuccess("");
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Profile pictures must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    setSelectedImage(imageUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);

    setError("");
    setSuccess("");

    event.target.value = "";
  };

  const handleCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleCancelCrop = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }

    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const createCroppedImage = async () => {
    if (!selectedImage || !croppedAreaPixels) {
      throw new Error("Crop area is not ready.");
    }

    const image = await loadImage(selectedImage);

    const canvas = document.createElement("canvas");
    const outputSize = 800;

    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create image canvas.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      outputSize,
      outputSize,
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not create cropped image."));
            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        0.95,
      );
    });
  };

  const handleUploadPicture = async () => {
    if (!selectedImage || uploadingPicture) {
      return;
    }

    try {
      setUploadingPicture(true);
      setError("");
      setSuccess("");

      const croppedImage = await createCroppedImage();

      const formData = new FormData();

      formData.append(
        "profilePicture",
        croppedImage,
        "chime-profile-picture.jpg",
      );

      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/me/profile-picture`,
        {
          method: "PUT",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to upload profile picture.");
        return;
      }

      const updatedProfilePicture = data.user.profilePicture || "";

      setProfile((currentProfile) => ({
        ...currentProfile,
        profilePicture: updatedProfilePicture,
      }));

      setOriginalProfile((currentProfile) => ({
        ...currentProfile,
        profilePicture: updatedProfilePicture,
      }));

      setSuccess("Profile picture updated successfully.");

      handleCancelCrop();
    } catch (error) {
      console.error("Failed to upload profile picture:", error);
      setError("Failed to upload profile picture.");
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleRemovePicture = async () => {
    if (removingPicture || !profile.profilePicture) {
      return;
    }

    try {
      setRemovingPicture(true);
      setError("");
      setSuccess("");

      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/me/profile-picture`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to remove profile picture.");
        return;
      }

      setProfile((currentProfile) => ({
        ...currentProfile,
        profilePicture: "",
      }));

      setOriginalProfile((currentProfile) => ({
        ...currentProfile,
        profilePicture: "",
      }));

      setSuccess("Profile picture removed successfully.");
    } catch (error) {
      console.error("Failed to remove profile picture:", error);
      setError("Failed to remove profile picture.");
    } finally {
      setRemovingPicture(false);
    }
  };

  const handleSave = async (event) => {
    event?.preventDefault();

    if (saving || !isOwnProfile || !hasChanges) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/me`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: profile.username,
            displayName: profile.displayName,
            bio: profile.bio,
            status: profile.status,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to update profile.");
        return;
      }

      const updatedProfile = {
        username: data.user.username || "",
        displayName: data.user.displayName || "",
        bio: data.user.bio || "",
        profilePicture:
          data.user.profilePicture || profile.profilePicture || "",
        status: data.user.status || "online",
      };

      setProfile(updatedProfile);
      setOriginalProfile(updatedProfile);

      setSuccess("Profile updated successfully.");
    } catch (error) {
      console.error("Failed to update profile:", error);
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile(originalProfile);
    setStatusOpen(false);
    setError("");
    setSuccess("");
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) {
      return;
    }

    try {
      setDeletingAccount(true);
      setError("");

      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/me`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to delete account.");
        setDeletingAccount(false);
        setShowDeleteModal(false);
        return;
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.location.href = "/";
    } catch (error) {
      console.error("Failed to delete account:", error);
      setError("Failed to delete account.");
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  const hasChanges =
    profile.username !== originalProfile.username ||
    profile.displayName !== originalProfile.displayName ||
    profile.bio !== originalProfile.bio ||
    profile.status !== originalProfile.status;

  const displayedStatus = isOwnProfile ? profile.status : getPresence(userId);

  const statusLabel =
    displayedStatus === "offline"
      ? "Offline"
      : displayedStatus === "away"
        ? "Away"
        : displayedStatus === "invisible"
          ? "Invisible"
          : "Online";

  const statusDot =
    displayedStatus === "offline" || displayedStatus === "invisible"
      ? "bg-stone-400"
      : displayedStatus === "away"
        ? "bg-amber-400"
        : "bg-green-500";

  const statusOptions = [
    {
      value: "online",
      label: "Online",
      description: "Available to chat",
      dot: "bg-green-500",
    },
    {
      value: "away",
      label: "Away",
      description: "Temporarily unavailable",
      dot: "bg-amber-400",
    },
    {
      value: "invisible",
      label: "Invisible",
      description: "Appear offline to others",
      dot: "bg-stone-400",
    },
  ];

  const currentStatusOption =
    statusOptions.find((option) => option.value === profile.status) ||
    statusOptions[0];

  const renderStatusDropdown = (mobile = false) => {
    const dropdownRef = mobile ? mobileStatusDropdownRef : statusDropdownRef;

    return (
      <div
        ref={dropdownRef}
        className={`relative ${mobile ? "w-full" : "w-[190px]"}`}
      >
        <button
          type="button"
          onClick={() => setStatusOpen((current) => !current)}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-stone-200 bg-chime-background px-3.5 text-left text-sm font-semibold text-chime-text outline-none transition hover:border-chime-gold focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/20"
          aria-haspopup="listbox"
          aria-expanded={statusOpen}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${currentStatusOption.dot}`}
            />

            <span className="truncate">{currentStatusOption.label}</span>
          </span>

          <ChevronDown
            size={17}
            className={`ml-2 shrink-0 text-chime-secondary transition-transform duration-200 ${
              statusOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {statusOpen && (
          <div
            className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-stone-200 bg-chime-chat p-1.5 shadow-xl"
            role="listbox"
          >
            {statusOptions.map((option) => {
              const isSelected = profile.status === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStatusChange(option.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                    isSelected ? "bg-chime-selected" : "hover:bg-chime-selected"
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dot}`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-chime-text">
                      {option.label}
                    </span>

                    <span className="mt-0.5 block text-[11px] leading-4 text-chime-secondary">
                      {option.description}
                    </span>
                  </span>

                  {isSelected && (
                    <Check size={15} className="shrink-0 text-chime-gold" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center bg-chime-background">
        <p className="text-sm text-chime-secondary">Loading profile...</p>
      </section>
    );
  }

  return (
    <>
      <section className="chime-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-chime-background">
        <header className="flex h-16 shrink-0 items-center border-b border-stone-200 px-5 md:px-8">
          <button
            type="button"
            onClick={onBack}
            className="mr-3 rounded-xl p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-chime-text">
              {isOwnProfile ? "Your Profile" : "Profile"}
            </h1>

            <p className="text-xs text-chime-secondary">
              {isOwnProfile
                ? "Manage your Chime profile"
                : "View Chime profile"}
            </p>
          </div>
        </header>

        <div className="w-full px-5 py-6 md:px-8 md:py-8">
          <div className="w-full">
            <div className="rounded-2xl border border-stone-200 bg-chime-chat p-5 md:p-6">
              <div className="flex items-center gap-5">
                <div className="relative h-24 w-24 shrink-0">
                  {profile.profilePicture ? (
                    <img
                      src={profile.profilePicture}
                      alt={profile.displayName || profile.username}
                      className="h-24 w-24 rounded-full object-cover ring-4 ring-chime-gold/20"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-chime-gold text-chime-text ring-4 ring-chime-gold/20">
                      <User size={42} />
                    </div>
                  )}

                  {isOwnProfile && (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPicture || removingPicture}
                        className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-chime-chat bg-chime-gold text-chime-text shadow-sm transition hover:bg-chime-bright disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Change profile picture"
                      >
                        <Camera size={16} />
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-2xl font-extrabold tracking-tight text-chime-text">
                    {profile.displayName || profile.username || "User"}
                  </h2>

                  <p className="mt-1 truncate text-sm text-chime-secondary">
                    @{profile.username}
                  </p>

                  {!isOwnProfile && (
                    <div className="mt-3 flex items-center gap-2">
                      {isFriend ? (
                        <>
                          <UserMinus
                            size={14}
                            className="text-chime-secondary"
                          />

                          <span className="text-xs font-semibold text-chime-secondary">
                            Friends
                          </span>
                        </>
                      ) : (
                        <>
                          <UserPlus
                            size={14}
                            className="text-chime-secondary"
                          />

                          <span className="text-xs text-chime-secondary">
                            Not friends
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isOwnProfile ? (
                  <div className="ml-auto flex shrink-0 items-end gap-3">
                    <div className="hidden sm:block">
                      <label className="mb-1.5 block text-xs font-semibold text-chime-secondary">
                        Status
                      </label>

                      {renderStatusDropdown()}
                    </div>

                    <div className="hidden items-center gap-2 sm:flex">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPicture || removingPicture}
                        className="h-10 rounded-xl border border-stone-200 bg-chime-background px-4 text-sm font-semibold text-chime-text transition hover:border-chime-gold hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Change photo
                      </button>

                      {profile.profilePicture && (
                        <button
                          type="button"
                          onClick={handleRemovePicture}
                          disabled={uploadingPicture || removingPicture}
                          className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingPicture ? "Removing..." : "Remove photo"}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className="hidden h-10 items-center gap-2 rounded-xl bg-chime-gold px-4 text-sm font-bold text-chime-text shadow-sm transition hover:bg-chime-bright disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
                    >
                      <Save size={16} />
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />

                    <span className="text-xs font-semibold text-chime-secondary">
                      {statusLabel}
                    </span>
                  </div>
                )}
              </div>

              {isOwnProfile && (
                <div className="mt-5 border-t border-stone-200 pt-4 sm:hidden">
                  <label className="mb-1.5 block text-xs font-semibold text-chime-secondary">
                    Status
                  </label>

                  {renderStatusDropdown(true)}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPicture || removingPicture}
                    className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-stone-200 bg-chime-background px-4 text-sm font-semibold text-chime-text transition hover:border-chime-gold hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Change photo
                  </button>

                  {profile.profilePicture && (
                    <button
                      type="button"
                      onClick={handleRemovePicture}
                      disabled={uploadingPicture || removingPicture}
                      className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {removingPicture ? "Removing..." : "Remove photo"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-chime-gold px-4 py-2.5 text-sm font-bold text-chime-text shadow-sm transition hover:bg-chime-bright disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-chime-chat p-5 md:p-7">
              {isOwnProfile ? (
                <>
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-chime-text">
                      Profile information
                    </h3>

                    <p className="mt-1 text-sm text-chime-secondary">
                      Update the information people see when they interact with
                      you on Chime.
                    </p>
                  </div>

                  <form onSubmit={handleSave}>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="username"
                          className="mb-2 block text-sm font-semibold text-chime-text"
                        >
                          Username
                        </label>

                        <div className="relative">
                          <input
                            id="username"
                            name="username"
                            type="text"
                            value={profile.username}
                            onChange={handleChange}
                            maxLength={20}
                            placeholder="Enter your username"
                            className="w-full rounded-xl border border-stone-200 bg-chime-background px-4 py-3 pr-16 text-sm text-chime-text outline-none transition placeholder:text-stone-400 focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/20"
                          />

                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-chime-secondary">
                            {profile.username.length}/20
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-chime-secondary">
                          3–20 characters. Letters, numbers, and underscores
                          only.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="displayName"
                          className="mb-2 block text-sm font-semibold text-chime-text"
                        >
                          Display Name
                        </label>

                        <div className="relative">
                          <input
                            id="displayName"
                            name="displayName"
                            type="text"
                            value={profile.displayName}
                            onChange={handleChange}
                            maxLength={50}
                            placeholder="Enter your display name"
                            className="w-full rounded-xl border border-stone-200 bg-chime-background px-4 py-3 pr-16 text-sm text-chime-text outline-none transition placeholder:text-stone-400 focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/20"
                          />

                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-chime-secondary">
                            {profile.displayName.length}/50
                          </span>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="bio"
                          className="mb-2 block text-sm font-semibold text-chime-text"
                        >
                          Bio
                        </label>

                        <div className="relative">
                          <textarea
                            id="bio"
                            name="bio"
                            value={profile.bio}
                            onChange={handleChange}
                            maxLength={200}
                            rows={5}
                            placeholder="Tell people a little about yourself..."
                            className="w-full resize-none rounded-xl border border-stone-200 bg-chime-background px-4 py-3 pb-8 text-sm leading-6 text-chime-text outline-none transition placeholder:text-stone-400 focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/20"
                          />

                          <span className="pointer-events-none absolute bottom-3 right-4 text-xs font-medium text-chime-secondary">
                            {profile.bio.length}/200
                          </span>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                      </div>
                    )}

                    {success && (
                      <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600">
                        {success}
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-5">
                      <p className="hidden text-xs text-chime-secondary sm:block">
                        Your changes will appear across Chime.
                      </p>

                      <div className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={!hasChanges || saving}
                          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={!hasChanges || saving}
                          className="flex items-center gap-2 rounded-xl bg-chime-gold px-5 py-2.5 text-sm font-bold text-chime-text shadow-sm transition hover:bg-chime-bright disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save size={17} />
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-chime-text">About</h3>

                    <p className="mt-1 text-sm text-chime-secondary">
                      A little about this Chime member.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-chime-text">
                        Username
                      </p>

                      <div className="rounded-xl border border-stone-200 bg-chime-background px-4 py-3 text-sm text-chime-secondary">
                        @{profile.username}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-chime-text">
                        Display Name
                      </p>

                      <div className="rounded-xl border border-stone-200 bg-chime-background px-4 py-3 text-sm text-chime-text">
                        {profile.displayName || profile.username}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-chime-text">
                        Bio
                      </p>

                      <div className="min-h-[140px] whitespace-pre-wrap rounded-xl border border-stone-200 bg-chime-background px-4 py-4 text-sm leading-6 text-chime-text">
                        {profile.bio || "No bio yet."}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>

            {isOwnProfile && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-5 md:p-7">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                    <AlertTriangle size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-red-700">
                      Danger Zone
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-red-600/80">
                      Permanently delete your Chime account and all associated
                      account data. This action cannot be undone.
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      disabled={deletingAccount}
                      className="mt-5 flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-chime-background shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-chime-text">
                  Adjust profile picture
                </h2>

                <p className="mt-0.5 text-xs text-chime-secondary">
                  Move and zoom to get the perfect crop.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelCrop}
                disabled={uploadingPicture}
                className="rounded-lg p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative h-[min(70vw,420px)] w-full shrink-0 bg-stone-950">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            <div className="shrink-0 border-t border-stone-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-chime-secondary">
                  Zoom
                </span>

                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="flex-1 accent-[#F4B942]"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelCrop}
                  disabled={uploadingPicture}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-text transition hover:bg-chime-selected disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUploadPicture}
                  disabled={uploadingPicture || !croppedAreaPixels}
                  className="flex items-center gap-2 rounded-xl bg-chime-gold px-5 py-2.5 text-sm font-bold text-chime-text transition hover:bg-chime-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check size={17} />
                  {uploadingPicture ? "Uploading..." : "Use Picture"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-chime-background p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Trash2 size={19} />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-bold text-chime-text">
                  Delete your account?
                </h2>

                <p className="mt-2 text-sm leading-6 text-chime-secondary">
                  This will permanently delete your account, friendships, direct
                  messages, notifications, Cluster memberships, and owned
                  Clusters. Your messages in Clusters will remain visible as
                  messages from a deleted user.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">
                This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} />
                {deletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));

    image.src = src;
  });
}

export default Profile;

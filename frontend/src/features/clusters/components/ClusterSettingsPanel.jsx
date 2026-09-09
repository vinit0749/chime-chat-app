import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Settings,
  Users,
  Search,
  Crown,
  UserMinus,
  Trash2,
  Camera,
} from "lucide-react";
import Cropper from "react-easy-crop";
import { authFetch } from "../../../shared/utils/authFetch";
import ConfirmModal from "../../../shared/components/ConfirmModal";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

function ClusterSettingsPanel({
  isOpen,
  cluster,
  onClose,
  onClusterUpdated,
  onClusterDeleted,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [memberSearch, setMemberSearch] = useState("");

  const [members, setMembers] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [pictureError, setPictureError] = useState("");
  const fileInputRef = useRef(null);

  const [kickTarget, setKickTarget] = useState(null);
  const [isKicking, setIsKicking] = useState(false);
  const [kickError, setKickError] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!isOpen || !cluster) {
      return;
    }

    setName(cluster.name || "");
    setDescription(cluster.description || "");
    setVisibility(cluster.visibility || "public");
    setMemberSearch("");
    setSaveError("");
    setPictureError("");
    setKickError("");
    setDeleteError("");
    setKickTarget(null);
    setIsDeleteModalOpen(false);
  }, [isOpen, cluster]);

  useEffect(() => {
    if (!isOpen || !cluster?._id) {
      return;
    }

    let cancelled = false;

    const fetchMembers = async () => {
      setIsMembersLoading(true);
      setMembersError("");

      try {
        const response = await authFetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${cluster._id}/members`,
        );

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setMembersError(data.message || "Failed to load Cluster members.");
          setMembers([]);
          setMemberCount(0);
          return;
        }

        setMembers(Array.isArray(data.members) ? data.members : []);
        setMemberCount(data.cluster?.memberCount || 0);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch Cluster members:", error);
          setMembersError("Something went wrong. Please try again.");
          setMembers([]);
          setMemberCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsMembersLoading(false);
        }
      }
    };

    fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [isOpen, cluster?._id]);

  const filteredMembers = useMemo(() => {
    const search = memberSearch.trim().toLowerCase();

    if (!search) {
      return members;
    }

    return members.filter((member) => {
      const memberUser = member.user;

      if (!memberUser) {
        return false;
      }

      const displayName = memberUser.displayName || "";
      const username = memberUser.username || "";

      return (
        displayName.toLowerCase().includes(search) ||
        username.toLowerCase().includes(search)
      );
    });
  }, [members, memberSearch]);

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPictureError("Please select an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPictureError("Cluster profile pictures must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    setSelectedImage(imageUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPictureError("");

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
    setPictureError("");
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
    if (!selectedImage || uploadingPicture || !cluster?._id) {
      return;
    }

    try {
      setUploadingPicture(true);
      setPictureError("");

      const croppedImage = await createCroppedImage();

      const formData = new FormData();

      formData.append(
        "profilePicture",
        croppedImage,
        "chime-cluster-profile-picture.jpg",
      );

      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${cluster._id}/profile-picture`,
        {
          method: "PUT",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setPictureError(
          data.message || "Failed to upload Cluster profile picture.",
        );
        return;
      }

      if (data.cluster) {
        onClusterUpdated?.(data.cluster);
      }

      handleCancelCrop();
    } catch (error) {
      console.error("Failed to upload Cluster profile picture:", error);
      setPictureError("Failed to upload Cluster profile picture.");
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleSave = async () => {
    if (!cluster?._id || isSaving) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setSaveError("Cluster name is required.");
      return;
    }

    if (trimmedName.length > 100) {
      setSaveError("Cluster name cannot exceed 100 characters.");
      return;
    }

    if (trimmedDescription.length > 500) {
      setSaveError("Cluster description cannot exceed 500 characters.");
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${cluster._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            description: trimmedDescription,
            visibility,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.message || "Failed to update Cluster.");
        return;
      }

      if (data.cluster) {
        setName(data.cluster.name || "");
        setDescription(data.cluster.description || "");
        setVisibility(data.cluster.visibility || "public");

        onClusterUpdated?.(data.cluster);
      }
    } catch (error) {
      console.error("Failed to update Cluster:", error);
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKick = async () => {
    if (!cluster?._id || !kickTarget?._id || isKicking) {
      return;
    }

    setIsKicking(true);
    setKickError("");

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${cluster._id}/members/${kickTarget._id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setKickError(data.message || "Failed to kick member.");
        return;
      }

      setMembers((currentMembers) =>
        currentMembers.filter(
          (member) => String(member.user?._id) !== String(kickTarget._id),
        ),
      );

      setMemberCount((currentCount) =>
        Math.max(0, data.memberCount ?? currentCount - 1),
      );

      setKickTarget(null);
    } catch (error) {
      console.error("Failed to kick Cluster member:", error);
      setKickError("Something went wrong. Please try again.");
    } finally {
      setIsKicking(false);
    }
  };

  const handleDelete = async () => {
    if (!cluster?._id || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${cluster._id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.message || "Failed to delete Cluster.");
        return;
      }

      setIsDeleteModalOpen(false);

      onClusterDeleted?.(data.clusterId || String(cluster._id));
    } catch (error) {
      console.error("Failed to delete Cluster:", error);
      setDeleteError("Something went wrong. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const clusterName = cluster?.name || "your Cluster";
  const clusterInitial = clusterName.charAt(0).toUpperCase();

  return (
    <>
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-4 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute inset-0 cursor-default"
          aria-label="Close Cluster settings"
        />

        <div className="relative z-10 flex h-full max-h-[850px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl">
          <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chime-gold text-chime-text">
                <Settings size={19} />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-chime-text">
                  Cluster Settings
                </h2>

                <p className="truncate text-xs text-chime-secondary">
                  Manage {clusterName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
              aria-label="Close"
            >
              <X size={19} />
            </button>
          </header>

          <div className="chime-scrollbar min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-stone-200 p-5 sm:p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-chime-secondary">
                General
              </h3>

              <div className="mt-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="relative h-28 w-28 shrink-0 self-center sm:self-auto">
                    <div className="h-28 w-28 overflow-hidden rounded-2xl border-4 border-chime-background bg-chime-gold shadow-md ring-1 ring-stone-200">
                      {cluster?.profilePicture ? (
                        <img
                          src={cluster.profilePicture}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-chime-text">
                          {clusterInitial}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPicture}
                      className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-chime-background bg-chime-gold text-chime-text shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Change Cluster profile picture"
                    >
                      <Camera size={17} />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h4 className="truncate text-lg font-bold text-chime-text">
                      {cluster?.name || "Cluster"}
                    </h4>

                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-chime-secondary">
                      {cluster?.description ||
                        "Add a short description for your Cluster."}
                    </p>

                    <p className="mt-2 text-[11px] text-chime-secondary">
                      JPG, PNG, or other image format · Max 10 MB
                    </p>

                    {pictureError && (
                      <p className="mt-2 text-sm leading-5 text-red-600">
                        {pictureError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="my-6 border-t border-stone-200" />

                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="cluster-name"
                      className="mb-2 block text-sm font-semibold text-chime-text"
                    >
                      Cluster Name
                    </label>

                    <div className="relative">
                      <input
                        id="cluster-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                        className="w-full rounded-xl border border-stone-200 bg-chime-chat px-3.5 py-3 pr-16 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold"
                        placeholder="Enter Cluster name"
                      />

                      <span className="pointer-events-none absolute bottom-3 right-3 text-[11px] font-medium text-chime-secondary">
                        {name.length}/100
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cluster-description"
                      className="mb-2 block text-sm font-semibold text-chime-text"
                    >
                      Description
                    </label>

                    <div className="relative">
                      <textarea
                        id="cluster-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={500}
                        rows={4}
                        className="w-full resize-none rounded-xl border border-stone-200 bg-chime-chat px-3.5 py-3 pb-8 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold"
                        placeholder="Tell people what this Cluster is about"
                      />

                      <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] font-medium text-chime-secondary">
                        {description.length}/500
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cluster-visibility"
                      className="mb-2 block text-sm font-semibold text-chime-text"
                    >
                      Visibility
                    </label>

                    <select
                      id="cluster-visibility"
                      value={visibility}
                      onChange={(event) => setVisibility(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-chime-chat px-3.5 py-3 text-sm font-medium text-chime-text outline-none transition focus:border-chime-gold"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>

                    <p className="mt-1.5 text-xs leading-5 text-chime-secondary">
                      {visibility === "public"
                        ? "Anyone can discover and join this Cluster."
                        : "This Cluster won't appear in public discovery."}
                    </p>
                  </div>

                  {saveError && (
                    <p className="text-sm leading-5 text-red-600">
                      {saveError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full rounded-xl bg-chime-gold px-4 py-3 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </section>

            <section className="border-b border-stone-200 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users size={17} className="text-chime-secondary" />

                  <h3 className="text-xs font-bold uppercase tracking-wider text-chime-secondary">
                    Members
                  </h3>
                </div>

                <span className="text-xs font-medium text-chime-secondary">
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 text-chime-secondary">
                View and manage the people who are currently part of this
                Cluster.
              </p>

              <div className="relative mt-4">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-chime-secondary"
                />

                <input
                  type="text"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search members..."
                  className="w-full rounded-xl border border-stone-200 bg-chime-chat py-3 pl-10 pr-4 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold"
                />
              </div>

              {kickError && (
                <p className="mt-3 text-sm leading-5 text-red-600">
                  {kickError}
                </p>
              )}

              <div className="chime-scrollbar mt-3 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-chime-chat p-1.5">
                {isMembersLoading ? (
                  <div className="flex min-h-28 items-center justify-center px-4">
                    <p className="text-sm text-chime-secondary">
                      Loading members...
                    </p>
                  </div>
                ) : membersError ? (
                  <div className="flex min-h-28 items-center justify-center px-4">
                    <p className="text-center text-sm leading-5 text-red-600">
                      {membersError}
                    </p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="flex min-h-28 items-center justify-center px-4">
                    <p className="text-center text-sm text-chime-secondary">
                      {memberSearch.trim()
                        ? "No members match your search."
                        : "No members found."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredMembers.map((member) => {
                      const memberUser = member.user;

                      if (!memberUser?._id) {
                        return null;
                      }

                      const displayName =
                        memberUser.displayName || memberUser.username || "User";

                      const username = memberUser.username || "user";
                      const isOwner = member.role === "owner";

                      return (
                        <div
                          key={member._id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold">
                            {memberUser.profilePicture ? (
                              <img
                                src={memberUser.profilePicture}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-chime-text">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-chime-text">
                                {displayName}
                              </p>

                              {isOwner && (
                                <span className="flex shrink-0 items-center gap-1 rounded-md bg-chime-gold px-1.5 py-0.5 text-[10px] font-bold text-chime-text">
                                  <Crown size={10} />
                                  Owner
                                </span>
                              )}
                            </div>

                            <p className="mt-0.5 truncate text-xs text-chime-secondary">
                              @{username}
                            </p>
                          </div>

                          {!isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setKickError("");
                                setKickTarget(memberUser);
                              }}
                              disabled={isKicking}
                              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-chime-background px-2.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <UserMinus size={14} />
                              <span className="hidden sm:inline">Kick</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="p-5 sm:p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-600">
                Danger Zone
              </h3>

              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Trash2 size={18} className="mt-0.5 shrink-0 text-red-600" />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-chime-text">
                      Delete Cluster
                    </p>

                    <p className="mt-1 text-xs leading-5 text-chime-secondary">
                      Permanently delete this Cluster and its messages. This
                      action cannot be undone.
                    </p>

                    {deleteError && (
                      <p className="mt-2 text-sm leading-5 text-red-600">
                        {deleteError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setIsDeleteModalOpen(true);
                      }}
                      disabled={isDeleting}
                      className="mt-3 rounded-lg border border-red-200 bg-chime-background px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete Cluster
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedImage && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-6">
          <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-chime-text">
                  Crop Cluster Picture
                </h2>

                <p className="mt-1 text-xs text-chime-secondary">
                  Position the image how you want it to appear.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelCrop}
                disabled={uploadingPicture}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cancel crop"
              >
                <X size={19} />
              </button>
            </div>

            <div className="relative h-[min(70vw,420px)] w-full bg-black">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            <div className="border-t border-stone-200 px-5 py-4">
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

                <span className="w-10 text-right text-xs font-medium text-chime-secondary">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              {pictureError && (
                <p className="mt-3 text-sm leading-5 text-red-600">
                  {pictureError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelCrop}
                  disabled={uploadingPicture}
                  className="rounded-xl border border-stone-200 bg-chime-chat px-4 py-2.5 text-sm font-bold text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUploadPicture}
                  disabled={uploadingPicture || !croppedAreaPixels}
                  className="rounded-xl bg-chime-gold px-4 py-2.5 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadingPicture ? "Uploading..." : "Save Picture"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(kickTarget)}
        title="Kick Member"
        message={`Are you sure you want to kick ${
          kickTarget?.displayName || kickTarget?.username || "this member"
        } from ${clusterName}?`}
        confirmText={isKicking ? "Kicking..." : "Kick Member"}
        cancelText="Cancel"
        onConfirm={handleKick}
        onCancel={() => {
          if (!isKicking) {
            setKickTarget(null);
          }
        }}
        loading={isKicking}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Cluster"
        message={`Are you sure you want to permanently delete ${clusterName} and all of its messages? This action cannot be undone.`}
        confirmText={isDeleting ? "Deleting..." : "Delete Cluster"}
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
          }
        }}
        loading={isDeleting}
      />
    </>
  );
}

export default ClusterSettingsPanel;

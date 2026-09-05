import { useRef, useState } from "react";
import {
  X,
  Globe,
  Lock,
  Compass,
  ArrowRight,
  Users,
  Check,
  Camera,
} from "lucide-react";
import Cropper from "react-easy-crop";
import { authFetch } from "../../../shared/utils/authFetch";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

function CreateClusterModal({ isOpen, onClose, onCreated, onOpenDiscover }) {
  const [mode, setMode] = useState("create");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [inviteCode, setInviteCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState("");

  const [selectedImage, setSelectedImage] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [pictureError, setPictureError] = useState("");
  const fileInputRef = useRef(null);

  if (!isOpen) {
    return null;
  }

  const isBusy = loading || joining;

  const clusterInitial = name.trim().charAt(0).toUpperCase() || "C";

  const handleClose = () => {
    if (isBusy) return;

    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }

    setName("");
    setDescription("");
    setVisibility("public");
    setInviteCode("");
    setError("");
    setRequestSent(false);
    setMode("create");
    setSelectedImage(null);
    setCroppedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPictureError("");

    onClose();
  };

  const handleModeChange = (nextMode) => {
    if (isBusy) return;

    setMode(nextMode);
    setError("");
    setRequestSent(false);
  };

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

    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }

    const imageUrl = URL.createObjectURL(file);

    setSelectedImage(imageUrl);
    setCroppedImage(null);
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

  const handleSavePicture = async () => {
    if (!selectedImage || !croppedAreaPixels) {
      return;
    }

    try {
      setPictureError("");

      const blob = await createCroppedImage();

      setCroppedImage(blob);

      if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
      }

      setSelectedImage(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (error) {
      console.error("Failed to crop Cluster profile picture:", error);
      setPictureError("Failed to prepare Cluster profile picture.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setError("Cluster name is required.");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Cluster name cannot exceed 100 characters.");
      return;
    }

    if (trimmedDescription.length > 500) {
      setError("Cluster description cannot exceed 500 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("name", trimmedName);
      formData.append("description", trimmedDescription);
      formData.append("visibility", visibility);

      if (croppedImage) {
        formData.append(
          "profilePicture",
          croppedImage,
          "chime-cluster-profile-picture.jpg",
        );
      }

      const response = await authFetch("http://localhost:5000/api/clusters", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to create Cluster.");
        return;
      }

      onCreated(data.cluster);

      if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
      }

      setName("");
      setDescription("");
      setVisibility("public");
      setError("");
      setSelectedImage(null);
      setCroppedImage(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setPictureError("");

      onClose();
    } catch (error) {
      console.error("Failed to create Cluster:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (event) => {
    event.preventDefault();

    const normalizedInviteCode = inviteCode.trim().toUpperCase();

    if (!normalizedInviteCode) {
      setError("Enter a Cluster invite code.");
      return;
    }

    setJoining(true);
    setError("");

    try {
      const response = await authFetch(
        "http://localhost:5000/api/clusters/join-private",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inviteCode: normalizedInviteCode,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to send join request.");
        return;
      }

      setInviteCode(normalizedInviteCode);
      setRequestSent(true);
    } catch (error) {
      console.error("Failed to send Cluster join request:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleDiscover = () => {
    if (isBusy || requestSent || !onOpenDiscover) return;

    onClose();
    onOpenDiscover();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl">
          <div className="flex shrink-0 items-start justify-between px-6 py-5">
            <div className="min-w-0 pr-4">
              <h2 className="text-xl font-bold tracking-tight text-chime-text">
                Clusters
              </h2>

              <p className="mt-1.5 text-sm leading-5 text-chime-secondary">
                Create a community or join one you're already part of.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close"
            >
              <X size={19} />
            </button>
          </div>

          <div className="px-6 pb-5">
            <div className="flex rounded-xl bg-chime-chat p-1">
              <button
                type="button"
                onClick={() => handleModeChange("create")}
                disabled={isBusy}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  mode === "create"
                    ? "bg-chime-background text-chime-text shadow-sm"
                    : "text-chime-secondary hover:text-chime-text"
                }`}
              >
                Create
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("join")}
                disabled={isBusy}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  mode === "join"
                    ? "bg-chime-background text-chime-text shadow-sm"
                    : "text-chime-secondary hover:text-chime-text"
                }`}
              >
                Join
              </button>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border-t border-stone-200">
            {mode === "create" ? (
              <form onSubmit={handleSubmit} className="space-y-6 p-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-chime-text">
                      Cluster picture
                    </p>

                    <p className="mt-1 text-xs text-chime-secondary">
                      Give your Cluster a picture so people can recognize it.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-chime-chat p-4">
                    <div className="relative h-20 w-20 shrink-0">
                      <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-chime-background bg-chime-gold shadow-sm ring-1 ring-stone-200">
                        {croppedImage ? (
                          <img
                            src={URL.createObjectURL(croppedImage)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-chime-text">
                            {clusterInitial}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-chime-chat bg-chime-gold text-chime-text shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Choose Cluster profile picture"
                      >
                        <Camera size={14} />
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-chime-text">
                        {croppedImage
                          ? "Picture selected"
                          : "No picture selected"}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-chime-secondary">
                        JPG, PNG, or other image format · Max 10 MB
                      </p>

                      {pictureError && (
                        <p className="mt-2 text-sm leading-5 text-red-600">
                          {pictureError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="cluster-name"
                      className="text-sm font-semibold text-chime-text"
                    >
                      Cluster name
                    </label>

                    <span className="text-xs text-chime-secondary">
                      {name.length}/100
                    </span>
                  </div>

                  <input
                    id="cluster-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    placeholder="e.g. Gaming Squad"
                    className="h-11 w-full rounded-xl border border-stone-200 bg-chime-chat px-4 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/10"
                    autoFocus
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="cluster-description"
                      className="text-sm font-semibold text-chime-text"
                    >
                      Description
                    </label>

                    <span className="text-xs text-chime-secondary">
                      {description.length}/500
                    </span>
                  </div>

                  <textarea
                    id="cluster-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="What is this Cluster about?"
                    className="w-full resize-none rounded-xl border border-stone-200 bg-chime-chat px-4 py-3 text-sm leading-5 text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/10"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-chime-text">
                      Visibility
                    </p>

                    <p className="mt-1 text-xs text-chime-secondary">
                      Choose who can find and join your Cluster.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setVisibility("public")}
                      disabled={loading}
                      className={`flex min-h-[92px] items-start gap-3 rounded-xl border p-4 text-left transition ${
                        visibility === "public"
                          ? "border-chime-gold bg-chime-selected"
                          : "border-stone-200 hover:bg-chime-selected"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          visibility === "public"
                            ? "bg-chime-gold text-chime-text"
                            : "bg-chime-chat text-chime-secondary"
                        }`}
                      >
                        <Globe size={18} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-chime-text">
                          Public
                        </p>

                        <p className="mt-1 text-xs leading-5 text-chime-secondary">
                          Anyone can discover and join.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisibility("private")}
                      disabled={loading}
                      className={`flex min-h-[92px] items-start gap-3 rounded-xl border p-4 text-left transition ${
                        visibility === "private"
                          ? "border-chime-gold bg-chime-selected"
                          : "border-stone-200 hover:bg-chime-selected"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          visibility === "private"
                            ? "bg-chime-gold text-chime-text"
                            : "bg-chime-chat text-chime-secondary"
                        }`}
                      >
                        <Lock size={18} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-chime-text">
                          Private
                        </p>

                        <p className="mt-1 text-xs leading-5 text-chime-secondary">
                          Join only with an invite.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-5">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex min-w-[128px] items-center justify-center rounded-xl bg-chime-gold px-5 py-2.5 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create Cluster"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5 p-6">
                <div>
                  <h3 className="text-base font-bold text-chime-text">
                    Join a Cluster
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-chime-secondary">
                    Use an invite code or discover a public community.
                  </p>
                </div>

                <section className="rounded-xl border border-stone-200 bg-chime-chat p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-text">
                      {requestSent ? <Check size={18} /> : <Lock size={18} />}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-chime-text">
                        {requestSent ? "Request sent" : "Have an invite?"}
                      </h4>

                      <p className="mt-1 text-xs leading-5 text-chime-secondary">
                        {requestSent
                          ? "Your request has been sent to the Cluster owner. You'll join once they approve it."
                          : "Enter the code shared by a Cluster owner or member."}
                      </p>
                    </div>
                  </div>

                  {!requestSent && (
                    <form onSubmit={handleJoin} className="mt-5">
                      <label
                        htmlFor="cluster-invite-code"
                        className="mb-2 block text-sm font-semibold text-chime-text"
                      >
                        Invite code
                      </label>

                      <div className="flex gap-2.5">
                        <input
                          id="cluster-invite-code"
                          type="text"
                          value={inviteCode}
                          onChange={(event) =>
                            setInviteCode(event.target.value.toUpperCase())
                          }
                          maxLength={10}
                          placeholder="Enter invite code"
                          className="h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-chime-background px-4 text-sm font-mono text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/10"
                          disabled={joining}
                          autoFocus
                        />

                        <button
                          type="submit"
                          disabled={joining}
                          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-chime-gold px-5 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {joining ? "Sending..." : "Request to Join"}
                          {!joining && <ArrowRight size={16} />}
                        </button>
                      </div>
                    </form>
                  )}
                </section>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-stone-200" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-chime-secondary">
                    Or
                  </span>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                <section className="rounded-xl border border-stone-200 bg-chime-background p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-gold text-chime-text">
                      <Compass size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-chime-text">
                        Discover public Clusters
                      </h4>

                      <p className="mt-1 text-xs leading-5 text-chime-secondary">
                        Browse public communities and find conversations that
                        interest you.
                      </p>

                      <button
                        type="button"
                        onClick={handleDiscover}
                        disabled={isBusy || requestSent}
                        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-chime-chat px-4 text-sm font-semibold text-chime-text transition hover:border-chime-gold hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Discover Clusters
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </section>

                <div className="flex items-start gap-2.5 rounded-xl bg-chime-chat px-4 py-3">
                  <Users
                    size={16}
                    className="mt-0.5 shrink-0 text-chime-secondary"
                  />

                  <p className="text-xs leading-5 text-chime-secondary">
                    Public Clusters can be discovered by everyone. Private
                    Clusters require an invite code and owner approval.
                  </p>
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">
                    {error}
                  </p>
                )}

                <div className="flex justify-end border-t border-stone-200 pt-5">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={joining}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-6">
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
                className="flex h-9 w-9 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
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
                  className="rounded-xl border border-stone-200 bg-chime-chat px-4 py-2.5 text-sm font-bold text-chime-text transition hover:bg-chime-selected"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSavePicture}
                  disabled={!croppedAreaPixels}
                  className="rounded-xl bg-chime-gold px-4 py-2.5 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Use Picture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CreateClusterModal;

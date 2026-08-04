import { useState } from "react";

function Register() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      setMessage(data.message);
    } catch (error) {
      console.error("Registration failed:", error);
      setMessage("Something went wrong");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-chime-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-chime-text">
          Create your Chime account
        </h1>

        <p className="mt-2 text-chime-secondary">
          Join Chime and start connecting.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-chime-text">
              Username
            </label>

            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-chime-gold"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-chime-text">
              Email
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-chime-gold"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-chime-text">
              Password
            </label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-chime-gold"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-chime-gold px-4 py-2.5 font-bold text-chime-text hover:opacity-90"
          >
            Create Account
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm font-semibold text-chime-text">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default Register;

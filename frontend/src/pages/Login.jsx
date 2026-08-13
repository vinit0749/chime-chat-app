import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(location.state?.message || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        setIsLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/app", { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect to server.");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-chime-chat px-4 py-8 sm:px-6">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-chime-background p-6 shadow-sm sm:p-8">
        {/* Brand */}
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-chime-gold text-2xl shadow-sm transition hover:bg-chime-bright"
          >
            🔔
          </Link>

          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-chime-text">
            Welcome back
          </h1>

          <p className="mt-2 text-sm leading-6 text-chime-secondary">
            Log in to continue chatting on Chime.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-chime-text"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-chime-chat px-4 py-3 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/20"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-chime-text"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-chime-chat px-4 py-3 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/20"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-chime-gold px-5 py-3.5 font-bold text-chime-text transition hover:bg-chime-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {/* Message */}
        {message && (
          <p className="mt-5 rounded-xl bg-chime-gold/10 px-4 py-3 text-center text-sm text-chime-text">
            {message}
          </p>
        )}

        {/* Register */}
        <p className="mt-7 text-center text-sm text-chime-secondary">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-chime-text transition hover:text-chime-gold"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

export default Login;

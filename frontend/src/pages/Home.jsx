import { Link } from "react-router-dom";

function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-chime-background px-6 py-12">
      <div className="w-full max-w-2xl text-center">
        {/* Brand */}
        <div className="mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-chime-gold text-4xl shadow-sm">
            🔔
          </div>

          <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-chime-text sm:text-6xl">
            Chime
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-chime-secondary sm:text-xl">
            A warm, simple place to talk, connect, and share moments with your
            people.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/register"
            className="w-full rounded-2xl bg-chime-gold px-8 py-3.5 font-bold text-chime-text shadow-sm transition hover:bg-chime-bright hover:shadow-md sm:w-auto"
          >
            Get Started
          </Link>

          <Link
            to="/login"
            className="w-full rounded-2xl border border-stone-200 bg-chime-background px-8 py-3.5 font-semibold text-chime-text transition hover:border-chime-gold hover:bg-chime-chat sm:w-auto"
          >
            I already have an account
          </Link>
        </div>

        {/* Small brand statement */}
        <p className="mt-10 text-sm text-chime-secondary">
          Connect. Talk. Belong.
        </p>
      </div>
    </main>
  );
}

export default Home;

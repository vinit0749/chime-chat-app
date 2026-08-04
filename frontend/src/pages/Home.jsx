function Home() {
  return (
    <div className="min-h-screen bg-chime-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-chime-text">Chime 🔔</h1>

        <p className="mt-4 text-lg text-chime-secondary">
          A friendly place to connect and chat.
        </p>

        <button className="mt-6 rounded-lg bg-chime-gold px-6 py-3 font-semibold text-chime-text hover:bg-chime-bright">
          Get Started
        </button>
      </div>
    </div>
  );
}

export default Home;

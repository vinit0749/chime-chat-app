import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

function OAuthSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const userParam = searchParams.get("user");

    if (!token || !userParam) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const user = JSON.parse(userParam);

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/app", { replace: true });
    } catch (error) {
      console.error("OAuth success error:", error);
      navigate("/login", { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-chime-chat">
      <p className="text-sm font-medium text-chime-secondary">
        Signing you in...
      </p>
    </main>
  );
}

export default OAuthSuccess;

import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "../features/auth/pages/Login";
import Register from "../features/auth/pages/Register";
import ChimeLayout from "./layouts/ChimeLayout";
import OAuthSuccess from "./pages/OAuthSuccess";

import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import PublicRoute from "../features/auth/components/PublicRoute";
import { PresenceProvider } from "../shared/context/PresenceContext";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/oauth-success" element={<OAuthSuccess />} />

        {/* Routes for logged-out users */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Routes for logged-in users */}
        <Route
          element={
            <PresenceProvider>
              <ProtectedRoute />
            </PresenceProvider>
          }
        >
          <Route path="/app" element={<ChimeLayout />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

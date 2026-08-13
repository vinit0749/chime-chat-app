import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChimeLayout from "./layouts/ChimeLayout";

import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Routes for logged-out users */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Routes for logged-in users */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<ChimeLayout />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

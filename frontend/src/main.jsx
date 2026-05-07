import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";

// Auth guard — redirects to login if not authenticated
function ProtectedRoute({ children }) {
  const session = JSON.parse(localStorage.getItem("anpa_session") || "{}");
  if (!session.loggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Guest guard — redirects to home if already logged in
function GuestRoute({ children }) {
  const session = JSON.parse(localStorage.getItem("anpa_session") || "{}");
  if (session.loggedIn) {
    return <Navigate to="/" replace />;
  }
  return children;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);

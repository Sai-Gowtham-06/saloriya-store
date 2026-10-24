import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import StorefrontPage from "./pages/StorefrontPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StorefrontPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin.html" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

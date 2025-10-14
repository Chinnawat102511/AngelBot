import React from "react";
import { clearAuth, getAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import LicensePanel from "../components/LicensePanel";

export default function Admin() {
  const nav = useNavigate();
  const auth = getAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">AngelBot — Admin</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Admin: {auth?.username}</span>
            <button
              className="rounded bg-slate-600 px-3 py-1.5 text-white"
              onClick={() => {
                clearAuth();
                nav("/login");
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow">
          <LicensePanel />
        </div>
      </div>
    </div>
  );
}

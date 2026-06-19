"use client";

// ============================================================
// ChangePasswordForm — update the app login password
// ============================================================

import { useState } from "react";
import { Check, AlertCircle, Lock } from "lucide-react";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to change password");
    } else {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setLoading(false);
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 bg-violet/15 rounded-xl flex items-center justify-center flex-shrink-0">
          <Lock size={16} className="text-violet-light" />
        </div>
        <div>
          <p className="font-display font-medium text-text-primary">Change Password</p>
          <p className="text-text-muted text-xs">Update your dashboard login password</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3 max-w-sm">
        <div>
          <label className="label">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="input"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="input"
            required
            minLength={6}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-fin-dim text-rose-fin text-xs px-3 py-2.5 rounded-lg animate-fade-in">
            <AlertCircle size={13} className="flex-shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-fin-dim text-emerald-fin text-xs px-3 py-2.5 rounded-lg animate-fade-in">
            <Check size={13} className="flex-shrink-0" /> Password updated successfully
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

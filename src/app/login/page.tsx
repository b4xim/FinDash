"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, TrendingUp, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/overview");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen login-bg grid-texture flex items-center justify-center p-4">

      {/* Background glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-gold/8 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
      </div>

      {/* Login card */}
      <div className={`w-full max-w-md animate-slide-up ${shake ? "animate-shake" : ""}`}>

        {/* Logo + brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-violet rounded-2xl shadow-violet-glow mb-4">
            <TrendingUp size={28} className="text-[#FFFFFF]" />
          </div>
          <h1 className="text-3xl font-display font-semibold text-text-primary tracking-tight">
            FinDash
          </h1>

        </div>

        {/* Card */}
        <div className="gradient-border rounded-2xl p-8 bg-surface shadow-card">

          {/* Heading */}
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} className="text-text-muted" />
            <span className="text-text-muted text-sm font-medium">Secure access</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password field */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your dashboard password"
                  className="input pr-12"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-rose-fin/10 border border-rose-fin/20 rounded-xl px-4 py-3 text-rose-fin text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Verifying...
                </>
              ) : (
                "Open Dashboard"
              )}
            </button>
          </form>


        </div>


      </div>

      {/* Shake animation */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

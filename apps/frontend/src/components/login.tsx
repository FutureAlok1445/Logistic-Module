"use client";
import { useState } from "react";
import { Package, ArrowRight, ShieldCheck } from "lucide-react";
import { useSession } from "./session";
import { post } from "../lib/client";

export function Login() {
  const { login } = useSession();
  const [mode, setMode] = useState<"login" | "forgot" | "reset">(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("reset")
      ? "reset"
      : "login",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login")
        await login(String(f.get("email")), String(f.get("password")));
      if (mode === "forgot") {
        await post("/auth/forgot-password", { email: f.get("email") });
        setMessage(
          "If this employee exists, a recovery link has been emailed.",
        );
      }
      if (mode === "reset") {
        await post("/auth/reset-password", {
          token: new URLSearchParams(window.location.search).get("reset"),
          password: f.get("password"),
        });
        window.history.replaceState({}, "", "/login");
        setMode("login");
        setMessage("Password updated. Sign in with your new password.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-screen">
      <section className="login-story">
        <div className="brand">
          <Package size={28} />
          <strong>ELMS</strong>
          <span>IMS Learning Resources</span>
        </div>
        <div>
          <h1>
            Every kit.
            <br />
            Every student.
            <br />
            Every step.
          </h1>
          <p>
            One workspace for the people who keep educational materials moving.
          </p>
        </div>
        <div className="login-route">
          <span>Payment verified</span>
          <span>Kit prepared</span>
          <span>Learning delivered</span>
        </div>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <ShieldCheck size={32} className="accent" />
          <h2>
            {mode === "login"
              ? "Welcome to operations"
              : mode === "forgot"
                ? "Recover your account"
                : "Choose a new password"}
          </h2>
          <p>Employee access only. Use your institute credentials.</p>
          <form onSubmit={submit}>
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={mode === "reset" ? 12 : 1}
                  autoComplete={
                    mode === "reset" ? "new-password" : "current-password"
                  }
                  required
                />
              </label>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="alert success" role="status">
                {message}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "forgot"
                    ? "Send recovery link"
                    : "Update password"}
              <ArrowRight size={17} />
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "login" ? "forgot" : "login");
              setError("");
              setMessage("");
            }}
          >
            {mode === "login" ? "Forgot password?" : "Back to sign in"}
          </button>
          <p className="fine-print">
            Secure employee workspace · India operations
          </p>
        </div>
      </section>
    </main>
  );
}

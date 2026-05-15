"use client";
// components/OTPForm.tsx
import { useState, useRef } from "react";

type Step = "phone" | "otp" | "success";

export default function OTPForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function startCountdown() {
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    if (data.debug_otp) setError(`(Dev) OTP: ${data.debug_otp}`);
    setStep("otp");
    startCountdown();
  }

  function handleOtpChange(i: number, v: string) {
    if (!/^\d?$/.test(v)) return;
    const n = [...otp];
    n[i] = v;
    setOtp(n);
    if (v && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[i] && i > 0)
      inputRefs.current[i - 1]?.focus();
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("6 оронтой код оруулна уу");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      return;
    }
    setStep("success");
  }

  const btn = {
    width: "100%",
    padding: "0.75rem",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    cursor: "pointer" as const,
  };

  return (
    <div
      style={{
        maxWidth: 360,
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {step === "phone" && (
        <form onSubmit={handleSendOTP}>
          <h2 style={{ marginBottom: "1.5rem" }}>Нэвтрэх</h2>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
            Утасны дугаар
          </label>
          <input
            type="tel"
            placeholder="+976 9900 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 8,
              marginBottom: "1rem",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <p
              style={{
                color: "darkorange",
                fontSize: 13,
                marginBottom: "1rem",
              }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ ...btn, background: loading ? "#aaa" : "#0066ff" }}
          >
            {loading ? "Илгээж байна..." : "OTP код авах"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOTP}>
          <h2 style={{ marginBottom: 6 }}>Код оруулах</h2>
          <p style={{ color: "#666", fontSize: 14, marginBottom: "1.5rem" }}>
            {phone} руу 6 оронтой код илгээлээ
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
            {otp.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                autoFocus={i === 0}
                style={{
                  width: 44,
                  height: 52,
                  textAlign: "center",
                  fontSize: 22,
                  fontWeight: 600,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  outline: "none",
                }}
              />
            ))}
          </div>
          {error && (
            <p style={{ color: "red", fontSize: 13, marginBottom: "1rem" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6}
            style={{
              ...btn,
              background: loading ? "#aaa" : "#0066ff",
              marginBottom: 8,
            }}
          >
            {loading ? "Шалгаж байна..." : "Баталгаажуулах"}
          </button>
          <button
            type="button"
            disabled={countdown > 0}
            onClick={() => {
              setOtp(["", "", "", "", "", ""]);
              setError("");
              handleSendOTP({ preventDefault: () => {} } as React.FormEvent);
            }}
            style={{
              ...btn,
              background: "none",
              color: countdown > 0 ? "#aaa" : "#0066ff",
              padding: "0.5rem",
            }}
          >
            {countdown > 0 ? `Дахин авах (${countdown}с)` : "Дахин код авах"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setOtp(["", "", "", "", "", ""]);
              setError("");
            }}
            style={{
              ...btn,
              background: "none",
              color: "#888",
              padding: "0.4rem",
              fontSize: 13,
            }}
          >
            ← Дугаар өөрчлөх
          </button>
        </form>
      )}

      {step === "success" && (
        <div style={{ textAlign: "center", paddingTop: "2rem" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>✅</div>
          <h2>Амжилттай нэвтэрлээ!</h2>
          <p style={{ color: "#666" }}>{phone}</p>
        </div>
      )}
    </div>
  );
}

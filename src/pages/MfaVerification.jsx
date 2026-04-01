import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Mail, RefreshCw, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function MfaVerification({ onVerified }) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    loadUser();
    return () => clearInterval(intervalRef.current);
  }, []);

  const loadUser = async () => {
    const user = await base44.auth.me();
    setUserEmail(user.email);
    // Auto-send the code on page load
    sendCode(user.email);
  };

  const startCountdown = () => {
    setCountdown(60);
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async (email) => {
    setSending(true);
    try {
      await base44.functions.invoke("requestMfaCode", {});
      setCodeSent(true);
      startCountdown();
      toast.success(`Verification code sent to ${email || userEmail}`);
    } catch (error) {
      toast.error("Failed to send verification code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      const res = await base44.functions.invoke("verifyMfaCode", { code });
      if (res.data?.success) {
        // Store MFA session in sessionStorage so it persists for the session
        sessionStorage.setItem("mfa_verified", "true");
        toast.success("Verification successful!");
        onVerified?.();
      } else {
        toast.error(res.data?.error || "Invalid code. Please try again.");
        setCode("");
      }
    } catch (error) {
      toast.error("Verification failed. Please try again.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleVerify();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Two-Factor Authentication</h1>
            <p className="text-indigo-200 text-sm mt-1">Extra security for your account</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-6">
            {/* Email info */}
            <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Code sent to</p>
                <p className="text-sm text-indigo-700 font-semibold">{userEmail}</p>
              </div>
              {codeSent && (
                <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto flex-shrink-0" />
              )}
            </div>

            {/* Code input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Enter verification code</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={handleKeyDown}
                className="text-center text-2xl font-bold tracking-widest h-14 border-2 focus:border-indigo-500"
                autoFocus
              />
              <p className="text-xs text-slate-500 text-center">
                Enter the 6-digit code from your email
              </p>
            </div>

            {/* Verify button */}
            <Button
              onClick={handleVerify}
              disabled={verifying || code.length < 6}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
            >
              {verifying ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Verifying...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Verify & Continue
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </Button>

            {/* Resend */}
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-2">Didn't receive the code?</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sendCode()}
                disabled={sending || countdown > 0}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${sending ? "animate-spin" : ""}`} />
                {countdown > 0 ? `Resend in ${countdown}s` : sending ? "Sending..." : "Resend Code"}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500 mt-4">
          Check your spam folder if you don't see the email
        </p>
      </div>
    </div>
  );
}
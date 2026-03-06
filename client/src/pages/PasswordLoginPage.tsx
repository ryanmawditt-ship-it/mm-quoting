import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Lock, Loader2, AlertCircle } from "lucide-react";
import { useState, useCallback } from "react";

interface PasswordLoginPageProps {
  onLoginSuccess: () => void;
}

export default function PasswordLoginPage({ onLoginSuccess }: PasswordLoginPageProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Incorrect password");
        setLoading(false);
        return;
      }

      if (data.success) {
        onLoginSuccess();
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [password, onLoginSuccess]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <Zap className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">MM Quoting</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Electrical & Data Suppliers — Quoting System
          </p>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Enter Password</CardTitle>
            <CardDescription>
              This site is password protected. Enter the access password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter site password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  autoFocus
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 shadow-md hover:shadow-lg transition-all"
                disabled={loading || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Access Site"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          MM Quoting System — Built for MM Albion
        </p>
      </div>
    </div>
  );
}

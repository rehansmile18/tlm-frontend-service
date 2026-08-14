"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { LanguageSwitcher } from "@/components/app-shell/language-switcher";

export default function LoginPage() {
  const { login, isAuthenticated, isReady } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — don't let a stale bookmark to /login sit in front of the app.
  useEffect(() => {
    if (isReady && isAuthenticated) router.replace("/dashboard");
  }, [isReady, isAuthenticated, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      router.replace("/dashboard");
    } catch {
      setError(t("auth.invalidCredentials"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold">{t("auth.signIn")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("auth.signIn")}</CardTitle>
            <CardDescription>{t("auth.signInSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">{t("auth.identifier")}</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder={t("auth.identifierPlaceholder")}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t("auth.signInButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

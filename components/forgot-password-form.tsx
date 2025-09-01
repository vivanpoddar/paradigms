"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full h-screen items-center justify-center" {...props}>
      <div className="w-full max-w-xl p-6 md:p-10 flex flex-col justify-center">
        <div>
          <img
            src="/logo-dark.svg"
            alt="Login Illustration"
            width={400}
            height={200}
            className="mx-auto mb-4"
          />
        </div>
        {success ? (
          <div className="border rounded-xl p-6 md:p-10 text-center">
            <span className="text-2xl font-semibold block mb-2">Check Your Email</span>
            <span className="block mb-4 text-muted-foreground">Password reset instructions sent</span>
            <p className="text-sm text-muted-foreground">
              If you registered using your email and password, you will receive a password reset email.
            </p>
          </div>
        ) : (
          <form className="border rounded-xl p-6 md:p-10 justify-center" onSubmit={handleForgotPassword}>
            <div className="gap-2 w-full flex flex-col">
              <span className="text-xl mb-2">Reset Your Password</span>
              <div className="gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="mt-4 w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send reset email"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="underline underline-offset-4"
              >
                Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

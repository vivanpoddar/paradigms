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
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-center" {...props}>
      <div className="w-full max-w-xl p-2 sm:p-4 flex flex-col justify-center">
        <div className="mb-4 sm:mb-6">
          <img
            src="/logo-dark.svg"
            alt="Login Illustration"
            width={400}
            height={200}
            className="mx-auto w-full max-w-xs sm:max-w-sm"
          />
        </div>
        <form className="border rounded-xl p-4 sm:p-6 md:p-8 justify-center" onSubmit={handleForgotPassword}>
          <div className="gap-3 sm:gap-4 w-full flex flex-col">
            <span className="text-lg sm:text-xl font-semibold mb-2">Reset Your Password</span>
            <div className="gap-2 space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="New password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-base" // Prevent zoom on iOS
              />
            </div>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <Button type="submit" className="mt-4 w-full py-3" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save new password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

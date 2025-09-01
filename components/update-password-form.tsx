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
        <form className="border rounded-xl p-6 md:p-10 justify-center" onSubmit={handleForgotPassword}>
          <div className="gap-2 w-full flex flex-col">
            <span className="text-xl mb-2">Reset Your Password</span>
            <div className="gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="New password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="mt-4 w-full" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save new password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

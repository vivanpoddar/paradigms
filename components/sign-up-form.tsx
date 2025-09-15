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
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/protected`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
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
            alt="Sign Up Illustration"
            width={400}
            height={200}
            className="mx-auto w-full max-w-xs sm:max-w-sm"
          />
        </div>
        <form className="border rounded-xl p-4 sm:p-6 md:p-8 justify-center" onSubmit={handleSignUp}>
          <div className="gap-3 sm:gap-4 w-full flex flex-col">
            <span className="text-lg sm:text-xl font-semibold">Sign Up</span>
            <div className="gap-2 space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-base" // Prevent zoom on iOS
              />
            </div>
            <div className="gap-2 space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-base" // Prevent zoom on iOS
              />
            </div>
            <div className="gap-2 space-y-2">
              <Label htmlFor="repeat-password">Repeat Password</Label>
              <Input
                id="repeat-password"
                type="password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="text-base" // Prevent zoom on iOS
              />
            </div>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <Button type="submit" className="mt-4 w-full py-3" disabled={isLoading}>
              {isLoading ? "Creating an account..." : "Sign up"}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="underline underline-offset-4 text-blue-600">
              Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

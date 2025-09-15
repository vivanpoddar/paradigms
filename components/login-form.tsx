"use client";

import Image from "next/image";
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

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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
          <Image
            src="/logo-dark.svg"
            alt="Login Illustration"
            width={400}
            height={200}
            className="mx-auto w-full max-w-xs sm:max-w-sm"
          />
        </div>
        <form className="border rounded-xl p-4 sm:p-6 md:p-8 justify-center" onSubmit={handleLogin}>
          <div className="gap-3 sm:gap-4 w-full flex flex-col">
            <span className="text-lg sm:text-xl font-semibold">Login</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="sm:ml-auto inline-block text-sm underline-offset-4 hover:underline text-blue-600"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-base" // Prevent zoom on iOS
              />
            </div>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <Button type="submit" className="mt-4 w-full py-3" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/sign-up"
              className="underline underline-offset-4 text-blue-600"
            >
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

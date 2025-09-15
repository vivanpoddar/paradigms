import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-screen mobile-viewport-fix w-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md sm:max-w-lg">
        <LoginForm />
      </div>
    </div>
  );
}

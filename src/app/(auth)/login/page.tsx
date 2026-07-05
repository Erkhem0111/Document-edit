import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to access your geodetic workspace."
    >
      {/* useSearchParams (callbackUrl) ашигладаг тул Suspense заавал хэрэгтэй */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Системд нэвтрэх"
      description="Terra Line Survey workspace-д ажлын эрхээрээ нэвтэрнэ үү."
    >
      <SignInForm />
    </AuthShell>
  );
}

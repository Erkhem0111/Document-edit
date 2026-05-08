import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Бүртгэл үүсгэх"
      description="TLS дотоод системд нэвтрэх шинэ хэрэглэгчийн мэдээллээ оруулна уу."
    >
      <RegisterForm />
    </AuthShell>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardClient
      initialUser={{
        id: session.user.id ?? "",
        email: session.user.email ?? "",
        nickname: session.user.name ?? null,
        role: session.user.role ?? "ENGINEER",
      }}
    />
  );
}

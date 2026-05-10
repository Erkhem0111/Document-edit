import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/app/login/page";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Terra Line Survey" }] }),
  component: LoginPage,
});

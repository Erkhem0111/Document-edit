import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/app/dashboard/layout";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Workspace — Terra Line Survey" }] }),
  component: DashboardLayout,
});

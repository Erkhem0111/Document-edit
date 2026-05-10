import { createFileRoute } from "@tanstack/react-router";
import { DashboardHomePage } from "@/app/dashboard/page";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHomePage,
});

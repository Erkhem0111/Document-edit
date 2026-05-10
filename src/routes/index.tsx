import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/app/home/page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terra Line Survey — Workspace for Geodetic Engineers" },
      {
        name: "description",
        content:
          "A document workspace built for geodesy: store survey files, maps and reports in one secure place, accessible from any field site.",
      },
    ],
  }),
  component: HomePage,
});

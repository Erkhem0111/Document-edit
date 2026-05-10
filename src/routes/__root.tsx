import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { AppErrorPage, AppLayout, AppNotFoundPage, AppShell } from "@/app/layout";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Terra Line Survey — Geodetic Document Workspace" },
      {
        name: "description",
        content:
          "Secure document workspace for geodetic engineers — store, share, and collaborate on surveys, maps, and reports.",
      },
      { property: "og:title", content: "Terra Line Survey — Geodetic Workspace" },
      {
        property: "og:description",
        content: "A clean, modern document platform built for surveyors and geodetic engineers.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: AppShell,
  component: RootRoute,
  notFoundComponent: AppNotFoundPage,
  errorComponent: AppErrorPage,
});

function RootRoute() {
  const { queryClient } = Route.useRouteContext();
  return <AppLayout queryClient={queryClient} />;
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { FolderNotFoundPage, FolderPage } from "@/app/dashboard/folder/page";
import { getFolder } from "@/lib/folders-store";

export const Route = createFileRoute("/dashboard/folder/$id")({
  component: FolderRoute,
  notFoundComponent: FolderNotFoundPage,
  loader: ({ params }) => {
    const folder = getFolder(params.id);
    if (!folder) throw notFound();
    return { folderId: params.id };
  },
});

function FolderRoute() {
  const { folderId } = Route.useLoaderData();
  return <FolderPage folderId={folderId} />;
}

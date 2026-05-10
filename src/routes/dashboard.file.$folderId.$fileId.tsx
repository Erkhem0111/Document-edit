import { createFileRoute, notFound } from "@tanstack/react-router";
import { FilePage } from "@/app/dashboard/file/page";
import { getFile } from "@/lib/folders-store";

export const Route = createFileRoute("/dashboard/file/$folderId/$fileId")({
  component: FileRoute,
  loader: ({ params }) => {
    const file = getFile(params.folderId, params.fileId);
    if (!file) throw notFound();
    return { folderId: params.folderId, fileId: params.fileId };
  },
});

function FileRoute() {
  const { folderId, fileId } = Route.useLoaderData();
  return <FilePage folderId={folderId} fileId={fileId} />;
}

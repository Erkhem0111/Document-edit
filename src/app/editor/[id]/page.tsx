import { auth } from "@/auth";
import { LiveblocksRoom } from "@/components/editor/liveblocks-room";
import { CollaborativeEditor } from "@/components/editor/collaborative-editor";
import { canAccessFile } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const file = await prisma.projectFile.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      uploaderId: true,
      viewerIds: true,
      editorIds: true,
    },
  });

  if (!file || !canAccessFile(file, { id: session.user.id ?? "", role: session.user.role })) {
    redirect("/dashboard");
  }

  return (
    <main className="flex h-screen min-w-0 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-[#d8dee4] bg-white px-4">
        <div>
          <p className="text-sm font-semibold text-[#1f2933]">Document Editor</p>
          <p className="text-xs text-[#6b7280]">{file.name}</p>
        </div>
      </header>
      <LiveblocksRoom fileId={id}>
        <CollaborativeEditor fileId={id} />
      </LiveblocksRoom>
    </main>
  );
}

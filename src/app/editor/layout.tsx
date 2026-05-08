import { FileExplorerSidebar } from "@/components/file-explorer/file-explorer-sidebar";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#eef2f5]">
      <FileExplorerSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

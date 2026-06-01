import { CollaborativeEditor } from "../collaborative-editor";
import { LiveblocksProviderWrapper, LiveblocksRoom } from "../liveblocks-room";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <LiveblocksProviderWrapper>
      <LiveblocksRoom fileId={id}>
        <CollaborativeEditor fileId={id} />
      </LiveblocksRoom>
    </LiveblocksProviderWrapper>
  );
}

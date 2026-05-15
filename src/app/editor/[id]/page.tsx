import { CollaborativeEditor } from "../collaborative-editor";
import {
  LiveblocksProviderWrapper,
  LiveblocksRoom,
} from "../liveblocks-room";

export default async function EditorPage(props: PageProps<"/editor/[id]">) {
  const { id } = await props.params;

  return (
    <LiveblocksProviderWrapper>
      <LiveblocksRoom fileId={id}>
        <CollaborativeEditor fileId={id} />
      </LiveblocksRoom>
    </LiveblocksProviderWrapper>
  );
}

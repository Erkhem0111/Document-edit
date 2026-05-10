"use client";

import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import type { ReactNode } from "react";

export function LiveblocksRoom({
  fileId,
  children,
}: {
  fileId: string;
  children: ReactNode;
}) {
  return (
    <RoomProvider id={`file:${fileId}`} initialPresence={{ cursor: null }}>
      {children}
    </RoomProvider>
  );
}

export function LiveblocksProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      {children}
    </LiveblocksProvider>
  );
}

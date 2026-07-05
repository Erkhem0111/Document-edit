"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MessageSquare,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { ApiUserSummary } from "@/types/domain";

// Comment API-ийн буцаадаг бүтэц (GET /api/files/[fileId]/comments)
export type ApiComment = {
  id: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  user: ApiUserSummary;
  replies?: ApiComment[];
};

function displayName(user?: ApiUserSummary) {
  return user?.nickname || user?.email || "?";
}

function initials(user?: ApiUserSummary) {
  return displayName(user).slice(0, 2).toUpperCase();
}

// ─── Google Docs маягийн баруун талын comment panel ──────────────────────────
export function CommentsPanel({
  fileId,
  currentUserId,
  canModerate,
  onClose,
}: {
  fileId: string;
  currentUserId: string;
  canModerate: boolean; // owner/admin — бусдын comment устгаж чадна
  onClose: () => void;
}) {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/${fileId}/comments`);
      const data = (await res.json().catch(() => null)) as
        | { comments?: ApiComment[]; message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Comment уншиж чадсангүй.");
      setComments(data?.comments ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(content: string, parentId?: string) {
    const trimmed = content.trim();
    if (!trimmed) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/files/${fileId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, parentId: parentId ?? null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Comment илгээж чадсангүй.");
      }
      await load();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function edit(commentId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) return false;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Засаж чадсангүй.");
      }
      await load();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
      return false;
    }
  }

  async function remove(commentId: string) {
    const ok = window.confirm("Энэ comment-ийг устгах уу?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Устгаж чадсангүй.");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    }
  }

  async function submitNew() {
    if (await submit(draft)) setDraft("");
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card xl:w-80">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare className="size-4 text-teal" />
        <span className="text-sm font-medium">Comments</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Шинэ comment бичих хэсэг */}
      <div className="border-b border-border p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Comment бичих… (Enter = илгээх)"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-teal"
          onKeyDown={(e) => {
            // Enter = илгээх, Shift+Enter = шинэ мөр (стандарт)
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitNew();
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground"
            disabled={busy || !draft.trim()}
            onClick={submitNew}
          >
            {busy ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 size-3.5" />
            )}
            Comment
          </Button>
        </div>
      </div>

      {/* Comment-уудын жагсаалт */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Loading…
          </p>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Comment алга. Анхных нь болоорой!
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                canModerate={canModerate}
                busy={busy}
                onReply={(content) => submit(content, comment.id)}
                onEdit={edit}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function CommentThread({
  comment,
  currentUserId,
  canModerate,
  busy,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: ApiComment;
  currentUserId: string;
  canModerate: boolean;
  busy: boolean;
  onReply: (content: string) => Promise<boolean>;
  onEdit: (commentId: string, content: string) => Promise<boolean>;
  onDelete: (commentId: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");

  async function submitReply() {
    if (await onReply(replyDraft)) {
      setReplyDraft("");
      setReplying(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <CommentBody
        comment={comment}
        currentUserId={currentUserId}
        canModerate={canModerate}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {/* Хариунууд */}
      {(comment.replies?.length ?? 0) > 0 && (
        <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
          {comment.replies!.map((reply) => (
            <CommentBody
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              canModerate={canModerate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Reply бичих */}
      {replying ? (
        <div className="mt-2">
          <textarea
            autoFocus
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="Хариу бичих… (Enter = илгээх)"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none focus:border-teal"
            onKeyDown={(e) => {
              // Enter = илгээх, Shift+Enter = шинэ мөр (стандарт)
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitReply();
              }
            }}
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReplying(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 bg-primary text-xs text-primary-foreground"
              disabled={busy || !replyDraft.trim()}
              onClick={submitReply}
            >
              Reply
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-teal"
          onClick={() => setReplying(true)}
        >
          <Reply className="size-3" /> Reply
        </button>
      )}
    </div>
  );
}

function CommentBody({
  comment,
  currentUserId,
  canModerate,
  onEdit,
  onDelete,
}: {
  comment: ApiComment;
  currentUserId: string;
  canModerate: boolean;
  onEdit: (commentId: string, content: string) => Promise<boolean>;
  onDelete: (commentId: string) => void;
}) {
  const isMine = comment.user?.id === currentUserId;
  const canDelete = canModerate || isMine;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);

  async function save() {
    if (await onEdit(comment.id, draft)) setEditing(false);
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-accent-foreground">
          {initials(comment.user)}
        </div>
        <span className="truncate text-xs font-medium text-foreground">
          {displayName(comment.user)}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {format(new Date(comment.createdAt), "MMM d, HH:mm")}
          {comment.isEdited && " · edited"}
        </span>
        <span className="ml-auto hidden items-center gap-1.5 group-hover:flex">
          {isMine && !editing && (
            <button
              type="button"
              title="Засах"
              className="text-muted-foreground hover:text-teal"
              onClick={() => {
                setDraft(comment.content);
                setEditing(true);
              }}
            >
              <Pencil className="size-3" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              title="Устгах"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(comment.id)}
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-1 pl-8">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none focus:border-teal"
            onKeyDown={(e) => {
              // Enter = хадгалах, Shift+Enter = шинэ мөр, Escape = болих
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void save();
              }
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <div className="mt-1 flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 bg-primary text-[11px] text-primary-foreground"
              disabled={!draft.trim()}
              onClick={save}
            >
              Хадгалах
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap pl-8 text-xs leading-relaxed text-foreground">
          {comment.content}
        </p>
      )}
    </div>
  );
}

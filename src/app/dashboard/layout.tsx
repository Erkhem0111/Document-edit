"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { ClipboardList, LayoutGrid, LogOut, Menu, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { WorkspaceSkeleton } from "@/components/skeletons";
import { ProfileDialog } from "@/components/profile-dialog";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { NewMenu } from "@/components/shell/new-menu";
import { SidebarTree } from "@/components/shell/sidebar-tree";
import { StorageWidget } from "@/components/shell/storage-widget";
import { TopSearch } from "@/components/shell/top-search";
import { cn } from "@/lib/utils";

// ─── Dashboard-ын хүрээ ───────────────────────────────────────────────────────
// Зүүн: лого, "＋ Шинэ", даалгавар, folder мод, хадгалах сан, хэрэглэгч.
// Баруун: дээд талд хайлт, доор нь хуудасны агуулга. (Баруун талын тусдаа
// panel байхгүй — хэрэгтэй мэдээлэл нь зүүн тал руу нэгдсэн.)

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Утсан дээр: хуудас солигдоход цэсийг хаана
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    // Session cookie байгаа ч DB-д хэрэглэгч байхгүй (устгагдсан/хаагдсан)
    // тохиолдолд router.push("/login") хийвэл proxy буцаагаад dashboard руу
    // үсэргэж мөнхийн эргэлт үүснэ — тиймээс cookie-г нь цэвэрлэж гаргана.
    if (!loading && !user) void signOut({ callbackUrl: "/login" });
  }, [loading, user]);

  if (loading || !user) return <WorkspaceSkeleton />;

  const sidebar = (
    <>
      <div className="flex items-center px-4 pb-3 pt-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-card">
            <Image
              src="/logo1.png"
              alt="Terra Line Survey"
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <div className="text-sm font-medium text-sidebar-foreground">Terra Line</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
              Workspace
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          title="Хаах"
          className="ml-auto rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <Suspense fallback={null}>
          <NewMenu
            onNewProject={() => {
              setDrawerOpen(false);
              setNewProjectOpen(true);
            }}
          />
        </Suspense>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <NavLink href="/dashboard/tasks" label="Даалгавар" icon={ClipboardList} />
        <NavLink href="/dashboard/tools" label="Хэрэгслүүд" icon={LayoutGrid} />
        {user.role === "ADMIN" && (
          <NavLink href="/dashboard/admin" label="Хэрэглэгчид" icon={ShieldCheck} />
        )}
        <div className="mb-1 mt-4 px-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/45">
          Folders
        </div>
        <Suspense fallback={null}>
          <SidebarTree />
        </Suspense>
      </nav>

      <div className="border-t border-sidebar-border px-2 py-2">
        <StorageWidget />
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            title="Профайл засах"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 text-left hover:bg-sidebar-accent/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm text-sidebar-foreground">
              {(user.name || user.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-sidebar-foreground">
                {user.name || user.email}
              </div>
              <div className="text-[10px] text-sidebar-foreground/50">Профайл</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            title="Гарах"
            className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="grid h-dvh overflow-hidden bg-background md:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden min-h-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        {sidebar}
      </aside>

      {/* Утасны drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-col">
        {/* Дээд мөр — хайлт (утсан дээр цэсний товчтой) */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-2.5 md:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            title="Цэс"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <TopSearch />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  );
}

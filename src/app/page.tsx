"use client";

import { useState } from "react";
import {
  Activity,
  BarChart2,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  FolderOpen,
  Home,
  LogOut,
  Mail,
  MoreHorizontal,
  PanelLeftClose,
  Pin,
  Settings,
  Share2,
  Search,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

interface Project {
  id: string;
  name: string;
  noteCount: number;
  sizeMB: number;
}

interface StorageInfo {
  documents: { usedGB: number; totalGB: number };
  images: { usedMB: number; totalMB: number };
}

interface InfoPanelData {
  sizeMB: number;
  created: string;
  lastModified: string;
  tags: string[];
  storage: StorageInfo;
}

const NAV_ITEMS = [
  { icon: Home, label: "Home" },
  { icon: FolderOpen, label: "Projects" },
  { icon: FileText, label: "Notes" },
  { icon: BarChart2, label: "Reports" },
  { icon: Mail, label: "Emails" },
  { icon: Zap, label: "Automation" },
];

const TAG_COLORS: Record<string, string> = {
  Sales: "bg-blue-100 text-blue-700 border-blue-200",
  Marketing: "bg-gray-100 text-gray-600 border-gray-200",
  Analytics: "bg-red-100 text-red-600 border-red-200",
};

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function filterProjects(projects: Project[], query: string): Project[] {
  const q = query.toLowerCase().trim();
  if (!q) return projects;
  return projects.filter((p) => p.name.toLowerCase().includes(q));
}

function SidebarNav({
  activeNav,
  onNavClick,
  notifications,
  user,
}: {
  activeNav: string;
  onNavClick: (label: string) => void;
  notifications: number;
  user: { name: string; email: string };
}) {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-gray-100 bg-white lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">K</span>
        </div>
        <span className="font-semibold text-gray-900 text-base">Kintsugi</span>
        <PanelLeftClose className="ml-auto w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ icon: Icon, label }) => (
          <NavItem
            key={label}
            icon={Icon}
            label={label}
            active={activeNav === label}
            onClick={() => onNavClick(label)}
          />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-4 space-y-0.5">
        <NavItem
          icon={Settings}
          label="Settings"
          active={false}
          onClick={() => {}}
        />
        <NotificationItem count={notifications} />
        <Separator className="my-2" />
        <UserAvatar user={user} />
      </div>
    </aside>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-gray-100 text-gray-900"
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function NotificationItem({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500">
      <Bell className="w-4 h-4" />
      <span className="font-medium">Notifications</span>
      {count > 0 && (
        <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
          {count}
        </span>
      )}
    </div>
  );
}

function UserAvatar({ user }: { user: { name: string; email: string } }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center shrink-0">
        <span className="text-white text-xs font-semibold">{user.name[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {user.name}
        </p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
      </div>
      <LogOut className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600 shrink-0" />
    </div>
  );
}

function ProjectCard({
  project,
  selected,
  onSelect,
}: {
  project: Project;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group relative text-left transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Folder tab */}
      <div
        className={cn(
          "absolute -top-2 left-4 w-16 h-4 rounded-t-md z-10",
          selected ? "bg-blue-300" : "bg-gray-200",
        )}
      />

      {/* Main folder */}
      <div
        className={cn(
          "relative flex min-h-40 flex-col gap-6 rounded-lg border p-5 pt-6 transition-all duration-300",

          selected
            ? "border-blue-300 bg-blue-50 text-blue-950 shadow-sm ring-1 ring-blue-200"
            : "border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:shadow-md",
        )}
      >
        {/* Folder icon */}
        <div className="relative w-12 h-10">
          <div
            className={cn(
              "absolute inset-0 rounded-md",
              selected ? "bg-blue-100" : "bg-gray-200",
            )}
          />
          <div
            className={cn(
              "absolute top-0 left-1 w-6 h-2 rounded-sm",
              selected ? "bg-blue-200" : "bg-gray-300",
            )}
          />
        </div>

        {/* Content */}
        <div>
          <p
            className={cn(
              "font-medium text-sm tracking-tight",
              selected ? "text-blue-950" : "text-gray-800",
            )}
          >
            {project.name}
          </p>

          <p
            className={cn(
              "text-[11px] mt-0.5",
              selected ? "text-blue-700" : "text-gray-400",
            )}
          >
            {project.noteCount} notes
          </p>

          <p
            className={cn(
              "text-[11px] mt-3 font-medium",
              selected ? "text-blue-600" : "text-gray-300",
            )}
          >
            {formatSize(project.sizeMB)}
          </p>
        </div>
      </div>
    </button>
  );
}

function StorageBar({
  used,
  total,
  color,
}: {
  used: number;
  total: number;
  color: string;
}) {
  const pct = Math.min((used / total) * 100, 100);
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function InfoPanel({
  data,
  onClose,
}: {
  data: InfoPanelData;
  onClose: () => void;
}) {
  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l border-gray-100 bg-white xl:flex">
      <div className="flex items-center justify-between px-5 py-5">
        <span className="font-semibold text-gray-900 text-sm">Info</span>
        <button onClick={onClose}>
          <ChevronRight className="w-4 h-4 text-gray-400 hover:text-gray-600" />
        </button>
      </div>

      <div className="px-4 space-y-4 flex-1 overflow-y-auto">
        {/* Documents storage */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Documents</span>
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {data.storage.documents.usedGB} GB
          </p>
          <StorageBar
            used={data.storage.documents.usedGB}
            total={data.storage.documents.totalGB}
            color="bg-blue-500"
          />
        </div>

        {/* Images storage */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Images</span>
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {data.storage.images.usedMB} MB
          </p>
          <StorageBar
            used={data.storage.images.usedMB}
            total={data.storage.images.totalMB}
            color="bg-red-400"
          />
        </div>

        {/* Properties */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Properties</p>
          <div className="space-y-1.5">
            <PropertyRow label="Size" value={formatSize(data.sizeMB)} />
            <PropertyRow label="Created" value={data.created} />
            <PropertyRow label="Last modification" value={data.lastModified} />
          </div>
        </div>

        {/* Tags */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full border font-medium",
                  TAG_COLORS[tag] ??
                    "bg-gray-100 text-gray-600 border-gray-200",
                )}
              >
                • {tag}
              </span>
            ))}
          </div>
        </div>

        <Separator />

        {/* Pinned / Activity */}
        <div className="space-y-1">
          <button className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 py-1">
            <Pin className="w-3.5 h-3.5" /> Pinned items
          </button>
          <button className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 py-1">
            <Activity className="w-3.5 h-3.5" /> Activity
          </button>
        </div>
      </div>
    </aside>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-700">{value}</span>
    </div>
  );
}

const MOCK_PROJECTS: Project[] = [
  { id: "1", name: "UX research", noteCount: 233, sizeMB: 116.9 },
  { id: "2", name: "Raw data", noteCount: 39, sizeMB: 180.2 },
  { id: "3", name: "Processed data", noteCount: 21, sizeMB: 23.4 },
  { id: "4", name: "Reports", noteCount: 17, sizeMB: 490 },
  { id: "5", name: "Data visualization", noteCount: 96, sizeMB: 1331.2 },
  { id: "6", name: "Ideas and Insights", noteCount: 103, sizeMB: 126.3 },
];

const INFO_PANEL_DATA: InfoPanelData = {
  sizeMB: 180.2,
  created: "12/03/2024",
  lastModified: "06/12/2024",
  tags: ["Sales", "Marketing", "Analytics"],
  storage: {
    documents: { usedGB: 48.5, totalGB: 100 },
    images: { usedMB: 182.4, totalMB: 500 },
  },
};

export default function ProjectGrid() {
  const [activeNav, setActiveNav] = useState("Projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("2");
  const [showInfo, setShowInfo] = useState(true);

  const visibleProjects = filterProjects(MOCK_PROJECTS, searchQuery);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans lg:h-screen lg:overflow-hidden">
      <SidebarNav
        activeNav={activeNav}
        onNavClick={setActiveNav}
        notifications={10}
        user={{ name: "Sophia Lane", email: "sophial@gmail.com" }}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
          <ChevronLeft className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-400">
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Projects</span>
            <ChevronRight className="w-3 h-3" />
            <FolderOpen className="w-4 h-4" />
            <span className="truncate">Ikigai Labs</span>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" className="text-gray-500 gap-1.5">
              <Settings className="w-4 h-4" /> Manage
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-gray-500 gap-1.5 sm:inline-flex"
            >
              <Share2 className="w-4 h-4" /> Share
            </Button>
            <MoreHorizontal className="w-4 h-4 text-gray-400 cursor-pointer" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900">Ikigai Labs</h1>
              <Button
                size="sm"
                className="bg-gray-900 hover:bg-gray-800 text-white text-xs rounded-lg px-4"
              >
                New draft
              </Button>
            </div>

            {/* Search + Filter */}
            <div className="mb-5 flex items-center gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm bg-gray-50 border-gray-200 rounded-lg"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5 border-gray-200"
              >
                <Filter className="w-3.5 h-3.5" /> Filter
              </Button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  selected={selectedId === project.id}
                  onSelect={() => setSelectedId(project.id)}
                />
              ))}
            </div>
            {visibleProjects.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
                Илэрц олдсонгүй.
              </div>
            )}
          </div>

          {/* Info panel */}
          {showInfo && (
            <InfoPanel
              data={INFO_PANEL_DATA}
              onClose={() => setShowInfo(false)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

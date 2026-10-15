"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIRECT_WORKSPACE_KEYS, VISIBILITY_FOLDERS, getProjectFolderKey } from "@/lib/folders";
import type { ApiProject } from "@/types/domain";

// Төсөл сонгох select — Миний файлууд / Төслүүд / Компанийн сан гэж бүлэглэнэ.
// Бүлэгт ганц ажлын орчин байвал (sidebar-тай адил) төслийн нэрийн оронд
// бүлгийн нэрийг харуулна ("Private" биш "Миний файлууд").
export function ProjectSelect({
  projects,
  value,
  onChange,
  currentProjectId,
  placeholder = "Сонгох",
}: {
  projects: ApiProject[];
  value: string;
  onChange: (projectId: string) => void;
  currentProjectId?: string;
  placeholder?: string;
}) {
  const groups = VISIBILITY_FOLDERS.map((folder) => {
    const items = projects.filter((p) => getProjectFolderKey(p) === folder.key);
    const single = DIRECT_WORKSPACE_KEYS.includes(folder.key) && items.length === 1;
    return {
      folder,
      items: items.map((p) => ({ project: p, label: single ? folder.label : p.name })),
    };
  }).filter((g) => g.items.length > 0);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="mt-1.5 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map(({ folder, items }) => {
          const Icon = folder.icon;
          return (
            <SelectGroup key={folder.key}>
              <SelectLabel className="flex items-center gap-1.5">
                <Icon className="size-3.5" style={{ color: folder.color }} />
                {folder.label}
              </SelectLabel>
              {items.map(({ project, label }) => (
                <SelectItem key={project.id} value={project.id} className="pl-7">
                  {label}
                  {project.id === currentProjectId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">· одоогийнх</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

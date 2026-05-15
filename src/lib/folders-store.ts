"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FOLDERS } from "@/app/mock-data";
import type { FileItem, Folder } from "@/types/domain";

const KEY = "tls-folders-v1";

function load(): Folder[] {
  if (typeof window === "undefined") return DEFAULT_FOLDERS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Folder[];
  } catch {
    return DEFAULT_FOLDERS;
  }
  return DEFAULT_FOLDERS;
}

let listeners: Array<() => void> = [];
let cache: Folder[] | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function getFolders(): Folder[] {
  if (cache === null) cache = load();
  return cache;
}

export function setFolders(next: Folder[]) {
  cache = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

export function addFolder(folder: Folder) {
  setFolders([...getFolders(), folder]);
}

export function getFolder(id: string): Folder | undefined {
  return getFolders().find((folder) => folder.id === id);
}

export function getFile(folderId: string, fileId: string): FileItem | undefined {
  return getFolder(folderId)?.files.find((file) => file.id === fileId);
}

export function useFolders(): Folder[] {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((version) => version + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((item) => item !== listener);
    };
  }, []);

  return getFolders();
}

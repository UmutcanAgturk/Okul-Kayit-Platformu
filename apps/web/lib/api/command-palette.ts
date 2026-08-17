import { apiFetch } from "./client";

export interface CommandPaletteStudentHit {
  id: string;
  name: string;
  studentNo: string;
}

export interface CommandPaletteStaffHit {
  id: string;
  name: string;
  title: string | null;
}

export interface CommandPaletteInstitutionHit {
  id: string;
  name: string;
  city: string;
}

export interface CommandPaletteSearchResult {
  students: CommandPaletteStudentHit[];
  staff: CommandPaletteStaffHit[];
  institutions: CommandPaletteInstitutionHit[];
}

export function searchCommandPalette(q: string) {
  return apiFetch<CommandPaletteSearchResult>(`/api/command-palette-search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
}

"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTeachers } from "@/lib/api/teachers";
import { Icon } from "@/components/ui/icons";

/**
 * Sınıflarım / Etüt Onayı / Sınıf Röntgeni gibi öğretmenin KENDİ kimliğine
 * bağlı self-servis ekranlarda, Genel Merkez'in (HqBranchSelector ile şube
 * seçtikten sonra) hangi öğretmen "gibi" görüntüleyeceğini seçmesini sağlar
 * (bkz. lib/hq-teacher.ts'teki backend karşılığı, ?asTeacherId=). Seçim yoksa
 * şubedeki ilk öğretmen otomatik seçilir. `activeTenantId` boşsa (henüz şube
 * seçilmemiş) hiçbir şey render etmez.
 */
export function HqTeacherPicker({
  activeTenantId,
  value,
  onChange,
}: {
  activeTenantId?: string | null;
  value: string | null;
  onChange: (teacherId: string, teacherName: string) => void;
}) {
  const teachersQuery = useQuery({
    queryKey: ["hq", "branch-teachers", activeTenantId],
    queryFn: fetchTeachers,
    enabled: !!activeTenantId,
  });
  const teachers = teachersQuery.data?.teachers ?? [];

  const teacherIds = teachers.map((t) => t.id).join(",");
  useEffect(() => {
    if (!value && teachers.length > 0) {
      onChange(teachers[0].id, teachers[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, teacherIds]);

  if (!activeTenantId) return null;

  return (
    <div className="field" style={{ maxWidth: 340, marginBottom: 16 }}>
      <label>
        <Icon name="lock" /> Genel Merkez — Görüntülenen Öğretmen
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const t = teachers.find((t) => t.id === e.target.value);
          if (t) onChange(t.id, t.name);
        }}
        disabled={teachers.length === 0}
      >
        {!value && <option value="">Öğretmen seçiliyor…</option>}
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

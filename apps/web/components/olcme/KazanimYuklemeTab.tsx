"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import {
  bulkImportCurriculumAchievements,
  createCurriculumAchievement,
  deleteCurriculumAchievement,
  examKeys,
  fetchCurriculumAchievements,
  updateCurriculumAchievementGrade,
  type CurriculumAchievement,
} from "@/lib/api/exams";
import { parseCsv } from "@/lib/csv";
import { SUBJECT_PREFIXES } from "@/lib/curriculum";

const MODES = [
  { id: "tekli", label: "Tek Tek Ekle" },
  { id: "toplu", label: "Toplu Yükle" },
  { id: "yonetim", label: "Toplu Yönetim" },
] as const;
type ModeId = (typeof MODES)[number]["id"];

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * demo'daki Kazanım Yükleme (kazanimYuklemeAllowed → SUPERADMIN/BRANCH_ADMIN)
 * ekranının karşılığı. Tek fark: `CurriculumNode`'da ayrı bir "subject" alanı
 * yok — ders her zaman kazanım kodunun önekinden türetilir (bkz.
 * lib/curriculum.ts) — bu yüzden demo'nun "Dersi Değiştir" toplu eylemi
 * taşınmadı (kodun önekini değiştirmek kazanımın kimliğini değiştirir).
 * .xlsx içe aktarma da kapsam dışı (bkz. lib/csv.ts üstündeki CVE notu) —
 * Toplu Yükle yalnızca CSV/TSV yapıştırmayı destekler.
 */
export function KazanimYuklemeTab() {
  const [mode, setMode] = useState<ModeId>("tekli");
  const achievementsQuery = useQuery({ queryKey: examKeys.curriculum(), queryFn: fetchCurriculumAchievements });
  const achievements = achievementsQuery.data?.achievements ?? [];

  return (
    <div>
      <p className="lede" style={{ marginBottom: 14 }}>
        Her ders için kazanım (öğrenme çıktısı) tanımlarını buradan yönetin — buradaki taksonomi Kazanım Analizi, Sınav
        Uygulaması ve Optikleri Yükle bölümlerinde otomatik kullanılır.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <button key={m.id} type="button" className={`btn ${mode === m.id ? "primary" : ""}`} style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {achievementsQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : mode === "tekli" ? (
        <TekliMode achievements={achievements} />
      ) : mode === "toplu" ? (
        <TopluYukleMode />
      ) : (
        <TopluYonetimMode achievements={achievements} />
      )}
    </div>
  );
}

function groupBySubject(achievements: CurriculumAchievement[]) {
  const map = new Map<string, CurriculumAchievement[]>();
  for (const prefix of SUBJECT_PREFIXES) map.set(prefix.label, []);
  for (const a of achievements) {
    const list = map.get(a.subject) ?? [];
    list.push(a);
    map.set(a.subject, list);
  }
  return map;
}

function TekliMode({ achievements }: { achievements: CurriculumAchievement[] }) {
  const queryClient = useQueryClient();
  const grouped = useMemo(() => groupBySubject(achievements), [achievements]);
  const [drafts, setDrafts] = useState<Record<string, { code: string; label: string; gradeLevel: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: createCurriculumAchievement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.curriculum() }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCurriculumAchievement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.curriculum() }),
    onError: (err, achievementId) => setErrors((prev) => ({ ...prev, [achievementId]: err instanceof ApiError ? err.message : "Silinemedi." })),
  });

  function draftFor(prefix: string) {
    return drafts[prefix] ?? { code: "", label: "", gradeLevel: "9" };
  }

  function handleAdd(prefix: string) {
    const d = draftFor(prefix);
    const code = d.code.trim().toUpperCase();
    const label = d.label.trim();
    const gradeLevel = Number(d.gradeLevel);
    if (!code || !label || !gradeLevel) {
      setErrors((prev) => ({ ...prev, [prefix]: "Kod ve kazanım adı zorunludur." }));
      return;
    }
    createMutation.mutate(
      { code, label, gradeLevel },
      {
        onSuccess: () => {
          setDrafts((prev) => ({ ...prev, [prefix]: { code: "", label: "", gradeLevel: d.gradeLevel } }));
          setErrors((prev) => ({ ...prev, [prefix]: "" }));
        },
        onError: (err) => setErrors((prev) => ({ ...prev, [prefix]: err instanceof ApiError ? err.message : "Eklenemedi." })),
      },
    );
  }

  return (
    <div className="grid cols-2">
      {SUBJECT_PREFIXES.map(({ prefix, label }) => {
        const items = grouped.get(label) ?? [];
        const d = draftFor(prefix);
        return (
          <div className="card card-pad" key={prefix}>
            <div className="card-head">
              <h3>{label}</h3>
              <span className="hint">{items.length} kazanım</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 220, overflowY: "auto" }}>
              {items.length ? (
                items.map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px" }}>
                    <span style={{ fontSize: 12.5 }}>
                      <code style={{ fontSize: 11, color: "var(--ink-faint)" }}>{a.code}</code> · {a.gradeLevel}. Sınıf
                      <br />
                      {a.label}
                    </span>
                    <button
                      type="button"
                      className="btn danger"
                      style={{ padding: "4px 8px", fontSize: 11, flexShrink: 0 }}
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(a.id)}
                    >
                      Sil
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ color: "var(--ink-faint)", fontSize: 12.5, margin: 0 }}>Henüz kazanım eklenmedi.</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                placeholder={`Kod (Örn. ${prefix}.10.1.1)`}
                value={d.code}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [prefix]: { ...d, code: e.target.value } }))}
                style={{ flex: 1, minWidth: 110, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}
              />
              <input
                placeholder="Kazanım adı"
                value={d.label}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [prefix]: { ...d, label: e.target.value } }))}
                style={{ flex: 1.4, minWidth: 130, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}
              />
              <select
                value={d.gradeLevel}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [prefix]: { ...d, gradeLevel: e.target.value } }))}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}. Sınıf
                  </option>
                ))}
              </select>
              <button type="button" className="btn primary" style={{ padding: "6px 10px", fontSize: 12 }} disabled={createMutation.isPending} onClick={() => handleAdd(prefix)}>
                Ekle
              </button>
            </div>
            {errors[prefix] && <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--critical)" }}>{errors[prefix]}</p>}
          </div>
        );
      })}
    </div>
  );
}

interface PreviewRow {
  _id: number;
  code: string;
  label: string;
  gradeLevel: number | null;
  selected: boolean;
}

function parseBulkPasteText(text: string): PreviewRow[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  let dataRows = rows;
  if (/^(kod|kazan)/i.test(rows[0][0] ?? "")) dataRows = rows.slice(1);
  let seq = 0;
  const out: PreviewRow[] = [];
  for (const parts of dataRows) {
    const code = (parts[0] ?? "").trim().toUpperCase();
    const label = (parts[1] ?? "").trim();
    const gradeRaw = (parts[2] ?? "").trim();
    const gradeLevel = /^\d+$/.test(gradeRaw) && Number(gradeRaw) >= 1 && Number(gradeRaw) <= 12 ? Number(gradeRaw) : null;
    if (!code || !label) continue;
    seq++;
    out.push({ _id: seq, code, label, gradeLevel, selected: true });
  }
  return out;
}

function TopluYukleMode() {
  const queryClient = useQueryClient();
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const idSeq = useRef(0);

  const importMutation = useMutation({
    mutationFn: bulkImportCurriculumAchievements,
    onError: (err) => setStatus(err instanceof ApiError ? err.message : "İçe aktarma başarısız."),
  });

  function handlePreview() {
    const rows = parseBulkPasteText(pasteText);
    setPreview((prev) => [...prev, ...rows.map((r) => ({ ...r, _id: ++idSeq.current }))]);
    setPasteText("");
  }

  function toggleAll(checked: boolean) {
    setPreview((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }

  function toggleRow(id: number, checked: boolean) {
    setPreview((prev) => prev.map((r) => (r._id === id ? { ...r, selected: checked } : r)));
  }

  async function handleImport() {
    const selected = preview.filter((r) => r.selected);
    if (!selected.length) return;
    try {
      const result = await importMutation.mutateAsync(selected.map((r) => ({ code: r.code, label: r.label, gradeLevel: r.gradeLevel ?? 9 })));
      queryClient.invalidateQueries({ queryKey: examKeys.curriculum() });
      setStatus(`${result.successCount} kazanım içe aktarıldı${result.errorCount ? `, ${result.errorCount} satır hata verdi (muhtemelen zaten kayıtlı).` : "."}`);
      const selectedIds = new Set(selected.map((r) => r._id));
      setPreview((prev) => prev.filter((r) => !selectedIds.has(r._id)));
    } catch {
      // onError callback already set the status message
    }
  }

  const selectedCount = preview.filter((r) => r.selected).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card card-pad">
        <div className="card-head">
          <h3>Metin Yapıştır (CSV/TSV)</h3>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: "0 0 10px" }}>
          Excel&apos;den kopyalayıp yapıştırabilirsiniz. Her satır: <code>Kod;Kazanım;Sınıf Düzeyi (opsiyonel)</code> — sekme,
          noktalı virgül ya da virgülle ayrılabilir. Ders, kodun önekinden (MAT/FIZ/KIM/BIY/TUR/TAR/ING) otomatik belirlenir.
        </p>
        <textarea
          rows={6}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="MAT.10.1.1;Rasyonel sayılarla işlem yapar;10"
          style={{ width: "100%", padding: 8, borderRadius: 7, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12.5, fontFamily: "monospace", resize: "vertical" }}
        />
        <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={handlePreview} disabled={!pasteText.trim()}>
          Önizlemeye Ekle
        </button>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Önizleme</h3>
          <span className="hint">{preview.length} satır</span>
        </div>
        {preview.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: 13, margin: 0 }}>Henüz önizleme yok — yukarıdan metin yapıştırıp önizlemeye ekleyin.</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={selectedCount === preview.length} onChange={(e) => toggleAll(e.target.checked)} /> Tümünü Seç ({selectedCount}/{preview.length})
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn sm" onClick={() => setPreview([])}>
                  Önizlemeyi Temizle
                </button>
                <button type="button" className="btn primary" style={{ padding: "6px 12px", fontSize: 12.5 }} disabled={!selectedCount || importMutation.isPending} onClick={handleImport}>
                  {importMutation.isPending ? "Aktarılıyor…" : `Seçilenleri İçe Aktar (${selectedCount})`}
                </button>
              </div>
            </div>
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th></th>
                    <th>Sınıf</th>
                    <th>Kod</th>
                    <th>Kazanım</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <input type="checkbox" checked={r.selected} onChange={(e) => toggleRow(r._id, e.target.checked)} />
                      </td>
                      <td>{r.gradeLevel ?? "—"}</td>
                      <td>
                        <code style={{ fontSize: 11 }}>{r.code}</code>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{r.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {status && <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-muted)" }}>{status}</p>}
      </div>
    </div>
  );
}

function TopluYonetimMode({ achievements }: { achievements: CurriculumAchievement[] }) {
  const queryClient = useQueryClient();
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkGrade, setBulkGrade] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteCurriculumAchievement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.curriculum() }),
  });
  const updateGradeMutation = useMutation({
    mutationFn: (input: { id: string; gradeLevel: number }) => updateCurriculumAchievementGrade(input.id, input.gradeLevel),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.curriculum() }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return achievements.filter((a) => {
      if (subjectFilter !== "ALL" && a.subject !== subjectFilter) return false;
      if (!q) return true;
      return a.code.toLocaleLowerCase("tr-TR").includes(q) || a.label.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [achievements, subjectFilter, search]);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filtered.map((a) => a.id)) : new Set());
  }

  async function applyBulkGrade() {
    const gradeLevel = Number(bulkGrade);
    if (!gradeLevel) return;
    setStatus("Uygulanıyor…");
    for (const id of selected) {
      await updateGradeMutation.mutateAsync({ id, gradeLevel });
    }
    setStatus(`${selected.size} kazanımın sınıf düzeyi güncellendi.`);
    setBulkGrade("");
  }

  async function confirmBulkDelete() {
    setStatus("Siliniyor…");
    let deleted = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        await deleteMutation.mutateAsync(id);
        deleted++;
      } catch {
        failed++;
      }
    }
    setStatus(`${deleted} kazanım silindi${failed ? `, ${failed} tanesi kullanımda olduğu için silinemedi.` : "."}`);
    setSelected(new Set());
    setConfirmingDelete(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12.5 }}
        >
          <option value="ALL">Tüm Dersler</option>
          {SUBJECT_PREFIXES.map(({ prefix, label }) => (
            <option key={prefix} value={label}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kod veya kazanım metniyle ara…"
          style={{ flex: 1, minWidth: 180, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12.5 }}
        />
      </div>

      {selected.size > 0 && (
        <div className="card card-pad" style={{ marginBottom: 12, background: "var(--brand-tint)", border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 12.5 }}>{selected.size} kazanım seçili</b>
            <select
              value={bulkGrade}
              onChange={(e) => setBulkGrade(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}
            >
              <option value="">Sınıf Düzeyini Değiştir…</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}. Sınıf
                </option>
              ))}
            </select>
            <button type="button" className="btn" style={{ padding: "5px 10px", fontSize: 12 }} disabled={!bulkGrade} onClick={applyBulkGrade}>
              Uygula
            </button>
            <button type="button" className="btn danger" style={{ padding: "5px 10px", fontSize: 12, marginLeft: "auto" }} onClick={() => setConfirmingDelete(true)}>
              Seçilenleri Sil ({selected.size})
            </button>
          </div>
          {confirmingDelete && (
            <p style={{ fontSize: 12, color: "var(--critical)", margin: "10px 0 0" }}>
              {selected.size} kazanım kalıcı olarak silinsin mi?
              <button type="button" className="btn xs danger solid" style={{ marginLeft: 8 }} onClick={confirmBulkDelete}>
                Evet, Sil
              </button>
              <button type="button" className="btn xs" style={{ marginLeft: 6 }} onClick={() => setConfirmingDelete(false)}>
                Vazgeç
              </button>
            </p>
          )}
        </div>
      )}

      <div className="card card-pad">
        <div className="card-head">
          <h3>Tüm Kazanımlar</h3>
          <span className="hint">{filtered.length} kazanım</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 440, overflowY: "auto" }}>
          <table className="data">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={filtered.length > 0 && filtered.every((a) => selected.has(a.id))} onChange={(e) => toggleAll(e.target.checked)} />
                </th>
                <th>Ders</th>
                <th>Sınıf</th>
                <th>Kod</th>
                <th>Kazanım</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 300).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(a.id)} onChange={(e) => toggleRow(a.id, e.target.checked)} />
                    </td>
                    <td>{a.subject}</td>
                    <td>{a.gradeLevel}</td>
                    <td>
                      <code style={{ fontSize: 11 }}>{a.code}</code>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{a.label}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {status && <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-muted)" }}>{status}</p>}
      </div>
    </div>
  );
}

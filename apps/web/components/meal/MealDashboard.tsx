"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createMealItem, createMenuPlan, fetchMealItems, fetchMenuPlans, mealKeys } from "@/lib/api/meal";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const WRITE_ROLES = ["BRANCH_ADMIN", "SUPERADMIN"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function MealView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: mealKeys.plans(), queryFn: fetchMenuPlans });
  const itemsQuery = useQuery({ queryKey: mealKeys.items(), queryFn: fetchMealItems });
  const canWrite = WRITE_ROLES.includes(me.role);

  const [date, setDate] = useState("");
  const [mealType, setMealType] = useState("Öğle");
  const [gradeLevels, setGradeLevels] = useState("");
  const [items, setItems] = useState("");
  const [expected, setExpected] = useState("");
  const [planError, setPlanError] = useState<string | null>(null);

  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);

  const planMutation = useMutation({
    mutationFn: () => createMenuPlan({
      date: new Date(date).toISOString(), mealType: mealType.trim() || undefined,
      gradeLevels: gradeLevels.split(",").map((g) => g.trim()).filter(Boolean),
      items: items.split(",").map((g) => g.trim()).filter(Boolean),
      expectedParticipation: expected ? Number(expected) : undefined, published: true,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: mealKeys.plans() }); setDate(""); setGradeLevels(""); setItems(""); setExpected(""); setPlanError(null); },
    onError: (err) => setPlanError(err instanceof ApiError ? err.message : "Menü planı oluşturulamadı."),
  });
  const itemMutation = useMutation({
    mutationFn: () => createMealItem({ name: itemName.trim(), category: itemCategory.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: mealKeys.items() }); setItemName(""); setItemCategory(""); setItemError(null); },
    onError: (err) => setItemError(err instanceof ApiError ? err.message : "Ürün eklenemedi."),
  });

  const plans = plansQuery.data?.plans ?? [];
  const mealItems = itemsQuery.data?.items ?? [];

  return (
    <div className="screen">
      <h1>Yemekhane</h1>
      <p className="lede">Günlük menü planı ve yemek ürünleri.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {canWrite && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="card-head"><h3>Yeni Menü Planı</h3></div>
          <form onSubmit={(e) => { e.preventDefault(); if (!date) { setPlanError("Tarih zorunludur."); return; } planMutation.mutate(); }} className="grid cols-2" style={{ rowGap: 12 }}>
            <div className="field"><label>Tarih</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label>Öğün</label><input value={mealType} onChange={(e) => setMealType(e.target.value)} placeholder="Kahvaltı / Öğle / İkindi" /></div>
            <div className="field"><label>Sınıf Seviyeleri (virgülle)</label><input value={gradeLevels} onChange={(e) => setGradeLevels(e.target.value)} placeholder="01, 02" /></div>
            <div className="field"><label>Öngörülen Katılım</label><input type="number" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Ürünler (virgülle)</label><input value={items} onChange={(e) => setItems(e.target.value)} placeholder="Çorba, Pilav, Salata, Meyve" /></div>
            {planError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{planError}</p>}
            <button type="submit" disabled={planMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{planMutation.isPending ? "Kaydediliyor…" : "Menüyü Yayınla"}</button>
          </form>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Menü Planı</h3><span className="hint">{plans.length} gün</span></div>
        {plansQuery.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          : plans.length === 0 ? <div className="empty-state"><Icon name="grid" /><p>Henüz menü planı yok.</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {plans.map((p) => (
                <div key={p.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b style={{ fontSize: "var(--text-sm)" }}>{fmtDate(p.date)} · {p.mealType ?? "—"}</b>
                    {p.expectedParticipation != null && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>~{p.expectedParticipation} kişi</span>}
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{p.items.join(", ") || "—"}</p>
                  {p.gradeLevels.length > 0 && <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Seviyeler: {p.gradeLevels.join(", ")}</p>}
                </div>
              ))}
            </div>}
      </div>

      {canWrite && (
        <div className="card card-pad">
          <div className="card-head"><h3>Yemek Ürünleri</h3><span className="hint">{mealItems.length} ürün</span></div>
          <form onSubmit={(e) => { e.preventDefault(); if (!itemName.trim()) { setItemError("Ürün adı zorunludur."); return; } itemMutation.mutate(); }} className="grid cols-2" style={{ rowGap: 12, marginBottom: 12 }}>
            <div className="field"><label>Ürün Adı</label><input value={itemName} onChange={(e) => setItemName(e.target.value)} /></div>
            <div className="field"><label>Kategori</label><input value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} placeholder="Ana yemek / Tatlı" /></div>
            {itemError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{itemError}</p>}
            <button type="submit" disabled={itemMutation.isPending} className="btn sm" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{itemMutation.isPending ? "Ekleniyor…" : "Ürün Ekle"}</button>
          </form>
          {mealItems.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{mealItems.map((i) => (<span key={i.id} className="chip neutral">{i.name}{i.category ? ` · ${i.category}` : ""}</span>))}</div>}
        </div>
      )}
    </div>
  );
}

export function MealDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  return <MealView me={me} />;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchBranchMap, toneForPct } from "@/lib/api/branch-map";
import { TURKEY_MAP_VIEWBOX, TURKEY_PROVINCES } from "@/lib/turkey-provinces";
import { Icon } from "@/components/ui/icons";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

/**
 * Şube Performans Haritası — demo/seviye360-app.html'deki "hq:map" ekranının
 * gerçek karşılığı (il/ilçe SVG çizimi hariç, demo'daki TURKEY_PROVINCES path
 * verisi birebir taşındı — bkz. lib/turkey-provinces.ts). Genel Merkez'e özel;
 * il rengi kurumun gerçek doluluk oranına göre dinamik hesaplanır.
 */
export function BranchMapDashboard() {
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const { data: me, isLoading, isError, error } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  const mapQuery = useQuery({ queryKey: ["branch-map"], queryFn: fetchBranchMap, enabled: !!me });

  const branches = mapQuery.data?.branches ?? [];

  const occupancyByCity = useMemo(() => {
    const byCity = new Map<string, number[]>();
    for (const b of branches) {
      if (!b.city) continue;
      if (!byCity.has(b.city)) byCity.set(b.city, []);
      byCity.get(b.city)!.push(b.occupancyPct);
    }
    const avg = new Map<string, number>();
    for (const [city, pcts] of byCity) {
      avg.set(city, Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length));
    }
    return avg;
  }, [branches]);

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Şube Performans Haritası yalnızca Genel Merkez rolüne açıktır.
        </p>
      </div>
    );
  }

  const totalCiro = branches.reduce((s, b) => s + b.revenue, 0);
  const avgCollection = branches.length ? Math.round(branches.reduce((s, b) => s + b.collectionPct, 0) / branches.length) : 0;
  const avgOccupancy = branches.length ? Math.round(branches.reduce((s, b) => s + b.occupancyPct, 0) / branches.length) : 0;
  const riskli = branches.filter((b) => b.occupancyPct < 70).length;

  return (
    <div className="screen">
      <h1>Şube Performans Haritası</h1>
      <p className="lede">
        Türkiye'nin 81 ili gerçek sınırlarıyla gösterilir — kurumu olan iller gerçek doluluk oranına göre dinamik
        renklenir.
      </p>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="card stat-card tone-accent">
          <p className="stat-label">Toplam Ciro</p>
          <p className="stat-value">{tl(totalCiro)}</p>
        </div>
        <div className="card stat-card tone-strong">
          <p className="stat-label">Ort. Tahsilat Oranı</p>
          <p className="stat-value">%{avgCollection}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Ort. Kapasite Doluluğu</p>
          <p className="stat-value">%{avgOccupancy}</p>
        </div>
        <div className="card stat-card tone-critical">
          <p className="stat-label">Riskli Kurum</p>
          <p className="stat-value">{riskli}</p>
          <p className="stat-sub down">Doluluk &lt; %70</p>
        </div>
      </div>

      {mapQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : (
        <div className="map-wrap">
          <div className="card card-pad">
            <div className="card-head">
              <h3>Şube Dağılımı</h3>
              <span className="hint">İl rengi = doluluk oranı · tıkla, tabloda vurgula</span>
            </div>
            <div className="map-svg-holder">
              <svg viewBox={`0 0 ${TURKEY_MAP_VIEWBOX.w} ${TURKEY_MAP_VIEWBOX.h}`} style={{ width: "100%", display: "block" }}>
                {TURKEY_PROVINCES.map((p) => {
                  const occ = occupancyByCity.get(p.name);
                  const active = occ !== undefined;
                  const tone = active ? toneForPct(occ) : null;
                  const fill = active ? `var(--${tone}-bg)` : "var(--surface-sunken)";
                  const stroke = active ? `var(--${tone})` : "var(--border-strong)";
                  const count = branches.filter((b) => b.city === p.name).length;
                  return (
                    <path
                      key={p.name}
                      className={`map-province${p.name === selectedCity ? " active-city" : ""}`}
                      d={p.d}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1}
                      onClick={() => active && setSelectedCity(p.name === selectedCity ? null : p.name)}
                    >
                      <title>{active ? `${p.name} — ${count} kurum · %${occ} doluluk` : `${p.name} — kurum yok`}</title>
                    </path>
                  );
                })}
              </svg>
            </div>
            <div className="map-legend-scale">
              <span style={{ color: "var(--strong)" }}>■</span> ≥%85
              <span style={{ color: "var(--weak)" }}>■</span> %70–85
              <span style={{ color: "var(--critical)" }}>■</span> &lt;%70
              <span>·</span>
              <span style={{ color: "var(--ink-faint)" }}>■</span> Kurum yok
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Şube Tablosu</h3>
              <span className="hint">{branches.length} kurum</span>
            </div>
            {branches.length === 0 ? (
              <div className="empty-state">
                <Icon name="map" />
                <p>Henüz kurum eklenmedi.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Kurum</th>
                      <th>Ciro</th>
                      <th>Tahsilat</th>
                      <th>Doluluk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b) => (
                      <tr
                        key={b.id}
                        className="row-clickable"
                        onClick={() => setSelectedCity(b.city === selectedCity ? null : b.city)}
                        style={b.city === selectedCity ? { background: "var(--surface-2)" } : undefined}
                      >
                        <td>
                          <b>{b.city}</b> · {b.district}
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{b.name}</div>
                        </td>
                        <td>{tl(b.revenue)}</td>
                        <td>
                          <span className={`chip ${toneForPct(b.collectionPct)}`}>%{b.collectionPct}</span>
                        </td>
                        <td>
                          <span className={`chip ${toneForPct(b.occupancyPct)}`}>%{b.occupancyPct}</span>{" "}
                          <span style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>
                            ({b.studentCount}/{b.capacity ?? 0})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

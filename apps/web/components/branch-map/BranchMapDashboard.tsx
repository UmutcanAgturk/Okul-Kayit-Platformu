"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { BranchMapRow, fetchBranchMap, toneForPct } from "@/lib/api/branch-map";
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
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");

  function goToCity(city: string) {
    setSelectedCity(city);
    setSelectedDistrict("");
  }
  function goBackToMap() {
    setSelectedCity(null);
    setSelectedDistrict("");
  }

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

  if (selectedCity) {
    return (
      <CityDrilldown
        city={selectedCity}
        branches={branches}
        selectedDistrict={selectedDistrict}
        onSelectDistrict={setSelectedDistrict}
        onBack={goBackToMap}
      />
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
                      className={`map-province${active ? " active-city" : ""}`}
                      d={p.d}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1}
                      style={active ? { cursor: "pointer" } : undefined}
                      onClick={() => active && goToCity(p.name)}
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
                        onClick={() => b.city && goToCity(b.city)}
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

/**
 * İl drill-down (bkz. demo renderCityDrilldown/mountCityDrilldown) — il
 * seçildiğinde ülke haritası yerine gösterilir. Demo'daki gibi TÜM ilçeleri
 * (kurumu olsun olmasın) listelemek yerine, yalnızca o ilde GERÇEKTEN
 * kurumu olan ilçeler gösterilir — statik bir il→ilçe referans verisi
 * gerçek backend'de yok, bu yüzden "veri zaten gerçek" ilkesiyle mevcut
 * şube verisinden türetilir.
 */
function CityDrilldown({
  city,
  branches,
  selectedDistrict,
  onSelectDistrict,
  onBack,
}: {
  city: string;
  branches: BranchMapRow[];
  selectedDistrict: string;
  onSelectDistrict: (district: string) => void;
  onBack: () => void;
}) {
  const cityBranches = branches.filter((b) => b.city === city);
  const districts = Array.from(new Set(cityBranches.map((b) => b.district).filter((d): d is string => !!d))).sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
  const visibleBranches = selectedDistrict ? cityBranches.filter((b) => b.district === selectedDistrict) : cityBranches;

  return (
    <div className="screen">
      <button type="button" className="btn" style={{ marginBottom: 14 }} onClick={onBack}>
        <Icon name="map" /> Türkiye Haritasına Dön
      </button>
      <h1>{city}</h1>
      <p className="lede">
        {city} ilinde {cityBranches.length} kurum, {districts.length} ilçede dağılmış durumda. Bir ilçeye tıklayarak o
        ilçenin kurumlarını görün.
      </p>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>{city} — İlçe Dağılımı</h3>
        </div>
        <div className="grid cols-4">
          <button
            type="button"
            className={`card stat-card row-clickable${selectedDistrict === "" ? " tone-accent" : ""}`}
            style={{ textAlign: "left", cursor: "pointer", border: "none" }}
            onClick={() => onSelectDistrict("")}
          >
            <p className="stat-label">Tümü</p>
            <p className="stat-value">{cityBranches.length}</p>
            <p className="stat-sub">kurum</p>
          </button>
          {districts.map((d) => {
            const count = cityBranches.filter((b) => b.district === d).length;
            return (
              <button
                type="button"
                key={d}
                className={`card stat-card row-clickable${selectedDistrict === d ? " tone-accent" : ""}`}
                style={{ textAlign: "left", cursor: "pointer", border: "none" }}
                onClick={() => onSelectDistrict(d)}
              >
                <p className="stat-label">{d}</p>
                <p className="stat-value">{count}</p>
                <p className="stat-sub">kurum</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Kurumlar</h3>
          <span className="hint">
            {city} · {selectedDistrict || "tümü"} ({visibleBranches.length})
          </span>
        </div>
        {visibleBranches.length === 0 ? (
          <div className="empty-state">
            <Icon name="map" />
            <p>Bu ilçede kurum yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Kurum</th>
                  <th>İlçe</th>
                  <th>Ciro</th>
                  <th>Tahsilat</th>
                  <th>Doluluk</th>
                </tr>
              </thead>
              <tbody>
                {visibleBranches.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <b>{b.name}</b>
                    </td>
                    <td>{b.district}</td>
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
  );
}

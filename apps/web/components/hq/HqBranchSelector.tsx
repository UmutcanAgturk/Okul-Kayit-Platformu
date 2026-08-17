"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, UserRole } from "@/lib/api/auth";
import { fetchHqTenants, hqKeys, setActingTenant } from "@/lib/api/hq";
import { Icon } from "@/components/ui/icons";

/**
 * Demo'daki hqBranchSelectorHtml/wireHqBranchSelector'ın gerçek karşılığı —
 * Genel Merkez'in (bare SUPERADMIN) CRM, Personel, Muhasebe, Etüt gibi
 * tek-şube ekranlarında Kurumlar > "Bu Şube Olarak Yönet"e gitmeden doğrudan
 * ekranın üstünden şube değiştirmesini sağlar. Seçim, aynı acting-tenant
 * mekanizmasını (app/api/hq/acting-tenant, ACTING_TENANT_COOKIE) günceller,
 * bu yüzden Kurumlar'daki "Bu Şube Olarak Yönet" ile bu bileşen aynı state'i
 * paylaşır. actingTenantId henüz seçilmemişse demo'daki CURRENT_BRANCH
 * default'u gibi ilk aktif şube otomatik seçilir — böylece hiçbir ekran boş
 * kalmaz. role !== "SUPERADMIN" ise hiçbir şey render etmez.
 */
export function HqBranchSelector({ role, activeTenantId }: { role: UserRole; activeTenantId?: string | null }) {
  const queryClient = useQueryClient();
  const isSuperadmin = role === "SUPERADMIN";

  const tenantsQuery = useQuery({ queryKey: hqKeys.tenants(), queryFn: fetchHqTenants, enabled: isSuperadmin });
  const branches = (tenantsQuery.data?.tenants ?? []).filter((t) => t.type === "SUBE" && t.isActive);

  const mutation = useMutation({
    mutationFn: setActingTenant,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      await queryClient.invalidateQueries();
    },
  });

  const branchIds = branches.map((b) => b.id).join(",");
  useEffect(() => {
    if (isSuperadmin && !activeTenantId && !mutation.isPending && branches.length > 0) {
      mutation.mutate(branches[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin, activeTenantId, branchIds]);

  if (!isSuperadmin) return null;

  return (
    <div className="field" style={{ maxWidth: 340, marginBottom: 16 }}>
      <label>
        <Icon name="lock" /> Genel Merkez — Görüntülenen/Düzenlenen Şube
      </label>
      <select
        value={activeTenantId ?? ""}
        onChange={(e) => {
          if (e.target.value) mutation.mutate(e.target.value);
        }}
        disabled={mutation.isPending || branches.length === 0}
      >
        {!activeTenantId && <option value="">Şube seçiliyor…</option>}
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.city ? ` (${b.city})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, UserRole } from "@/lib/api/auth";
import { clearActingTenant, fetchHqTenants, hqKeys, setActingTenant } from "@/lib/api/hq";
import { Icon } from "@/components/ui/icons";

/**
 * Demo'daki hqBranchSelectorHtml/wireHqBranchSelector'ın gerçek karşılığı —
 * Genel Merkez'in (bare SUPERADMIN) CRM, Personel, Muhasebe, Etüt gibi
 * tek-şube ekranlarında Kurumlar > "Bu Şube Olarak Yönet"e gitmeden doğrudan
 * ekranın üstünden şube değiştirmesini sağlar. Seçim, aynı acting-tenant
 * mekanizmasını (app/api/hq/acting-tenant, ACTING_TENANT_COOKIE) günceller,
 * bu yüzden Kurumlar'daki "Bu Şube Olarak Yönet" ile bu bileşen aynı state'i
 * paylaşır. Varsayılan durum (henüz şube seçilmemişken) "Tüm Kurumlar
 * (Konsolide)"dir: modüller superadmin_role (BYPASSRLS) üzerinden TÜM
 * kurumların birleşik verisini gösterir (bkz. lib/db-context.ts
 * withBranchTenantContext konsolide modu). Listeden bir şube seçilince ekran
 * o şubeye scope edilir; "Tüm Kurumlar" seçilerek konsolide moda dönülür.
 * role !== "SUPERADMIN" ise hiçbir şey render etmez.
 */
export function HqBranchSelector({ role, activeTenantId }: { role: UserRole; activeTenantId?: string | null }) {
  const queryClient = useQueryClient();
  const isSuperadmin = role === "SUPERADMIN";

  const tenantsQuery = useQuery({ queryKey: hqKeys.tenants(), queryFn: fetchHqTenants, enabled: isSuperadmin });
  const branches = (tenantsQuery.data?.tenants ?? []).filter((t) => t.type === "SUBE" && t.isActive);

  const mutation = useMutation({
    mutationFn: async (tenantId: string | null) => {
      if (tenantId) await setActingTenant(tenantId);
      else await clearActingTenant();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      await queryClient.invalidateQueries();
    },
  });

  if (!isSuperadmin) return null;

  return (
    <div className="field" style={{ maxWidth: 340, marginBottom: 16 }}>
      <label>
        <Icon name="lock" /> Genel Merkez — Kurum Kapsamı
      </label>
      <select
        value={activeTenantId ?? ""}
        onChange={(e) => mutation.mutate(e.target.value || null)}
        disabled={mutation.isPending}
      >
        <option value="">Tüm Kurumlar (Konsolide)</option>
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

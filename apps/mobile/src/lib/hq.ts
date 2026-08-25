// Genel Merkez (SUPERADMIN) — şube listesi ve "bir şube olarak yönet" (acting
// tenant) işlemleri. Web'deki HqBranchSelector'ın (bkz. apps/web/components/hq)
// mobil karşılığı: acting tenant bir çereze yazılır (POST /api/hq/acting-tenant)
// ve React Native'in native çerez deposu bunu sonraki tüm /api/branch/*
// isteklerine otomatik ekler — böylece HQ, seçtiği şubede tam yetkiyle çalışır.
import { api } from './api';
import type { HqTenant } from './types';

export function fetchHqTenants() {
  return api.get<{ tenants: HqTenant[] }>('/api/hq/tenants');
}

export function setActingTenant(tenantId: string) {
  return api.post<{ tenantId: string; tenantName: string }>('/api/hq/acting-tenant', { tenantId });
}

export function clearActingTenant() {
  return api.del<{ ok: true }>('/api/hq/acting-tenant');
}

"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInbox, messageKeys } from "@/lib/api/messages";
import { useToast } from "@/components/ui/Toast";

const POLL_MS = 25000;
const MAX_TOASTS_PER_TICK = 3;

/**
 * checkAndShowMessageToasts'ın (demo) karşılığı — İletişim gelen kutusunu
 * arka planda düzenli aralıklarla kontrol eder, önceki kontrolden bu yana
 * gelen YENİ mesajlar için toast gösterir. İlk yüklemede geçmiş okunmamış
 * mesajlar için toast ATILMAZ — yalnızca bu bileşen bağlandıktan SONRA
 * gelen mesajlar bildirilir.
 */
export function MessageToastWatcher() {
  const { showToast } = useToast();
  const seenIds = useRef<Set<string> | null>(null);

  const { data } = useQuery({
    queryKey: messageKeys.inbox(),
    queryFn: fetchInbox,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data) return;
    if (seenIds.current === null) {
      seenIds.current = new Set(data.messages.map((m) => m.id));
      return;
    }
    const fresh = data.messages.filter((m) => !seenIds.current!.has(m.id));
    for (const m of fresh) {
      seenIds.current.add(m.id);
    }
    for (const m of fresh.slice(0, MAX_TOASTS_PER_TICK)) {
      showToast({ title: `Yeni mesaj — ${m.senderLabel}`, body: `${m.title}: ${m.body}`, tone: "strong" });
    }
  }, [data, showToast]);

  return null;
}

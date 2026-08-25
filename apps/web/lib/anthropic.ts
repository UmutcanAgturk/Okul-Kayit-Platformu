/**
 * Anthropic (Claude) entegrasyonu — gerçek AI yorumları (Yol Haritası / Sınıf
 * Röntgeni) ve optik form görsel okuma (mobil OMR) için.
 *
 * Tasarım ilkeleri (lib/notifications.ts ile aynı desen):
 *  - **Opt-in / zarif devre dışı**: `ANTHROPIC_API_KEY` tanımlı değilse tüm
 *    fonksiyonlar `null` döner — çağıran taraf mevcut heuristik'e (Yol Haritası/
 *    Sınıf Röntgeni) veya "AI yapılandırılmadı" mesajına (OMR) düşer.
 *  - **En iyi çaba**: hata ASLA fırlatmaz; ana isteği düşürmez.
 *  - **Bağımlılıksız**: doğrudan Messages API'sine `fetch` ile.
 *
 * Ortam değişkenleri (bkz. apps/web/.env.example):
 *   ANTHROPIC_API_KEY   — zorunlu (yoksa AI kapalı)
 *   ANTHROPIC_MODEL     — opsiyonel (varsayılan: claude-sonnet-5)
 */
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
  };
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function extractText(data: unknown): string {
  const content = (data as { content?: unknown })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b): b is { type: string; text: string } => !!b && typeof b === "object" && (b as { type?: string }).type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Metin tabanlı yorum (Yol Haritası / Sınıf Röntgeni). Kapalıysa null. */
export async function askClaude(system: string, userText: string, opts?: { maxTokens?: number }): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: opts?.maxTokens ?? 500,
        system,
        messages: [{ role: "user", content: userText }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const text = extractText(await res.json());
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Optik form görsel okuma (mobil OMR). Görseldeki işaretli şıkları soru sırasına
 * göre okur; her soru için "A".."E" veya boş "". Yalnız AI açıkken çalışır.
 */
export async function readOpticSheet(imageBase64: string, mediaType: string, questionCount: number): Promise<string[] | null> {
  if (!aiEnabled()) return null;
  const system =
    "Sen bir optik form (cevap kağıdı) okuyucusun. Sana verilen görseldeki işaretli/karalanmış şıkları soru numarası sırasına göre oku. Yanıtı YALNIZCA bir JSON dizi olarak ver; başka hiçbir metin yazma.";
  const userContent: ContentBlock[] = [
    {
      type: "text",
      text: `Bu optik cevap kağıdında ${questionCount} soru var. Her soru için işaretlenen şıkkı (A, B, C, D veya E) sırayla oku. Boş/işaretsiz bırakılan soru için "" (boş dize) yaz. Çıktı tam olarak ${questionCount} elemanlı bir JSON dizi olsun. Örnek: ["A","","C","D",...]`,
    },
    { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
  ];
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: MODEL(), max_tokens: 1500, system, messages: [{ role: "user", content: userContent }] }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const text = extractText(await res.json());
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    return arr.map((x) => (typeof x === "string" ? x.trim().toUpperCase() : "")).map((x) => (/^[A-E]$/.test(x) ? x : ""));
  } catch {
    return null;
  }
}

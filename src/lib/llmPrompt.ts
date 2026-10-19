/** ZORRO sistem talimatı yalnızca sunucuda (supabase/functions/student-ai). İstemci yalnızca yanıtı ayrıştırır. */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(raw.slice(start, end + 1));
    return v && typeof v === 'object' ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function packAiResult(action: string, text: string) {
  const parsed = extractJsonObject(text) || {};
  const reply = String(parsed.reply || '').trim() || (action === 'chat' ? text.replace(/```[\s\S]*```/g, '').trim() : text.slice(0, 500));
  return {
    reply,
    summary: String(parsed.summary || ''),
    plan: parsed.plan,
    schedule: parsed.schedule,
    text,
  };
}

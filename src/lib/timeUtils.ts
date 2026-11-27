export function getCurrentLocalTimeStr(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function normalizeTimeStr(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Exact HH:mm or HH:mm:ss
  const exactMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (exactMatch) {
    const h = Number(exactMatch[1]);
    const m = Number(exactMatch[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // ISO timestamp or date+time string
  if (trimmed.includes('T') || trimmed.includes(' ')) {
    // If it has timezone indicator (Z or +-HH:MM), parse via Date to convert to local time
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return getCurrentLocalTimeStr(parsed);
      }
    }
    const timePartMatch = trimmed.match(/[T\s](\d{1,2}):(\d{2})/);
    if (timePartMatch) {
      const h = Number(timePartMatch[1]);
      const m = Number(timePartMatch[2]);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

export function toLocalDateKey(isoOrDate?: string | null): string | null {
  if (!isoOrDate || typeof isoOrDate !== 'string') return null;
  const trimmed = isoOrDate.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes('T') && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return trimmed.split('T')[0];
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getEffectiveDateStr(item?: {
  date?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
  payment_status?: string | null;
} | null): string {
  if (!item) return '';
  const raw =
    item.payment_status === 'pending'
      ? item.due_date || item.date
      : item.payment_date || item.date;
  return raw ? String(raw).split('T')[0] : '';
}

export function getEffectiveItemTime(item?: {
  date?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
  payment_status?: string | null;
  time?: string | null;
  created_at?: string | null;
} | null): string | null {
  if (!item) return null;
  const explicit = normalizeTimeStr(item.time);
  if (explicit) return explicit;

  // Fallback: if created_at's local calendar date matches item's effective date, derive local HH:mm
  if (item.created_at) {
    const itemDate = getEffectiveDateStr(item) || (item.date ? String(item.date).split('T')[0] : '');
    const createdLocalDate = toLocalDateKey(item.created_at);
    if (itemDate && createdLocalDate && itemDate === createdLocalDate) {
      return normalizeTimeStr(item.created_at);
    }
  }
  return null;
}

export function combineLocalDateAndTimeMs(
  dateStr?: string | null,
  timeStr?: string | null,
  fallbackTime: string = '00:00'
): number {
  if (!dateStr) return 0;
  const cleanDate = String(dateStr).split('T')[0];
  const parts = cleanDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const normTime = normalizeTimeStr(timeStr) || fallbackTime;
  const [hh, mm] = normTime.split(':').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], hh || 0, mm || 0, 0, 0).getTime();
}

export function getDateTimeSortKey(
  dateStr?: string | null,
  timeStr?: string | null,
  createdAt?: string | null,
  fallbackTime: string = '00:00'
): { date: string; time: string; createdMs: number } {
  const date = dateStr ? String(dateStr).split('T')[0] : '';
  const time = normalizeTimeStr(timeStr) || fallbackTime;
  const createdMs = createdAt ? new Date(createdAt).getTime() || 0 : 0;
  return { date, time, createdMs };
}

export interface DateTimeSortableItem {
  id?: string;
  date?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
  payment_status?: string | null;
  time?: string | null;
  created_at?: string | null;
}

export function compareByDateTimeDesc(a: DateTimeSortableItem, b: DateTimeSortableItem): number {
  const dateA = (a.date ? String(a.date).split('T')[0] : '') || getEffectiveDateStr(a);
  const dateB = (b.date ? String(b.date).split('T')[0] : '') || getEffectiveDateStr(b);
  if (dateA !== dateB) return dateB.localeCompare(dateA);

  const timeA = getEffectiveItemTime(a) || '00:00';
  const timeB = getEffectiveItemTime(b) || '00:00';
  if (timeA !== timeB) return timeB.localeCompare(timeA);

  const ca = a.created_at ? new Date(a.created_at).getTime() || 0 : 0;
  const cb = b.created_at ? new Date(b.created_at).getTime() || 0 : 0;
  if (ca !== cb) return cb - ca;

  return String(b.id || '').localeCompare(String(a.id || ''));
}

export function compareByDateTimeAsc(a: DateTimeSortableItem, b: DateTimeSortableItem): number {
  return compareByDateTimeDesc(b, a);
}

export function formatTimeDisplay(timeStr?: string | null): string {
  return normalizeTimeStr(timeStr) || '';
}

export function formatDateWithTime(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return '---';
  const cleanDate = String(dateStr).split('T')[0];
  const parts = cleanDate.split('-');
  const brDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : cleanDate;
  const normTime = normalizeTimeStr(timeStr);
  return normTime ? `${brDate} às ${normTime}` : brDate;
}

// ==============================================================================
// LocalStorage Hydration Maps (garante persistência imediata mesmo antes da migração SQL)
// ==============================================================================

export function getTxTimeMap(userId?: string | null): Record<string, string> {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`tx_time_map_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setTxTimeEntry(userId: string | null | undefined, txId: string, time?: string | null): void {
  if (!userId || !txId) return;
  try {
    const map = getTxTimeMap(userId);
    const norm = normalizeTimeStr(time);
    if (norm) {
      map[txId] = norm;
    } else {
      delete map[txId];
    }
    localStorage.setItem(`tx_time_map_${userId}`, JSON.stringify(map));
  } catch {}
}

export function getRtTimeMap(userId?: string | null): Record<string, string> {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`rt_time_map_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setRtTimeEntry(userId: string | null | undefined, rtId: string, time?: string | null): void {
  if (!userId || !rtId) return;
  try {
    const map = getRtTimeMap(userId);
    const norm = normalizeTimeStr(time);
    if (norm) {
      map[rtId] = norm;
    } else {
      delete map[rtId];
    }
    localStorage.setItem(`rt_time_map_${userId}`, JSON.stringify(map));
  } catch {}
}

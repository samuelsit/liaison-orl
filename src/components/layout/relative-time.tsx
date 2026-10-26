import { formatFullDateTime, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Date courte d'une liste (« il y a 5 min », « hier », « 9 oct. ») avec la date
 * complète en infobulle. Utilisable côté serveur comme côté client ; le texte peut
 * différer d'une minute entre les deux rendus, d'où `suppressHydrationWarning`.
 */
export function RelativeTime({ date, className }: { date: Date | string; className?: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return (
    <time
      dateTime={d.toISOString()}
      title={formatFullDateTime(d)}
      suppressHydrationWarning
      className={cn("tabular-nums", className)}
    >
      {formatShortDate(d)}
    </time>
  );
}

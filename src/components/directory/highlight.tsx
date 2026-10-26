import { Fragment } from "react";
import { highlightRanges } from "./utils";

/**
 * Texte dont les mots recherchés sont surlignés (début de mot, sans accents ni casse).
 * Composant sans état, utilisable côté serveur comme client.
 */
export function Highlight({ text, query }: { text: string; query?: string }) {
  const ranges = query ? highlightRanges(text, query) : [];
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, start)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className="rounded-[3px] bg-accent text-inherit ring-1 ring-ring/15 ring-inset">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(<Fragment key="rest">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}

"use client";

import { useCallback, type KeyboardEvent } from "react";
import { moveInGrid, type GridMove } from "./measure-cells";

function caretAtStart(el: HTMLInputElement) {
  return el.selectionStart === 0 && (el.selectionEnd === 0 || el.selectionEnd === el.value.length);
}

function caretAtEnd(el: HTMLInputElement) {
  const len = el.value.length;
  return el.selectionEnd === len && (el.selectionStart === len || el.selectionStart === 0);
}

/**
 * Navigation de tableur dans une grille d'`<input data-grid-row data-grid-col>` :
 * Entrée / ↓ descend (puis colonne suivante), Maj+Entrée / ↑ monte, ← → aux bords
 * du texte, Début / Fin en bout de ligne. À poser sur le conteneur (délégation).
 */
export function useGridNavigation(rows: number, cols: number) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.dataset.gridRow === undefined) return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      let move: GridMove | null = null;
      if (e.key === "Enter") move = e.shiftKey ? "up" : "enter";
      else if (e.key === "ArrowDown") move = "down";
      else if (e.key === "ArrowUp") move = "up";
      else if (e.key === "ArrowLeft" && caretAtStart(t)) move = "left";
      else if (e.key === "ArrowRight" && caretAtEnd(t)) move = "right";
      else if (e.key === "Home") move = "rowStart";
      else if (e.key === "End") move = "rowEnd";
      if (!move) return;
      e.preventDefault();
      const next = moveInGrid({ row: Number(t.dataset.gridRow), col: Number(t.dataset.gridCol) }, move, rows, cols);
      if (!next) return;
      const el = e.currentTarget.querySelector<HTMLInputElement>(`input[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`);
      el?.focus();
    },
    [rows, cols],
  );
}

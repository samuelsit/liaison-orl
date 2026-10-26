"use client";

import { useState, type ComponentProps, type KeyboardEvent } from "react";
import { ArrowBigUpDash, Check, Circle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFr } from "@/lib/i18n/auth";
import { cn } from "@/lib/utils";

const T = authFr.password;

/** Longueur minimale imposée par le serveur (Better Auth : minPasswordLength). */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Champ mot de passe : bouton afficher / masquer (44 px au toucher) et alerte
 * « Verrouillage des majuscules activé ». L'id reste sur le vrai <input>.
 */
export function PasswordInput({
  id,
  className,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { id: string }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  function readCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    // getModifierState n'existe pas sur certains claviers virtuels.
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  }

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn("pr-11 pointer-coarse:pr-12", className)}
          onKeyDown={(e) => {
            readCapsLock(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            readCapsLock(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute inset-y-0 right-0.5 my-auto text-muted-foreground hover:text-foreground pointer-coarse:right-0"
          aria-label={visible ? T.hide : T.show}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
      <p aria-live="polite" className="text-meta text-warning-foreground empty:hidden">
        {capsLock ? (
          <span className="mt-1.5 flex items-center gap-1.5">
            <ArrowBigUpDash className="size-3.5 shrink-0" aria-hidden />
            {T.capsLock}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** Règles d'un nouveau mot de passe, cochées en direct (longueur, et concordance si `confirm` est fourni). */
export function PasswordRules({ password, confirm, id, className }: { password: string; confirm?: string; id?: string; className?: string }) {
  const rules: { label: string; met: boolean }[] = [{ label: T.ruleLength, met: password.length >= PASSWORD_MIN_LENGTH }];
  if (confirm !== undefined) rules.push({ label: T.ruleMatch, met: confirm.length > 0 && confirm === password });
  return (
    <ul id={id} aria-label={T.rulesLabel} className={cn("space-y-1 text-meta", className)}>
      {rules.map((r) => (
        <li key={r.label} className={cn("flex items-center gap-1.5", r.met ? "text-success-foreground" : "text-muted-foreground")}>
          {r.met ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-3.5 shrink-0" aria-hidden />}
          <span>
            {r.label}
            <span className="sr-only">{r.met ? " : respectée" : " : non respectée"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

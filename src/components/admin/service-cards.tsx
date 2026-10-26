"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Database, HardDrive, Mail, Mailbox, RefreshCw, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, SeeAllLink } from "@/components/layout/section-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { testServicesAction } from "@/server/actions/admin";
import type { ServiceState } from "@/server/services/service-status";
import { adminFr } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "./admin-page-header";

const T = adminFr.services;

const ICON: Record<ServiceState["key"], LucideIcon> = {
  database: Database,
  ai: Sparkles,
  email: Mail,
  postal: Mailbox,
  storage: HardDrive,
};

const TONE: Record<ServiceState["status"], BadgeTone> = { ok: "success", demo: "warning", error: "danger" };

export function ServiceStatusBadge({ status }: { status: ServiceState["status"] }) {
  return (
    <Badge tone={TONE[status]} dot>
      {T.status[status]}
    </Badge>
  );
}

/** État des services + test de connexion (action serveur réservée aux administrateurs). */
function useServiceTest(initial: ServiceState[]) {
  const [states, setStates] = useState(initial);
  const [tested, setTested] = useState(false);
  const [pending, start] = useTransition();
  const test = () =>
    start(async () => {
      const res = await testServicesAction();
      if (!res.ok) return void toast.error(res.error);
      setStates(res.data);
      setTested(true);
      toast.success(T.tested);
    });
  return { states, pending, tested, test };
}

function TestButton({ pending, onClick, compact = false }: { pending: boolean; onClick: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={T.test} disabled={pending} onClick={onClick} className="text-muted-foreground">
            <RefreshCw aria-hidden className={cn(pending && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{pending ? T.testing : T.test}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Button variant="outline" disabled={pending} onClick={onClick}>
      <RefreshCw aria-hidden className={cn(pending && "animate-spin")} />
      {pending ? T.testing : T.test}
    </Button>
  );
}

/** Page « Services » : en-tête avec le test des connexions, puis une ligne par prestataire. */
export function ServicesPanel({ initial, meta }: { initial: ServiceState[]; meta?: ReactNode }) {
  const { states, pending, tested, test } = useServiceTest(initial);
  return (
    <>
      <AdminPageHeader section="services" meta={meta} actions={<TestButton pending={pending} onClick={test} />} />
      <Card>
        <ul className="divide-y" aria-busy={pending || undefined}>
          {states.map((s) => {
            const Icon = ICON[s.key];
            const testing = pending && s.mode === "live";
            return (
              <li key={s.key} className="flex min-h-16 items-center gap-3 px-(--card-px) py-3">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-meta wrap-break-word text-muted-foreground">{s.detail}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {testing ? <Spinner className="text-muted-foreground" /> : <ServiceStatusBadge status={s.status} />}
                  {tested && !testing && s.mode === "live" ? <span className="text-xs text-muted-foreground">{T.testedAt}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

/** Carte compacte de la vue d'ensemble : une ligne par service, détail en infobulle. */
export function ServicesSummaryCard({ initial }: { initial: ServiceState[] }) {
  const { states, pending, test } = useServiceTest(initial);
  return (
    <SectionCard
      flush
      title={adminFr.overview.servicesTitle}
      action={
        <div className="-my-1 flex items-center gap-1">
          <TestButton compact pending={pending} onClick={test} />
          <SeeAllLink href="/admin/services" label={adminFr.overview.servicesLink} context={adminFr.overview.servicesTitle} />
        </div>
      }
    >
      <ul className="divide-y" aria-busy={pending || undefined}>
        {states.map((s) => {
          const Icon = ICON[s.key];
          return (
            <li key={s.key} className="flex min-h-11 items-center gap-3 px-(--card-px) py-2" title={s.detail}>
              <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{s.label}</span>
              {pending && s.mode === "live" ? <Spinner className="text-muted-foreground" /> : <ServiceStatusBadge status={s.status} />}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

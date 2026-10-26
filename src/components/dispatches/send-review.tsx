"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Lock, Mail, Mailbox, Paperclip, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { DispatchRows } from "@/components/dispatches/dispatch-rows";
import { formatPrescriberName } from "@/components/prescribers/format";
import { estimatePostalAction, sendDocumentAction, type SentSummary } from "@/server/actions/dispatch";
import type { DispatchPlan } from "@/server/services/dispatch";
import type { DispatchListItem } from "@/server/services/hydrate";
import type { Channel } from "@/lib/schemas/dispatch";
import type { DeliveryProduct } from "@/lib/schemas/organization";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const euros = (cents: number, currency = "EUR") => new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);

export function SendReview({ plan, history, postalEnvLabel }: { plan: DispatchPlan; history: DispatchListItem[]; postalEnvLabel: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>(plan.defaultChannels);
  const [copyToCentre, setCopyToCentre] = useState(plan.email.copyToCentre);
  const [product, setProduct] = useState<DeliveryProduct>(plan.postal.options.deliveryProduct);
  const [spectrum, setSpectrum] = useState(plan.postal.options.printSpectrum);
  const [printMode, setPrintMode] = useState(plan.postal.options.printMode);
  const [estimate, setEstimate] = useState(plan.postal.estimate);
  const [estimating, setEstimating] = useState(false);
  const [results, setResults] = useState<SentSummary[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!plan.postal.available) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setEstimating(true);
      const res = await estimatePostalAction(plan.documentId, { deliveryProduct: product, printSpectrum: spectrum, printMode });
      if (!cancelled) {
        if (res.ok) setEstimate(res.data);
        setEstimating(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [product, spectrum, printMode, plan.documentId, plan.postal.available]);

  const toggle = (c: Channel) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  function send() {
    startTransition(async () => {
      const res = await sendDocumentAction(plan.documentId, { channels, copyToCentre, postal: { deliveryProduct: product, printSpectrum: spectrum, printMode } });
      if (!res.ok) return void toast.error(res.error);
      setResults(res.data);
      const failed = res.data.filter((d) => d.error);
      if (failed.length) toast.error("Un envoi a échoué", { description: failed.map((f) => f.error).join(" ") });
      else toast.success(channels.length > 1 ? "Document envoyé par e-mail et par courrier." : `Document envoyé (${fr.channels[channels[0]!].toLowerCase()}).`);
      router.refresh();
    });
  }

  const channelCard = (c: Channel, available: boolean, problem: string | null, icon: React.ReactNode, title: string, subtitle: string) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={channels.includes(c)}
      disabled={!available || Boolean(results)}
      onClick={() => toggle(c)}
      data-testid={`channel-${c}`}
      className={cn(
        "flex min-h-20 flex-1 items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed",
        channels.includes(c) ? "border-primary bg-accent" : "bg-card hover:bg-accent/60",
        !available && "opacity-60",
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{available ? subtitle : problem}</span>
      </span>
      <span aria-hidden className={cn("mt-1 flex size-5 items-center justify-center rounded border-2", channels.includes(c) ? "border-primary bg-primary text-primary-foreground" : "border-primary/60")}>
        {channels.includes(c) ? <CheckCircle2 className="size-3.5" /> : null}
      </span>
    </button>
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/documents/${plan.documentId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Document
        </Link>
        <h1 className="text-xl font-bold text-brand-fg">Envoi — {fr.documentTypes[plan.type]}</h1>
        <span className="text-muted-foreground">
          {plan.patientLabel} · v{plan.version}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-1 text-sm font-medium text-muted-foreground">Destinataire</h2>
            {plan.prescriber ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{formatPrescriberName(plan.prescriber)}</p>
                  <p className="text-sm text-muted-foreground">{[plan.prescriber.practiceName, plan.prescriber.address.city].filter(Boolean).join(" · ")}</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/prescripteurs/${plan.prescriber.id}`}>Modifier la fiche</Link>
                </Button>
              </div>
            ) : (
              <p className="text-destructive">Aucun prescripteur : rouvrez le document pour en choisir un.</p>
            )}
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            {channelCard("EMAIL", plan.email.available, plan.email.problem, <Mail className="size-5" aria-hidden />, fr.channels.EMAIL, plan.email.to ?? "")}
            {channelCard(
              "COURRIER",
              plan.postal.available,
              plan.postal.errors[0] ?? "Adresse postale incomplète.",
              <Mailbox className="size-5" aria-hidden />,
              fr.channels.COURRIER,
              estimate ? `≈ ${euros(estimate.cents, estimate.currency)} TTC` : "Prix calculé à l'envoi",
            )}
          </div>

          {channels.includes("EMAIL") ? (
            <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="E-mail">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">E-mail</h2>
                {plan.email.mode === "secure-link" ? (
                  <Badge tone="outline">
                    <Lock aria-hidden /> Lien sécurisé · {plan.email.secondFactor === "birthdate" ? "date de naissance" : "code séparé"} · {plan.email.validityDays} j
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <Paperclip aria-hidden /> PDF joint en clair
                  </Badge>
                )}
              </div>
              <dl className="grid gap-1 text-sm sm:grid-cols-[6rem_1fr]">
                <dt className="text-muted-foreground">À</dt>
                <dd>{plan.email.to}</dd>
                <dt className="text-muted-foreground">Objet</dt>
                <dd className="font-medium">{plan.email.subject}</dd>
                <dt className="text-muted-foreground">Réponses</dt>
                <dd>{plan.email.centreEmail || "—"}</dd>
              </dl>
              <Collapsible>
                <CollapsibleTrigger className="text-sm text-brand-fg underline-offset-4 hover:underline">Voir le message</CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">{plan.email.bodyText}</pre>
                </CollapsibleContent>
              </Collapsible>
              {plan.email.centreEmail ? (
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Checkbox checked={copyToCentre} onCheckedChange={(v) => setCopyToCentre(v === true)} disabled={Boolean(results)} />
                  Mettre le centre en copie ({plan.email.centreEmail})
                </label>
              ) : null}
            </section>
          ) : null}

          {channels.includes("COURRIER") ? (
            <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="Courrier postal">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">Courrier postal</h2>
                <Badge tone="outline">{postalEnvLabel}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Adresse imprimée (fenêtre de l&apos;enveloppe)</p>
                  <address className="rounded-lg border bg-surface-subtle p-3 font-sans text-sm leading-snug text-foreground not-italic">
                    {plan.postal.addressLines.map((l, i) => (
                      <span key={i} className="block">
                        {l}
                      </span>
                    ))}
                  </address>
                  {plan.postal.warnings.map((w) => (
                    <p key={w} className="mt-1 text-xs text-warning-foreground">
                      {w}
                    </p>
                  ))}
                </div>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="product" className="mb-1 block text-sm text-muted-foreground">
                      Affranchissement
                    </label>
                    <Select value={product} onValueChange={(v) => setProduct(v as DeliveryProduct)} disabled={Boolean(results)}>
                      <SelectTrigger id="product">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(fr.deliveryProducts) as DeliveryProduct[]).map((p) => (
                          <SelectItem key={p} value={p}>
                            {fr.deliveryProducts[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <SegmentedControl value={spectrum} onValueChange={setSpectrum} disabled={Boolean(results)} aria-label="Impression" fullWidth>
                    <SegmentedControlItem value="color">Couleur</SegmentedControlItem>
                    <SegmentedControlItem value="grayscale">Noir et blanc</SegmentedControlItem>
                  </SegmentedControl>
                  <SegmentedControl value={printMode} onValueChange={setPrintMode} disabled={Boolean(results)} aria-label="Recto / verso" fullWidth>
                    <SegmentedControlItem value="simplex">Recto</SegmentedControlItem>
                    <SegmentedControlItem value="duplex">Recto-verso</SegmentedControlItem>
                  </SegmentedControl>
                  <p className="text-sm">
                    {plan.postal.pages} pages (page d&apos;accompagnement incluse) ·{" "}
                    <strong>{estimating ? <Loader2 className="inline size-4 animate-spin" aria-label="Calcul" /> : estimate ? `≈ ${euros(estimate.cents, estimate.currency)}` : "prix indisponible"}</strong>
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {!plan.email.available && !plan.postal.available ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden />
              <AlertDescription>Ni e-mail ni adresse postale exploitable : complétez la fiche du prescripteur.</AlertDescription>
            </Alert>
          ) : null}

          {results ? (
            <section className="space-y-3 rounded-xl border bg-card p-5" role="status">
              <h2 className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-5 text-success-foreground" aria-hidden /> Envoi effectué
              </h2>
              <ul className="space-y-1 text-sm">
                {results.map((r) => (
                  <li key={r.id}>
                    {fr.channels[r.channel]} : {r.error ? <span className="text-destructive">{r.error}</span> : fr.dispatchStatus[r.status as keyof typeof fr.dispatchStatus]}
                    {" — "}
                    <Link className="underline" href={`/envois/${r.id}`}>
                      suivi
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/">Retour à l&apos;accueil</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/envois">Tous les envois</Link>
                </Button>
              </div>
            </section>
          ) : (
            <Button className="h-12 w-full text-base" disabled={pending || channels.length === 0} onClick={send} data-testid="send">
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {pending ? "Envoi en cours…" : channels.length === 2 ? "Envoyer par e-mail et courrier" : channels[0] === "COURRIER" ? "Envoyer par courrier" : "Envoyer par e-mail"}
            </Button>
          )}

          {history.length ? (
            <section className="rounded-xl border bg-card p-2">
              <h2 className="px-3 pt-2 text-sm font-medium text-muted-foreground">Envois précédents de ce document</h2>
              <DispatchRows items={history} canSend />
            </section>
          ) : null}
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <PdfPreview request={{ method: "GET", url: `/api/documents/${plan.documentId}/pdf?v=${plan.version}` }} label="Document envoyé" downloadUrl={`/api/documents/${plan.documentId}/pdf?telecharger=1`} />
        </aside>
      </div>
    </div>
  );
}

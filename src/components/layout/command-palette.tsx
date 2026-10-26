"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Activity,
  Archive,
  ArrowLeft,
  BarChart3,
  Building2,
  CircleAlert,
  ClipboardList,
  CornerDownLeft,
  Download,
  FilePen,
  FilePlus2,
  FileText,
  House,
  Inbox,
  Keyboard,
  LayoutDashboard,
  Mail,
  Moon,
  Palette,
  ScrollText,
  Search,
  Send,
  SendHorizontal,
  Settings2,
  Stethoscope,
  Sun,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Shortcut, type ShortcutKey } from "@/components/ui/shortcut";
import { Spinner } from "@/components/ui/spinner";
import { DocumentStatusBadge } from "@/components/documents/status-badge";
import { RelativeTime } from "@/components/layout/relative-time";
import { KeyCombo, KeySequence } from "@/components/layout/key-hints";
import { globalSearchAction, recentItemsAction, setActiveCentreAction, type SearchHit } from "@/server/actions/navigation";
import { useCreateDocument } from "@/hooks/use-create-document";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";
import { normalizeSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/lib/schemas/document";

const T = shellFr.palette;

interface PaletteContextValue {
  open: () => void;
  openHelp: () => void;
}

const PaletteContext = createContext<PaletteContextValue>({ open: () => {}, openHelp: () => {} });
export const useCommandPalette = () => useContext(PaletteContext);

/** Navigation au clavier : « g » puis une lettre (cf. aide clavier). */
export const NAV_SEQUENCES = {
  "/": ["g", "h"],
  "/documents": ["g", "d"],
  "/envois": ["g", "e"],
  "/patients": ["g", "p"],
  "/prescripteurs": ["g", "o"],
  "/compte": ["g", "c"],
} as const satisfies Record<string, readonly [string, string]>;

const ADMIN_SECTIONS: { href: string; key: keyof typeof fr.admin.nav.items; icon: LucideIcon; demoOnly?: boolean }[] = [
  { href: "/admin", key: "overview", icon: LayoutDashboard },
  { href: "/admin/marque", key: "brand", icon: Palette },
  { href: "/admin/centres", key: "centres", icon: Building2 },
  { href: "/admin/utilisateurs", key: "users", icon: UserCog },
  { href: "/admin/annuaire", key: "directory", icon: Stethoscope },
  { href: "/admin/modeles", key: "templates", icon: Mail },
  { href: "/admin/envois", key: "dispatch", icon: Settings2 },
  { href: "/admin/boite-demo", key: "demoOutbox", icon: Inbox, demoOnly: true },
  { href: "/admin/statistiques", key: "statistics", icon: BarChart3 },
  { href: "/admin/audit", key: "audit", icon: ScrollText },
  { href: "/admin/conservation", key: "retention", icon: Archive },
  { href: "/admin/services", key: "services", icon: Activity },
];

/** Vrai si chaque mot de la recherche figure dans le texte (sans accents ni casse). */
export function matchesQuery(query: string, ...texts: string[]): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch(texts.join(" "));
  return words.every((w) => haystack.includes(w));
}

/** Téléchargement d'une route API (export CSV) sans quitter la page. */
function downloadFile(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Nombre de résultats patients / ORL qui reçoivent des actions contextuelles (créer un document). */
const CONTEXTUAL_LIMIT = 3;

export interface PaletteCentre {
  id: string;
  name: string;
}

export function CommandPaletteProvider({
  isAdmin,
  canSend = false,
  centres = [],
  activeCentreId = null,
  demoOutbox = false,
  children,
}: {
  isAdmin: boolean;
  canSend?: boolean;
  centres?: PaletteCentre[];
  activeCentreId?: string | null;
  demoOutbox?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<"root" | "centres">("root");
  const [results, setResults] = useState<{ q: string; hits: SearchHit[] } | null>(null);
  const [recents, setRecents] = useState<SearchHit[] | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [creatingValue, setCreatingValue] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState(pathname);
  const latestQuery = useRef("");
  const { create, pending } = useCreateDocument();

  // Une navigation (création aboutie, lien suivi) referme la palette.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setQuery("");
    setPage("root");
  }

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setPage("root");
      router.push(href);
    },
    [router],
  );

  useHotkeys(
    {
      "mod+k": (e) => {
        e.preventDefault();
        setOpen((o) => !o);
      },
      "/": (e) => {
        e.preventDefault();
        setOpen(true);
      },
      a: (e) => {
        e.preventDefault();
        create("ADRESSAGE");
      },
      c: (e) => {
        e.preventDefault();
        create("COMPTE_RENDU");
      },
      "?": () => setShowHelp(true),
      ...Object.fromEntries(
        Object.entries(NAV_SEQUENCES).map(([href, keys]) => [
          keys.join(" "),
          (e: KeyboardEvent) => {
            e.preventDefault();
            router.push(href);
          },
        ]),
      ),
      ...(isAdmin
        ? {
            "g a": (e: KeyboardEvent) => {
              e.preventDefault();
              router.push("/admin");
            },
          }
        : {}),
    },
    [create, router, isAdmin],
  );

  // Recherche serveur (debounce 180 ms). Les anciens résultats restent affichés, estompés, jusqu'aux nouveaux.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    latestQuery.current = q;
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      let hits: SearchHit[] = [];
      try {
        hits = await globalSearchAction(q);
      } catch {
        hits = [];
      }
      if (latestQuery.current === q) setResults({ q, hits });
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  // Documents récents : rechargés à chaque ouverture (palette vide).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    recentItemsAction()
      .then((items) => {
        if (!cancelled) setRecents(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const ctx = useMemo<PaletteContextValue>(() => ({ open: () => setOpen(true), openHelp: () => setShowHelp(true) }), []);

  const trimmed = query.trim();
  const searchMode = trimmed.length >= 2;
  const searching = searchMode && results?.q !== trimmed;
  const hits = searchMode ? (results?.hits ?? []) : [];
  const stale = searching && hits.length > 0;

  function startCreate(value: string, type: DocumentType, opts: { patientId?: string; prescriberId?: string } = {}) {
    if (pending) return;
    setCreatingValue(value);
    create(type, opts);
  }

  function changeCentre(id: string) {
    const name = centres.find((c) => c.id === id)?.name ?? "";
    setOpen(false);
    setPage("root");
    setQuery("");
    void setActiveCentreAction(id).then((res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(shellFr.sidebar.centreChanged(name));
        router.refresh();
      }
    });
  }

  const isDark = resolvedTheme === "dark";
  const actions: { id: string; label: string; icon: LucideIcon; keys?: readonly ShortcutKey[]; run: () => void; keywords?: string }[] = [
    { id: "new-adressage", label: fr.home.newAdressage, icon: FilePlus2, keys: ["a"], run: () => startCreate("new-adressage", "ADRESSAGE"), keywords: "créer courrier" },
    { id: "new-cr", label: fr.home.newCompteRendu, icon: ClipboardList, keys: ["c"], run: () => startCreate("new-cr", "COMPTE_RENDU"), keywords: "créer appareillage" },
    { id: "new-patient", label: shellFr.create.newPatient, icon: UserPlus, run: () => go("/patients?nouveau=1"), keywords: "créer" },
    { id: "new-prescriber", label: shellFr.create.newPrescriber, icon: Stethoscope, run: () => go("/prescripteurs?nouveau=1"), keywords: "créer médecin" },
    ...(centres.length > 1
      ? [{ id: "switch-centre", label: T.switchCentre, icon: Building2, run: () => { setQuery(""); setPage("centres"); }, keywords: "centre actif" }]
      : []),
    { id: "theme", label: isDark ? T.themeLight : T.themeDark, icon: isDark ? Sun : Moon, run: () => { setTheme(isDark ? "light" : "dark"); setOpen(false); }, keywords: "thème apparence" },
    { id: "shortcuts", label: shellFr.help.title, icon: Keyboard, keys: ["?"], run: () => { setOpen(false); setShowHelp(true); }, keywords: "aide clavier" },
    ...(isAdmin
      ? [{ id: "export-audit", label: T.exportAudit, icon: Download, run: () => { setOpen(false); downloadFile("/api/admin/audit"); }, keywords: "administration csv" }]
      : []),
  ].filter((a) => matchesQuery(query, a.label, a.keywords ?? ""));

  const links: { href: string; label: string; icon: LucideIcon; seq?: readonly string[]; keywords?: string }[] = [
    { href: "/", label: fr.nav.home, icon: House, seq: NAV_SEQUENCES["/"] },
    { href: "/documents?statut=BROUILLON", label: T.draftsToFinish, icon: FilePen, keywords: "documents" },
    { href: "/documents?statut=VALIDE", label: T.readyToSend, icon: SendHorizontal, keywords: "documents validés" },
    { href: "/documents", label: fr.nav.documents, icon: FileText, seq: NAV_SEQUENCES["/documents"] },
    { href: "/envois", label: fr.nav.dispatches, icon: Send, seq: NAV_SEQUENCES["/envois"] },
    { href: "/envois?filtre=erreurs", label: T.sendErrors, icon: CircleAlert, keywords: "envois" },
    { href: "/prescripteurs", label: fr.nav.prescribers, icon: Stethoscope, seq: NAV_SEQUENCES["/prescripteurs"], keywords: "prescripteurs médecins" },
    { href: "/patients", label: fr.nav.patients, icon: Users, seq: NAV_SEQUENCES["/patients"] },
    { href: "/compte", label: fr.nav.account, icon: UserRound, seq: NAV_SEQUENCES["/compte"], keywords: "profil signature" },
  ].filter((i) => matchesQuery(query, i.label, i.keywords ?? ""));

  const adminLinks = isAdmin
    ? ADMIN_SECTIONS.filter((s) => !s.demoOnly || demoOutbox)
        .map((s) => ({ ...s, label: fr.admin.nav.items[s.key] }))
        .filter((s) => matchesQuery(query, s.label, fr.nav.admin))
    : [];

  const patientHits = hits.filter((h) => h.kind === "patient");
  const prescriberHits = hits.filter((h) => h.kind === "prescriber");
  const documentHits = hits.filter((h) => h.kind === "document");
  const showRecents = trimmed.length === 0 && page === "root" && (recents?.length ?? 0) > 0;
  const nothingFound = searchMode && !searching && hits.length === 0 && actions.length === 0 && links.length === 0 && adminLinks.length === 0;

  const spinnerFor = (value: string) => (pending && creatingValue === value ? <Spinner className="ml-auto size-4" /> : null);

  function renderDocument(h: SearchHit, prefix: string) {
    const Icon = h.docType === "COMPTE_RENDU" ? ClipboardList : FileText;
    return (
      <CommandItem key={`${prefix}-${h.id}`} value={`${prefix}-${h.id}`} onSelect={() => go(h.href)}>
        <Icon aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{h.title}</span>
          <span className="truncate text-meta text-muted-foreground">
            {h.subtitle}
            {h.updatedAt ? (
              <>
                {" · "}
                <RelativeTime date={h.updatedAt} />
              </>
            ) : null}
          </span>
        </span>
        {h.status ? <DocumentStatusBadge status={h.status} className="ml-2" /> : null}
      </CommandItem>
    );
  }

  return (
    <PaletteContext.Provider value={ctx}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPage("root");
        }}
        title={fr.nav.commandPalette}
        description={T.description}
      >
        <Command
          shouldFilter={false}
          className="relative"
          onKeyDown={(e) => {
            if (page !== "root" && e.key === "Backspace" && query === "") {
              e.preventDefault();
              setPage("root");
            }
          }}
        >
          <CommandInput
            placeholder={page === "centres" ? shellFr.sidebar.searchCentre : T.placeholder}
            value={query}
            onValueChange={setQuery}
            aria-busy={searching || undefined}
          />
          {searching ? (
            <Spinner aria-label={T.searching} className="absolute top-4 right-4 size-4 text-muted-foreground max-sm:right-24" />
          ) : null}
          <CommandList aria-busy={searching || undefined}>
            <CommandEmpty>{searching ? T.searching : fr.common.noResults}</CommandEmpty>

            {page === "centres" ? (
              <CommandGroup heading={T.centres}>
                <CommandItem value="back" onSelect={() => setPage("root")} className="text-muted-foreground">
                  <ArrowLeft aria-hidden /> {T.back}
                </CommandItem>
                {centres
                  .filter((c) => matchesQuery(query, c.name))
                  .map((c) => (
                    <CommandItem key={c.id} value={`centre-${c.id}`} data-checked={c.id === activeCentreId} onSelect={() => changeCentre(c.id)}>
                      <Building2 aria-hidden />
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.id === activeCentreId ? <span className="sr-only">({T.currentCentre})</span> : null}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ) : (
              <>
                {trimmed.length === 1 ? (
                  <p className="px-3 pt-2 pb-1 text-meta text-muted-foreground">{T.minChars}</p>
                ) : null}

                {showRecents ? (
                  <CommandGroup heading={T.recent}>{recents!.map((h) => renderDocument(h, "recent"))}</CommandGroup>
                ) : null}

                <div className={cn("transition-opacity duration-150", stale && "opacity-60")}>
                  {patientHits.length ? (
                    <CommandGroup heading={T.patients}>
                      {patientHits.map((h, i) => (
                        <PatientHit key={h.id} hit={h} contextual={i < CONTEXTUAL_LIMIT} go={go} startCreate={startCreate} spinnerFor={spinnerFor} />
                      ))}
                    </CommandGroup>
                  ) : null}
                  {prescriberHits.length ? (
                    <CommandGroup heading={T.prescribers}>
                      {prescriberHits.map((h, i) => (
                        <PrescriberHit key={h.id} hit={h} contextual={i < CONTEXTUAL_LIMIT} go={go} startCreate={startCreate} spinnerFor={spinnerFor} />
                      ))}
                    </CommandGroup>
                  ) : null}
                  {documentHits.length ? (
                    <CommandGroup heading={T.documents}>
                      {documentHits.flatMap((h) => [
                        renderDocument(h, "document"),
                        canSend && h.status === "VALIDE" ? (
                          <CommandItem
                            key={`send-${h.id}`}
                            value={`send-${h.id}`}
                            onSelect={() => go(`${h.href}/envoi`)}
                            className="pl-9 text-muted-foreground data-selected:text-foreground"
                          >
                            <Send aria-hidden />
                            <span className="truncate">{T.prepareSend(h.patientName ?? fr.documentTypesShort[h.docType ?? "ADRESSAGE"])}</span>
                          </CommandItem>
                        ) : null,
                      ])}
                    </CommandGroup>
                  ) : null}
                </div>

                {nothingFound ? (
                  <CommandGroup heading={T.noResult(trimmed)}>
                    <p className="px-2.5 pb-1 text-meta text-muted-foreground">{T.noResultHint}</p>
                    <CommandItem value="create-patient" onSelect={() => go("/patients?nouveau=1")}>
                      <UserPlus aria-hidden /> {T.createPatient}
                    </CommandItem>
                    <CommandItem value="create-prescriber" onSelect={() => go("/prescripteurs?nouveau=1")}>
                      <Stethoscope aria-hidden /> {T.addPrescriber}
                    </CommandItem>
                  </CommandGroup>
                ) : null}

                {hits.length || showRecents ? <CommandSeparator /> : null}
                {actions.length ? (
                  <CommandGroup heading={T.actions}>
                    {actions.map((a) => (
                      <CommandItem key={a.id} value={a.id} onSelect={a.run}>
                        <a.icon aria-hidden /> <span className="flex-1 truncate">{a.label}</span>
                        {spinnerFor(a.id) ??
                          (a.keys ? (
                            <CommandShortcut>
                              <Shortcut keys={a.keys} />
                            </CommandShortcut>
                          ) : null)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {links.length ? (
                  <CommandGroup heading={T.goTo}>
                    {links.map((i) => (
                      <CommandItem key={i.href} value={i.href} onSelect={() => go(i.href)}>
                        <i.icon aria-hidden /> <span className="flex-1 truncate">{i.label}</span>
                        {i.seq ? (
                          <CommandShortcut>
                            <KeySequence keys={i.seq} />
                          </CommandShortcut>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {adminLinks.length ? (
                  <CommandGroup heading={T.admin}>
                    {adminLinks.map((i) => (
                      <CommandItem key={i.href} value={i.href} onSelect={() => go(i.href)}>
                        <i.icon aria-hidden /> <span className="flex-1 truncate">{i.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </>
            )}
          </CommandList>
          <div
            aria-hidden
            className="flex shrink-0 items-center gap-4 border-t bg-surface-subtle px-4 py-2 text-2xs text-muted-foreground pointer-coarse:hidden"
          >
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {T.footer.navigate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft />
              </Kbd>{" "}
              {T.footer.open}
            </span>
            {page !== "root" ? (
              <span className="inline-flex items-center gap-1.5">
                <Kbd>⌫</Kbd> {T.footer.back}
              </span>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5">
              <Kbd>{T.footer.escape}</Kbd> {T.footer.close}
            </span>
          </div>
        </Command>
      </CommandDialog>
      <ShortcutsHelp open={showHelp} onOpenChange={setShowHelp} isAdmin={isAdmin} />
    </PaletteContext.Provider>
  );
}

type StartCreate = (value: string, type: DocumentType, opts?: { patientId?: string; prescriberId?: string }) => void;

/** Patient trouvé, suivi (pour les premiers résultats) de « Nouvel adressage / compte rendu pour … ». */
function PatientHit({
  hit,
  contextual,
  go,
  startCreate,
  spinnerFor,
}: {
  hit: SearchHit;
  contextual: boolean;
  go: (href: string) => void;
  startCreate: StartCreate;
  spinnerFor: (value: string) => ReactNode;
}) {
  return (
    <>
      <CommandItem value={`patient-${hit.id}`} onSelect={() => go(hit.href)}>
        <UserRound aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{hit.title}</span>
          <span className="truncate text-meta text-muted-foreground">{hit.subtitle}</span>
        </span>
      </CommandItem>
      {contextual ? (
        <>
          <CommandItem
            value={`adr-${hit.id}`}
            onSelect={() => startCreate(`adr-${hit.id}`, "ADRESSAGE", { patientId: hit.id })}
            className="pl-9 text-muted-foreground data-selected:text-foreground"
          >
            <FilePlus2 aria-hidden />
            <span className="flex-1 truncate">{T.newAdressageFor(hit.title)}</span>
            {spinnerFor(`adr-${hit.id}`)}
          </CommandItem>
          <CommandItem
            value={`cr-${hit.id}`}
            onSelect={() => startCreate(`cr-${hit.id}`, "COMPTE_RENDU", { patientId: hit.id })}
            className="pl-9 text-muted-foreground data-selected:text-foreground"
          >
            <ClipboardList aria-hidden />
            <span className="flex-1 truncate">{T.newCompteRenduFor(hit.title)}</span>
            {spinnerFor(`cr-${hit.id}`)}
          </CommandItem>
        </>
      ) : null}
    </>
  );
}

/** ORL trouvé, suivi de « Adresser un patient au Dr … » (adressage avec cet ORL pré-rempli). */
function PrescriberHit({
  hit,
  contextual,
  go,
  startCreate,
  spinnerFor,
}: {
  hit: SearchHit;
  contextual: boolean;
  go: (href: string) => void;
  startCreate: StartCreate;
  spinnerFor: (value: string) => ReactNode;
}) {
  return (
    <>
      <CommandItem value={`prescriber-${hit.id}`} onSelect={() => go(hit.href)}>
        <Stethoscope aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{hit.title}</span>
          {hit.subtitle ? <span className="truncate text-meta text-muted-foreground">{hit.subtitle}</span> : null}
        </span>
      </CommandItem>
      {contextual ? (
        <CommandItem
          value={`refer-${hit.id}`}
          onSelect={() => startCreate(`refer-${hit.id}`, "ADRESSAGE", { prescriberId: hit.id })}
          className="pl-9 text-muted-foreground data-selected:text-foreground"
        >
          <FilePlus2 aria-hidden />
          <span className="flex-1 truncate">{T.referTo(hit.civility ?? "", hit.title)}</span>
          {spinnerFor(`refer-${hit.id}`)}
        </CommandItem>
      ) : null}
    </>
  );
}

/** Aide clavier : touches adaptées à la plateforme, regroupées par contexte. */
function ShortcutsHelp({ open, onOpenChange, isAdmin }: { open: boolean; onOpenChange: (o: boolean) => void; isAdmin: boolean }) {
  const H = shellFr.help;
  const groups: { title: string; rows: { label: string; combo?: readonly ShortcutKey[]; seq?: readonly string[]; alt?: readonly ShortcutKey[] }[] }[] = [
    {
      title: H.groups.general,
      rows: [
        { label: H.items.palette, combo: ["mod", "k"], alt: ["/"] },
        { label: H.items.help, combo: ["?"] },
        { label: H.items.sidebar, combo: ["mod", "b"] },
      ],
    },
    {
      title: H.groups.create,
      rows: [
        { label: H.items.adressage, combo: ["a"] },
        { label: H.items.compteRendu, combo: ["c"] },
      ],
    },
    {
      title: H.groups.navigation,
      rows: [
        { label: H.items.goHome, seq: NAV_SEQUENCES["/"] },
        { label: H.items.goDocuments, seq: NAV_SEQUENCES["/documents"] },
        { label: H.items.goDispatches, seq: NAV_SEQUENCES["/envois"] },
        { label: H.items.goPatients, seq: NAV_SEQUENCES["/patients"] },
        { label: H.items.goPrescribers, seq: NAV_SEQUENCES["/prescripteurs"] },
        { label: H.items.goAccount, seq: NAV_SEQUENCES["/compte"] },
        ...(isAdmin ? [{ label: fr.nav.admin, seq: ["g", "a"] as const }] : []),
      ],
    },
    {
      title: H.groups.document,
      rows: [
        { label: H.items.save, combo: ["mod", "s"] },
        { label: H.items.validate, combo: ["mod", "enter"] },
        { label: H.items.paste, combo: ["mod", "v"] },
      ],
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{H.title}</DialogTitle>
          <DialogDescription>{H.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">{g.title}</h3>
              <dl className="divide-y">
                {g.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <dt>{r.label}</dt>
                    <dd className="flex shrink-0 items-center gap-2">
                      {r.seq ? <KeySequence keys={r.seq} withThen alwaysVisible /> : null}
                      {r.combo ? <KeyCombo keys={r.combo} /> : null}
                      {r.alt ? (
                        <>
                          <span className="text-2xs text-muted-foreground">{shellFr.help.or}</span>
                          <KeyCombo keys={r.alt} />
                        </>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Bouton de recherche de l'en-tête : champ factice avec raccourci sur ordinateur,
 * simple loupe de 44 px sur téléphone (un seul élément, repositionné).
 */
export function SearchButton({ className }: { className?: string }) {
  const { open } = useCommandPalette();
  return (
    <Button
      variant="outline"
      onClick={open}
      aria-label={shellFr.header.searchLabel}
      aria-keyshortcuts="Control+K Meta+K /"
      className={cn(
        "min-w-0 shrink justify-start gap-2 text-muted-foreground max-md:size-11 max-md:justify-center max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:shadow-none md:w-72 lg:w-80",
        className,
      )}
      data-testid="open-palette"
    >
      <Search aria-hidden className="max-md:size-5!" />
      <span className="flex-1 text-left max-md:sr-only">{shellFr.header.search}</span>
      <Shortcut keys={["mod", "k"]} className="max-md:hidden" />
    </Button>
  );
}

/** Ouvre l'aide clavier (bouton de l'en-tête, ordinateur uniquement). */
export function ShortcutsButton({ className }: { className?: string }) {
  const { openHelp } = useCommandPalette();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openHelp}
      aria-label={shellFr.header.shortcuts}
      aria-keyshortcuts="?"
      title={shellFr.header.shortcuts}
      className={cn("text-muted-foreground pointer-coarse:hidden", className)}
    >
      <Keyboard aria-hidden />
    </Button>
  );
}

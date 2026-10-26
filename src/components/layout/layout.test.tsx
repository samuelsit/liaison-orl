// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorSection } from "@/components/documents/editor/section";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { FilterChip, FilterSearch } from "./filter-bar";
import { ListRow, ListRows } from "./list-row";
import { PageHeader } from "./page-header";
import { SaveBar } from "./save-bar";
import { StatTile, StatTiles } from "./stat-tile";

afterEach(cleanup);

describe("PageHeader", () => {
  it("rend un seul h1 et transforme l'ancien lien de retour en fil d'Ariane", () => {
    render(
      <PageHeader
        title="Mme Jeanne DURAND"
        back={{ href: "/patients", label: "Patients" }}
        description="Née le 12/03/1946"
      />,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Fil d'Ariane" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Patients" }).getAttribute("href")).toBe("/patients");
  });

  it("sert de sous-titre h2 dans l'administration", () => {
    render(<PageHeader title="Statistiques" level={2} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Statistiques" })).toBeTruthy();
  });
});

describe("ListRow", () => {
  it("place le lien principal en premier dans le DOM, avant les actions", () => {
    render(
      <TooltipProvider>
        <ListRows>
          <ListRow
            href="/documents/abc"
            title="Mme Jeanne DURAND"
            subtitle="Adressage · Dr Marc DUBOIS"
            date="2026-10-09T21:25:00Z"
            actions={[{ label: "Préparer l'envoi", icon: <svg />, href: "/documents/abc/envoi" }]}
          />
        </ListRows>
      </TooltipProvider>,
    );
    const links = screen.getAllByRole("link");
    expect(links[0]!.getAttribute("href")).toBe("/documents/abc");
    expect(links[0]!.textContent).toContain("Mme Jeanne DURAND");
    expect(screen.getByRole("link", { name: "Préparer l'envoi" }).getAttribute("href")).toBe("/documents/abc/envoi");
    const time = document.querySelector("time")!;
    expect(time.getAttribute("dateTime")).toBe("2026-10-09T21:25:00.000Z");
    expect(time.getAttribute("title")).toContain("9 octobre 2026");
  });
});

describe("FilterSearch / FilterChip", () => {
  function Search() {
    const [q, setQ] = useState("dupont");
    return <FilterSearch value={q} onValueChange={setQ} placeholder="Nom, ville…" data-testid="prescriber-search" />;
  }

  it("efface la recherche au bouton et à Échap", () => {
    render(<Search />);
    const input = screen.getByTestId("prescriber-search") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Nom, ville…");
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "martin" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });

  it("annonce l'état d'une puce bouton ou lien", () => {
    const onActiveChange = vi.fn();
    render(
      <>
        <FilterChip active={false} onActiveChange={onActiveChange}>
          Mes documents
        </FilterChip>
        <FilterChip active href="/documents?type=ADRESSAGE">
          Adressage
        </FilterChip>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mes documents" }));
    expect(onActiveChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Mes documents" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("link", { name: "Adressage" }).getAttribute("aria-current")).toBe("true");
  });
});

describe("SaveBar", () => {
  it("n'apparaît qu'en cas de modification et enregistre avec Ctrl/⌘ + S", () => {
    const onSave = vi.fn();
    const { rerender } = render(<SaveBar dirty={false} onSave={onSave} onReset={() => {}} />);
    expect(screen.queryByRole("region", { name: "Modifications non enregistrées" })).toBeNull();

    rerender(<SaveBar dirty onSave={onSave} onReset={() => {}} />);
    expect(screen.getByRole("region", { name: "Modifications non enregistrées" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Enregistrer/ })).toHaveLength(1);

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("useDirtyState", () => {
  it("détecte, annule et valide les modifications", () => {
    const { result } = renderHook(() => useDirtyState({ days: 30 }));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValue({ days: 45 }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.value).toEqual({ days: 30 });
    act(() => result.current.setValue({ days: 60 }));
    act(() => result.current.commit());
    expect(result.current.dirty).toBe(false);
    expect(result.current.value).toEqual({ days: 60 });
  });
});

describe("EditorSection", () => {
  it("expose son état pour le navigateur de sections", () => {
    render(
      <EditorSection title="Identification" id="sec-identity" step={1} status="complete">
        <p>contenu</p>
      </EditorSection>,
    );
    const section = document.getElementById("sec-identity")!;
    expect(section.dataset.sectionTitle).toBe("Identification");
    expect(section.dataset.sectionStatus).toBe("complete");
    expect(section.hasAttribute("data-editor-section")).toBe(true);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Identification");
    expect(screen.getByRole("region", { name: /Identification/ })).toBe(section);
  });
});

describe("StatTile", () => {
  it("associe libellé et valeur, et colore l'écart selon le sens souhaité", () => {
    render(
      <StatTiles>
        <StatTile
          label="Erreurs d'envoi"
          value="4"
          delta={{ value: "+2", direction: "up", period: "vs 30 j précédents", upIsGood: false }}
        />
      </StatTiles>,
    );
    expect(screen.getByRole("term").textContent).toBe("Erreurs d'envoi");
    const delta = screen.getAllByRole("definition")[1]!;
    expect(delta.className).toContain("text-destructive");
  });
});

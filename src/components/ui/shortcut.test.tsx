// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { keyLabel, Shortcut } from "./shortcut";

describe("Shortcut", () => {
  it("affiche la touche de commande selon la plateforme", () => {
    expect(keyLabel("mod", true)).toBe("⌘");
    expect(keyLabel("mod", false)).toBe("Ctrl");
    expect(keyLabel("alt", false)).toBe("Alt");
    expect(keyLabel("enter", false)).toBe("↵");
    expect(keyLabel("escape", true)).toBe("Échap");
    expect(keyLabel("k", true)).toBe("K");
  });

  it("rend « Ctrl » côté serveur (postes Windows majoritaires) et se masque au toucher", () => {
    const html = renderToString(<Shortcut keys={["mod", "k"]} />);
    expect(html).toContain("Ctrl");
    expect(html).toContain(">K<");
    expect(html).toContain("pointer-coarse:hidden");
  });
});

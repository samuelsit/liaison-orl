import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("conserve les paliers typographiques du projet à côté d'une couleur de texte", () => {
    expect(cn("text-meta text-muted-foreground")).toBe("text-meta text-muted-foreground");
    expect(cn("text-2xs text-muted-foreground")).toBe("text-2xs text-muted-foreground");
    expect(cn("text-display text-foreground")).toBe("text-display text-foreground");
  });

  it("résout les conflits de taille de texte, y compris avec les paliers du projet", () => {
    expect(cn("text-sm", "text-meta")).toBe("text-meta");
    expect(cn("text-meta", "text-xs")).toBe("text-xs");
    expect(cn("h-9 px-3", "h-11")).toBe("px-3 h-11");
  });
});

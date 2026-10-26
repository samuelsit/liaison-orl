import { describe, expect, it } from "vitest";
import { addressLines, channelReadiness, contactText, formatPrescriberName } from "./format";

const address = { line1: "12 rue de la Paix", line2: "", postalCode: "75002", city: "Paris", country: "FRANCE" };
const noAddress = { line1: "", line2: "", postalCode: "", city: "Paris", country: "FRANCE" };

describe("channelReadiness", () => {
  it("accepte le canal préféré quand ses coordonnées sont complètes", () => {
    expect(channelReadiness({ email: "a@b.fr", address: noAddress, preferredChannel: "email" })).toEqual({
      email: true,
      post: false,
      preferredUsable: true,
      suggestion: null,
    });
    expect(channelReadiness({ email: "", address, preferredChannel: "courrier" }).preferredUsable).toBe(true);
  });

  it("propose l'autre canal quand le canal préféré est inutilisable", () => {
    expect(channelReadiness({ email: "", address, preferredChannel: "email" })).toMatchObject({ preferredUsable: false, suggestion: "courrier" });
    expect(channelReadiness({ email: "a@b.fr", address: noAddress, preferredChannel: "courrier" }).suggestion).toBe("email");
  });

  it("« les deux » exige e-mail et adresse ; sans aucune coordonnée, pas de suggestion", () => {
    expect(channelReadiness({ email: "a@b.fr", address: noAddress, preferredChannel: "both" })).toMatchObject({ preferredUsable: false, suggestion: "email" });
    expect(channelReadiness({ email: "a@b.fr", address, preferredChannel: "both" }).preferredUsable).toBe(true);
    expect(channelReadiness({ email: " ", address: noAddress, preferredChannel: "both" })).toMatchObject({ email: false, suggestion: null });
  });
});

describe("coordonnées", () => {
  it("met l'adresse en lignes sans lignes vides", () => {
    expect(addressLines(address)).toEqual(["12 rue de la Paix", "75002 Paris", "FRANCE"]);
  });

  it("assemble un bloc copiable", () => {
    const p = { civility: "Dr", firstName: "sarah", lastName: "Benali", practiceName: "Pôle Santé", address, email: "s@b.fr", phone: "" };
    expect(formatPrescriberName(p)).toBe("Dr Sarah BENALI");
    expect(contactText(p)).toBe("Dr Sarah BENALI\nPôle Santé\n12 rue de la Paix\n75002 Paris\nFRANCE\ns@b.fr");
  });
});

import { describe, expect, it } from "vitest";
import { nextStatusAllowed } from "./status";

describe("nextStatusAllowed", () => {
  it("ne fait qu'avancer", () => {
    expect(nextStatusAllowed("sent", "delivered")).toBe(true);
    expect(nextStatusAllowed("delivered", "sent")).toBe(false);
    expect(nextStatusAllowed("opened", "delivered")).toBe(false);
    expect(nextStatusAllowed("sent", "sent")).toBe(false);
  });

  it("accepte les erreurs et la reprise après « action requise »", () => {
    expect(nextStatusAllowed("sent", "bounced")).toBe(true);
    expect(nextStatusAllowed("action_required", "sent")).toBe(true);
    expect(nextStatusAllowed("undeliverable", "posted")).toBe(false);
  });

  it("ne modifie plus un envoi annulé", () => {
    expect(nextStatusAllowed("cancelled", "sent")).toBe(false);
    expect(nextStatusAllowed("cancelled", "failed")).toBe(false);
  });

  it("ne transforme pas un e-mail ouvert en rejet (webhook rejoué)", () => {
    expect(nextStatusAllowed("opened", "bounced")).toBe(false);
  });
});

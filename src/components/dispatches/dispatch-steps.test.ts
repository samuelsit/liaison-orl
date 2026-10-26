import { describe, expect, it } from "vitest";
import { dispatchSteps, isLiveStatus, stepIndex } from "./dispatch-steps";

const T0 = "2026-10-11T21:25:00.000Z";
const T1 = "2026-10-11T21:25:05.000Z";
const T2 = "2026-10-11T21:25:20.000Z";
const T3 = "2026-10-11T22:00:00.000Z";

const states = (steps: ReturnType<typeof dispatchSteps>) => steps.map((s) => s.state);

describe("stepIndex", () => {
  it("place chaque statut positif dans le parcours du canal", () => {
    expect(stepIndex("EMAIL", "queued")).toBe(0);
    expect(stepIndex("EMAIL", "sent")).toBe(1);
    expect(stepIndex("EMAIL", "delivered")).toBe(2);
    expect(stepIndex("EMAIL", "opened")).toBe(3);
    expect(stepIndex("COURRIER", "awaiting_confirmation")).toBe(0);
    expect(stepIndex("COURRIER", "printing")).toBe(2);
    expect(stepIndex("COURRIER", "posted")).toBe(3);
  });

  it("renvoie -1 pour les erreurs et l'annulation", () => {
    expect(stepIndex("EMAIL", "bounced")).toBe(-1);
    expect(stepIndex("COURRIER", "cancelled")).toBe(-1);
  });
});

describe("dispatchSteps", () => {
  it("e-mail délivré : deux étapes franchies, l'étape actuelle, puis la consultation à venir", () => {
    const steps = dispatchSteps({
      channel: "EMAIL",
      status: "delivered",
      createdAt: T0,
      events: [
        { status: "queued", at: T0 },
        { status: "sent", at: T1 },
        { status: "delivered", at: T2 },
      ],
    });
    expect(steps.map((s) => s.key)).toEqual(["created", "sent", "delivered", "opened"]);
    expect(states(steps)).toEqual(["done", "done", "current", "upcoming"]);
    expect(steps[0]!.at).toBe(T0);
    expect(steps[1]!.at).toBe(T1);
    expect(steps[2]!.at).toBe(T2);
    expect(steps[3]!.at).toBeNull();
  });

  it("e-mail consulté : toutes les étapes sont franchies (aucune étape « actuelle »)", () => {
    const steps = dispatchSteps({ channel: "EMAIL", status: "opened", createdAt: T0, openedAt: T3, deliveredAt: T2, events: [{ status: "sent", at: T1 }] });
    expect(states(steps)).toEqual(["done", "done", "done", "done"]);
    expect(steps[2]!.at).toBe(T2);
    expect(steps[3]!.at).toBe(T3);
  });

  it("e-mail rejeté après acceptation : l'erreur prend la place de « Délivré »", () => {
    const steps = dispatchSteps({
      channel: "EMAIL",
      status: "bounced",
      createdAt: T0,
      events: [
        { status: "queued", at: T0 },
        { status: "sent", at: T1 },
        { status: "bounced", at: T2 },
      ],
    });
    expect(states(steps)).toEqual(["done", "done", "error", "upcoming"]);
    expect(steps[2]!.status).toBe("bounced");
    expect(steps[2]!.at).toBe(T2);
  });

  it("courrier en échec dès la création : l'erreur suit l'étape « Créé »", () => {
    const steps = dispatchSteps({ channel: "COURRIER", status: "failed", createdAt: T0, events: [{ status: "queued", at: T0 }, { status: "failed", at: T1 }] });
    expect(states(steps)).toEqual(["done", "error", "upcoming", "upcoming"]);
  });

  it("courrier non distribuable après remise à La Poste : la dernière étape passe en erreur", () => {
    const steps = dispatchSteps({
      channel: "COURRIER",
      status: "undeliverable",
      createdAt: T0,
      events: [
        { status: "sent", at: T1 },
        { status: "printing", at: T2 },
        { status: "posted", at: T3 },
        { status: "undeliverable", at: T3 },
      ],
    });
    expect(states(steps)).toEqual(["done", "done", "done", "error"]);
  });

  it("courrier annulé avant impression", () => {
    const steps = dispatchSteps({ channel: "COURRIER", status: "cancelled", createdAt: T0, events: [{ status: "queued", at: T0 }, { status: "cancelled", at: T1 }] });
    expect(states(steps)).toEqual(["done", "cancelled", "upcoming", "upcoming"]);
    expect(steps[1]!.status).toBe("cancelled");
  });

  it("courrier en file : la création est l'étape actuelle", () => {
    const steps = dispatchSteps({ channel: "COURRIER", status: "queued", createdAt: T0, events: [] });
    expect(states(steps)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(steps[0]!.at).toBe(T0);
  });

  it("n'invente pas d'horodatage pour une étape franchie sans événement daté", () => {
    const steps = dispatchSteps({ channel: "COURRIER", status: "posted", createdAt: T0, sentAt: T1, events: [] });
    expect(states(steps)).toEqual(["done", "done", "done", "done"]);
    expect(steps[1]!.at).toBe(T1);
    expect(steps[2]!.at).toBeNull();
  });
});

describe("isLiveStatus", () => {
  it("vrai tant que l'envoi peut évoluer", () => {
    expect(isLiveStatus("queued")).toBe(true);
    expect(isLiveStatus("sent")).toBe(true);
    expect(isLiveStatus("delivered")).toBe(true);
    expect(isLiveStatus("printing")).toBe(true);
  });
  it("faux pour les statuts finaux et les erreurs", () => {
    expect(isLiveStatus("opened")).toBe(false);
    expect(isLiveStatus("posted")).toBe(false);
    expect(isLiveStatus("cancelled")).toBe(false);
    expect(isLiveStatus("bounced")).toBe(false);
    expect(isLiveStatus("action_required")).toBe(false);
  });
});

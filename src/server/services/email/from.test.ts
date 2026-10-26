import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { formatFrom, senderAddress } from "./from";
import { EmailSendError, emailErrorHint } from "./types";

function withEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  resetEnvCache();
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("senderAddress", () => {
  it("construit l'adresse à partir du domaine, même saisi avec un préfixe", () => {
    for (const domain of ["mail.exemple.fr", "https://mail.exemple.fr/", "@mail.exemple.fr", "contact@mail.exemple.fr", " mail.exemple.fr. "]) {
      withEnv({ EMAIL_FROM_ADDRESS: "", EMAIL_FROM_DOMAIN: domain });
      expect(senderAddress()).toEqual({ address: "ne-pas-repondre@mail.exemple.fr", configured: true, issue: null });
    }
  });

  it("extrait l'adresse d'une saisie « Nom <adresse> »", () => {
    withEnv({ EMAIL_FROM_ADDRESS: "Harmonie Audition <envoi@mail.exemple.fr>" });
    expect(senderAddress().address).toBe("envoi@mail.exemple.fr");
    expect(senderAddress().issue).toBeNull();
  });

  it("signale une configuration absente ou invalide", () => {
    withEnv({ EMAIL_FROM_ADDRESS: "", EMAIL_FROM_DOMAIN: "" });
    expect(senderAddress().issue).toMatch(/EMAIL_FROM_DOMAIN manquant/);
    withEnv({ EMAIL_FROM_DOMAIN: "mail exemple" });
    expect(senderAddress().issue).toMatch(/EMAIL_FROM_DOMAIN invalide/);
    withEnv({ EMAIL_FROM_ADDRESS: "pas une adresse" });
    expect(senderAddress().issue).toMatch(/EMAIL_FROM_ADDRESS invalide/);
  });
});

describe("formatFrom", () => {
  it("neutralise les caractères qui cassent l'en-tête From", () => {
    withEnv({ EMAIL_FROM_DOMAIN: "mail.exemple.fr" });
    expect(formatFrom('Centre "Paris" <15e>\r\ncontact@x')).toBe('"Centre Paris 15e contact x" <ne-pas-repondre@mail.exemple.fr>');
    expect(formatFrom("Harmonie Audition — Évreux")).toBe('"Harmonie Audition — Évreux" <ne-pas-repondre@mail.exemple.fr>');
    expect(formatFrom("  ")).toBe("ne-pas-repondre@mail.exemple.fr");
  });
});

describe("emailErrorHint", () => {
  it("n'accuse le prescripteur que pour un refus portant sur le destinataire", () => {
    const fromErr = new EmailSendError("Invalid `from` field. The email address needs to follow the `email@example.com` format.", "validation_error", false);
    expect(emailErrorHint(fromErr)).toMatch(/Adresse d'expédition refusée/);
    expect(emailErrorHint(new EmailSendError("The mail.exemple.fr domain is not verified.", "validation_error", false))).toMatch(/domaine d'expédition n'est pas vérifié/);
    expect(emailErrorHint(new EmailSendError("EMAIL_FROM_DOMAIN manquant", "sender_config", false))).toMatch(/administrateur/);
    expect(emailErrorHint(new EmailSendError("Invalid `to` field.", "validation_error", false))).toMatch(/prescripteur/);
    expect(emailErrorHint(new EmailSendError("Rate limit", "rate_limit_exceeded", true))).toBe("Réessayez dans quelques minutes.");
  });
});

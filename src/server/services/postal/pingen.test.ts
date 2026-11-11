import { describe, expect, it, vi } from "vitest";
import { authError } from "./pingen";

describe("authError (Pingen)", () => {
  it("indique l'environnement utilisé et la raison renvoyée par Pingen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = new Response(JSON.stringify({ error: "invalid_client", error_description: "Client authentication failed" }), { status: 401 });
    const err = await authError(res, "staging", "https://identity-staging.pingen.com");
    expect(err.code).toBe("auth");
    expect(err.message).toContain("staging");
    expect(err.message).toContain("HTTP 401");
    expect(err.message).toContain("invalid_client");
    expect(err.hint).toContain("STAGING");
  });

  it("reste lisible si le corps n'est pas du JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = await authError(new Response("oops", { status: 400 }), "production", "https://identity.pingen.com");
    expect(err.message).toBe("Authentification Pingen refusée (production, HTTP 400).");
    expect(err.hint).toContain("app.pingen.com");
  });
});

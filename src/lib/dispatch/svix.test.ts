import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "./svix";

const secret = `whsec_${Buffer.from("cle-secrete-de-test").toString("base64")}`;
const sign = (id: string, ts: number, body: string) => createHmac("sha256", Buffer.from("cle-secrete-de-test")).update(`${id}.${ts}.${body}`).digest("base64");

describe("signature des webhooks Resend", () => {
  const now = 1_800_000_000_000;
  const ts = Math.floor(now / 1000);
  const body = '{"type":"email.delivered"}';
  it("accepte une signature valide parmi plusieurs", () => {
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: String(ts), signature: `v1,xxx v1,${sign("msg_1", ts, body)}`, body, now })).toBe(true);
  });
  it("refuse un corps modifié, une signature absente ou un horodatage trop ancien", () => {
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: String(ts), signature: `v1,${sign("msg_1", ts, body)}`, body: body + " ", now })).toBe(false);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: String(ts), signature: null, body, now })).toBe(false);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: String(ts - 600), signature: `v1,${sign("msg_1", ts - 600, body)}`, body, now })).toBe(false);
  });
});

/**
 * npm run admin:create — premier démarrage en production.
 *
 * Crée l'organisation (thème par défaut, modifiable ensuite dans Administration → Marque),
 * un premier centre et le premier administrateur, puis affiche un lien d'activation (48 h)
 * permettant de choisir son mot de passe. La double authentification sera exigée à la
 * première connexion. Si Resend est configuré, le lien est aussi envoyé par e-mail.
 *
 * Les valeurs peuvent être passées en arguments (sinon elles sont demandées) :
 *   --email --prenom --nom --titre --organisation
 *   --centre --adresse --code-postal --ville --telephone --email-centre
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomUUID } from "node:crypto";
import { loadEnv } from "./lib/load-env";
loadEnv();

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const { mongoUri } = await import("@/lib/env");
  const { collections } = await import("@/lib/db/collections");
  const { ensureIndexes } = await import("@/lib/db/indexes");
  const { closeDb } = await import("@/lib/db/client");
  const { DEFAULT_COLORS, DEFAULT_FONTS, defaultSettings } = await import("@/lib/brand");
  const { centreInputSchema } = await import("@/lib/schemas/centre");
  const { emailSchema } = await import("@/lib/schemas/common");
  const { provisionUser } = await import("@/server/services/users");
  const { getAuth } = await import("@/lib/auth/server");
  const { emailProvider, setEmailProvider } = await import("@/server/services/email");
  const { audit } = await import("@/server/audit");

  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (name: string, label: string, fallback = ""): Promise<string> => {
    const given = argValue(name);
    if (given !== undefined) return given.trim();
    const answer = (await rl.question(`${label}${fallback ? ` [${fallback}]` : ""} : `)).trim();
    return answer || fallback;
  };

  console.log(`\nBase cible : ${mongoUri().replace(/\/\/[^@]*@/, "//***@")}\n`);
  await ensureIndexes();

  let org = await collections().organizations().findOne({});
  if (org?.demo) {
    throw new Error("Cette base contient l'organisation de démonstration. Utilisez une base vide pour la production (ou `npm run seed` pour la démo).");
  }
  const now = new Date();
  if (!org) {
    const name = await ask("organisation", "Nom de l'organisation", "Harmonie Audition");
    const logo = `data:image/png;base64,${readFileSync(path.resolve("assets/brand/logo-default.png")).toString("base64")}`;
    org = {
      _id: randomUUID(),
      name,
      brand: { name, slogan: "", logo, colors: { ...DEFAULT_COLORS }, fonts: { ...DEFAULT_FONTS } },
      legal: { companyName: name, mentions: "" },
      settings: defaultSettings(),
      demo: false,
      createdAt: now,
      updatedAt: now,
    };
    await collections().organizations().insertOne(org);
    console.log(`✓ Organisation « ${name} » créée (thème par défaut).`);
  }

  if ((await collections().centres().countDocuments({ organizationId: org._id })) === 0) {
    console.log("\nPremier centre (les autres se créent dans Administration → Centres) :");
    const centre = centreInputSchema.parse({
      name: await ask("centre", "Nom du centre (ex. Paris 11)"),
      address: {
        line1: await ask("adresse", "Adresse"),
        postalCode: await ask("code-postal", "Code postal"),
        city: await ask("ville", "Ville"),
      },
      phone: await ask("telephone", "Téléphone"),
      email: await ask("email-centre", "E-mail du centre"),
    });
    await collections().centres().insertOne({ _id: randomUUID(), organizationId: org._id, ...centre, createdAt: now, updatedAt: now });
    console.log(`✓ Centre « ${centre.name} » créé.`);
  }

  console.log("\nPremier administrateur :");
  const email = emailSchema.parse(await ask("email", "E-mail"));
  const firstName = await ask("prenom", "Prénom");
  const lastName = await ask("nom", "Nom");
  const title = await ask("titre", "Titre", "Direction");
  rl.close();
  if (!firstName || !lastName) throw new Error("Prénom et nom obligatoires.");

  const centreIds = (await collections().centres().find({ organizationId: org._id }).toArray()).map((c) => c._id);
  const userId = await provisionUser({ email, firstName, lastName, title, role: "admin", organizationId: org._id, centreIds, canSend: true });
  await audit(null, "user.invite", "user", userId, { role: "admin", source: "admin:create" }, org._id);

  // Le lien d'activation est intercepté pour être affiché ici, et transmis à Resend s'il est configuré.
  const real = emailProvider();
  let activationUrl = "";
  setEmailProvider({
    name: real.name,
    mode: real.mode,
    ping: () => real.ping(),
    async send(message) {
      activationUrl = /https?:\/\/\S+reset-password\S+/.exec(message.text)?.[0] ?? "";
      return real.mode === "live" ? real.send(message) : { id: "console" };
    },
  });
  await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/bienvenue" } });

  console.log(`\n✓ Administrateur ${firstName} ${lastName} <${email}> créé.`);
  if (real.mode === "live") console.log("  Un e-mail d'activation lui a été envoyé.");
  console.log(`\nLien d'activation (valable 48 h, à usage unique) :\n  ${activationUrl || "(introuvable — utilisez « Mot de passe oublié » sur l'écran de connexion)"}`);
  console.log("\nÀ la première connexion, la double authentification (application TOTP) sera exigée.\n");
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(`\nÉchec : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

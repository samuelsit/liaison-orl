import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { magicLink, twoFactor } from "better-auth/plugins";
import { appUrl, authSecret, env, rateLimitDisabled } from "@/lib/env";
import { db } from "@/lib/db/client";
import { collections } from "@/lib/db/collections";
import { emailProvider } from "@/server/services/email";
import { emailBrand, renderEmail } from "@/server/emails/render";
import { invitationEmail, magicLinkEmail, resetPasswordEmail } from "@/server/emails/system";
import { emailFr } from "@/lib/i18n/email";
import { getDefaultOrganization, getOrganization } from "@/server/repositories/organizations";

async function brandFor(email: string) {
  const user = await collections().users().findOne({ email: email.toLowerCase() });
  const org = user ? await getOrganization(user.organizationId) : await getDefaultOrganization();
  return { org, user };
}


function createAuth() {
  return betterAuth({
    appName: "Liaison ORL",
    baseURL: appUrl(),
    secret: authSecret(),
    trustedOrigins: [appUrl()],
    database: mongodbAdapter(db()),
    advanced: {
      database: { generateId: () => randomUUID() },
      cookiePrefix: "lorl",
      useSecureCookies: env().NODE_ENV === "production" && appUrl().startsWith("https://"),
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
    },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "assistant" },
        organizationId: { type: "string", input: false, defaultValue: "" },
        centreIds: { type: "string[]", input: false, defaultValue: [] },
        firstName: { type: "string", input: false, defaultValue: "" },
        lastName: { type: "string", input: false, defaultValue: "" },
        title: { type: "string", input: false, defaultValue: "" },
        active: { type: "boolean", input: false, defaultValue: true },
        canSend: { type: "boolean", input: false, defaultValue: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60 * 48,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const { org, user: doc } = await brandFor(user.email);
        const isInvitation = url.includes("bienvenue");
        const content = isInvitation
          ? invitationEmail({ brand: emailBrand(org), url, firstName: doc?.firstName ?? "", inviter: "Votre administrateur" })
          : resetPasswordEmail({ brand: emailBrand(org), url });
        const { html, text } = await renderEmail(content);
        await emailProvider().send({
          kind: isInvitation ? "invitation" : "reset-password",
          organizationId: org?._id ?? null,
          fromName: org?.brand.name ?? "",
          to: [user.email],
          subject: isInvitation ? emailFr.invitation.subject : emailFr.resetPassword.subject,
          html,
          text,
        });
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await collections().users().findOne({ _id: session.userId });
            if (!user || user.active === false) return false;
            return { data: session };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/magic-link") return;
        const email = typeof ctx.body?.email === "string" ? ctx.body.email.toLowerCase() : "";
        const user = email ? await collections().users().findOne({ email }) : null;
        if (user && (user.role === "admin" || user.twoFactorEnabled)) {
          throw new APIError("FORBIDDEN", {
            message:
              "La connexion par lien n'est pas disponible pour ce compte protégé par double authentification. Utilisez votre mot de passe.",
          });
        }
      }),
    },
    rateLimit: {
      enabled: !rateLimitDisabled() && env().NODE_ENV !== "test",
      storage: "database",
      window: 60,
      max: 120,
      customRules: {
        "/sign-in/email": { window: 60, max: 6 },
        "/sign-in/magic-link": { window: 60, max: 3 },
        "/two-factor/verify-totp": { window: 60, max: 6 },
        "/two-factor/verify-backup-code": { window: 60, max: 6 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    plugins: [
      twoFactor({ issuer: "Liaison ORL", backupCodeOptions: { storeBackupCodes: "encrypted" } }),
      magicLink({
        expiresIn: 60 * 15,
        disableSignUp: true,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          const { org, user } = await brandFor(email);
          if (!user || user.active === false) return;
          const { html, text } = await renderEmail(magicLinkEmail({ brand: emailBrand(org), url }));
          await emailProvider().send({
            kind: "magic-link",
            organizationId: org?._id ?? null,
            fromName: org?.brand.name ?? "",
            to: [email],
            subject: emailFr.magicLink.subject,
            html,
            text,
          });
        },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __lorlAuth?: Auth };

/** Instance Better Auth créée à la première utilisation (jamais pendant le build). */
export function getAuth(): Auth {
  if (!globalForAuth.__lorlAuth) globalForAuth.__lorlAuth = createAuth();
  return globalForAuth.__lorlAuth;
}

/** Réinitialise l'instance (tests). */
export function resetAuth() {
  globalForAuth.__lorlAuth = undefined;
}

import "server-only";
import { collections } from "@/lib/db/collections";
import type { CentreDoc, OrganizationDoc } from "@/lib/db/types";
import { organizationSettingsSchema } from "@/lib/schemas/organization";

/** Applique les valeurs par défaut des réglages ajoutés après la création de l'organisation. */
function withDefaults(o: OrganizationDoc): OrganizationDoc {
  const parsed = organizationSettingsSchema.safeParse(o.settings);
  return parsed.success ? { ...o, settings: parsed.data } : o;
}

const TTL_MS = 15_000;
let orgCache: { at: number; byId: Map<string, OrganizationDoc>; first: OrganizationDoc | null } | null = null;

function fresh() {
  return orgCache && Date.now() - orgCache.at < TTL_MS;
}

export function invalidateOrganizationCache() {
  orgCache = null;
}

async function load() {
  const orgs = (await collections().organizations().find({}).sort({ createdAt: 1 }).toArray()).map(withDefaults);
  orgCache = { at: Date.now(), byId: new Map(orgs.map((o) => [o._id, o])), first: orgs[0] ?? null };
  return orgCache;
}

export async function getOrganization(id: string): Promise<OrganizationDoc | null> {
  const c = fresh() ? orgCache! : await load();
  const found = c.byId.get(id) ?? (await collections().organizations().findOne({ _id: id }));
  return found ? withDefaults(found) : null;
}

/** V1 : une seule organisation. Utilisé pour les pages publiques (connexion, lien sécurisé). */
export async function getDefaultOrganization(): Promise<OrganizationDoc | null> {
  const c = fresh() ? orgCache! : await load();
  return c.first;
}

export async function listCentres(organizationId: string, opts: { includeInactive?: boolean } = {}): Promise<CentreDoc[]> {
  return collections()
    .centres()
    .find({ organizationId, ...(opts.includeInactive ? {} : { active: true }) })
    .sort({ name: 1 })
    .toArray();
}

export async function getCentre(organizationId: string, centreId: string): Promise<CentreDoc | null> {
  return collections().centres().findOne({ _id: centreId, organizationId });
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SendReview } from "@/components/dispatches/send-review";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { pingenEnvironment, serviceModes } from "@/lib/env";
import { UserFacingError } from "@/server/actions/result";
import { prepareDispatch } from "@/server/services/dispatch";
import { hydrateDispatches } from "@/server/services/hydrate";

export const metadata: Metadata = { title: "Envoi" };

export default async function SendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  if (!can(ctx.user, "document.send", ctx.organization.settings)) redirect(`/documents/${id}`);
  let plan;
  try {
    plan = await prepareDispatch(ctx, id);
  } catch (err) {
    if (err instanceof UserFacingError) redirect(`/documents/${id}`);
    throw err;
  }
  const history = await hydrateDispatches(await collections().dispatches().find({ documentId: id }).sort({ createdAt: -1 }).limit(20).toArray());
  const postalEnvLabel = serviceModes().postal === "mock" ? "Simulation : aucun courrier réel" : pingenEnvironment() === "staging" ? "Pingen — environnement de test" : "Pingen — production";
  return <SendReview plan={plan} history={history} postalEnvLabel={postalEnvLabel} />;
}

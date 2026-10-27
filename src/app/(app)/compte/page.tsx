import type { Metadata } from "next";
import { AccountForms } from "@/components/account/account-forms";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser();
  const doc = await collections().users().findOne({ _id: user.id });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={fr.nav.account} description={fr.roles[user.role]} />
      <AccountForms profile={{ firstName: user.firstName, lastName: user.lastName, title: user.title, rpps: doc?.rpps ?? "" }} signature={doc?.signature ?? null} twoFactorEnabled={user.twoFactorEnabled} email={user.email} />
    </div>
  );
}

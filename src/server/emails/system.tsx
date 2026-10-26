import { Text } from "@react-email/components";
import { EmailButton, EmailLayout, type EmailBrand } from "./layout";

export function MagicLinkEmail({ brand, url }: { brand: EmailBrand; url: string }) {
  return (
    <EmailLayout brand={brand} preview="Votre lien de connexion">
      <Text>Bonjour,</Text>
      <Text>Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable 15 minutes et ne peut servir qu&apos;une fois.</Text>
      <EmailButton href={url} label="Me connecter" color={brand.primary} />
      <Text style={{ fontSize: 13, color: "#6B7280" }}>
        Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez simplement cet e-mail.
      </Text>
    </EmailLayout>
  );
}

export function InvitationEmail({ brand, url, firstName, inviter }: { brand: EmailBrand; url: string; firstName: string; inviter: string }) {
  return (
    <EmailLayout brand={brand} preview="Votre accès à l'outil de liaison ORL">
      <Text>Bonjour {firstName},</Text>
      <Text>
        {inviter} vous a créé un accès à l&apos;outil de liaison avec les ORL et médecins prescripteurs de {brand.name}. Choisissez
        votre mot de passe pour activer votre compte (lien valable 48 heures).
      </Text>
      <EmailButton href={url} label="Activer mon compte" color={brand.primary} />
    </EmailLayout>
  );
}

export function ResetPasswordEmail({ brand, url }: { brand: EmailBrand; url: string }) {
  return (
    <EmailLayout brand={brand} preview="Réinitialisation de votre mot de passe">
      <Text>Bonjour,</Text>
      <Text>Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 48 heures.</Text>
      <EmailButton href={url} label="Choisir un nouveau mot de passe" color={brand.primary} />
      <Text style={{ fontSize: 13, color: "#6B7280" }}>Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez cet e-mail.</Text>
    </EmailLayout>
  );
}

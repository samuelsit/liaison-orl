# LIAISON ORL — Cahier des charges pour Claude Code

Outil web assisté par IA pour que les audioprothésistes des centres Harmonie Audition préparent, complètent et envoient aux ORL (et autres prescripteurs) leurs courriers d'adressage et comptes rendus d'appareillage, par e-mail et/ou courrier postal.

Ce fichier est la référence du projet. Lis-le en entier avant chaque tâche.

---

## 0. MODE AUTONOME — À RESPECTER EN PRIORITÉ

Le propriétaire du projet veut un produit fini, utilisable en production, sans être sollicité pendant la construction.

- Ne pose AUCUNE question. Face à une ambiguïté, choisis l'option la plus simple, la plus robuste et la plus agréable pour l'utilisateur final, puis note-la dans `DECISIONS.md` (date, décision, raison, alternative écartée).
- Enchaîne toutes les phases de la section 10 sans attendre de validation. À la fin de chaque phase : `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` doivent passer. Corrige jusqu'à ce que ce soit vert avant de continuer.
- Tiens à jour `PROGRESS.md` : phases terminées, en cours, restantes, problèmes connus.
- L'application doit tourner SANS aucune clé d'API : chaque service externe (IA, Pingen, Resend, S3) a un mode "mock" activé automatiquement si sa clé est absente (IA → réponses fictives réalistes, Pingen/Resend → envois simulés avec statuts qui évoluent, stockage → disque local en dev). Un bandeau discret "Mode démo" s'affiche dans l'admin quand un service est en mock.
- Fournis un `.env.example` complet et commenté, un script `npm run seed` (organisation, 11 centres, utilisateurs de chaque rôle, 30 ORL, 20 patients, documents à tous les statuts, bilans auditifs fictifs en PDF et image) et un `README.md` de mise en production pas à pas (création des comptes MongoDB Atlas, Vercel, Resend, Pingen, Anthropic, S3 ; variables d'environnement ; domaine ; webhooks ; premier admin).
- Ne t'arrête que lorsque toutes les phases sont terminées et que le parcours complet fonctionne de bout en bout en mode démo. Termine par un résumé dans `PROGRESS.md`.

---

## 1. Contexte

- Réseau de centres auditifs (11+ centres en Île-de-France et Normandie, nouvelles ouvertures en cours, réseau de franchise en préparation).
- Utilisateurs : audioprothésistes D.E. (rôle principal), assistant(e)s, administrateurs.
- Deux documents existants à reproduire fidèlement en PDF (modèles dans /docs/modeles/) :
  1. COURRIER D'ADRESSAGE — l'audioprothésiste adresse un patient à un ORL (vérification des conduits auditifs externes, bilan auditif, autre motif libre).
  2. COMPTE RENDU D'APPAREILLAGE — retour au médecin prescripteur après appareillage.
- Logiciel métier patient : Cosium ; agenda : Doctolib. Pas d'intégration en V1, mais saisie la plus rapide possible.

## 2. Principes non négociables

### 2.1 Sécurité des données patients

- TLS partout ; fichiers dans un bucket S3 privé (région eu-west-3 Paris), accès uniquement par URL signée courte durée ; chiffrement côté serveur activé.
- MongoDB Atlas en région UE (Paris ou Francfort), accès réseau restreint, utilisateur base à droits minimaux.
- Journal d'audit : qui a consulté / créé / modifié / envoyé quoi, quand.
- Durée de conservation paramétrable par l'admin + purge automatique (Vercel Cron).
- IA : pseudonymiser avant chaque appel (nom, prénom, date de naissance remplacés par des jetons, réinjectés après). Ne transmettre que le nécessaire.
- E-mail : par défaut, lien sécurisé à durée limitée vers le PDF (second facteur : date de naissance du patient ou code envoyé séparément). Option admin "joindre le PDF directement".

### 2.2 Marque configurable

L'entreprise doit changer de nom avant fin 2027. Aucun nom, logo, couleur, slogan ou coordonnée en dur : tout vient de la configuration (organisation → centres). Thème par défaut :

- Bleu #1F3F7A, orange #E8632B, Comfortaa pour les titres, Inter pour le texte de l'interface.

### 2.3 Multi-centres, prêt pour le multi-organisation

Organisation → Centres → Utilisateurs. V1 = une seule organisation, mais toutes les requêtes filtrent par organisationId.

### 2.4 L'IA propose, l'humain valide

Rien n'est envoyé sans validation explicite de l'audioprothésiste. Les champs remplis par l'IA portent un badge "Suggéré par l'IA" jusqu'à validation.

## 3. Stack (imposée)

- Next.js (App Router, dernière version stable) + TypeScript strict, Server Components, Server Actions.
- UI : Tailwind CSS + shadcn/ui + Radix, icônes Lucide, animations discrètes (Framer Motion), cmdk pour la palette de commandes, Sonner pour les toasts.
- Formulaires : React Hook Form + Zod (schémas partagés client/serveur).
- Auth : Better Auth (e-mail + mot de passe, lien magique, 2FA TOTP obligatoire pour les admins), adaptateur MongoDB.
- Base : MongoDB Atlas (driver officiel ou Mongoose, au choix — documenter dans DECISIONS.md). Index sur organisationId, centreId, recherche texte sur ORL et patients.
- Hébergement : Vercel. Tâches planifiées via Vercel Cron.
- Fichiers : AWS S3 (SDK v3, URL présignées).
- PDF : @react-pdf/renderer côté serveur (compatible Vercel, pas de Chromium). Gabarits en composants, rendu identique aux modèles fournis. Polices embarquées.
- E-mail : Resend (+ React Email pour les gabarits). Webhooks Resend pour les statuts (délivré, ouvert, rejeté) avec vérification de signature.
- Courrier postal : Pingen (API v2 REST, voir 7.2).
- IA : API Anthropic (voir 6.3).
- Tests : Vitest (unitaires), Playwright (E2E des parcours clés, exécutés en mode démo).

## 4. Rôles et droits

| Rôle             | Peut faire                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Admin            | Tout : organisation, centres, utilisateurs, annuaire ORL global, modèles, paramètres IA/e-mail/courrier, audit, statistiques |
| Audioprothésiste | Ses centres : patients, documents, envois ; ajout/modification d'ORL                                                         |
| Assistant(e)     | Brouillons, saisie patients/ORL ; envoi seulement si l'admin l'autorise                                                      |

Un utilisateur peut avoir plusieurs centres ; sélecteur de centre actif dans la barre latérale. Toutes les vérifications de droits côté serveur.

## 5. Modèle de données (collections)

- organizations : nom, marque (logo, couleurs, polices, slogan), mentions légales, paramètres (IA, envoi, conservation).
- centres : nom, adresse, téléphone, e-mail, signature par défaut, adresse d'expéditeur postal.
- users : nom, prénom, titre ("Audioprothésiste D.E"), rôle, centres, signature scannée (image), préférences et valeurs par défaut mémorisées.
- prescribers (ORL/médecins) : civilité, nom, prénom, spécialité, RPPS (optionnel), cabinet, adresse postale structurée (ligne 1, ligne 2, code postal, ville, pays), e-mail, téléphone, canal préféré (email / courrier / les deux), formule d'appel ("Cher Confrère", "Chère Madame"…), notes, centres associés, favori, actif/archivé.
- patients : civilité, nom, prénom, date de naissance, centre, prescripteur habituel.
- documents : type (ADRESSAGE | COMPTE_RENDU), patient, prescripteur, centre, auteur, données (validées par Zod, schéma versionné), statut (BROUILLON | VALIDÉ | ENVOYÉ | ERREUR), clé S3 du PDF, version.
- attachments : bilan auditif (PDF/image), clé S3, extraction IA (JSON + confiance par champ), confirmée oui/non.
- dispatches : document, canal (EMAIL | COURRIER), destinataire, statut, id externe (Resend / Pingen), coût, horodatages, événements reçus.
- auditLogs : utilisateur, action, entité, horodatage, IP.

## 6. Les deux documents

### 6.1 Courrier d'adressage

Champs : patient (Mme/M., nom), examens (vérification des conduits auditifs externes, bilan auditif, autre + texte libre), audioprothésiste, centre, date.
IA : à partir de quelques mots dictés ou tapés ("bouchon cérumen OD, vertiges depuis 3 semaines"), formulation médicale sobre pour le motif "Autre".

### 6.2 Compte rendu d'appareillage

Champs : date du jour, Dr, date d'ordonnance, nom, prénom, date de naissance, degré de surdité (légère/moyenne/sévère/profonde), oreille(s), type (intra-auriculaire/écouteur déporté/contour classique), marque (Signia/Starkey/GN ReSound/autre), modèle, prix par appareil, classe (CMU/1/2), rechargeable, embouts sur mesure, durée de port moyen + heures/jour, motivation, acquisition de la manipulation, commentaires.

Fonction phare — l'audioprothésiste joint le bilan auditif (PDF exporté, capture ou photo prise au téléphone). L'IA :

1. Extrait : seuils en conduction aérienne et osseuse par oreille et fréquence (125/250 → 8000 Hz), audiométrie vocale (seuil d'intelligibilité, % d'intelligibilité), tests dans le bruit si présents, mesures en champ libre sans/avec appareils.
2. Affiche l'extraction dans un tableau éditable + un audiogramme redessiné (SVG, conventions standard : O rouge oreille droite, X bleu oreille gauche), pour correction avant suite.
3. Pré-remplit le degré de surdité (classification BIAP sur la perte moyenne 500/1000/2000/4000 Hz, règle affichée) et les oreilles.
4. Calcule le gain prothétique (sans/avec appareil, par fréquence et moyen ; gain en intelligibilité) — en code TypeScript testé, jamais par le modèle.
5. Rédige le commentaire : 4 à 8 lignes, ton confraternel, avec gain tonal moyen, gain en intelligibilité, adaptation, observance, points de vigilance, suite prévue. Bouton "Régénérer" avec choix : plus court / plus détaillé / plus technique.

### 6.3 IA — choix des modèles (meilleur rapport qualité/prix)

- Lecture du bilan auditif (vision, précision critique) : `claude-sonnet-5-5`. Entrée PDF native ou image ; sortie via tool use avec schéma JSON strict.
- Rédaction (commentaire, motif d'adressage, objet/corps d'e-mail, nettoyage de dictée) : `claude-haiku-5-5`.
- Identifiants de modèles dans des variables d'environnement (`AI_MODEL_VISION`, `AI_MODEL_TEXT`) pour changer sans redéployer de code.
- Prompt caching sur les instructions système ; limites de taille d'image (redimensionner/compresser avant envoi).
- Ne jamais inventer une valeur absente : "non détecté" + saisie manuelle. Confiance par champ ; champs à faible confiance surlignés en orange.
- Sortie validée par Zod ; en cas d'échec, une nouvelle tentative puis bascule en saisie manuelle avec message clair.
- Prompts versionnés dans /src/ai/prompts/, testés sur les bilans fictifs du seed.
- Compteur de consommation IA par centre visible dans l'admin.

## 7. Envoi

### 7.1 E-mail (Resend)

- Expéditeur au nom du centre sur un domaine vérifié ; Reply-To = e-mail du centre ; copie optionnelle au centre.
- Objet et corps depuis un modèle éditable par l'admin ; lien sécurisé (cf. 2.1) ou PDF joint selon le paramètre.
- Statuts mis à jour par webhook (signature vérifiée).

### 7.2 Courrier postal (Pingen API v2)

- Auth OAuth2 client_credentials ; jeton mis en cache jusqu'à expiration.
- Environnement staging de Pingen utilisé automatiquement hors production (`PINGEN_ENV=staging|production`). Aucun envoi réel hors production.
- Le PDF postal doit contenir l'adresse du destinataire dans la zone fenêtre de l'enveloppe attendue par Pingen (vérifier la spécification exacte de zone et marges dans la doc Pingen et la respecter au millimètre). Générer pour l'envoi postal une version du document avec bloc adresse destinataire (et adresse expéditeur du centre) positionné dans cette zone ; la dernière ligne de l'adresse est le pays (FRANCE).
- Création de la lettre avec envoi automatique désactivé, puis déclenchement de l'envoi après validation finale de l'utilisateur. Options : produit d'acheminement, recto, couleur/noir & blanc — valeurs par défaut réglables par l'admin.
- Validation d'adresse avant envoi ; prix affiché avant confirmation quand l'API le permet.
- Statuts via webhooks Pingen (signature vérifiée) ; gestion explicite des refus (adresse invalide, PDF non conforme) avec message compréhensible et action de correction.

### 7.3 Commun

- Écran récapitulatif avant envoi : aperçu PDF exact, destinataire, canaux, coût courrier, alertes (e-mail ou adresse manquants).
- Envoi groupé de plusieurs documents validés.
- Historique par patient et par ORL ; renvoi en un clic ; idempotence (pas de double envoi sur double clic ou webhook rejoué).

## 8. UI/UX

Objectif : un compte rendu complet en moins de 2 minutes, un adressage en moins de 30 secondes.

- Accueil orienté action : deux grands boutons "Nouvel adressage" / "Nouveau compte rendu", puis "À finir", "Envoyés récemment", "Erreurs d'envoi".
- Palette de commandes (Cmd/Ctrl+K) : patient, ORL, document, actions.
- Création en un écran : formulaire à gauche, aperçu PDF en direct à droite (mobile : onglets Formulaire / Aperçu).
- Choix de l'ORL : autocomplétion (nom, ville, cabinet), favoris et récents en tête, création rapide en fenêtre sans quitter le formulaire.
- Dépôt du bilan : glisser-déposer, coller une image, "Prendre une photo" sur mobile ; progression par étapes lisibles ("Lecture du bilan", "Extraction des seuils", "Rédaction du commentaire").
- Dictée vocale (Web Speech API) pour commentaires et motifs, nettoyée par l'IA.
- Valeurs par défaut apprises : marque, classe, rechargeable… pré-remplies selon les choix fréquents de l'utilisateur.
- Sauvegarde automatique des brouillons ; aucune perte de saisie.
- États soignés : squelettes de chargement, états vides illustrés avec action, erreurs avec solution.
- Navigation clavier complète, WCAG AA, contrastes vérifiés, cibles tactiles ≥ 44 px.
- Responsive tablette et téléphone ; mode sombre.
- Toasts pour chaque action, annulation quand c'est réversible.
- Français partout, vouvoiement, libellés métier exacts.

## 9. Espace admin

- Organisation et marque (logo, couleurs, polices, slogan, mentions) avec aperçu en direct des PDF.
- Centres, utilisateurs (invitation par e-mail, rôles, rattachements), annuaire ORL global (import CSV, dédoublonnage, fusion).
- Modèles : e-mails, formules de politesse, ton de l'IA, champs optionnels.
- Paramètres d'envoi : options Pingen par défaut, lien sécurisé ou pièce jointe, validité des liens.
- Statistiques : documents par centre / audioprothésiste / ORL, coûts courrier, consommation IA, taux d'erreur.
- Journal d'audit filtrable et exportable (CSV).
- État des services (IA, Resend, Pingen, S3 : connecté / mode démo / erreur).

## 10. Phases (à enchaîner sans pause)

1. Socle : projet, design system (tokens de marque), auth + rôles, modèle de données, seed, layout (barre latérale, sélecteur de centre, palette de commandes), mocks des services.
2. Annuaire ORL + patients : CRUD, recherche, favoris, import CSV.
3. Documents : formulaires, aperçu en direct, PDF identiques aux modèles, brouillons, statuts.
4. IA : extraction du bilan, tableau de correction, audiogramme, calculs (degré, gain), rédactions.
5. Envois : Resend (lien sécurisé), Pingen (staging), webhooks, historique, envoi groupé.
6. Admin complet, statistiques, audit, purge.
7. Finition : tests E2E du parcours complet, sécurité (en-têtes, limitation de débit, revue des accès), performance, accessibilité, README de mise en production.

## 11. Conventions

- TypeScript strict, aucune `any`. Zod comme source de vérité des types.
- Composants nommés en anglais ; textes de l'interface en français, centralisés.
- Aucun secret dans le code ; `.env.example` à jour.
- Chaque fonctionnalité livrée avec ses tests.
- Commits petits et explicites, un par étape logique.

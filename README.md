# Liaison ORL

Outil web pour les audioprothésistes du réseau : préparer et compléter les **courriers d'adressage** (affichés, imprimés et téléchargés en PDF) et les **comptes rendus d'appareillage**, envoyés aux ORL (et autres prescripteurs) par e-mail sécurisé et/ou courrier postal. L'IA lit le bilan auditif, calcule le degré de surdité (BIAP) et le gain prothétique, et propose les textes ; l'audioprothésiste relit et valide toujours avant envoi.

Ce document explique :

1. [comment essayer l'application en 5 minutes, sans aucun compte ni clé](#1-essayer-en-mode-démo) ;
2. [comment la mettre en production pas à pas](#2-mise-en-production-pas-à-pas) ;
3. [comment l'exploiter au quotidien](#3-exploitation).

> ⚠️ **Données de santé.** L'application manipule l'identité des patients, leurs audiogrammes et leurs appareillages. En France, l'hébergement de données de santé pour le compte de professionnels de santé doit être confié à des prestataires **certifiés HDS** (article L.1111-8 du Code de la santé publique). Avant d'y saisir des données réelles, lisez la section [Conformité](#29-conformité-à-valider-avant-les-données-réelles). En attendant, utilisez uniquement les données fictives de démonstration.

---

## 1. Essayer en mode démo

Le mode démo fonctionne **sans aucune clé** : la base de données est embarquée, l'IA répond avec des résultats réalistes simulés, les e-mails et les courriers sont simulés (aucun envoi réel, aucun coût) et les fichiers sont stockés sur le disque.

**Prérequis :** [Node.js 22 ou plus récent](https://nodejs.org) et MongoDB installé localement (`brew install mongodb-community` sur Mac). Sans MongoDB installé, la base embarquée télécharge automatiquement un binaire au premier lancement.

```bash
npm install
npm run demo          # base locale + données fictives + application sur http://localhost:3000
npm run demo -- --reset   # repartir de données de démonstration neuves
```

L'écran de connexion affiche les comptes de démonstration (mot de passe commun : `Demo-Liaison-2026!`) :

| Compte | Rôle |
|---|---|
| `direction@demo.test` | Administratrice (double authentification : le code du moment est affiché à l'écran en mode démo) |
| `claire.morel@demo.test` | Audioprothésiste (centres d'Île-de-France) |
| `julien.bernard@demo.test` | Audioprothésiste (Normandie) |
| `karim.haddad@demo.test` | Audioprothésiste (Val-d'Oise / Seine-Saint-Denis) |
| `lea.petit@demo.test` | Assistante, sans droit d'envoi |
| `nadia.roux@demo.test` | Assistante, avec droit d'envoi |

Des **bilans auditifs fictifs** (PDF et photos) sont fournis dans [demo/bilans/](demo/bilans/) : glissez-les dans un compte rendu pour voir la lecture par l'IA. Les e-mails simulés (avec leur lien sécurisé cliquable) sont visibles dans **Administration → Boîte d'envoi (démo)**.

---

## 2. Mise en production pas à pas

Comptez une demi-journée. Suivez l'ordre ci-dessous : chaque étape fournit des valeurs dont la suivante a besoin. Notez au fur et à mesure chaque valeur dans un gestionnaire de mots de passe : ce sont des **secrets**.

| Étape | Service | Ce que vous obtenez |
|---|---|---|
| 2.1 | MongoDB Atlas | `MONGODB_URI` |
| 2.2 | AWS S3 | `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| 2.3 | Anthropic | `ANTHROPIC_API_KEY` |
| 2.4 | Resend | `RESEND_API_KEY`, `EMAIL_FROM_DOMAIN`, puis `RESEND_WEBHOOK_SECRET` |
| 2.5 | Pingen | `PINGEN_CLIENT_ID`, `PINGEN_CLIENT_SECRET`, `PINGEN_ORGANISATION_ID`, `PINGEN_WEBHOOK_SECRET` |
| 2.6 | Vercel + domaine | l'adresse de l'application (`APP_URL`), le déploiement |
| 2.7 | — | le premier administrateur |

Deux secrets se génèrent vous-même, dans un terminal :

```bash
openssl rand -base64 32   # → BETTER_AUTH_SECRET (sessions, signatures) — ne JAMAIS le changer ensuite sans prévoir de reconnecter tout le monde
openssl rand -hex 24      # → CRON_SECRET (protège les tâches planifiées)
```

Tout service laissé sans clé reste **simulé** : vous pouvez donc mettre en ligne progressivement (par exemple sans courrier postal au début). Un bandeau « Mode démo » rappelle alors à l'administrateur quels services sont simulés.

### 2.1 MongoDB Atlas (base de données)

1. Créez un compte sur [cloud.mongodb.com](https://cloud.mongodb.com), puis une **organisation** et un **projet** « Liaison ORL ».
2. **Create cluster** → choisissez un cluster **dédié (M10 ou plus)** chez **AWS, région Paris (eu-west-3)** — ou Francfort. Les offres gratuites/partagées n'ont ni sauvegardes continues ni les garanties attendues pour des données de santé.
3. **Backup** : activez la sauvegarde continue (*Continuous Cloud Backup*).
4. **Database Access → Add new database user** :
   - authentification par mot de passe, mot de passe long généré ;
   - rôle : *Specific privileges* → `readWrite` sur la base **`liaison-orl` uniquement** (pas `atlasAdmin`).
5. **Network Access** : Vercel n'utilise pas d'adresses IP fixes par défaut.
   - Si votre offre Vercel propose des IP sortantes statiques (option *Static IPs* / *Secure Compute*), autorisez uniquement ces IP : c'est la configuration recommandée.
   - Sinon, vous devrez autoriser `0.0.0.0/0` ; la protection repose alors sur le mot de passe de l'utilisateur et sur TLS (toujours actif sur Atlas). Notez ce point dans votre analyse de risques.
   - Ajoutez temporairement votre propre IP pour les étapes 2.7 et suivantes (vous pourrez la retirer ensuite).
6. **Connect → Drivers** : copiez la chaîne `mongodb+srv://…`, remplacez `<password>` et ajoutez le nom de la base : `mongodb+srv://utilisateur:motdepasse@cluster.xxxxx.mongodb.net/liaison-orl?retryWrites=true&w=majority` → c'est **`MONGODB_URI`**.

> Journal d'audit : l'application n'expose aucune fonction de modification du journal. Pour une immuabilité stricte, créez un rôle personnalisé sans droit `update`/`remove` sur la collection `auditLogs` pour l'utilisateur applicatif, et confiez la purge des journaux (36 mois par défaut) à un utilisateur distinct.

### 2.2 AWS S3 (fichiers : PDF, bilans, preuves de dépôt)

1. Créez un compte AWS (ou utilisez celui de l'entreprise) et activez la double authentification sur le compte racine.
2. **S3 → Create bucket** :
   - nom : par exemple `liaison-orl-prod-<votre-société>` ;
   - région : **Europe (Paris) eu-west-3** ;
   - **Block all public access : coché** (obligatoire) ;
   - *Bucket Versioning* : activé (recommandé) ;
   - *Default encryption* : **SSE-S3** (l'application demande aussi le chiffrement à chaque dépôt).
3. **IAM → Users → Create user** `liaison-orl-app`, sans accès console, avec cette politique en ligne (remplacez `NOM_DU_BUCKET`) :

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::NOM_DU_BUCKET" },
       { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::NOM_DU_BUCKET/*" }
     ]
   }
   ```

4. Sur cet utilisateur : **Security credentials → Create access key** (cas d'usage « Application running outside AWS ») → **`S3_ACCESS_KEY_ID`** et **`S3_SECRET_ACCESS_KEY`**. `S3_BUCKET` = le nom du bucket, `S3_REGION=eu-west-3`.

Les fichiers ne sont **jamais** exposés par une URL publique : l'application les lit dans le bucket privé après avoir vérifié les droits de l'utilisateur, et journalise chaque consultation.

### 2.3 Anthropic (IA)

1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com) au nom de l'entreprise et ajoutez un moyen de paiement.
2. Créez un **workspace** « Liaison ORL » avec une **limite de dépense mensuelle** (quelques dizaines d'euros suffisent largement : une lecture de bilan coûte quelques centimes).
3. **API Keys → Create key** dans ce workspace → **`ANTHROPIC_API_KEY`**.
4. **Avant toute donnée réelle** : demandez à Anthropic la signature de l'**accord de traitement des données (DPA)** et l'activation de la **rétention zéro (Zero Data Retention)** pour votre organisation. L'application pseudonymise les textes (nom, prénom, date de naissance remplacés par des jetons), mais l'image d'un bilan peut montrer l'identité du patient.
5. Facultatif : `AI_MODEL_VISION` (lecture des bilans, `claude-sonnet-5-5` par défaut) et `AI_MODEL_TEXT` (rédaction, `claude-haiku-5-5` par défaut) se changent sans toucher au code. `AI_INFERENCE_GEO` force la géographie de traitement si votre contrat le prévoit.
6. Vérification (sur les bilans fictifs, coût de quelques centimes) :

   ```bash
   ANTHROPIC_API_KEY="sk-ant-…" npm run ai:check
   ```

La consommation (appels, jetons, coût estimé) est suivie par centre dans **Administration → Statistiques**.

### 2.4 Resend (e-mails)

1. Créez un compte sur [resend.com](https://resend.com).
2. **Domains → Add domain** : utilisez un **sous-domaine dédié**, par exemple `mail.votredomaine.fr`, et la région **EU (Ireland)**.
3. Ajoutez chez votre hébergeur DNS les enregistrements affichés par Resend (**SPF** et **DKIM**, plus l'enregistrement MX de retour), puis cliquez sur **Verify**.
4. Ajoutez un enregistrement **DMARC** sur le sous-domaine (commencez en observation, durcissez après quelques semaines sans anomalie) :

   ```
   _dmarc.mail.votredomaine.fr   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@votredomaine.fr"
   # puis, une fois les rapports propres :
   _dmarc.mail.votredomaine.fr   TXT   "v=DMARC1; p=quarantine; rua=mailto:dmarc@votredomaine.fr"
   ```

5. Laissez **désactivés** le suivi d'ouverture et de clics de Resend : le statut « Ouvert » de l'application vient de la consultation du lien sécurisé, sans pixel espion.
6. **API Keys → Create API key** avec la permission *Sending access* limitée à ce domaine → **`RESEND_API_KEY`**.
7. `EMAIL_FROM_DOMAIN=mail.votredomaine.fr` (l'adresse d'expédition technique sera `ne-pas-repondre@mail.votredomaine.fr`, ou celle que vous indiquez dans `EMAIL_FROM_ADDRESS`). Le **nom affiché** est celui du centre et les **réponses** vont à l'e-mail du centre.
8. Le webhook se crée **après** la mise en ligne (étape 2.6) : **Webhooks → Add endpoint**
   - URL : `https://VOTRE-DOMAINE/api/webhooks/resend`
   - événements : `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`
   - copiez le **Signing secret** (`whsec_…`) → **`RESEND_WEBHOOK_SECRET`**.

Ce qui part chez Resend : l'objet (type de document, civilité, initiale du prénom et nom du patient), le nom du centre et un lien. Par défaut, **le PDF n'est jamais joint** : le médecin l'ouvre via un lien à durée limitée protégé par un second facteur (date de naissance du patient ou code envoyé dans un e-mail séparé). L'administrateur peut activer la pièce jointe directe, avec avertissement.

### 2.5 Pingen (courrier postal)

Commencez **toujours par l'environnement de test (staging)** : aucun courrier n'est imprimé ni facturé.

1. Créez un compte de test sur [identity-staging.pingen.com/auth/register](https://identity-staging.pingen.com/auth/register).
2. Créez l'**organisation** avec **pays de destination par défaut = France** : c'est ce qui fait passer les courriers par **La Poste** (sinon ils partent par DHL). Les courriers de l'application sont mis en page pour la **fenêtre à droite**, format exigé dans ce cas.
3. **Profil utilisateur → API Access → Create client** → **`PINGEN_CLIENT_ID`** et **`PINGEN_CLIENT_SECRET`**.
4. **`PINGEN_ORGANISATION_ID`** : l'identifiant (UUID) de l'organisation, visible dans l'adresse de l'application web Pingen quand l'organisation est ouverte.
5. Laissez `PINGEN_ENV=staging`.
6. Après la mise en ligne (étape 2.6), créez **4 webhooks** dans Pingen (*Organisation → Webhooks*), un par catégorie : `issues`, `sent`, `undeliverable`, `delivered`
   - URL commune : `https://VOTRE-DOMAINE/api/webhooks/pingen`
   - même clé de signature pour les 4, choisie par vous (20 à 32 caractères, par exemple `openssl rand -hex 16`) → **`PINGEN_WEBHOOK_SECRET`**.
7. Lancez `npm run pingen:check` : chaque gabarit postal est déposé en staging, contrôlé par Pingen (zones, polices, code DMC en haut à droite) puis annulé.
8. Faites un essai complet (voir 2.8) : le courrier apparaît dans Pingen staging, son statut remonte dans l'application.
9. **Passage en réel** : créez le compte et l'organisation de production sur [identity.pingen.com](https://identity.pingen.com) (mêmes réglages : France), approvisionnez les crédits, créez un nouveau client API et les 4 webhooks, remplacez les 4 variables Pingen et mettez `PINGEN_ENV=production`.

Garde-fou : `PINGEN_ENV=production` n'est pris en compte **que** sur le déploiement de production Vercel. Une copie de développement ou une préversion utilise toujours le staging.

> À vérifier lors de l'essai en staging : la correspondance entre les produits proposés dans l'application (« Lettre verte », « Envoi rapide », « Lettre recommandée », réglables dans **Administration → Envois et droits**) et les produits La Poste facturés par Pingen. Le prix affiché avant envoi provient du calculateur de prix de Pingen.

### 2.6 Vercel (hébergement) et domaine

1. Mettez le code sur un dépôt GitHub privé de l'entreprise.
2. Créez un compte [vercel.com](https://vercel.com) avec l'offre **Pro** : l'usage commercial l'exige, et la tâche de suivi des statuts tourne toutes les 15 minutes (l'offre gratuite limite les tâches planifiées à une par jour).
3. **Add New → Project** → importez le dépôt. Framework détecté : Next.js ; ne changez pas les commandes. Les fonctions s'exécutent à **Paris (cdg1)** (réglé dans [vercel.json](vercel.json)).
4. **Settings → Environment Variables** : saisissez les variables ci-dessous en cochant **uniquement « Production »**. Ne donnez jamais la base ni les clés de production aux environnements *Preview* et *Development* (laissez-les sans clés : ils fonctionneront en mode démo).

   | Variable | Valeur |
   |---|---|
   | `APP_URL` | `https://orl.votredomaine.fr` (votre domaine définitif, sans `/` final) |
   | `MONGODB_URI` | étape 2.1 |
   | `BETTER_AUTH_SECRET` | généré plus haut |
   | `CRON_SECRET` | généré plus haut |
   | `ANTHROPIC_API_KEY` | étape 2.3 |
   | `RESEND_API_KEY`, `EMAIL_FROM_DOMAIN` (et `EMAIL_FROM_ADDRESS` si besoin) | étape 2.4 |
   | `RESEND_WEBHOOK_SECRET` | étape 2.4, après la création du webhook |
   | `PINGEN_CLIENT_ID`, `PINGEN_CLIENT_SECRET`, `PINGEN_ORGANISATION_ID`, `PINGEN_ENV` | étape 2.5 |
   | `PINGEN_WEBHOOK_SECRET` | étape 2.5 |
   | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | étape 2.2 |

   La liste complète et commentée est dans [.env.example](.env.example). **Ne définissez jamais** `DEMO_LOGIN_HINTS` ni `DISABLE_RATE_LIMIT` en production.

5. **Deploy**.
6. **Domaine** : *Settings → Domains → Add* `orl.votredomaine.fr`, puis créez chez votre hébergeur DNS l'enregistrement indiqué par Vercel (en général un `CNAME` vers `cname.vercel-dns.com`). Le certificat TLS est automatique. Vérifiez que `APP_URL` correspond exactement à ce domaine, puis **Redeploy**.
7. **Tâches planifiées** : *Settings → Cron Jobs* doit afficher `/api/cron/statuts` (toutes les 15 minutes : statuts des envois, relances) et `/api/cron/purge` (chaque nuit : purge selon la durée de conservation). Vercel leur transmet automatiquement `CRON_SECRET`.
8. Revenez aux étapes 2.4 (point 8) et 2.5 (point 6) pour créer les webhooks, ajoutez les secrets correspondants dans Vercel, puis **Redeploy**.

### 2.7 Premier administrateur

Depuis votre poste (votre IP doit être autorisée dans Atlas, étape 2.1), dans le dossier du projet (les variables saisies dans le terminal sont prioritaires sur un éventuel `.env.local`) :

```bash
npm install
export MONGODB_URI="mongodb+srv://…/liaison-orl?…"
export BETTER_AUTH_SECRET="(le même que sur Vercel)"
export APP_URL="https://orl.votredomaine.fr"
export RESEND_API_KEY="re_…" EMAIL_FROM_DOMAIN="mail.votredomaine.fr"   # facultatif : pour recevoir le lien par e-mail
npm run db:indexes
npm run admin:create
unset MONGODB_URI BETTER_AUTH_SECRET APP_URL RESEND_API_KEY EMAIL_FROM_DOMAIN
```

Le script demande le nom de l'organisation, le premier centre (nom, adresse, téléphone, e-mail) et l'identité du premier administrateur. Il crée l'organisation avec le thème par défaut, puis **affiche un lien d'activation** valable 48 h ; il l'envoie aussi par e-mail si Resend est configuré.

Ouvrez le lien et choisissez un mot de passe. À la première connexion, l'application **impose la double authentification** : scannez le QR code avec une application d'authentification (Google Authenticator, Microsoft Authenticator, 1Password…) et **conservez les codes de secours**.

Puis, dans **Administration** :

1. **Organisation et marque** : logo, couleurs, polices, slogan, mentions légales. L'aperçu des PDF se met à jour en direct. Changer de nom d'entreprise se fait ici uniquement.
2. **Centres** : créez les autres centres (adresse, téléphone, e-mail de réponse, signature par défaut).
3. **Utilisateurs** : invitez les audioprothésistes et les assistant(e)s (rôle, centres rattachés, droit d'envoi pour les assistant(e)s). Chacun reçoit un lien d'invitation par e-mail.
4. **Annuaire** : importez vos ORL depuis un fichier CSV (colonnes reconnues : `civilite, nom, prenom, specialite, rpps, cabinet, adresse1, adresse2, code_postal, ville, pays, email, telephone, canal, formule, notes`, séparateur `;` ou `,`) ; les doublons sont signalés et fusionnables.
5. **Modèles** et **Envois et droits** : textes des e-mails, formules d'appel, ton de l'IA ; mode lien sécurisé ou pièce jointe, durée de validité des liens, second facteur, affranchissement.
6. **Conservation** : durée de conservation des documents (60 mois par défaut) et du journal d'audit, avec simulation avant la première purge.

### 2.8 Vérifications avant ouverture

1. **Administration → Services → Tester les connexions** : tous les services doivent être « Connecté ».
2. Créez un **prescripteur fictif** avec **votre propre e-mail** et votre adresse postale, puis un patient fictif.
3. Faites un **adressage**, validez-le, puis **imprimez-le** et **téléchargez le PDF** (l'adressage ne s'envoie pas : aucune action d'envoi ne doit apparaître).
4. Faites un **compte rendu** avec un bilan de [demo/bilans/](demo/bilans/) et envoyez-le **par e-mail et par courrier** (Pingen **staging**) : vérifiez la réception de l'e-mail, ouvrez le lien, saisissez la date de naissance du patient fictif et vérifiez que le statut passe à « Ouvert » ; le courrier apparaît dans Pingen et son statut évolue dans l'application.
5. **Administration → Journal d'audit** : toutes ces actions y figurent.
6. Supprimez les données de test (fiche patient → Supprimer).

---

### 2.9 Conformité (à valider avant les données réelles)

Cette liste ne remplace pas l'avis de votre DPO ou de votre conseil.

- **HDS.** Chaque prestataire qui stocke ou traite des données patients doit être certifié HDS : la base de données (MongoDB Atlas), le stockage des fichiers (AWS) **et** l'hébergement de l'application (Vercel exécute le code qui lit ces données). Vérifiez les certificats en vigueur auprès de chaque prestataire, pour les régions choisies. **Vercel ne figurait pas, à notre connaissance, parmi les hébergeurs certifiés HDS** : si c'est toujours le cas, il faudra déployer l'application chez un hébergeur certifié (l'application est une application Next.js standard, déployable sur tout hébergement Node.js ; voir [DECISIONS.md](DECISIONS.md)).
- **Anthropic** : DPA signé et rétention zéro activée (étape 2.3).
- **Resend, Pingen** : DPA signés ; Pingen imprime l'adresse et le courrier, Resend ne reçoit que l'objet (type de document et identification minimale du patient) et le lien.
- **RGPD** : inscription au registre des traitements, analyse d'impact (AIPD, obligatoire pour des données de santé à cette échelle), information des patients, durées de conservation (réglées dans l'application), procédure de violation de données.
- **Accès** : 2FA obligatoire pour les administrateurs (imposée par l'application) ; recommandée pour tous.

---

## 3. Exploitation

### Mettre à jour l'application

Poussez sur la branche principale du dépôt : Vercel redéploie automatiquement. Après une mise à jour, relancez `npm run db:indexes` (idempotent) avec la `MONGODB_URI` de production.

### Tâches automatiques

| Tâche | Fréquence | Rôle |
|---|---|---|
| `/api/cron/statuts` | 15 min | Interroge Pingen pour les courriers en cours, met à jour les statuts (filet de sécurité si un webhook est perdu) |
| `/api/cron/purge` | chaque nuit | Supprime les documents (et leurs bilans, envois, PDF, liens) non modifiés depuis la durée de conservation, les patients sans document, les journaux anciens |

### En cas de problème

| Symptôme | Où regarder |
|---|---|
| Un envoi est en erreur | Accueil → « Erreurs d'envoi » ; le détail de l'envoi donne la raison (adresse refusée par La Poste, e-mail rejeté…) et permet de corriger puis renvoyer |
| Un service semble indisponible | Administration → Services → Tester les connexions |
| Un utilisateur a perdu son téléphone (2FA) | Administration → Utilisateurs → menu de l'utilisateur → Réinitialiser la 2FA |
| Qui a fait quoi ? | Administration → Journal d'audit (filtres, export CSV) |
| Erreurs techniques | Vercel → projet → *Logs* |

### Changer un secret

- `RESEND_WEBHOOK_SECRET`, `PINGEN_WEBHOOK_SECRET`, `CRON_SECRET`, clés d'API : remplacez-les chez le prestataire et dans Vercel, puis **Redeploy**.
- `BETTER_AUTH_SECRET` : le changer déconnecte tout le monde, invalide les liens sécurisés en cours et **rend illisibles les secrets de double authentification** (chaque utilisateur devra la reconfigurer). À ne faire qu'en cas de fuite.

---

## 4. Développement

| Commande | Rôle |
|---|---|
| `npm run demo` | Application + base embarquée + données fictives |
| `npm run dev` | Application seule (`MONGODB_URI` dans `.env.local`) |
| `npm run seed` | Réinitialise une base de **démonstration** (refuse une base de production) |
| `npm run lint` · `npm run typecheck` | Qualité du code |
| `npm run test` | Tests unitaires et d'intégration (Vitest, base MongoDB embarquée) |
| `npm run test:e2e` | Build de production + tests de bout en bout Playwright en mode démo (parcours complets, droits, sécurité, accessibilité WCAG 2.2 AA, mobile) |
| `npm run render:docs` | Génère tous les PDF (versions e-mail et postale, cas limites, version « debug » avec les zones Pingen) dans `/tmp/docs-preview`, en PNG à 150 dpi, et contrôle les zones Pingen ; `-- --previews` met à jour [docs/previews/](docs/previews/) |
| `npm run render:emails` | Rend chaque e-mail (HTML + texte brut) et le capture à 600 px et 375 px, en clair et en sombre (`/tmp/emails-preview`) |
| `npm run pingen:check` | Dépose chaque gabarit postal dans Pingen **staging**, vérifie qu'il passe la validation, puis l'annule (aucun envoi) |
| `npm run ai:check` | Vérifie l'IA réelle sur les bilans fictifs (consomme quelques centimes) |
| `npm run admin:create` · `npm run db:indexes` | Mise en production (voir 2.7) |

Les choix techniques et leurs raisons sont tenus dans [DECISIONS.md](DECISIONS.md), l'avancement et les limites connues dans [PROGRESS.md](PROGRESS.md), le cahier des charges dans [CLAUDE.md](CLAUDE.md).

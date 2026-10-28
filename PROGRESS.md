# Avancement

État au 2026-10-28 : **toutes les phases sont terminées**, refonte des documents sortants et changement de périmètre de l'adressage compris. Le parcours complet fonctionne de bout en bout en mode démo (sans aucune clé) et il est couvert par les tests automatisés.

## Changement de périmètre : adressage non envoyable (2026-10-28)

Le courrier d'adressage n'est plus envoyé : il est **affiché, imprimé et téléchargé en PDF**. Le compte rendu d'appareillage ne change pas (e-mail Resend + courrier Pingen). Décisions n° 68 à 73 dans [DECISIONS.md](DECISIONS.md).

- **Parcours** : saisir → valider → « Imprimer » (boîte d'impression du navigateur sur le PDF exact) ou « Télécharger le PDF ». Le PDF validé est affiché (onglet Aperçu ouvert d'office sur mobile).
- **Retiré pour l'adressage** : bouton et page « Préparer l'envoi », choix des canaux, sélection dans l'envoi groupé, raccourci de la palette, action d'envoi du toast de validation. Le renvoi est impossible, puisqu'aucun envoi n'existe.
- **Serveur** : préparation, envoi, renvoi et envoi groupé refusent un adressage (« Le courrier d'adressage ne s'envoie pas : imprimez-le ou téléchargez le PDF. »), même appelés directement ; aucun envoi n'est créé.
- **PDF** : plus de version postale (zones Pingen) pour l'adressage ; la version standard fidèle au modèle est la seule produite.
- **Statuts et écrans** : un adressage passe de BROUILLON à VALIDÉ, jamais ENVOYÉ ni ERREUR. « Prêts à envoyer » et l'envoi groupé ne portent que sur les comptes rendus ; « Envoyés récemment » et « Erreurs d'envoi » ne listent que des envois de comptes rendus ; les filtres Envoyés / Erreurs disparaissent pour l'adressage ; les statistiques séparent les comptes rendus envoyés et les adressages validés.
- **Seed** : aucun adressage ENVOYÉ, ERREUR ou avec des envois (vérifié en fin de seed) ; l'erreur d'envoi de démonstration porte sur un compte rendu.
- **Correctif annexe** : le commentaire du compte rendu n'était jamais rédigé automatiquement après confirmation du bilan, car le contexte partagé n'était pas monté (régression antérieure, cause de l'échec E2E « compte rendu » listé auparavant en problème connu n° 8). C'est corrigé.
- Aucune migration : la base de production a été remise à zéro.

## Refonte documents (2026-10-27)

Refonte de tous les documents et e-mails sortants : sobres, lisibles, paramétrés par la marque, conformes aux zones Pingen. Décisions n° 49 à 67 dans [DECISIONS.md](DECISIONS.md) ; captures dans [docs/previews/](docs/previews/).

### Inventaire des gabarits sortants

| | Gabarit | Code | État |
|---|---|---|---|
| ✅ | PDF — Courrier d'adressage (version e-mail) | `src/lib/pdf/templates/adressage.tsx` | refondu |
| ➖ | PDF — Courrier d'adressage (version postale) | — | **supprimé le 2026-10-28** : l'adressage ne s'envoie plus (imprimé ou téléchargé) |
| ✅ | PDF — Compte rendu d'appareillage (version e-mail) | `src/lib/pdf/templates/compte-rendu.tsx` | refondu ; audiogramme et gain intégrés (ancienne annexe) |
| ✅ | PDF — Compte rendu d'appareillage (version postale) | idem, variante `postal` | refondu |
| ✅ | PDF — Aperçu de marque (administration) | `src/lib/pdf/sample.ts` | mêmes composants que les PDF envoyés |
| ✅ | PDF — Aperçu en direct de l'éditeur | `/api/documents/[id]/apercu` | même moteur ; `?debug=pingen` affiche la version postale avec les zones |
| ✅ | E-mail — Document au prescripteur, lien sécurisé (date de naissance ou code) | `src/server/emails/document.tsx` | refondu |
| ✅ | E-mail — Document au prescripteur, PDF en pièce jointe | idem | refondu |
| ✅ | E-mail — Copie au centre | même e-mail en copie (cc) | couvert par le gabarit ci-dessus |
| ✅ | E-mail — Code d'accès (second facteur, message séparé) | `src/server/emails/document.tsx` | refondu |
| ✅ | Page web de consultation du lien sécurisé (second facteur, aperçu, téléchargement, lien expiré) | `src/app/l/[token]/page.tsx` | refaite |
| ✅ | E-mail — Invitation utilisateur | `src/server/emails/system.tsx` | refondu |
| ✅ | E-mail — Lien magique | idem | refondu |
| ✅ | E-mail — Réinitialisation du mot de passe | idem | refondu |
| ➖ | E-mail — 2FA | — | sans objet : la double authentification est en TOTP (application), aucun e-mail n'est envoyé |
| ✅ | E-mail — Notification d'erreur d'envoi | `src/server/emails/system.tsx`, `src/server/services/dispatch-notify.ts` | **créé** (n'existait pas) : envoyé à l'auteur quand un échec arrive après coup |

### Zone DMC (haut droite)

**Confirmé vide sur chaque page de chaque gabarit**, versions e-mail et postale, cas nominaux et cas limites : rien entre x = 182 et 205 mm pour y de 5 à 28 mm. Vérification automatique sur les boîtes englobantes extraites avec pdf.js (texte, tracés, images) dans `src/lib/pdf/documents.test.ts` et `npm run render:docs`. Sont aussi vérifiés : bord bloqué de 5 mm vide sur toutes les pages ; en page 1 de la version postale, seule l'adresse dans la zone d'affranchissement (x 90–205, y 30–94 mm), entièrement dans la zone d'adresse (x 110–190, y 50–78 mm).

**Non confirmé par Pingen** : aucun identifiant staging n'est configuré, `npm run pingen:check` n'a donc pas pu déposer les gabarits chez Pingen. À lancer dès que `PINGEN_CLIENT_ID`, `PINGEN_CLIENT_SECRET` et `PINGEN_ORGANISATION_ID` (staging) sont renseignés.

### Vérifications

- `npm run render:docs` : 8 jeux de données (nominaux et cas limites : noms et adresses très longs, prescripteur sans cabinet, commentaire de 15 lignes, sans bilan, une seule oreille, champs optionnels vides, accents et apostrophes typographiques) × versions e-mail et postale, plus versions « debug » ; chaque page relue en PNG à 150 dpi. Défauts corrigés pendant la relecture : lettre manquante (état de police react-pdf), pagination invisible (interligne hérité), intertitre orphelin, ligne de tableau isolée, signature seule sur une page, page 1 à moitié vide (audiogramme), alignement de la signature.
- `npm run render:emails` : 8 e-mails à 600 px et 375 px, en clair et en sombre, relus.
- Tests automatisés ajoutés : zones Pingen (16 rendus), contenu des documents, régression de la lettre perdue, rendus simultanés, mise en forme postale NF Z10-011 (abréviations, largeur réelle, blocage), e-mails (structure, VML, préheader, texte brut, aucune information médicale), notification d'échec, **non-régression visuelle** des PDF (`tests/visual/pdf/`) et des e-mails (`tests/visual/emails/`).
- Seed : cas limites ajoutés (patient au nom très long, prescripteur sans cabinet avec adresse longue, compte rendu de 15 lignes envoyé par courrier, une seule oreille sans bilan, brouillon vide).

## Phases

| Phase | Statut |
|-------|--------|
| 1. Socle (projet, design system, auth + rôles, modèle de données, seed, layout, mocks) | ✅ terminée |
| 2. Annuaire ORL + patients | ✅ terminée |
| 3. Documents (formulaires, aperçu, PDF, brouillons, statuts) | ✅ terminée |
| 4. IA (extraction, correction, audiogramme, calculs, rédactions) | ✅ terminée |
| 5. Envois (Resend, Pingen, webhooks, historique, envoi groupé) | ✅ terminée |
| 6. Admin, statistiques, audit, purge | ✅ terminée |
| 7. Finition (E2E, sécurité, performance, accessibilité, README) | ✅ terminée |

## Contrôles (dernière exécution)

| Commande | Résultat |
|---|---|
| `npm run lint` | ✅ 0 erreur, 0 avertissement (2026-10-28) |
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ 43 fichiers, 331 tests (unitaires, intégration sur base MongoDB embarquée, zones Pingen, non-régression visuelle PDF et e-mails) |
| `npm run build` | ✅ |
| `npm run render:docs` | ✅ 16 PDF, zones Pingen conformes partout |
| `npm run test:e2e` | ⚠️ 22 / 27 (2026-10-28) : adressage (impression / téléchargement) et compte rendu (envoi + lien sécurisé) ✅ ; 5 échecs **antérieurs**, voir « Problèmes connus » n° 8 |

## Ce qui est livré

**Pour l'audioprothésiste**
- Accueil orienté action : « Nouvel adressage » / « Nouveau compte rendu », brouillons à finir, comptes rendus prêts à envoyer, envois récents, erreurs d'envoi.
- Éditeur sur un seul écran : formulaire à gauche, **aperçu PDF exact en direct** à droite (onglets sur mobile), sauvegarde automatique permanente (avec copie locale de secours), validation explicite.
- PDF refondus (2026-10-27) : courrier de cabinet sobre en Inter, couleurs issues de la marque, audiogramme vectoriel et gain prothétique, version postale conforme aux zones Pingen (voir « Refonte documents »).
- Compte rendu : dépôt du bilan (glisser-déposer, coller, photo), étapes lisibles, **lecture par l'IA** avec niveau de confiance par valeur, tableau de correction et audiogrammes redessinés, **degré BIAP et gain prothétique calculés en code** (règle affichée), commentaire rédigé (plus court / plus détaillé / plus technique), badges « Suggéré par l'IA » jusqu'à validation.
- Adressage : motif « Autre » reformulé par l'IA à partir de quelques mots ; dictée vocale nettoyée par l'IA ; après validation, **impression** et **téléchargement du PDF** (jamais d'envoi).
- Valeurs mémorisées (marque, classe, rechargeable…), prescripteur habituel proposé automatiquement.
- Envoi (compte rendu uniquement) : récapitulatif (aperçu, destinataire, canaux, coût du courrier, alertes), e-mail avec **lien sécurisé à second facteur** (ou pièce jointe si l'admin l'autorise), courrier Pingen (lettre verte, rapide ou recommandée), suivi des statuts par webhooks + interrogation périodique, renvoi en un clic, correction d'adresse après refus, **envoi groupé**.
- Annuaire ORL (recherche, favoris, récents, création rapide sans quitter le formulaire, import CSV, dédoublonnage et fusion), patients, historiques par patient et par prescripteur.
- Palette de commandes (Ctrl/⌘ + K), raccourcis clavier, mode sombre, responsive tablette/téléphone.

**Pour l'administration**
- Organisation et **marque entièrement configurable** (logo, couleurs, polices, slogan, mentions) avec aperçu PDF en direct : changer de nom = changer la configuration.
- Centres, utilisateurs (invitation par e-mail, rôles, rattachements, droit d'envoi, réinitialisation 2FA), modèles d'e-mails et formules, ton de l'IA, paramètres d'envoi, durée de conservation avec simulation et purge automatique, statistiques (documents, délais, coûts courrier, taux d'erreur, consommation IA par centre), journal d'audit filtrable et exportable, état des services avec test de connexion, boîte d'envoi de démonstration.

**Sécurité**
- Better Auth : mot de passe, lien magique (refusé aux administrateurs), **2FA TOTP imposée aux administrateurs**, limitation de débit, comptes désactivables.
- Droits vérifiés côté serveur sur chaque action, route et page (rôle, organisation, centre) ; revue complète des accès réalisée en phase 7 et corrections testées.
- Fichiers jamais exposés publiquement (lecture après contrôle des droits, accès journalisé) ; chiffrement S3 côté serveur.
- Lien sécurisé : jeton 256 bits stocké haché, second facteur, essais réservés atomiquement, verrouillage puis révocation.
- CSP avec nonce par requête, HSTS, protections contre l'intégration en iframe, webhooks signés, tâches planifiées protégées.
- IA : pseudonymisation des textes avant chaque appel, sortie JSON validée par Zod (un nouvel essai puis saisie manuelle), aucune valeur inventée.

**Exploitation**
- `npm run demo` (tout en local, sans clé), `npm run seed`, `npm run admin:create`, `npm run db:indexes`, `npm run ai:check`, `npm run render:docs`, `npm run render:emails`, `npm run pingen:check`.
- [README.md](README.md) : mise en production pas à pas (Atlas, S3, Anthropic, Resend, Pingen, Vercel, domaine, webhooks, premier administrateur, vérifications, conformité).
- [DECISIONS.md](DECISIONS.md) : 73 décisions argumentées.

## Tests de bout en bout (Playwright, mode démo)

- Adressage complet : patient → prescripteur habituel proposé → motif reformulé par l'IA → validation → PDF affiché → **téléchargement** (`courrier-adressage-v1.pdf`) → **impression** (PDF chargé dans le cadre d'impression) ; aucune action d'envoi, page d'envoi refusée, filtres Envoyés / Erreurs absents.
- Compte rendu complet : dépôt d'un bilan PDF → extraction → confirmation → commentaire rédigé → validation → envoi e-mail + courrier → **ouverture du lien sécurisé côté médecin** (mauvaise puis bonne date de naissance, PDF téléchargé) → statut « Ouvert ».
- Droits (assistante sans droit d'envoi, API non authentifiées), authentification (2FA admin, accès admin refusé), sécurité (en-têtes, CSP à nonce, cron, webhooks non signés, aucune erreur JavaScript ni violation de CSP), administration (toutes les pages, invitation, export d'audit), annuaire et palette.
- **Accessibilité** : axe-core WCAG 2.2 AA + bonnes pratiques, **0 violation** sur les écrans publics, principaux, éditeur et admin, en clair et en sombre ; navigation au clavier (lien d'évitement, palette, raccourcis).
- **Mobile** (Pixel 7) : menu, éditeur à onglets, aucune page qui déborde horizontalement.

## Problèmes connus et points à valider

1. **Hébergement HDS** (bloquant pour des données réelles). Vercel n'est pas, à notre connaissance, certifié HDS ; les certifications de MongoDB Atlas et AWS sont à vérifier pour les régions choisies. L'application est un Next.js standard : elle peut être déployée chez un hébergeur certifié sans modification du code (prévoir alors un planificateur pour les deux tâches `/api/cron/*`).
2. **Services réels non testés faute de comptes** : Resend et Pingen n'ont été exercés qu'en simulation et par des tests sur leurs formats documentés (signatures de webhooks, statuts). Faire l'essai complet décrit au §2.8 du README, en **Pingen staging**, avant l'ouverture.
3. **Produits postaux Pingen** : la correspondance entre « lettre verte / envoi rapide / recommandée » et les produits La Poste facturés par Pingen n'est pas documentée publiquement ; à confirmer pendant l'essai en staging (le prix affiché vient du calculateur Pingen).
4. **IA et images** : la pseudonymisation porte sur les textes ; l'image d'un bilan peut montrer le nom du patient. Signer le DPA et activer la rétention zéro chez Anthropic avant les données réelles.
5. **Dictée vocale** : assurée par le navigateur ; Chrome et Edge envoient l'audio à Google ou Microsoft. Réglage « Dictée vocale » dans Administration → Modèles pour la désactiver si nécessaire.
6. **Accès réseau Atlas** : sans IP fixes côté Vercel, l'accès doit être ouvert à `0.0.0.0/0` (protégé par mot de passe et TLS) ; préférer l'option d'IP statiques de Vercel si l'offre la propose.
7. La limitation de débit maison (lien sécurisé, IA) peut compter un ou deux appels de moins lors de la création simultanée d'une fenêtre ; sans conséquence pratique (le verrouillage du lien sécurisé, lui, est atomique).
8. **Cinq tests E2E en échec, antérieurs à la refonte des documents** (déjà présents sur le commit 492f911) : règle axe-core `label-content-name-mismatch` sur trois champs `.border-input` de l'accueil, de l'éditeur et de l'administration (4 tests d'accessibilité) ; délai dépassé à l'ouverture du combobox patient dans le parcours mobile. À corriger séparément. (Le sixième, commentaire IA non rédigé dans le parcours « compte rendu », est corrigé depuis le 2026-10-28.)
9. **Envoi de contrôle Pingen staging non réalisé** (aucun identifiant) : lancer `npm run pingen:check` pour confirmer la position du code DMC et la validation des gabarits par Pingen.

## Hors périmètre V1 (prévu par le cahier des charges)

- Messagerie sécurisée de santé (MSSanté) : l'envoi passe par une interface de fournisseur d'e-mail, prête pour un second fournisseur.
- Import depuis Cosium / Doctolib.
- Multi-organisation (franchise) : toutes les données et requêtes sont déjà filtrées par organisation ; reste l'interface de gestion des organisations.

## Coûts engagés pendant le développement

- Un appel réel à l'API Anthropic de vérification (`npm run ai:check`, bilans fictifs, ≈ 0,04 $) et un appel refusé (erreur 400, non facturé) pendant la mise au point du schéma de sortie.
- Aucun e-mail ni courrier réel envoyé.

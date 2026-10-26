# Avancement

État au 2026-10-17 : **toutes les phases sont terminées.** Le parcours complet fonctionne de bout en bout en mode démo (sans aucune clé) et il est couvert par les tests automatisés.

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
| `npm run lint` | ✅ 0 erreur, 0 avertissement |
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ 21 fichiers, 107 tests (unitaires et intégration sur base MongoDB embarquée) |
| `npm run build` | ✅ |
| `npm run test:e2e` | ✅ 27 scénarios Playwright sur le build de production, en mode démo (≈ 1 min) |

## Ce qui est livré

**Pour l'audioprothésiste**
- Accueil orienté action : « Nouvel adressage » / « Nouveau compte rendu », brouillons à finir, envois récents, erreurs d'envoi.
- Éditeur sur un seul écran : formulaire à gauche, **aperçu PDF exact en direct** à droite (onglets sur mobile), sauvegarde automatique permanente (avec copie locale de secours), validation explicite.
- PDF **identiques aux modèles** fournis (comparaison pixel à pixel), polices embarquées, version postale avec page d'adresse pour la fenêtre La Poste, annexe audiométrique facultative.
- Compte rendu : dépôt du bilan (glisser-déposer, coller, photo), étapes lisibles, **lecture par l'IA** avec niveau de confiance par valeur, tableau de correction et audiogrammes redessinés, **degré BIAP et gain prothétique calculés en code** (règle affichée), commentaire rédigé (plus court / plus détaillé / plus technique), badges « Suggéré par l'IA » jusqu'à validation.
- Adressage : motif « Autre » reformulé par l'IA à partir de quelques mots ; dictée vocale nettoyée par l'IA.
- Valeurs mémorisées (marque, classe, rechargeable…), prescripteur habituel proposé automatiquement.
- Envoi : récapitulatif (aperçu, destinataire, canaux, coût du courrier, alertes), e-mail avec **lien sécurisé à second facteur** (ou pièce jointe si l'admin l'autorise), courrier Pingen (lettre verte, rapide ou recommandée), suivi des statuts par webhooks + interrogation périodique, renvoi en un clic, correction d'adresse après refus, **envoi groupé**.
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
- `npm run demo` (tout en local, sans clé), `npm run seed`, `npm run admin:create`, `npm run db:indexes`, `npm run ai:check`, `npm run pdf:samples`.
- [README.md](README.md) : mise en production pas à pas (Atlas, S3, Anthropic, Resend, Pingen, Vercel, domaine, webhooks, premier administrateur, vérifications, conformité).
- [DECISIONS.md](DECISIONS.md) : 48 décisions argumentées.

## Tests de bout en bout (Playwright, mode démo)

- Adressage complet : patient → prescripteur habituel proposé → motif reformulé par l'IA → validation → envoi e-mail → **ouverture du lien sécurisé côté médecin** (mauvaise puis bonne date de naissance, PDF téléchargé) → statut « Ouvert ».
- Compte rendu complet : dépôt d'un bilan PDF → extraction → confirmation → commentaire rédigé → validation → envoi e-mail + courrier.
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

## Hors périmètre V1 (prévu par le cahier des charges)

- Messagerie sécurisée de santé (MSSanté) : l'envoi passe par une interface de fournisseur d'e-mail, prête pour un second fournisseur.
- Import depuis Cosium / Doctolib.
- Multi-organisation (franchise) : toutes les données et requêtes sont déjà filtrées par organisation ; reste l'interface de gestion des organisations.

## Coûts engagés pendant le développement

- Un appel réel à l'API Anthropic de vérification (`npm run ai:check`, bilans fictifs, ≈ 0,04 $) et un appel refusé (erreur 400, non facturé) pendant la mise au point du schéma de sortie.
- Aucun e-mail ni courrier réel envoyé.

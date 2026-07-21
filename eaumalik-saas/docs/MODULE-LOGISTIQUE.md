# Module Logistique — Documentation utilisateur

> Module de gestion des **dépôts**, **magasins** et **présentoirs** physiques,
> avec affectation des produits par localité et workflow d'approbation des
> transferts entre localités.
>
> **Date de mise en service** : juillet 2026
> **Public** : administrateurs EAUMALIK (`admin`, `administrator`),
> gestionnaires de magasin/dépôt/présentoir (`store_manager`, `depot_manager`,
> `presentoir_manager`).

---

## 1. Concepts clés

| Terme | Définition |
|---|---|
| **Localité** | Emplacement physique d'un sous-ensemble du stock. Trois types : `depot` (entrepôt), `magasin` (point de vente / retrait), `presentoir` (showroom). |
| **Capacité** | Plafond en nombre d'articles (`capacity_units`) et/ou en surface (`capacity_area_m2`). À 0 = non renseignée, alerte désactivée. |
| **Sous-rôle logistique** | Profil staff spécialisé : `depot_manager`, `store_manager`, `presentoir_manager`. Voit UNIQUEMENT ses localités affectées. |
| **Transfert** | Mouvement de stock d'une localité à une autre. Workflow 2 niveaux : `pending` → `approved` → `executed`. |
| **Workflow d'approbation** | Si un transfert sort du périmètre d'affectation, il est refusé en exécution directe et passe par une demande validée par `admin` ou `administrator`. |

---

## 2. Accès et permissions

### 2.1 Qui voit quoi ?

| Rôle | Accès à `/admin/locations` | Visibilité sur les localités |
|---|---|---|
| `admin` (superadmin) | ✅ Complet | TOUTES (actives + archivées) |
| `administrator` (Droits Étendus) | ✅ Complet | TOUTES (actives + archivées) |
| `stock_manager`, `sales`, `admin_assistant` | ✅ Lecture seule | TOUTES actives |
| `depot_manager` | ✅ Ses localités | Uniquement `managed_location_ids ∩ type='depot'` |
| `store_manager` | ✅ Ses localités | Uniquement `managed_location_ids ∩ type='magasin'` |
| `presentoir_manager` | ✅ Ses localités | Uniquement `managed_location_ids ∩ type='presentoir'` |
| `client` | ❌ | — |

> **Important** : un sous-rôle logistique ne peut PAS voir les localités d'un
> autre type, même si leur UUID est dans `managed_location_ids` (sécurité forte
> côté serveur).

### 2.2 Qui peut faire quoi ?

| Action | Rôles autorisés |
|---|---|
| Créer / modifier / archiver une localité | `admin`, `administrator` |
| Supprimer définitivement une localité (`purge`) | `admin` (superadmin uniquement) |
| Voir l'inventaire d'une localité | Selon visibilité ci-dessus |
| Enregistrer un mouvement de stock dans une localité | Selon visibilité + permission `can_manage_locations` |
| Demander un transfert vers sa localité | Selon visibilité |
| Approuver / rejeter une demande de transfert | `admin` OU `administrator` |
| Exécuter un transfert approuvé | `admin`, `administrator`, ou le demandeur initial |
| Annuler une demande en attente | Le demandeur OU `admin`/`administrator` |

---

## 3. Parcours utilisateur — `/admin/locations`

La page se compose de **3 onglets**.

### 3.1 Onglet **Localités** (par défaut)

- **Header** : bouton « + Nouvelle localité » + filtres (type / actif-archivé).
- **Grille de cards** par localité. Chaque card affiche :
  - Icône selon le type (`Warehouse` / `Store` / `PackageOpen`)
  - Code (ex. `D-CASA-DEPOT`) + Nom + Ville
  - **Barre de capacité** :
    - Vert ≤ 70 %
    - Orange 70-90 %
    - Rouge ≥ 90 %
    - Badge « Sur-capacité » si dépassement
  - Actions : Modifier / Archiver / Restaurer / Supprimer (superadmin)

#### Créer une localité

Champs obligatoires :
- **Code** : `MAJUSCULES-CHIFFRES-TIRETS`, 3-30 caractères (ex. `M-RABAT-01`)
- **Nom** : libellé humain (ex. `Magasin Rabat Centre`)
- **Type** : dépôt / magasin / présentoir
- **Capacité unités** + **Capacité m²** : optionnels (0 = non renseigné)

### 3.2 Onglet **Inventaire**

- **Sélecteur de localité** en haut.
- **3 KPIs** : unités en stock, capacité déclarée, % de remplissage.
- **Table produits** présents dans cette localité, avec :
  - Quantité dans la localité
  - Stock global (pour info)
  - Bouton **« Transférer »** : ouvre le dialog de demande de transfert.

### 3.3 Onglet **Workflows**

- **Filtre** par statut (tous / en attente / approuvées / exécutées / rejetées / annulées).
- **Badge compteur** sur l'onglet quand il y a des demandes en attente.
- **Table** avec colonnes : Produit, Trajet (source → destination), Quantité, Demandeur, Statut, Actions.
- **Actions contextuelles** :
  - Demande `pending` + viewer admin → **Approuver** / **Rejeter**
  - Demande `approved` + viewer admin ou demandeur → **Exécuter**
  - Demande `pending` ou `approved` + demandeur → **Annuler**
  - Rejet = **commentaire obligatoire** (≥ 3 caractères)

---

## 4. Workflow d'un transfert (cycle de vie)

```
┌──────────────────────────────────────────────────────────────┐
│  1. DEMANDE                                                 │
│     Un staff crée une demande : produit, source,            │
│     destination, quantité, motif.                           │
│     → status = 'pending'                                    │
└──────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ approve  │    │  reject  │    │  cancel  │
       │ (admin/  │    │ (admin/  │    │ (demander│
       │   admin) │    │   admin) │    │  ou admin│
       └──────────┘    └──────────┘    └──────────┘
              │               │               │
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ approved │    │ rejected │    │cancelled │
       └──────────┘    └──────────┘    └──────────┘
              │
              ▼
       ┌──────────┐
       │ execute  │  (admin OU administrator OU demandeur)
       └──────────┘
              │
              ▼
       ┌──────────┐
       │ executed │  → 2 lignes dans restock_history
       │          │     (sortie + entrée, même transfer_group_id)
       │          │  → products.stock recalculé (trigger SQL SUM)
       └──────────┘
```

---

## 5. Mouvement de stock depuis le catalogue

Le dialog « Mouvement de stock » (accessible depuis `/admin/stocks` et depuis
chaque produit dans `/admin/catalogue`) intègre désormais un sélecteur de
localité :

- **Si au moins 1 localité est enregistrée** : le sélecteur s'affiche et est
  obligatoire. La localité est **pré-remplie** avec celle où le produit est
  physiquement présent (1re localité avec stock > 0).
- **Si aucune localité n'est enregistrée** : comportement legacy, maj directe
  de `products.stock` (rétro-compatible).
- **Toast de confirmation** enrichi :
  > « Mouvement enregistré : +5 à la localité M-CASA-CENTRAL → 95 en stock global »

---

## 6. Création d'un profil staff logistique

Dans `/admin/personnels` → « + Ajouter un membre » → choisir le rôle :

```
┌─ Logistique — gestion des localités ─────────────────────┐
│  Gestionnaire de Dépôt         → type depot             │
│  Gestionnaire de Magasin       → type magasin           │
│  Gestionnaire de Présentoir    → type présentoir        │
└──────────────────────────────────────────────────────────┘
```

Une fois le rôle sélectionné, **un nouveau bloc « Localités affectées »**
apparaît : multi-select filtré sur le type correspondant au rôle.
- 0 localité sélectionnée → bandeau d'avertissement
- Toutes les permissions `can_*_locations` restent cochables manuellement
  dans la grille des toggles.

---

## 7. Capacité et alertes

- **Vert** : remplissage ≤ 70 %
- **Orange** : 70-90 %
- **Rouge** : ≥ 90 %
- **Sur-capacité** : unités stockées > capacité déclarée

> ⚠️ La capacité est un **indicateur visuel**, pas un blocage. Vous pouvez
> dépasser la capacité (toast warning, pas de refus). C'est volontaire pour
> ne pas bloquer les opérations en cas de sous-estimation initiale.

---

## 8. Stock global vs stock par localité

Le stock global (`products.stock`) est désormais **la somme** des quantités
par localité. Il est :
- **En Supabase** : recalculé automatiquement par un trigger SQL `AFTER
  INSERT/UPDATE/DELETE` sur `product_location_stock`.
- **En mock** : recalculé manuellement à chaque mouvement.

> Implication : modifier `products.stock` directement est désormais
> **incorrect**. Utilisez toujours le dialog de mouvement de stock (qui cible
> une localité) ou le workflow de transfert.

---

## 9. Données seed

À l'installation de la migration `0014_locations.sql`, **3 localités** sont
créées :

| Code | Type | Nom | Ville |
|---|---|---|---|
| `D-CASA-DEPOT` | depot | Dépôt principal — Casablanca | Casablanca |
| `M-CASA-CENTRAL` | magasin | Magasin central — Casablanca | Casablanca |
| `P-SHOWROOM` | presentoir | Showroom / Présentoir | Casablanca |

La migration `0015_product_location_stock.sql` **backfill** automatiquement
tous les produits avec `stock > 0` vers `D-CASA-DEPOT`. Vérification :

```sql
SELECT l.code, COUNT(*) AS nb_produits, SUM(pls.quantity) AS total_unites
FROM eaumalik.product_location_stock pls
JOIN eaumalik.locations l ON l.id = pls.location_id
GROUP BY l.code;
```

---

## 10. Glossaire des permissions

| Permission | Effet |
|---|---|
| `can_view_locations` | Accès lecture à `/admin/locations` |
| `can_manage_locations` | Peut faire des mouvements de stock localisés et demander des transferts |

Ces 2 permissions sont **ajoutées** à la liste existante (`can_view_*`,
`can_edit_*`, etc.). Compatibles avec le rôle `stock_manager` qui les obtient
par défaut.

---

## 11. Troubleshooting

### « Je ne vois pas la localité X dans l'onglet Inventaire »

- Vérifiez que la localité n'est pas archivée (filtre « Archivées »).
- Si vous êtes `store_manager` : vérifiez que la localité est bien dans
  `managed_location_ids` ET de type `magasin`.
- Rechargez la page (le cache Next.js peut être obsolète).

### « Mon transfert n'apparaît pas dans l'onglet Workflows »

- Filtre par statut (peut-être que la demande est déjà `executed`).
- Si vous êtes sous-rôle logistique : la demande doit impliquer au moins
  une de vos localités affectées.

### « La barre de capacité reste vide / grise »

- Vous n'avez pas renseigné `capacity_units` ET `capacity_area_m2`.
- Allez dans Modifier la localité → remplir au moins un des deux.

### « Le bouton « Exécuter maintenant » est grisé »

- La demande n'est pas `approved` (vérifiez le badge statut).
- Vous n'êtes ni `admin`/`administrator` ni le demandeur initial.

---

## 12. API / Server Actions (référence développeur)

Voir [`/src/app/actions/locationsActions.ts`](../src/app/actions/locationsActions.ts) et
[`/src/app/actions/transferActions.ts`](../src/app/actions/transferActions.ts).

| Action | Signature | Rôles |
|---|---|---|
| `listLocationsAction` | `(filters) → { locations[] }` | staff authentifié (filtré) |
| `listAllLocationsForAdminAction` | `(filters) → { locations[] }` | admin, administrator |
| `createLocationAction` | `(input) → { location }` | admin, administrator |
| `updateLocationAction` | `(id, input) → { location }` | admin, administrator |
| `archiveLocationAction` | `(id) → { location }` | admin, administrator |
| `restoreLocationAction` | `(id) → { location }` | admin, administrator |
| `purgeLocationAction` | `(id) → {}` | admin (superadmin) |
| `createTransferRequestAction` | `(input) → { request }` | staff authentifié |
| `updateTransferRequestAction` | `({ request_id, action, comment? })` | admin/administrator + requester |
| `executeTransferRequestAction` | `(requestId) → { request }` | admin OU requester |

---

## 13. Limitations connues (juillet 2026)

- **Pas de sélecteur automatique de la localité de pick** à l'expédition :
  pour le moment, c'est un workflow manuel via l'onglet Workflows.
- **Pas de notifications email/SMS** aux approbateurs : la notification est
  visuelle (badge compteur sur l'onglet Workflows).
- **Pas de scan QR** : l'inventaire physique reste géré hors-app.
- **Capacité non bloquante** : on peut dépasser la capacité déclarée. Le
  respect strict est laissé à la discipline de l'admin.

---

## 14. Liens utiles

- [`AUDIT-APPLICATION-2026-07-17.md`](../AUDIT-APPLICATION-2026-07-17.md) — section « Performance, architecture et qualité »
- [`DEPLOY.md`](./DEPLOY.md) — processus de déploiement
- [`OPERATIONS-SECURITY.md`](./OPERATIONS-SECURITY.md) — bonnes pratiques secrets
- [`MASTER-PROMPT.md`](./MASTER-PROMPT.md) — référence globale du projet
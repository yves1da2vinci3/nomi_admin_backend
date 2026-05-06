# `admin_backend` — API Express (Bun) pour le SPA admin

Ce service sert **uniquement** le dossier [`admin/`](../admin/). Il partage la **même base PostgreSQL** que `nomi_backend` via `DATABASE_URL`, mais se déploie comme **service séparé** (pas de dépendance runtime avec `nomi_backend`).

## Hors périmètre

- Pas d’exposition de **`ChatMessage`**, messagerie ni CRUD messages sous session scénario — l’admin produit n’en a pas besoin dans cette API.
- Les **migrations Prisma** sont appliquées **uniquement** depuis [`nomi_backend`](../nomi_backend/) (`prisma migrate deploy`). Ici : **`prisma generate`** au build / après sync du schéma.

## Variables d’environnement

Copier [`.env.example`](./.env.example) vers `.env` et ajuster.

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Connexion PostgreSQL (souvent identique à `nomi_backend`). |
| `ADMIN_API_TOKEN` | Secret pour l’en-tête `Authorization: Bearer …` (minimum 8 caractères). |
| `PORT` | Port HTTP (défaut `4001`). |
| `ADMIN_CORS_ORIGIN` | Origine du build Vite admin (ex. `http://localhost:5173`). Omis → CORS permissif côté dev. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Utilisés par `bun run seed:admin` uniquement (compte `Admin` en base, distinct du jeton API). |

Côté SPA : **`VITE_ADMIN_API_URL`** doit pointer vers l’URL de ce service ; les requêtes authentifiées envoient le Bearer configuré côté front.

## Prisma et schéma

- Le fichier [`prisma/schema.prisma`](./prisma/schema.prisma) est une **copie** de celui de `nomi_backend`. Après chaque migration dans `nomi_backend`, **resynchroniser** ce fichier pour éviter le drift.
- Génération du client : `bun run prisma:generate` ou `bun run build`.

## Démarrage

```bash
cd admin_backend
bun install
bun run prisma:generate
# Sur la base : appliquer les migrations depuis nomi_backend une fois
# (depuis ../nomi_backend) : bunx prisma migrate deploy

export DATABASE_URL="postgresql://..."
export ADMIN_API_TOKEN="votre-jeton-long"
bun run dev
```

Santé du service (sans auth) : `GET http://localhost:4001/health`.

## Seed compte Admin (base)

Après migration du modèle `Admin` :

```bash
export DATABASE_URL="postgresql://..."
export SEED_ADMIN_EMAIL="admin@example.com"
export SEED_ADMIN_PASSWORD="..."
bun run seed:admin
```

## Appels API (exemples)

Toutes les routes sous `/api/v1/*` exigent :

```http
Authorization: Bearer <ADMIN_API_TOKEN>
```

```bash
curl -sS -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "http://localhost:4001/api/v1/dashboard/metrics?days=7"

curl -sS -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "http://localhost:4001/api/v1/users"

curl -sS -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "http://localhost:4001/api/v1/generated-games?gameType=story"
```

## Risques connus

- **Drift** entre les deux `schema.prisma` si la copie n’est pas mise à jour après une migration `nomi_backend`.
- **Abonnements** : l’endpoint overview peut renvoyer des données **démo** étiquetées — pas de vérité billing dans Prisma Nomi.

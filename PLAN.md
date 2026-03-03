# geek-api — Plan de projet

> **Projet** : API REST + RPC pour une collection de produits geek (mangas, figurines, merch)
> **Objectif pédagogique** : Maîtriser `@effect/platform` HTTP et `@effect/rpc` avec Effect v4 beta
> **Stack** : Effect v4 beta · @effect/platform-bun · @effect/rpc · Drizzle ORM · Neon (PostgreSQL)
> **Démarré le** : —
> **Auteur** : Marc Le Labourier

---

## Contexte

Marc est développeur freelance / CTO en formation. Il maîtrise déjà Effect.ts v3 (Effect.gen, tagged errors, Schema, Service/Layer, Context.Tag). Ce projet explore Effect v4 beta et ses nouveaux modules HTTP et RPC — une API standalone que n'importe quel client (web SPA, app mobile) peut appeler.

**Ce projet n'est PAS :**
- Une app full-stack avec SSR ou server functions
- Un projet de production — c'est un lab, on accepte les breaking changes beta

---

## Changements Effect v4 à connaître avant de coder

### 1. Versioning unifié
Tous les packages partagent le même numéro de version. Installer en cohérence :
```bash
bun add effect@beta @effect/platform@beta @effect/platform-bun@beta @effect/rpc@beta
```
Vérifier que toutes les versions beta installées sont identiques (`bun pm ls`).

### 2. Pattern HTTP : HttpApi (déclaratif, v4)
Plus de `HttpRouter.get(path, handler)` impératif. En v4, on **déclare** l'API d'abord, puis on **implémente** les handlers.

**⚠️ Changement majeur v4** : plus de méthodes chaînées (`.addSuccess()`, `.setPayload()`). Tout passe dans l'objet `options` du constructeur.

**Imports v4 :**
```typescript
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Schema, Effect, Layer } from "effect"
```

```typescript
// 1. Déclaration (le contrat)
const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("items")
    .add(HttpApiEndpoint.get("list", "/items", { success: Schema.Array(ItemSchema) }))
    .add(HttpApiEndpoint.post("create", "/items", { success: ItemSchema, payload: CreateItemFields }))
)

// 2. Implémentation
const ItemsLive = HttpApiBuilder.group(MyApi, "items", (handlers) =>
  handlers
    .handle("list", () => Effect.succeed([]))
    .handle("create", ({ payload }) => Effect.succeed(payload))
)

// 3. Serveur
const ApiLive = HttpApiBuilder.layer(MyApi).pipe(Layer.provide(ItemsLive))

const ServerLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

BunRuntime.runMain(Layer.launch(ServerLive))
```

Bonus : `HttpApiSwagger` ajoute `/docs` (Swagger UI) sans config supplémentaire.

### 3. Pattern RPC : RpcGroup (v4)
```typescript
import { Rpc, RpcGroup, RpcServer, RpcClient, RpcSerialization } from "effect/unstable/rpc"

// Contrat (partageable client/serveur)
export class CollectionRpcs extends RpcGroup.make(
  Rpc.make("Add", { success: CollectionItem, payload: { productId: Schema.String } }),
  Rpc.make("Remove", { success: Schema.Void, payload: { productId: Schema.String } }),
  Rpc.make("List", { success: CollectionItem, stream: true })
) {}

// Implémentation serveur
const CollectionLive = CollectionRpcs.toLayer(
  Effect.gen(function* () {
    const repo = yield* CollectionRepository
    return {
      Add: ({ productId }) => repo.add(productId),
      Remove: ({ productId }) => repo.remove(productId),
      List: () => Stream.fromIterableEffect(repo.findAll()),
    }
  })
)

// Montage dans le serveur HTTP
const RpcProtocol = RpcServer.layerProtocolHttp({ path: "/rpc" }).pipe(
  Layer.provide(RpcSerialization.layerNdjson)
)
const RpcLive = RpcServer.layer(CollectionRpcs).pipe(Layer.provide(CollectionLive))
```

### 4. Packages installés
```
effect@4.0.0-beta.25           — core + http + httpapi + rpc (via effect/unstable/*)
@effect/platform-bun@4.0.0-beta.25  — BunHttpServer, BunRuntime
drizzle-orm + drizzle-kit       — ORM + migrations
@neondatabase/serverless        — client Neon
```

> **Note** : `@effect/platform` et `@effect/rpc` sont fusionnés dans `effect` en v4 beta.
> Les modules HTTP, HttpApi et RPC sont accessibles via `effect/unstable/*` (unstable = peuvent changer dans les mineurs).

---

## Domaine métier

Une API pour gérer une collection de produits geek. L'API est publique en lecture, mais les mutations et la gestion des collections nécessitent une clé API.

### Modèle de données

```
Franchise        Dragon Ball, Naruto, Marvel, Studio Ghibli...
  └── Product    Tome 1 DB, Figurine Goku, Artbook Ghibli, T-shirt Naruto...

User             Collectionneur (identifié par sa clé API)
  └── ApiKey     Clé(s) d'accès de l'utilisateur
  └── UserCollection   (quels Products il possède)
  └── UserWishlist     (quels Products il veut)
```

**Franchise**
| Champ | Type | Notes |
|-------|------|-------|
| id | text UUID | PK |
| name | text | notNull |
| slug | text | unique |
| type | enum | manga · anime · game · comic · movie · other |
| origin | enum | jp · us · fr · other |
| description | text | nullable |
| coverImage | text | URL nullable |
| createdAt | timestamp | |

**Product**
| Champ | Type | Notes |
|-------|------|-------|
| id | text UUID | PK |
| franchiseId | text | FK → franchise |
| name | text | notNull |
| slug | text | unique |
| type | enum | manga_volume · figurine · artbook · apparel · other |
| condition | enum | new · like_new · good · acceptable · poor |
| price | integer | en centimes |
| photos | text[] | URLs R2 (simulées en lab) |
| createdAt | timestamp | |

**User**
| Champ | Type | Notes |
|-------|------|-------|
| id | text UUID | PK |
| name | text | nullable |
| createdAt | timestamp | |

**ApiKey**
| Champ | Type | Notes |
|-------|------|-------|
| id | text UUID | PK |
| userId | text | FK → user |
| key | text | unique, généré aléatoirement |
| name | text | label ex: "Mon app mobile" |
| createdAt | timestamp | |
| lastUsedAt | timestamp | nullable — usage monitoring |

**UserCollection**
| Champ | Type | Notes |
|-------|------|-------|
| userId | text | FK → user |
| productId | text | FK → product |
| quantity | integer | default 1 |
| acquiredAt | timestamp | |
PK composite (userId, productId)

**UserWishlist**
| Champ | Type | Notes |
|-------|------|-------|
| userId | text | FK → user |
| productId | text | FK → product |
| createdAt | timestamp | |
PK composite (userId, productId)

---

## Structure du projet

```
geek-api/
├── src/
│   ├── main.ts                  ← entry point — Layer.launch(ServerLive)
│   ├── api.ts                   ← HttpApi.make() — déclaration globale
│   ├── server.ts                ← composition HttpApiBuilder.serve() + BunHttpServer
│   │
│   ├── domain/
│   │   ├── franchise/
│   │   │   ├── schema.ts        ← Effect Schema + Drizzle table
│   │   │   ├── repository.ts    ← Context.Tag + Layer Drizzle + Layer Mock
│   │   │   └── handlers.ts      ← HttpApiBuilder.group(MyApi, "franchises", ...)
│   │   ├── product/
│   │   │   ├── schema.ts
│   │   │   ├── repository.ts
│   │   │   └── handlers.ts
│   │   └── collection/
│   │       ├── schema.ts
│   │       ├── repository.ts
│   │       └── rpc.ts           ← CollectionRpcs (RpcGroup) + implémentation
│   │
│   ├── middleware/
│   │   └── auth.ts              ← HttpApiMiddleware API Key, CurrentUser context tag
│   │
│   └── lib/
│       ├── db.ts                ← Drizzle client (Neon)
│       └── runtime.ts           ← ManagedRuntime si besoin
│
├── scripts/
│   └── seed-apikey.ts           ← crée un user + une ApiKey de test en DB
│
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Phases

### Phase 0 — Setup
**Durée estimée** : 0.5 jour

**Checklist :**
- [ ] `bun init` + configuration TypeScript strict
- [ ] Installer les dépendances (voir commandes ci-dessous)
- [ ] `tsconfig.json` : `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] `.env.example` avec `DATABASE_URL`, `PORT=3000`
- [ ] `drizzle.config.ts` + `src/lib/db.ts` (client Neon)
- [ ] Schéma Drizzle : franchise, product, user, api_key, user_collection, user_wishlist
- [ ] `db:push` sur Neon → tables créées
- [ ] `src/main.ts` minimal qui démarre un serveur sur le port 3000 et répond `{ ok: true }` sur `GET /health`

**Commandes d'installation :**
```bash
bun add effect@beta @effect/platform@beta @effect/platform-bun@beta @effect/rpc@beta
bun add drizzle-orm @neondatabase/serverless
bun add -d drizzle-kit typescript @types/bun
```
⚠️ Vérifier après install que toutes les versions `@beta` sont identiques.

**Validation :** `bun run src/main.ts` → serveur démarre, `curl localhost:3000/health` → `{ "ok": true }`

---

### Phase 1 — CRUD Franchise + Product
**Durée estimée** : 1.5 jours

**Objectif** : Implémenter les endpoints REST pour les deux ressources principales en utilisant le pattern `HttpApi` / `HttpApiBuilder`. Routes ouvertes pour l'instant — la protection est ajoutée en Phase 2.

**Endpoints Franchise :**
- `GET /franchises` — liste (avec filtre optionnel `?type=manga`)
- `GET /franchises/:id` — détail
- `POST /franchises` — création
- `PATCH /franchises/:id` — mise à jour partielle
- `DELETE /franchises/:id` — suppression

**Endpoints Product :**
- `GET /products` — liste (filtres : `?franchiseId=`, `?type=`, `?maxPrice=`)
- `GET /products/:id` — détail
- `POST /products` — création
- `PATCH /products/:id` — mise à jour partielle
- `DELETE /products/:id` — suppression

**Architecture à respecter :**
- `FranchiseRepository` et `ProductRepository` → `Context.Tag` + `Layer` Drizzle
- Les handlers reçoivent les erreurs typées du repository (pas de try/catch)
- Un `Layer Mock` pour chaque repository (pour les tests ou le dev sans DB)
- `HttpApiSwagger` monté → Swagger UI accessible sur `/docs`

**Validation :** CRUD complet via curl ou Swagger UI, repository Mock fonctionne en isolation.

---

### Phase 2 — Auth API Key
**Durée estimée** : 0.5 jour

**Objectif** : Protéger les routes de mutation avec un middleware API Key pur Effect — pas de dépendance externe.

**Fonctionnement :**
- Header attendu : `Authorization: Bearer <api-key>`
- Le middleware fait un lookup en DB → résout le `User` associé
- `CurrentUser` est injecté dans le contexte Effect via `Context.Tag`
- `lastUsedAt` sur `api_key` mis à jour à chaque requête authentifiée

**Checklist :**
- [ ] `CurrentUser` : `Context.Tag<{ id: string; name: string | null }>`
- [ ] `UnauthorizedError` : tagged error (manquant, invalide, révoqué)
- [ ] `HttpApiMiddleware` qui lit le header, fait le lookup, injecte `CurrentUser`
- [ ] Routes protégées : POST/PATCH/DELETE sur franchises et products
- [ ] Routes publiques : GET franchises, GET products
- [ ] `scripts/seed-apikey.ts` : crée un user + une clé de test → affiche la clé générée

**Validation :** `POST /franchises` sans header → 401. Avec `Authorization: Bearer <clé>` valide → 201.

---

### Phase 3 — @effect/rpc (UserCollection)
**Durée estimée** : 1 jour

**Objectif** : Implémenter la gestion de la collection utilisateur via RPC plutôt que REST. Comprendre la différence et les avantages.

**Contrat RPC à définir (`src/domain/collection/rpc.ts`) :**
```typescript
CollectionRpcs:
  - AddToCollection      payload: { productId }   → CollectionItem
  - RemoveFromCollection payload: { productId }   → void
  - GetCollection        stream: true             → CollectionItem[]
  - GetWishlist          stream: true             → Product[]
  - AddToWishlist        payload: { productId }   → void
  - RemoveFromWishlist   payload: { productId }   → void
```

**Checklist :**
- [ ] `CollectionRpcs` défini avec `RpcGroup.make(...)`
- [ ] Implémentation server-side avec `CollectionRpcs.toLayer(...)`
- [ ] `CollectionRepository` injecté via Layer
- [ ] Monté dans le serveur : `RpcServer.layerProtocolHttp({ path: "/rpc" })`
- [ ] Sérialisation : `RpcSerialization.layerNdjson`
- [ ] Auth : le middleware API Key injecte `CurrentUser` dans le contexte RPC (toutes les RPC sont protégées)
- [ ] Client de test : un script `scripts/test-rpc.ts` qui appelle l'API via `RpcClient.make(CollectionRpcs)`

**Validation :** `bun run scripts/test-rpc.ts` → AddToCollection + GetCollection fonctionnent avec une clé valide.

---

## Extensions possibles (si temps)

Ces phases sont optionnelles et exploratoires — pas de pression de complétion.

### Phase 4 — @effect/cli
Script d'import catalogue depuis un CSV (`bun run src/cli/import.ts franchises.csv`).
Explorer : `Command.make`, `Args`, `Options`, prompts interactifs.

### Phase 5 — @effect/ai
Génération automatique de description pour un Product via un LLM.
Explorer : intégration avec l'API Claude ou OpenAI via `@effect/ai`.

### Phase 6 — Deploy
Déployé sur le serveur lab Hetzner — Docker + GitHub Actions.

---

## Conventions

| Règle | Valeur |
|-------|--------|
| Package manager | `bun` — jamais npm ni pnpm |
| TypeScript | strict + noUncheckedIndexedAccess |
| Nommage DB | snake_case |
| Nommage TS | camelCase |
| IDs | text UUID (`$defaultFn(() => crypto.randomUUID())`) |
| Monnaie | integer en centimes (pas de decimal) |
| Images | text URLs (simulées en lab, R2 en prod) |
| Imports | `@/` → `./src/*` (via tsconfig paths) |
| Erreurs | Tagged errors uniquement — pas de try/catch en logique métier |
| `any` | Interdit sauf self-reference Drizzle (commenter pourquoi) |

---

## Variables d'environnement

```bash
# .env.example
DATABASE_URL=postgresql://...  # Neon connection string
PORT=3000
```

---

## Ressources

- [Effect v4 Beta — blog officiel](https://effect.website/blog/releases/effect/40-beta/)
- [@effect/platform README](https://github.com/Effect-TS/effect/blob/main/packages/platform/README.md)
- [@effect/rpc README](https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md)
- [Effect docs](https://effect.website/docs)

---

## Checkpoint

```
claude --resume [À compléter à chaque session]
```

| Phase | Statut | Date |
|-------|--------|------|
| 0 — Setup | ✅ | 2026-03-03 |
| 1 — CRUD Franchise + Product | 🔲 | |
| 2 — Auth API Key | 🔲 | |
| 3 — @effect/rpc Collection | 🔲 | |

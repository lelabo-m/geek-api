import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

// --- Enums ---

export const franchiseTypeEnum = pgEnum("franchise_type", [
  "manga",
  "anime",
  "game",
  "comic",
  "movie",
  "other",
])

export const franchiseOriginEnum = pgEnum("franchise_origin", [
  "jp",
  "us",
  "fr",
  "other",
])

export const productTypeEnum = pgEnum("product_type", [
  "manga_volume",
  "figurine",
  "artbook",
  "apparel",
  "other",
])

export const productConditionEnum = pgEnum("product_condition", [
  "new",
  "like_new",
  "good",
  "acceptable",
  "poor",
])

// --- Tables ---

export const franchise = pgTable("franchise", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: franchiseTypeEnum("type").notNull(),
  origin: franchiseOriginEnum("origin").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const product = pgTable("product", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  franchiseId: text("franchise_id")
    .notNull()
    .references(() => franchise.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: productTypeEnum("type").notNull(),
  condition: productConditionEnum("condition").notNull(),
  price: integer("price").notNull(),
  photos: text("photos").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const apiKey = pgTable("api_key", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
})

export const userCollection = pgTable(
  "user_collection",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull().default(1),
    acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })]
)

export const userWishlist = pgTable(
  "user_wishlist",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })]
)

import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { Schema, Effect, Layer } from "effect"

// --- API declaration ---

const HealthResponse = Schema.Struct({ ok: Schema.Boolean })

const GeekApi = HttpApi.make("GeekApi").add(
  HttpApiGroup.make("health").add(
    HttpApiEndpoint.get("health", "/health", { success: HealthResponse })
  )
)

// --- Handlers ---

const HealthLive = HttpApiBuilder.group(GeekApi, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed({ ok: true }))
)

// --- Server composition ---

const ApiLive = HttpApiBuilder.layer(GeekApi).pipe(Layer.provide(HealthLive))

const ServerLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(BunHttpServer.layer({ port: Number(process.env["PORT"] ?? 3000) }))
)

BunRuntime.runMain(Layer.launch(ServerLive))

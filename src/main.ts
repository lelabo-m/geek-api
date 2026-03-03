import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter } from "effect/unstable/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger,
} from "effect/unstable/httpapi";

// --- API declaration ---

const HealthResponse = Schema.Struct({ ok: Schema.Boolean });

const GeekApi = HttpApi.make("GeekApi").add(
  HttpApiGroup.make("health").add(
    HttpApiEndpoint.get("health", "/health", { success: HealthResponse }),
  ),
);

// --- Handlers ---

const HealthLive = HttpApiBuilder.group(GeekApi, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed({ ok: true })),
);

// --- Server composition ---

const ApiLive = HttpApiBuilder.layer(GeekApi).pipe(
  Layer.provide(HealthLive),
  Layer.provide(HttpApiSwagger.layer(GeekApi)),
);

const ServerLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(
    BunHttpServer.layer({ port: Number(process.env["PORT"] ?? 3000) }),
  ),
);

BunRuntime.runMain(Layer.launch(ServerLive));

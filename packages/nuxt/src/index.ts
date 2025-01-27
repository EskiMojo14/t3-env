import type {
  CreateEnv,
  DefaultCombinedSchema,
  FinalSchemaOptions,
  ServerClientOptions,
  SkipValidationOptions,
  StandardSchemaDictionary,
  StandardSchemaV1,
  StrictOptions,
} from "@t3-oss/env-core";
import { createEnv as createEnvCore } from "@t3-oss/env-core";

const CLIENT_PREFIX = "NUXT_PUBLIC_" as const;
type ClientPrefix = typeof CLIENT_PREFIX;

type Options<
  TServer extends StandardSchemaDictionary,
  TClient extends Record<`${ClientPrefix}${string}`, StandardSchemaV1>,
  TShared extends StandardSchemaDictionary,
  TExtends extends Array<Record<string, unknown>>,
  TFinalSchema extends StandardSchemaV1<{}, {}>,
> = Omit<
  StrictOptions<ClientPrefix, TServer, TClient, TShared, TExtends> &
    ServerClientOptions<ClientPrefix, TServer, TClient> &
    FinalSchemaOptions<TServer, TClient, TShared, TFinalSchema> &
    SkipValidationOptions<TFinalSchema>,
  "runtimeEnvStrict" | "runtimeEnv" | "clientPrefix"
>;

export function createEnv<
  TServer extends StandardSchemaDictionary = NonNullable<unknown>,
  TClient extends Record<
    `${ClientPrefix}${string}`,
    StandardSchemaV1
  > = NonNullable<unknown>,
  TShared extends StandardSchemaDictionary = NonNullable<unknown>,
  const TExtends extends Array<Record<string, unknown>> = [],
  TFinalSchema extends StandardSchemaV1<{}, {}> = DefaultCombinedSchema<
    TServer,
    TClient,
    TShared
  >,
>(
  opts: Options<TServer, TClient, TShared, TExtends, TFinalSchema>,
): CreateEnv<TFinalSchema, TExtends> {
  return createEnvCore<
    ClientPrefix,
    TServer,
    TClient,
    TShared,
    TExtends,
    TFinalSchema
  >({
    ...opts,
    clientPrefix: CLIENT_PREFIX,
    runtimeEnv: process.env,
  } as never);
}

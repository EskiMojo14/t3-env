/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import * as v from "valibot";
import { createEnv } from "../src";
import runSmokeTests from "./smoke.test";

runSmokeTests({
  returnType: {
    simple: {
      server: { BAR: v.string() },
      client: { FOO_BAR: v.string() },
    },
    withTransforms: {
      server: { BAR: v.pipe(v.string(), v.transform(Number), v.number()) },
      client: { FOO_BAR: v.string() },
    },
    withoutClientVars: {
      server: { BAR: v.string() },
    },
  },

  numberAndBoolean: {
    server: { PORT: v.number(), IS_DEV: v.boolean() },
  },

  failValidation: {
    missingEnvs: {
      server: { BAR: v.string() },
      client: { FOO_BAR: v.string() },
    },
    invalidEnvs: {
      server: { BAR: v.pipe(v.string(), v.transform(Number), v.number()) },
      client: { FOO_BAR: v.string() },
    },
    customErrorHandler: {
      server: { BAR: v.pipe(v.string(), v.transform(Number), v.number()) },
      client: { FOO_BAR: v.string() },
      errorMessage: "Invalid type: Expected number but received NaN",
    },
  },

  serverVarsOnClient: {
    withDefaultHandler: {
      server: { BAR: v.string() },
      client: { FOO_BAR: v.string() },
    },
    withCustomHandler: {
      server: { BAR: v.string() },
      client: { FOO_BAR: v.string() },
    },
  },

  clientOrServerOnly: {
    clientOnly: {
      client: { FOO_BAR: v.string() },
    },
    serverOnly: {
      server: { BAR: v.string() },
    },
    configWithMissingClient: {},
    configWithMissingClientPrefix: {},
  },

  sharedAccessOnClientOrServer: {
    server: {
      shared: {
        NODE_ENV: v.picklist(["development", "production", "test"]),
      },
      server: { BAR: v.string() },
      client: { FOO_BAR: v.string() },
    },
    client: {
      shared: {
        NODE_ENV: v.picklist(["development", "production", "test"]),
      },
      server: { BAR: v.string() },
      client: { FOO_BAR: v.string() },
    },
  },

  readonlyEnvs: {
    server: { BAR: v.string() },
  },

  extendingPresets: {
    withInvalidRuntimeEnvs: {
      presetServer: { PRESET_ENV: v.string() },
      server: { SERVER_ENV: v.string() },
      client: { CLIENT_ENV: v.string() },
      expectedIssue: expect.objectContaining({
        message: expect.any(String),
        path: ["PRESET_ENV"],
      }),
    },
    singlePreset: {
      server: {
        presetServer: { PRESET_ENV: v.string() },
        server: { SERVER_ENV: v.string() },
        client: { CLIENT_ENV: v.string() },
        shared: { SHARED_ENV: v.string() },
      },
      client: {
        presetServer: { PRESET_ENV: v.string() },
        server: { SERVER_ENV: v.string() },
        client: { CLIENT_ENV: v.string() },
        shared: { SHARED_ENV: v.string() },
      },
    },

    multiplePresets: {
      server: {
        presetServer1: { PRESET_ENV1: v.picklist(["preset"]) },
        presetServer2: { PRESET_ENV2: v.number() },
        server: { SERVER_ENV: v.string() },
        client: { CLIENT_ENV: v.string() },
        shared: { SHARED_ENV: v.string() },
      },
      client: {
        presetServer1: { PRESET_ENV1: v.picklist(["preset"]) },
        presetServer2: { PRESET_ENV2: v.number() },
        server: { SERVER_ENV: v.string() },
        client: { CLIENT_ENV: v.string() },
        shared: { SHARED_ENV: v.string() },
      },
    },
  },
});

describe("createFinalSchema", () => {
  test("custom schema combiner", () => {
    let receivedIsServer = false;
    const env = createEnv({
      server: {
        SERVER_ENV: v.string(),
      },
      shared: {
        SHARED_ENV: v.string(),
      },
      clientPrefix: "CLIENT_",
      client: {
        CLIENT_ENV: v.string(),
      },
      runtimeEnv: {
        SERVER_ENV: "server",
        SHARED_ENV: "shared",
        CLIENT_ENV: "client",
      },
      createFinalSchema: (shape, isServer) => {
        expectTypeOf(isServer).toEqualTypeOf<boolean>();
        if (typeof isServer === "boolean") receivedIsServer = true;
        return v.object(shape);
      },
    });
    expectTypeOf(env).toEqualTypeOf<
      Readonly<{
        SERVER_ENV: string;
        SHARED_ENV: string;
        CLIENT_ENV: string;
      }>
    >();
    expect(env).toMatchObject({
      SERVER_ENV: "server",
      SHARED_ENV: "shared",
      CLIENT_ENV: "client",
    });
    expect(receivedIsServer).toBe(true);
  });
  test("schema combiner with further refinement", () => {
    const env = createEnv({
      server: {
        SKIP_AUTH: v.optional(v.boolean()),
        EMAIL: v.optional(v.pipe(v.string(), v.email())),
        PASSWORD: v.optional(v.pipe(v.string(), v.minLength(1))),
      },
      runtimeEnv: {
        SKIP_AUTH: true,
      },
      createFinalSchema: (shape) =>
        v.pipe(
          v.object(shape),
          v.check((env) => env.SKIP_AUTH || !!(env.EMAIL && env.PASSWORD)),
        ),
    });
    expectTypeOf(env).toEqualTypeOf<
      Readonly<{
        SKIP_AUTH?: boolean;
        EMAIL?: string;
        PASSWORD?: string;
      }>
    >();
    expect(env).toMatchObject({ SKIP_AUTH: true });
  });
  test("schema combiner that changes the type", () => {
    const env = createEnv({
      server: {
        SKIP_AUTH: v.optional(v.boolean()),
        EMAIL: v.optional(v.pipe(v.string(), v.email())),
        PASSWORD: v.optional(v.pipe(v.string(), v.minLength(1))),
      },
      runtimeEnv: {
        SKIP_AUTH: true,
      },
      createFinalSchema: (shape) =>
        v.pipe(
          v.object(shape),
          v.rawTransform(({ addIssue, dataset, NEVER }) => {
            const env = dataset.value;
            if (env.SKIP_AUTH) return { SKIP_AUTH: true } as const;
            if (!env.EMAIL || !env.PASSWORD) {
              addIssue({
                message:
                  "EMAIL and PASSWORD are required if SKIP_AUTH is false",
              });
              return NEVER;
            }
            return {
              EMAIL: env.EMAIL,
              PASSWORD: env.PASSWORD,
            };
          }),
        ),
    });
    expectTypeOf(env).toEqualTypeOf<
      Readonly<
        | {
            readonly SKIP_AUTH: true;
            EMAIL?: undefined;
            PASSWORD?: undefined;
          }
        | {
            readonly SKIP_AUTH?: undefined;
            EMAIL: string;
            PASSWORD: string;
          }
      >
    >();
    expect(env).toMatchObject({ SKIP_AUTH: true });
  });
});

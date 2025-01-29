/// <reference types="bun" />
import { describe, expect, spyOn, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import z from "zod";
import { createEnv } from "../src";
import runSmokeTests from "./smoke.test";

function ignoreErrors(cb: () => void) {
  try {
    cb();
  } catch (err) {
    // ignore
  }
}

test("server vars should not be prefixed", () => {
  ignoreErrors(() => {
    createEnv({
      clientPrefix: "FOO_",
      server: {
        // @ts-expect-error - server should not have FOO_ prefix
        FOO_BAR: z.string(),
        BAR: z.string(),
      },
      client: {},
      runtimeEnv: {},
    });
  });
});

test("client vars should be correctly prefixed", () => {
  ignoreErrors(() => {
    createEnv({
      clientPrefix: "FOO_",
      server: {},
      client: {
        FOO_BAR: z.string(),
        // @ts-expect-error - no FOO_ prefix
        BAR: z.string(),
      },
      runtimeEnv: {},
    });
  });
});

test("runtimeEnvStrict enforces all keys", () => {
  createEnv({
    clientPrefix: "FOO_",
    server: {},
    client: {},
    runtimeEnvStrict: {},
  });

  createEnv({
    clientPrefix: "FOO_",
    server: {},
    client: { FOO_BAR: z.string() },
    runtimeEnvStrict: { FOO_BAR: "foo" },
  });

  createEnv({
    clientPrefix: "FOO_",
    server: { BAR: z.string() },
    client: {},
    runtimeEnvStrict: { BAR: "foo" },
  });

  createEnv({
    clientPrefix: "FOO_",
    server: { BAR: z.string() },
    client: { FOO_BAR: z.string() },
    runtimeEnvStrict: { BAR: "foo", FOO_BAR: "foo" },
  });

  createEnv({
    clientPrefix: "FOO_",
    server: {},
    client: { FOO_BAR: z.string() },
    runtimeEnvStrict: {
      FOO_BAR: "foo",
      // @ts-expect-error - FOO_BAZ is extraneous
      FOO_BAZ: "baz",
    },
  });

  ignoreErrors(() => {
    createEnv({
      clientPrefix: "FOO_",
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
      // @ts-expect-error - BAR is missing
      runtimeEnvStrict: {
        FOO_BAR: "foo",
      },
    });
  });
});

runSmokeTests({
  returnType: {
    simple: {
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
    },
    withTransforms: {
      server: { BAR: z.string().transform(Number) },
      client: { FOO_BAR: z.string() },
    },
    withoutClientVars: {
      server: { BAR: z.string() },
    },
  },

  numberAndBoolean: {
    server: { PORT: z.number(), IS_DEV: z.boolean() },
  },

  failValidation: {
    missingEnvs: {
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
    },
    invalidEnvs: {
      server: { BAR: z.string().transform(Number).pipe(z.number()) },
      client: { FOO_BAR: z.string() },
    },
    customErrorHandler: {
      server: { BAR: z.string().transform(Number).pipe(z.number()) },
      client: { FOO_BAR: z.string() },
      errorMessage: "Expected number, received nan",
    },
  },

  serverVarsOnClient: {
    withDefaultHandler: {
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
    },
    withCustomHandler: {
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
    },
  },

  clientOrServerOnly: {
    clientOnly: {
      client: { FOO_BAR: z.string() },
    },
    serverOnly: {
      server: { BAR: z.string() },
    },
    configWithMissingClient: {},
    configWithMissingClientPrefix: {},
  },

  sharedAccessOnClientOrServer: {
    server: {
      shared: {
        NODE_ENV: z.enum(["development", "production", "test"]),
      },
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
    },
    client: {
      shared: {
        NODE_ENV: z.enum(["development", "production", "test"]),
      },
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
    },
  },

  readonlyEnvs: {
    server: { BAR: z.string() },
  },

  extendingPresets: {
    withInvalidRuntimeEnvs: {
      presetServer: { PRESET_ENV: z.string() },
      server: { SERVER_ENV: z.string() },
      client: { CLIENT_ENV: z.string() },
      expectedIssue: expect.objectContaining({
        message: expect.any(String),
        path: ["PRESET_ENV"],
      }),
    },

    singlePreset: {
      server: {
        presetServer: { PRESET_ENV: z.string() },
        server: { SERVER_ENV: z.string() },
        client: { CLIENT_ENV: z.string() },
        shared: { SHARED_ENV: z.string() },
      },
      client: {
        presetServer: { PRESET_ENV: z.string() },
        server: { SERVER_ENV: z.string() },
        client: { CLIENT_ENV: z.string() },
        shared: { SHARED_ENV: z.string() },
      },
    },

    multiplePresets: {
      server: {
        presetServer1: { PRESET_ENV1: z.enum(["preset"]) },
        presetServer2: { PRESET_ENV2: z.number() },
        server: { SERVER_ENV: z.string() },
        client: { CLIENT_ENV: z.string() },
        shared: { SHARED_ENV: z.string() },
      },
      client: {
        presetServer1: { PRESET_ENV1: z.enum(["preset"]) },
        presetServer2: { PRESET_ENV2: z.number() },
        server: { SERVER_ENV: z.string() },
        client: { CLIENT_ENV: z.string() },
        shared: { SHARED_ENV: z.string() },
      },
    },
  },
});

describe("createFinalSchema", () => {
  test("custom schema combiner", () => {
    let receivedIsServer = false;
    const env = createEnv({
      server: {
        SERVER_ENV: z.string(),
      },
      shared: {
        SHARED_ENV: z.string(),
      },
      clientPrefix: "CLIENT_",
      client: {
        CLIENT_ENV: z.string(),
      },
      runtimeEnv: {
        SERVER_ENV: "server",
        SHARED_ENV: "shared",
        CLIENT_ENV: "client",
      },
      createFinalSchema: (shape, isServer) => {
        expectTypeOf(isServer).toEqualTypeOf<boolean>();
        if (typeof isServer === "boolean") receivedIsServer = true;
        return z.object(shape);
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
        SKIP_AUTH: z.boolean().optional(),
        EMAIL: z.string().email().optional(),
        PASSWORD: z.string().min(1).optional(),
      },
      runtimeEnv: {
        SKIP_AUTH: true,
      },
      createFinalSchema: (shape) =>
        z.object(shape).refine((env) => {
          expectTypeOf(env).toEqualTypeOf<{
            SKIP_AUTH?: boolean;
            EMAIL?: string;
            PASSWORD?: string;
          }>();
          return env.SKIP_AUTH || (env.EMAIL && env.PASSWORD);
        }),
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
        SKIP_AUTH: z.boolean().optional(),
        EMAIL: z.string().email().optional(),
        PASSWORD: z.string().min(1).optional(),
      },
      createFinalSchema: (shape) =>
        z.object(shape).transform((env, ctx) => {
          if (env.SKIP_AUTH) return { SKIP_AUTH: true } as const;
          if (!env.EMAIL || !env.PASSWORD) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "EMAIL and PASSWORD are required if SKIP_AUTH is false",
            });
            return z.NEVER;
          }
          return {
            EMAIL: env.EMAIL,
            PASSWORD: env.PASSWORD,
          };
        }),
      runtimeEnv: {
        SKIP_AUTH: true,
      },
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

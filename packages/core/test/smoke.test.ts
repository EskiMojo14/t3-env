import {
  describe as bunDescribe,
  test as bunTest,
  expect,
  spyOn,
} from "bun:test";
import { expectTypeOf } from "expect-type";
import type { StandardSchemaDictionary, StandardSchemaV1 } from "../src";
import { createEnv } from "../src";
import { combine, describe, ignoreErrors, test } from "./utils";

bunDescribe.skip("type only tests", () => {
  const stringSchema: StandardSchemaV1<string> = null as never;

  bunTest("server vars should not be prefixed", () => {
    createEnv({
      clientPrefix: "FOO_",
      server: {
        // @ts-expect-error - server should not have FOO_ prefix
        FOO_BAR: stringSchema,
        BAR: stringSchema,
      },
      client: {},
      runtimeEnv: {},
    });
  });

  bunTest("client vars should be correctly prefixed", () => {
    createEnv({
      clientPrefix: "FOO_",
      server: {},
      client: {
        FOO_BAR: stringSchema,
        // @ts-expect-error - no FOO_ prefix
        BAR: stringSchema,
      },
      runtimeEnv: {},
    });
  });

  bunTest("runtimeEnvStrict enforces all keys", () => {
    createEnv({
      clientPrefix: "FOO_",
      server: {},
      client: {},
      runtimeEnvStrict: {},
    });

    createEnv({
      clientPrefix: "FOO_",
      server: {},
      client: { FOO_BAR: stringSchema },
      runtimeEnvStrict: { FOO_BAR: "foo" },
    });

    createEnv({
      clientPrefix: "FOO_",
      server: { BAR: stringSchema },
      client: {},
      runtimeEnvStrict: { BAR: "foo" },
    });

    createEnv({
      clientPrefix: "FOO_",
      server: { BAR: stringSchema },
      client: { FOO_BAR: stringSchema },
      runtimeEnvStrict: { BAR: "foo", FOO_BAR: "foo" },
    });

    createEnv({
      clientPrefix: "FOO_",
      server: {},
      client: { FOO_BAR: stringSchema },
      runtimeEnvStrict: {
        FOO_BAR: "foo",
        // @ts-expect-error - FOO_BAZ is extraneous
        FOO_BAZ: "baz",
      },
    });

    createEnv({
      clientPrefix: "FOO_",
      server: { BAR: stringSchema },
      client: { FOO_BAR: stringSchema },
      // @ts-expect-error - BAR is missing
      runtimeEnvStrict: {
        FOO_BAR: "foo",
      },
    });
  });
});

const returnType = describe("return type is correctly inferred", {
  simple: test("simple", (opts: {
    server: StandardSchemaDictionary<{ BAR: string }>;
    client: StandardSchemaDictionary<{ FOO_BAR: string }>;
  }) => {
    const env = createEnv({
      clientPrefix: "FOO_",
      ...opts,
      runtimeEnvStrict: {
        BAR: "bar",
        FOO_BAR: "foo",
      },
    });

    expectTypeOf(env).toEqualTypeOf<
      Readonly<{
        BAR: string;
        FOO_BAR: string;
      }>
    >();

    expect(env).toMatchObject({
      BAR: "bar",
      FOO_BAR: "foo",
    });
  }),

  withTransforms: test("with transforms", (opts: {
    server: StandardSchemaDictionary<{ BAR: string }, { BAR: number }>;
    client: StandardSchemaDictionary<{ FOO_BAR: string }>;
  }) => {
    const env = createEnv({
      clientPrefix: "FOO_",
      ...opts,
      runtimeEnvStrict: {
        BAR: "123",
        FOO_BAR: "foo",
      },
    });
    expectTypeOf(env).toEqualTypeOf<
      Readonly<{
        BAR: number;
        FOO_BAR: string;
      }>
    >();

    expect(env).toMatchObject({
      BAR: 123,
      FOO_BAR: "foo",
    });
  }),

  withoutClientVars: test("without client vars", (opts: {
    server: StandardSchemaDictionary<{ BAR: string }>;
  }) => {
    const env = createEnv({
      clientPrefix: "FOO_",
      ...opts,
      client: {},
      runtimeEnvStrict: {
        BAR: "bar",
      },
    });

    expectTypeOf(env).toEqualTypeOf<
      Readonly<{
        BAR: string;
      }>
    >();

    expect(env).toMatchObject({
      BAR: "bar",
    });
  }),
});

const numberAndBoolean = test("can pass number and booleans", (opts: {
  server: StandardSchemaDictionary<{ PORT: number; IS_DEV: boolean }>;
}) => {
  const env = createEnv({
    clientPrefix: "FOO_",
    ...opts,
    client: {},
    runtimeEnvStrict: {
      PORT: 123,
      IS_DEV: true,
    },
  });

  expectTypeOf(env).toEqualTypeOf<
    Readonly<{
      PORT: number;
      IS_DEV: boolean;
    }>
  >();

  expect(env).toMatchObject({
    PORT: 123,
    IS_DEV: true,
  });
});

const failValidation = describe("errors when validation fails", {
  missingEnvs: test("envs are missing", (opts: {
    server: StandardSchemaDictionary<{ BAR: string }>;
    client: StandardSchemaDictionary<{ FOO_BAR: string }>;
  }) => {
    expect(() =>
      createEnv({
        clientPrefix: "FOO_",
        ...opts,
        runtimeEnv: {},
      }),
    ).toThrow("Invalid environment variables");
  }),

  invalidEnvs: test("envs are invalid", (opts: {
    server: StandardSchemaDictionary<{ BAR: string }, { BAR: number }>;
    client: StandardSchemaDictionary<{ FOO_BAR: string }>;
  }) => {
    expect(() =>
      createEnv({
        clientPrefix: "FOO_",
        ...opts,
        runtimeEnv: {
          BAR: "123abc",
          FOO_BAR: "foo",
        },
      }),
    ).toThrow("Invalid environment variables");
  }),

  customErrorHandler: test("with custom error handler", ({
    errorMessage,
    ...opts
  }: {
    server: StandardSchemaDictionary<{ BAR: string }, { BAR: number }>;
    client: StandardSchemaDictionary<{ FOO_BAR: string }>;
    errorMessage: string;
  }) => {
    expect(() =>
      createEnv({
        clientPrefix: "FOO_",
        ...opts,
        runtimeEnv: {
          BAR: "123abc",
          FOO_BAR: "foo",
        },
        onValidationError: (issues) => {
          const barError = issues.find(
            (issue) => issue.path?.[0] === "BAR",
          )?.message;
          throw new Error(`Invalid variable BAR: ${barError}`);
        },
      }),
    ).toThrow(`Invalid variable BAR: ${errorMessage}`);
  }),
});

const serverVarsOnClient = describe(
  "errors when server var is accessed on client",
  {
    withDefaultHandler: test("with default handler", (opts: {
      server: StandardSchemaDictionary<{ BAR: string }>;
      client: StandardSchemaDictionary<{ FOO_BAR: string }>;
    }) => {
      const env = createEnv({
        clientPrefix: "FOO_",
        ...opts,
        runtimeEnvStrict: {
          BAR: "bar",
          FOO_BAR: "foo",
        },
        isServer: false,
      });

      expect(() => env.BAR).toThrow(
        "❌ Attempted to access a server-side environment variable on the client",
      );
    }),
    withCustomHandler: test("with custom handler", (opts: {
      server: StandardSchemaDictionary<{ BAR: string }>;
      client: StandardSchemaDictionary<{ FOO_BAR: string }>;
    }) => {
      const env = createEnv({
        clientPrefix: "FOO_",
        ...opts,
        runtimeEnvStrict: {
          BAR: "bar",
          FOO_BAR: "foo",
        },
        isServer: false,
        onInvalidAccess: (key) => {
          throw new Error(`Attempted to access ${key} on the client`);
        },
      });

      expect(() => env.BAR).toThrow("Attempted to access BAR on the client");
    }),
  },
);

const clientOrServerOnly = describe("client/server only mode", {
  clientOnly: test("client only", (opts: {
    client: StandardSchemaDictionary<{ FOO_BAR: string }>;
  }) => {
    const env = createEnv({
      clientPrefix: "FOO_",
      ...opts,
      runtimeEnv: { FOO_BAR: "foo" },
    });

    expectTypeOf(env).toEqualTypeOf<
      Readonly<{
        FOO_BAR: string;
      }>
    >();

    expect(env).toMatchObject({ FOO_BAR: "foo" });
  }),

  serverOnly: test("server only", (opts: {
    server: StandardSchemaDictionary<{ BAR: string }>;
  }) => {
    const env = createEnv({
      ...opts,
      runtimeEnv: { BAR: "bar" },
    });

    expectTypeOf(env).toEqualTypeOf<
      Readonly<{
        BAR: string;
      }>
    >();

    expect(env).toMatchObject({ BAR: "bar" });
  }),

  configWithMissingClient: test("config with missing client", () => {
    ignoreErrors(() => {
      createEnv(
        // @ts-expect-error - incomplete client config - client not present
        {
          clientPrefix: "FOO_",
          server: {},
          runtimeEnv: {},
        },
      );
    });
  }),

  configWithMissingClientPrefix:
    test("config with missing clientPrefix", () => {
      ignoreErrors(() => {
        // @ts-expect-error - incomplete client config - clientPrefix not present
        createEnv({
          client: {},
          server: {},
          runtimeEnv: {},
        });
      });
    }),
});

const sharedAccessOnClientOrServer =
  describe("shared can be accessed on both server and client", () => {
    process.env = {
      NODE_ENV: "development",
      BAR: "bar",
      FOO_BAR: "foo",
    };

    interface LazyCreateEnvOptions {
      shared: StandardSchemaDictionary<{ NODE_ENV: string }>;
      server: StandardSchemaDictionary<{ BAR: string }>;
      client: StandardSchemaDictionary<{ FOO_BAR: string }>;
    }

    function lazyCreateEnv(opts: LazyCreateEnvOptions) {
      return createEnv({
        clientPrefix: "FOO_",
        ...opts,
        runtimeEnv: process.env,
      });
    }

    expectTypeOf(lazyCreateEnv).returns.toEqualTypeOf<
      Readonly<{
        NODE_ENV: string;
        BAR: string;
        FOO_BAR: string;
      }>
    >();

    return {
      server: test("server", (opts: LazyCreateEnvOptions) => {
        const { window } = globalThis;

        globalThis.window = undefined as any;

        const env = lazyCreateEnv(opts);

        expect(env).toMatchObject({
          NODE_ENV: "development",
          BAR: "bar",
          FOO_BAR: "foo",
        });

        globalThis.window = window;
      }),

      client: test("client", (opts: LazyCreateEnvOptions) => {
        const { window } = globalThis;
        globalThis.window = {} as any;

        const env = lazyCreateEnv(opts);

        expect(() => env.BAR).toThrow(
          "❌ Attempted to access a server-side environment variable on the client",
        );
        expect(env.FOO_BAR).toBe("foo");
        expect(env.NODE_ENV).toBe("development");

        globalThis.window = window;
      }),
    };
  });

const readonlyEnvs = test("envs are readonly", (opts: {
  server: StandardSchemaDictionary<{ BAR: string }>;
}) => {
  const env = createEnv({
    ...opts,
    runtimeEnv: { BAR: "bar" },
  });

  /**
   * We currently don't enforce readonly during runtime:
   * https://github.com/t3-oss/t3-env/pull/111#issuecomment-1682931526
   */

  // expect(() => {
  //   // @ts-expect-error - envs are readonly
  //   env.BAR = "foo";
  // }).toThrow(
  //   '"Cannot assign to read only property BAR of object #<Object>"'
  // );
  //
  // expect(env).toMatchObject({ BAR: "bar" });

  // @ts-expect-error - envs are readonly
  env.BAR = "foo";
  expect(env).toMatchObject({ BAR: "foo" });
});

const extendingPresets = describe("extending presets", {
  withInvalidRuntimeEnvs: test("with invalid runtime envs", ({
    presetServer,
    expectedIssue,
    ...opts
  }: {
    presetServer: StandardSchemaDictionary<{ PRESET_ENV: string }>;
    server: StandardSchemaDictionary<{ SERVER_ENV: string }>;
    client: StandardSchemaDictionary<{ CLIENT_ENV: string }>;
    expectedIssue: StandardSchemaV1.Issue;
  }) => {
    const processEnv = {
      SERVER_ENV: "server",
      CLIENT_ENV: "client",
    };

    function lazyCreateEnv() {
      const preset = createEnv({
        server: presetServer,
        runtimeEnv: processEnv,
      });

      return createEnv({
        clientPrefix: "CLIENT_",
        ...opts,
        extends: [preset],
        runtimeEnv: processEnv,
      });
    }
    expectTypeOf(lazyCreateEnv).returns.toEqualTypeOf<
      Readonly<{
        SERVER_ENV: string;
        CLIENT_ENV: string;
        PRESET_ENV: string;
      }>
    >();

    const consoleError = spyOn(console, "error");

    expect(() => lazyCreateEnv()).toThrow("Invalid environment variables");
    expect(consoleError).toHaveBeenNthCalledWith(
      1,
      "❌ Invalid environment variables:",
      [expectedIssue],
    );

    consoleError.mockRestore();
  }),

  singlePreset: describe("single preset", () => {
    const processEnv = {
      PRESET_ENV: "preset",
      SHARED_ENV: "shared",
      SERVER_ENV: "server",
      CLIENT_ENV: "client",
    };

    interface LazyCreateEnvOptions {
      presetServer: StandardSchemaDictionary<{ PRESET_ENV: string }>;
      server: StandardSchemaDictionary<{ SERVER_ENV: string }>;
      client: StandardSchemaDictionary<{ CLIENT_ENV: string }>;
      shared: StandardSchemaDictionary<{ SHARED_ENV: string }>;
    }

    function lazyCreateEnv({ presetServer, ...opts }: LazyCreateEnvOptions) {
      const preset = createEnv({
        server: presetServer,
        runtimeEnv: processEnv,
      });

      return createEnv({
        clientPrefix: "CLIENT_",
        ...opts,
        extends: [preset],
        runtimeEnv: processEnv,
      });
    }

    return {
      server: test("server", (opts: LazyCreateEnvOptions) => {
        const { window } = globalThis;
        globalThis.window = undefined as any;

        const env = lazyCreateEnv(opts);

        expect(env).toMatchObject({
          SERVER_ENV: "server",
          SHARED_ENV: "shared",
          CLIENT_ENV: "client",
          PRESET_ENV: "preset",
        });

        globalThis.window = window;
      }),

      client: test("client", (opts: LazyCreateEnvOptions) => {
        const { window } = globalThis;
        globalThis.window = {} as any;
        const env = lazyCreateEnv(opts);

        expect(() => env.SERVER_ENV).toThrow(
          "❌ Attempted to access a server-side environment variable on the client",
        );
        expect(() => env.PRESET_ENV).toThrow(
          "❌ Attempted to access a server-side environment variable on the client",
        );
        expect(env.SHARED_ENV).toBe("shared");
        expect(env.CLIENT_ENV).toBe("client");

        globalThis.window = window;
      }),
    };
  }),

  multiplePresets: describe("multiple presets", () => {
    const processEnv = {
      PRESET_ENV1: "preset",
      PRESET_ENV2: 123,
      SHARED_ENV: "shared",
      SERVER_ENV: "server",
      CLIENT_ENV: "client",
    };

    interface LazyCreateEnvOptions {
      presetServer1: StandardSchemaDictionary<{ PRESET_ENV1: "preset" }>;
      presetServer2: StandardSchemaDictionary<{ PRESET_ENV2: number }>;
      server: StandardSchemaDictionary<{ SERVER_ENV: string }>;
      client: StandardSchemaDictionary<{ CLIENT_ENV: string }>;
      shared: StandardSchemaDictionary<{ SHARED_ENV: string }>;
    }

    function lazyCreateEnv({
      presetServer1,
      presetServer2,
      ...opts
    }: LazyCreateEnvOptions) {
      const preset1 = createEnv({
        server: presetServer1,
        runtimeEnv: processEnv,
      });
      const preset2 = createEnv({
        server: presetServer2,
        runtimeEnv: processEnv,
      });

      return createEnv({
        clientPrefix: "CLIENT_",
        ...opts,
        extends: [preset1, preset2],
        runtimeEnv: processEnv,
      });
    }

    expectTypeOf(lazyCreateEnv).returns.toEqualTypeOf<
      Readonly<{
        PRESET_ENV1: "preset";
        PRESET_ENV2: number;
        SERVER_ENV: string;
        SHARED_ENV: string;
        CLIENT_ENV: string;
      }>
    >();

    return {
      server: test("server", (opts: LazyCreateEnvOptions) => {
        const { window } = globalThis;
        globalThis.window = undefined as any;

        const env = lazyCreateEnv(opts);

        expect(env).toMatchObject({
          PRESET_ENV1: "preset",
          PRESET_ENV2: 123,
          SERVER_ENV: "server",
          SHARED_ENV: "shared",
          CLIENT_ENV: "client",
        });

        globalThis.window = window;
      }),

      client: test("client", (opts: LazyCreateEnvOptions) => {
        const { window } = globalThis;
        globalThis.window = {} as any;

        const env = lazyCreateEnv(opts);

        expect(() => env.SERVER_ENV).toThrow(
          "❌ Attempted to access a server-side environment variable on the client",
        );
        expect(() => env.PRESET_ENV1).toThrow(
          "❌ Attempted to access a server-side environment variable on the client",
        );
        expect(() => env.PRESET_ENV2).toThrow(
          "❌ Attempted to access a server-side environment variable on the client",
        );
        expect(env.SHARED_ENV).toBe("shared");
        expect(env.CLIENT_ENV).toBe("client");

        globalThis.window = window;
      }),
    };
  }),
});

export default combine({
  returnType,
  numberAndBoolean,
  failValidation,
  serverVarsOnClient,
  clientOrServerOnly,
  sharedAccessOnClientOrServer,
  readonlyEnvs,
  extendingPresets,
});

import type { TestOptions } from "bun:test";
import { describe as bunDescribe, test as bunTest, expect } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { StandardSchemaDictionary } from "../src";
import { createEnv } from "../src";

type TestFunction<Opts> = (opts: Opts) => void | Promise<void>;
type TestMap<OptsMap> = {
  [Name in keyof OptsMap]: TestFunction<OptsMap[Name]>;
};

const test =
  <Opts>(
    name: string,
    cb: TestFunction<Opts>,
    testOptions?: number | TestOptions,
  ) =>
  (opts: Opts) =>
    bunTest(name, () => cb(opts), testOptions);

const describe =
  <OptMap extends Record<string, unknown>>(
    groupName: string,
    tests: TestMap<OptMap>,
  ) =>
  (optsMap: OptMap) => {
    bunDescribe(groupName, () => {
      for (const [name, test] of Object.entries(tests)) {
        test(optsMap[name]);
      }
    });
  };

const combine =
  <OptMap extends Record<string, unknown>>(tests: TestMap<OptMap>) =>
  (optsMap: OptMap) => {
    for (const [name, test] of Object.entries(tests)) {
      test(optsMap[name]);
    }
  };

export const returnType = describe("return type is correctly inferred", {
  simple: test("simple", (opts: {
    server: StandardSchemaDictionary.Matching<{ BAR: string }>;
    client: StandardSchemaDictionary.Matching<{ FOO_BAR: string }>;
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
    server: StandardSchemaDictionary.Matching<{ BAR: string }, { BAR: number }>;
    client: StandardSchemaDictionary.Matching<{ FOO_BAR: string }>;
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
    server: StandardSchemaDictionary.Matching<{ BAR: string }>;
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

export const numberAndBoolean = test("can pass number and booleans", (opts: {
  server: StandardSchemaDictionary.Matching<{ PORT: number; IS_DEV: boolean }>;
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

export const failValidation = describe("errors when validation fails", {
  missingEnvs: test("envs are missing", (opts: {
    server: StandardSchemaDictionary.Matching<{ BAR: string }>;
    client: StandardSchemaDictionary.Matching<{ FOO_BAR: string }>;
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
    server: StandardSchemaDictionary.Matching<{ BAR: string }, { BAR: number }>;
    client: StandardSchemaDictionary.Matching<{ FOO_BAR: string }>;
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
    server: StandardSchemaDictionary.Matching<{ BAR: string }, { BAR: number }>;
    client: StandardSchemaDictionary.Matching<{ FOO_BAR: string }>;
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

export default combine({
  returnType,
  numberAndBoolean,
  failValidation,
});

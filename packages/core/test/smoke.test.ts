import type { TestOptions } from "bun:test";
import { describe, expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { StandardSchemaDictionary } from "../src";
import { createEnv } from "../src";

const defineTest =
  <Opts>(
    name: string,
    cb: (opts: Opts) => void,
    testOptions?: number | TestOptions,
  ) =>
  (opts: Opts) =>
    test(name, () => cb(opts), testOptions);

const defineTestGroup =
  <OptMap extends Record<string, unknown>>(
    groupName: string,
    tests: {
      [Name in keyof OptMap]: (opts: OptMap[Name]) => void;
    },
  ) =>
  (optsMap: OptMap) => {
    describe(groupName, () => {
      for (const [name, test] of Object.entries(tests)) {
        test(optsMap[name]);
      }
    });
  };

export const returnType = defineTestGroup("return type is correctly inferred", {
  simple: defineTest(
    "simple",
    (opts: {
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
    },
  ),

  withTransforms: defineTest(
    "with transforms",
    (opts: {
      server: StandardSchemaDictionary.Matching<
        { BAR: string },
        { BAR: number }
      >;
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
    },
  ),

  withoutClientVars: defineTest(
    "without client vars",
    (opts: {
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
    },
  ),
});

import type { TestOptions } from "bun:test";
import { describe as bunDescribe, test as bunTest } from "bun:test";

export function ignoreErrors(cb: () => void) {
  try {
    cb();
  } catch (err) {
    // ignore
  }
}

type TestFunction<Opts> = (opts: Opts) => void | Promise<void>;
type TestMap<OptsMap> = {
  [Name in keyof OptsMap]: TestFunction<OptsMap[Name]>;
};

export const test =
  <Opts>(
    name: string,
    cb: TestFunction<Opts>,
    testOptions?: number | TestOptions,
  ) =>
  (opts: Opts) =>
    bunTest(name, () => cb(opts), testOptions);

function runTestMap<OptMap extends Record<string, unknown>>(
  tests: TestMap<OptMap>,
  optsMap: OptMap,
) {
  // biome-ignore lint/suspicious/noExplicitAny: needs to be any, is contravariant
  for (const [name, test] of Object.entries<TestFunction<any>>(tests)) {
    test(optsMap[name]);
  }
}

export const describe =
  <OptMap extends Record<string, unknown>>(
    groupName: string,
    tests: TestMap<OptMap> | (() => TestMap<OptMap>),
  ) =>
  (optsMap: OptMap) => {
    bunDescribe(groupName, () => {
      runTestMap(typeof tests === "function" ? tests() : tests, optsMap);
    });
  };

export const combine =
  <OptMap extends Record<string, unknown>>(tests: TestMap<OptMap>) =>
  (optsMap: OptMap) =>
    runTestMap(tests, optsMap);

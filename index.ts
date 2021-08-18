import { resolve } from 'path';
import { readFileSync } from 'fs';

function unescape(unsafe: string) {
  return JSON.parse(
    `"${unsafe
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\\'/g, "'")
      .replace(/\\\"/g, '"')}"`,
  );
}

export type Value = [string, Set<string>?]; // content, dependencies

const singleQuotedMultilineEnd = /^\s*'''\s*([#!].*)?$/;
const doubleQuotedMultilineEnd = /^\s*"""\s*([#!].*)?$/;
const nonEscapedSingleQuote = /(?<!\\)'/;
const nonEscapedDoubleQuote = /(?<!\\)"/;
const variable = /\${([a-zA-Z][\w.-]*)}/g;

function parseDeps(str: string): Set<string> {
  const result = new Set<string>();
  const matches = str.matchAll(variable);
  for (const match of matches) {
    result.add(match[1]);
  }
  return result;
}

interface Reducer {
  result: [string, Value][];
  state?: [string, string | undefined, boolean]; // if multiline, [key, value, isDoubleQuoted]
}

function multiline(acc: Reducer, curr: string): boolean {
  if (!acc.state) return false;
  const [key, oldValue, isDoubleQuoted] = acc.state;
  const regex = isDoubleQuoted
    ? doubleQuotedMultilineEnd
    : singleQuotedMultilineEnd;
  if (curr.match(regex)) {
    const value = oldValue || '';
    acc.result.push([
      key,
      isDoubleQuoted ? [value, parseDeps(value)] : [value],
    ]);
    acc.state = undefined;
  } else {
    acc.state[1] = oldValue !== undefined ? `${oldValue}\n${curr}` : curr;
  }
  return true;
}

const lineProcessors: [
  RegExp,
  (match: RegExpMatchArray, accumulator: Reducer) => void,
][] = [
  [
    // empty line
    /^\s*([#!].*)?$/,
    () => {
      /* return */
    },
  ],
  [
    // single quoted multiline start
    /^\s*([a-zA-Z][\w.-]*)\s*=\s*'''\s*$/,
    (match, acc) => {
      acc.state = [match[1], undefined, false];
    },
  ],
  [
    // double quoted multiline start
    /^\s*([a-zA-Z][\w.-]*)\s*=\s*"""\s*$/,
    (match, acc) => {
      acc.state = [match[1], undefined, true];
    },
  ],
  [
    // single quoted
    /^\s*([a-zA-Z][\w.-]*)\s*=\s*'(.*?)(?<!\\)'\s*([#!].*)?$/,
    (match, { result }) => {
      result.push([
        match[1],
        [
          match[2].match(nonEscapedSingleQuote)
            ? `'${match[2]}'`
            : unescape(match[2]),
        ],
      ]);
    },
  ],
  [
    // double quoted
    /^\s*([a-zA-Z][\w.-]*)\s*=\s*"(.*?)(?<!\\)"\s*([#!].*)?$/,
    (match, { result }) => {
      result.push([
        match[1],
        match[2].match(nonEscapedDoubleQuote)
          ? [`"${match[2]}"`]
          : [unescape(match[2]), parseDeps(match[2])],
      ]);
    },
  ],
  [
    // non quoted
    /^\s*([a-zA-Z][\w.-]*)\s*=\s*(.*)\s*$/,
    (match, { result }) => {
      result.push([match[1], [match[2]]]);
    },
  ],
];

function reducer(acc: Reducer, curr: string): Reducer {
  if (multiline(acc, curr)) return acc;

  for (const [regex, func] of lineProcessors) {
    const match = curr.match(regex);
    if (match) {
      func(match, acc);
      return acc;
    }
  }
  throw new Error(`Failed to parse .env file: ${curr}`);
}

export function parse(src: string): Record<string, Value> {
  const parsed = src
    .toString()
    .split(/\r\n|\n|\r/)
    .reduce<Reducer>(reducer, { result: [] });
  if (parsed.state) {
    throw new Error('Failed to parse .env file - multiline not terminated');
  }
  return Object.fromEntries(parsed.result);
}

function readEnvFile(...path: string[]): Record<string, Value> {
  try {
    return parse(readFileSync(resolve(...path)).toString());
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {};
    } else {
      throw err;
    }
  }
}

type MODE = 'prod' | 'dev' | 'test' | 'debug';

const modeMap: Record<string, MODE> = {
  production: 'prod',
  PROD: 'prod',
  PRODUCTION: 'prod',
  development: 'dev',
  develop: 'dev',
  DEV: 'dev',
  DEVELOPMENT: 'dev',
  DEVELOP: 'dev',
  TEST: 'test',
  DEBUG: 'debug',
};

function conflictKey(
  a: Record<string, Value>,
  b: Record<string, Value>,
  except: Record<string, Value>,
): string | undefined {
  for (const key in a) {
    for (const bKey in b) {
      if (key === bKey && !(key in except) && a[key][0] !== b[key][0]) {
        return key;
      }
    }
  }
  return undefined;
}

function resolveDeps(
  value: Record<string, Value>,
  variables: Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string | null> = {};
  function resolveDepsInternal(key: string): void {
    if (typeof result[key] === 'string') return; // already resolved
    if (result[key] === 'null') {
      throw new Error(
        `Failed to resolve variable - circular dependency: "${key}"`,
      );
    }
    result[key] = null;
    Array.from(value[key][1] || [])
      .filter((name) => !variables[name] && name in value && value[name][1])
      .forEach(resolveDepsInternal);
    result[key] = value[key][0].replace(
      variable,
      (match, name) => variables[name] ?? result[name] ?? match,
    );
  }
  for (const key in value) {
    resolveDepsInternal(key);
  }
  return result as Record<string, string>;
}

export function apply(object: Record<string, string>, canOverwrite = false) {
  for (const key in object) {
    if (key in process.env && !canOverwrite) {
      console.log(
        `[WARN] Key '${key}' is already defined in environment variable. ignoring`,
      );
    } else {
      process.env[key] = object[key];
    }
  }
}

export default function config(
  dirname: string = process.cwd(),
  mode?: string,
  canOverwrite = false,
): void {
  const modeName = mode ?? process.env.NODE_ENV ?? 'dev';
  if (!(modeName in modeMap)) {
    throw new Error(`Unrecognized mode: ${modeName}`);
  }
  mode = modeMap[modeName];
  const _base = readEnvFile(dirname, '.env');
  const local = readEnvFile(dirname, '.env.local');
  const _mode = readEnvFile(dirname, `.env.${mode}`);
  const first = readEnvFile(dirname, `.env.${mode}.local`);
  const conflict = conflictKey(_mode, local, first);
  if (conflict) {
    throw new Error(
      `File with same specificity ".env.local" and ".env.${mode}" has different value with same key: "${conflict}"`,
    );
  }
  const result = resolveDeps(
    { ..._base, ...local, ..._mode, ...first },
    process.env,
  );
  apply(result, canOverwrite);
}

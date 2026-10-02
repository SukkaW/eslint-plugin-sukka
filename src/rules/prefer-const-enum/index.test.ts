/* eslint-disable no-template-curly-in-string -- Enum initializers are embedded TypeScript source. */
import module from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    'const enum E { A, B } E.A;',
    'export enum E { A, B }',
    'enum E { A } export { E };',
    'enum E { A } export { E as Other };',
    'enum E { A } export { E as default };',
    'enum E { A } export default E;',
    'export { E }; enum E { A }',
    'enum E { A } export type { E };',
    'enum E { A } export { type E };',
    'enum E { A } export = E;',
    'declare enum E { A }',
    'namespace Internal { enum E { A } }',
    'declare namespace API { enum E { A } }',
    'declare global { enum E { A } } export {};',
    'enum E { A } enum E { B = 1 }',
    'enum E { A } namespace E { export const B = 1; }',
    'enum E { A = getValue() }',
    'enum E { A = Date.now(), B = 1 }',
    'enum E { A = 1 / 0 }',
    'enum E { A = 0 / 0 }',
    'enum E { A = "abc".length }',
    'let value = 1; enum E { A = value }',
    'const value: number = 1; enum E { A = value }',
    'const value: string = "a"; enum E { A = value }',
    'const value = value; enum E { A = value }',
    'enum E { A = B, B = 1 }',
    'enum E { A = "a", B }',
    'import { Other } from "./other"; enum E { A = Other.A }',
    {
      code: 'enum E { A }',
      languageOptions: {
        parserOptions: { sourceType: 'script', projectService: false }
      }
    },
    {
      code: 'enum E { A }',
      filename: 'ambient.d.ts',
      languageOptions: { parserOptions: { projectService: false } }
    },
    {
      code: 'enum E { A }',
      filename: 'ambient.d.mts',
      languageOptions: { parserOptions: { projectService: false } }
    },
    {
      code: 'enum E { A }',
      filename: 'ambient.d.cts',
      languageOptions: { parserOptions: { projectService: false } }
    }
  ],
  invalid: [
    {
      code: 'enum E {}',
      output: 'const enum E {}',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A, B } E.A;',
      output: 'const enum E { A, B } E.A;',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A = "a", B = "b" } E["A"];',
      output: 'const enum E { A = "a", B = "b" } E["A"];',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A = 1, B = A << 1, C = E.B | 1, D = ~C } E.D;',
      output: 'const enum E { A = 1, B = A << 1, C = E.B | 1, D = ~C } E.D;',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A = -1, B = +2, C = (A + B) * 3 / 2 % 2, D = 2 ** 3, F = D >> 1, G = F >>> 1, H = F & G, I = H ^ G }',
      output: 'const enum E { A = -1, B = +2, C = (A + B) * 3 / 2 % 2, D = 2 ** 3, F = D >> 1, G = F >>> 1, H = F & G, I = H ^ G }',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A = "a" + "b", B = `value${1}` }',
      output: 'const enum E { A = "a" + "b", B = `value${1}` }',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'const value = 1 + 2; enum E { A = value }',
      output: 'const value = 1 + 2; const enum E { A = value }',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'export enum Other { A = 1 } enum E { A = Other.A }',
      output: 'export enum Other { A = 1 } const enum E { A = Other.A }',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A } type Value = E; type Member = E.A; type Keys = keyof typeof E;',
      output: 'const enum E { A } type Value = E; type Member = E.A; type Keys = keyof typeof E;',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'function local() { enum E { A } return E.A; }',
      output: 'function local() { const enum E { A } return E.A; }',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'export enum E { A } function local() { enum E { B } return E.B; }',
      output: 'export enum E { A } function local() { const enum E { B } return E.B; }',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum /* keep this comment */ E { A }',
      output: 'const enum /* keep this comment */ E { A }',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A } export { E as Other } from "./other";',
      output: 'const enum E { A } export { E as Other } from "./other";',
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: dedent`
        enum E { A }
        function local() {
          const E = { A: 2 };
          return Object.values(E);
        }
        E.A;
      `,
      output: dedent`
        const enum E { A }
        function local() {
          const E = { A: 2 };
          return Object.values(E);
        }
        E.A;
      `,
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A } Object.values(E);',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } Object.keys(E); Object.entries(E);',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } use(E);',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } const copy = { ...E }; const { A } = E;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } E[0];',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } const name = "A"; E[name];',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } E.A = 2;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } E.A++;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } delete E.A;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } E.Unknown;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } typeof E;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } type T = typeof E.A;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } E?.A;',
      output: null,
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } E.A;',
      output: 'const enum E { A } E.A;',
      languageOptions: { parserOptions: { projectService: false } },
      errors: [{ messageId: 'preferConstEnum' }]
    },
    {
      code: 'enum E { A } Object.values(E);',
      output: null,
      languageOptions: { parserOptions: { projectService: false } },
      errors: [{ messageId: 'enumObjectUsage' }]
    },
    {
      code: 'enum E { A } enum F { B = E.A + 1 } F.B;',
      output: 'const enum E { A } const enum F { B = E.A + 1 } F.B;',
      errors: [{ messageId: 'preferConstEnum' }, { messageId: 'preferConstEnum' }]
    }
  ]
});

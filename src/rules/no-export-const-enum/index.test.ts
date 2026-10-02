import module from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    'enum E {}',
    'const enum E {}',
    'export enum E { A }',
    'enum E { A } export { E };',
    'enum E { A } export default E;',
    'const enum E { A } export { E } from "./other";',
    'const enum E { A } export * from "./other";',
    'const enum E { A } function local() { const E = 1; return E; }',
    'const enum E { A } export const other = 1;',
    'const enum E { A } export { other as E } from "./other";',
    'namespace Internal { const enum E { A } } const E = 1; export { E };'
  ],
  invalid: [
    {
      code: 'export const enum E {}',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } export { E };',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } export { E as Other };',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } export { E as default };',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'export { E }; const enum E { A }',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } export type { E };',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } export { type E };',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } export = E;',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } const enum F { B } export { E, F };',
      errors: [{ messageId: 'noConstEnum' }, { messageId: 'noConstEnum' }]
    },
    {
      code: 'const enum E { A } export { E }; export { E as Other };',
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: dedent`
        const enum A {
          MB = 'MiB'
        };
        export const A;
      `,
      errors: [{ messageId: 'noConstEnum' }]
    },
    {
      code: dedent`
        const enum A {
          MB = 'MiB'
        };
        export default A;
      `,
      errors: [{ messageId: 'noConstEnum' }]
    }
  ]
});

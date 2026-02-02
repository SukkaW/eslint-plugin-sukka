import module from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    'enum E {}',
    'const enum E {}'
  ],
  invalid: [
    {
      code: 'export const enum E {}',
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

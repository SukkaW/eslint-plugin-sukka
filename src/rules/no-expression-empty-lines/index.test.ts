import { runTest } from '@test/run-test';
import module from '.';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    dedent`
      const result = []
        .map(x => x)
        .map(x => x);
    `,
    dedent`
      const result = []
        // comment
        .map(x => x) // comment
        .map(x => x);
    `
  ],
  invalid: [
    {
      code: dedent`
        const result = []

          .map(x => x)


          .map(x => x);
      `,
      output: dedent`
        const result = []
          .map(x => x)
          .map(x => x);
      `,
      errors: [
        { messageId: 'unexpectedEmptyLine' },
        { messageId: 'unexpectedEmptyLine' }
      ]
    }
  ]
});

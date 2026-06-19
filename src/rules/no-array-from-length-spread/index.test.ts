import module from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    'Array.from([1, 2, 3])',
    'Array.from("hello")',
    'Array.from(new Set([1, 2, 3]))',
    'Array.from({ key: "value" })',
    'Array.from({ len: 10 })',
    '[...someArray]',
    '[...new Set([1, 2, 3])]',
    '[1, 2, 3]',
    dedent`
      import { createFixedArray } from 'foxts/create-fixed-array';
      const arr = createFixedArray(10);
    `
  ],
  invalid: [
    {
      code: 'Array.from({ length: 10 })',
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: 'Array.from({ length: n })',
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: 'Array.from({ length: 10 }, (_, i) => i)',
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: dedent`
        const n = 10;
        Array.from({ length: n }, (_, i) => i * 2);
      `,
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: 'Array.from({ length: 10, extra: true })',
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: dedent`
        const length = 10;
        Array.from({ length }, (_, i) => i * 2);
      `,
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: '[...Array(10)]',
      errors: [{ messageId: 'noSpreadNewArray' }]
    },
    {
      code: '[...new Array(10)]',
      errors: [{ messageId: 'noSpreadNewArray' }]
    },
    {
      code: '[...Array(n)]',
      errors: [{ messageId: 'noSpreadNewArray' }]
    },
    {
      code: '[...new Array(n)]',
      errors: [{ messageId: 'noSpreadNewArray' }]
    }
  ]
});

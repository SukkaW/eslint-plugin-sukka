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
    'someArray.fill(0)',
    'someArray.map((_, i) => i)',
    'someArray.keys()',
    dedent`
      const result = Array(input.length);
      for (let i = 0; i < input.length; i++) {
        result[i] = compute(input[i]);
      }
    `,
    dedent`
      const result = new Array(input.length);
      for (let i = 0; i < input.length; i++) {
        result[i] = compute(input[i]);
      }
    `,
    dedent`
      import { createFixedArray } from 'foxts/create-fixed-array';
      const arr = createFixedArray(10);
    `
  ],
  invalid: [
    // Array.from({ length })
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
    // Array.from(Array(n)) / Array.from(new Array(n))
    {
      code: 'Array.from(Array(10))',
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: 'Array.from(new Array(10))',
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    {
      code: 'Array.from(Array(n), (_, i) => i)',
      errors: [{ messageId: 'noArrayFromLength' }]
    },
    // [...Array(n)] / [...new Array(n)]
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
    },
    // Array(n).fill() / new Array(n).fill()
    {
      code: 'Array(10).fill(0)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'fill' } }]
    },
    {
      code: 'new Array(10).fill(0)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'fill' } }]
    },
    {
      code: 'new Array(n).fill(null)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'fill' } }]
    },
    // Array(n).keys() / .values() / .entries()
    {
      code: 'Array(10).keys()',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'keys' } }]
    },
    {
      code: 'new Array(10).values()',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'values' } }]
    },
    {
      code: 'new Array(10).entries()',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'entries' } }]
    },
    // [...Array(n).keys()] / [...new Array(n).fill(0)]
    {
      code: '[...Array(10).keys()]',
      errors: [{ messageId: 'noSpreadArrayIterator', data: { method: 'keys' } }]
    },
    {
      code: '[...new Array(10).keys()]',
      errors: [{ messageId: 'noSpreadArrayIterator', data: { method: 'keys' } }]
    },
    {
      code: '[...new Array(10).values()]',
      errors: [{ messageId: 'noSpreadArrayIterator', data: { method: 'values' } }]
    },
    {
      code: '[...Array(n).fill(0)]',
      errors: [{ messageId: 'noSpreadArrayIterator', data: { method: 'fill' } }]
    },
    // Array(n).map() / .flatMap() / .forEach() / .reduce() etc.
    {
      code: 'Array(10).map((_, i) => i)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'map' } }]
    },
    {
      code: 'new Array(10).map((_, i) => i)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'map' } }]
    },
    {
      code: 'new Array(10).flatMap((x) => [x, x])',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'flatMap' } }]
    },
    {
      code: 'Array(10).forEach((_, i) => console.log(i))',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'forEach' } }]
    },
    {
      code: 'Array(10).reduce((acc, _, i) => acc + i, 0)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'reduce' } }]
    },
    {
      code: 'Array(10).filter(Boolean)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'filter' } }]
    },
    {
      code: 'Array(10).find((x) => x)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'find' } }]
    },
    {
      code: 'Array(10).findIndex((x) => x)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'findIndex' } }]
    },
    {
      code: 'Array(10).some(Boolean)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'some' } }]
    },
    {
      code: 'Array(10).every(Boolean)',
      errors: [{ messageId: 'noArrayConstructorChain', data: { method: 'every' } }]
    }
  ]
});

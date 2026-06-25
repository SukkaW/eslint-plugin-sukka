import module from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    // No spread — normal push is fine
    'arr.push(1, 2, 3)',
    'arr.push(item)',
    // appendArrayInPlace is fine
    dedent`
      import { appendArrayInPlace } from 'foxts/append-array-in-place';
      appendArrayInPlace(arr, items);
    `,
    // Spread in other methods is not this rule's concern
    'arr.concat(...items)',
    'fn(...args)'
  ],
  invalid: [
    // Simple: push(...items)
    {
      code: 'arr.push(...items);',
      output: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        appendArrayInPlace(arr, items);
      `,
      errors: [{ messageId: 'noSpreadInPush' }]
    },
    // push(a, ...b) → push(a); appendArrayInPlace(arr, b);
    {
      code: 'arr.push(a, ...b);',
      output: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        arr.push(a);
        appendArrayInPlace(arr, b);
      `,
      errors: [{ messageId: 'noSpreadInPush' }]
    },
    // push(...b, c) → appendArrayInPlace(arr, b); push(c);
    {
      code: 'arr.push(...b, c);',
      output: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        appendArrayInPlace(arr, b);
        arr.push(c);
      `,
      errors: [{ messageId: 'noSpreadInPush' }]
    },
    // push(a, ...b, c) → push(a); appendArrayInPlace(arr, b); push(c);
    {
      code: 'arr.push(a, ...b, c);',
      output: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        arr.push(a);
        appendArrayInPlace(arr, b);
        arr.push(c);
      `,
      errors: [{ messageId: 'noSpreadInPush' }]
    },
    // Multiple spreads: push(...a, ...b)
    {
      code: 'arr.push(...a, ...b);',
      output: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        appendArrayInPlace(arr, a);
        appendArrayInPlace(arr, b);
      `,
      errors: [{ messageId: 'noSpreadInPush' }]
    },
    // Already has import — don't add again
    {
      code: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        arr.push(...items);
      `,
      output: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        appendArrayInPlace(arr, items);
      `,
      errors: [{ messageId: 'noSpreadInPush' }]
    },
    // Chained object: this.items.push(...newItems)
    {
      code: 'this.items.push(...newItems);',
      output: dedent`
        import { appendArrayInPlace } from 'foxts/append-array-in-place';
        appendArrayInPlace(this.items, newItems);
      `,
      errors: [{ messageId: 'noSpreadInPush' }]
    }
  ]
});

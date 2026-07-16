import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // Branches don't wrap the same value
    'Array.isArray(a) ? a : [b]',
    'Array.isArray(a) ? b : [a]',
    // Array branch has more than one element
    'Array.isArray(a) ? a : [a, a]',
    // Not the isArray argument
    'Array.isArray(a) ? c : [c]',
    // Spread element
    'Array.isArray(a) ? a : [...a]',
    // Not the global Array
    dedent`
      const Array = { isArray: () => true };
      Array.isArray(a) ? a : [a];
    `,
    // Side-effectful target — repeating a call is not the same as calling once
    'Array.isArray(foo()) ? foo() : [foo()]',
    // Computed member access may trigger getters
    'Array.isArray(a[i]) ? a[i] : [a[i]]',
    // Already using the util
    dedent`
      import { castArray } from 'foxts/cast-array';
      castArray(a);
    `,
    // if with extra work in the body — not a pure wrap
    dedent`
      if (!Array.isArray(a)) {
        a = [a];
        b = 1;
      }
    `,
    // if with an else branch
    dedent`
      if (!Array.isArray(a)) {
        a = [a];
      } else {
        a = a.slice();
      }
    `
  ],
  invalid: [
    // Basic ternary
    {
      code: 'Array.isArray(a) ? a : [a]',
      output: 'import { castArray } from \'foxts/cast-array\';\ncastArray(a)',
      errors: [{ messageId: 'default' }]
    },
    // Negated ternary
    {
      code: '!Array.isArray(a) ? [a] : a',
      output: 'import { castArray } from \'foxts/cast-array\';\ncastArray(a)',
      errors: [{ messageId: 'default' }]
    },
    // Member expression target
    {
      code: 'const arr = Array.isArray(props.items) ? props.items : [props.items];',
      output: 'import { castArray } from \'foxts/cast-array\';\nconst arr = castArray(props.items);',
      errors: [{ messageId: 'default' }]
    },
    // Reuse existing import
    {
      code: dedent`
        import { castArray } from 'foxts/cast-array';
        const arr = Array.isArray(a) ? a : [a];
      `,
      output: dedent`
        import { castArray } from 'foxts/cast-array';
        const arr = castArray(a);
      `,
      errors: [{ messageId: 'default' }]
    },
    // Insert after existing (unrelated) import
    {
      code: dedent`
        import { foo } from 'bar';
        const arr = Array.isArray(a) ? a : [a];
      `,
      output: dedent`
        import { foo } from 'bar';
        import { castArray } from 'foxts/cast-array';

        const arr = castArray(a);
      `,
      errors: [{ messageId: 'default' }]
    },
    // if-statement wrap
    {
      code: dedent`
        if (!Array.isArray(a)) {
          a = [a];
        }
      `,
      output: 'import { castArray } from \'foxts/cast-array\';\na = castArray(a);',
      errors: [{ messageId: 'default' }]
    },
    // if-statement without block
    {
      code: 'if (!Array.isArray(a)) a = [a];',
      output: 'import { castArray } from \'foxts/cast-array\';\na = castArray(a);',
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

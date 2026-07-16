import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // Logical operators are not bitwise
    'a && b',
    'a || b',
    'a ?? b',
    '!a',
    // Comparison / arithmetic
    'a > b',
    'a >= b',
    'a + b',
    // Logical assignment
    'a &&= b',
    'a ||= b',
    // No util counterpart — left alone
    'const x = a & b;',
    'a ^ b',
    'a << b',
    'a >> b',
    'a >>> b',
    '~a',
    'a &= b',
    'a ^= b',
    'a <<= b',
    'a >>= b',
    'a >>>= b',
    // Mirrored deleteBit with side-effectful operands — fix would reverse
    // evaluation order, so it is left alone
    'const x = ~foo() & bar();',
    // Comparison against a non-zero literal is a value check, not a bit check
    '(a & b) !== 1',
    '(a & b) === MASK',
    // Already using the utils
    'getBit(flags, MASK)',
    'setBit(flags, MASK)',
    'bitCount(x)'
  ],
  invalid: [
    // ── getBit / missingBit ────────────────────────────────────────────────
    {
      code: 'const has = (a & b) !== 0;',
      output: 'import { getBit } from \'foxts/bitwise\';\nconst has = getBit(a, b);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    },
    {
      code: 'const missing = (a & b) === 0;',
      output: 'import { missingBit } from \'foxts/bitwise\';\nconst missing = missingBit(a, b);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'missingBit' } }]
    },
    // Zero literal on the left
    {
      code: 'const has = 0 !== (a & b);',
      output: 'import { getBit } from \'foxts/bitwise\';\nconst has = getBit(a, b);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    },
    // Negation forms
    {
      code: 'const missing = !(a & b);',
      output: 'import { missingBit } from \'foxts/bitwise\';\nconst missing = missingBit(a, b);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'missingBit' } }]
    },
    {
      code: 'const has = !!(a & b);',
      output: 'import { getBit } from \'foxts/bitwise\';\nconst has = getBit(a, b);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    },
    // Boolean() coercion
    {
      code: 'const has = Boolean(a & b);',
      output: 'import { getBit } from \'foxts/bitwise\';\nconst has = getBit(a, b);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    },
    // Boolean test position
    {
      code: 'if (flags & MASK) {}',
      output: 'import { getBit } from \'foxts/bitwise\';\nif (getBit(flags, MASK)) {}',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    },
    {
      code: 'const v = flags & MASK ? 1 : 2;',
      output: 'import { getBit } from \'foxts/bitwise\';\nconst v = getBit(flags, MASK) ? 1 : 2;',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    },

    // ── setBit / deleteBit ─────────────────────────────────────────────────
    {
      code: 'const next = flags | MASK;',
      output: 'import { setBit } from \'foxts/bitwise\';\nconst next = setBit(flags, MASK);',
      errors: [{ messageId: 'default', data: { operator: '|', util: 'setBit' } }]
    },
    {
      code: 'const next = flags & ~MASK;',
      output: 'import { deleteBit } from \'foxts/bitwise\';\nconst next = deleteBit(flags, MASK);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'deleteBit' } }]
    },
    // Mirrored: ~MASK & flags — safe with simple operands
    {
      code: 'const next = ~MASK & flags;',
      output: 'import { deleteBit } from \'foxts/bitwise\';\nconst next = deleteBit(flags, MASK);',
      errors: [{ messageId: 'default', data: { operator: '&', util: 'deleteBit' } }]
    },
    {
      code: 'flags |= MASK;',
      output: 'import { setBit } from \'foxts/bitwise\';\nflags = setBit(flags, MASK);',
      errors: [{ messageId: 'default', data: { operator: '|=', util: 'setBit' } }]
    },
    {
      code: 'flags &= ~MASK;',
      output: 'import { deleteBit } from \'foxts/bitwise\';\nflags = deleteBit(flags, MASK);',
      errors: [{ messageId: 'default', data: { operator: '&=', util: 'deleteBit' } }]
    },
    // The |0 truncation trick still maps onto setBit(x, 0) (runtime-identical)
    {
      code: 'const truncated = x | 0;',
      output: 'import { setBit } from \'foxts/bitwise\';\nconst truncated = setBit(x, 0);',
      errors: [{ messageId: 'default', data: { operator: '|', util: 'setBit' } }]
    },
    // Member-expression compound assignment — has a counterpart, but repeating
    // the target may trigger getters: report without fix
    {
      code: 'obj.flags |= MASK;',
      errors: [{ messageId: 'default', data: { operator: '|=', util: 'setBit' } }]
    },

    // ── import handling ────────────────────────────────────────────────────
    // Merge into an existing foxts/bitwise import
    {
      code: dedent`
        import { bitCount } from 'foxts/bitwise';
        const has = (a & b) !== 0;
      `,
      output: dedent`
        import { bitCount, getBit } from 'foxts/bitwise';
        const has = getBit(a, b);
      `,
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    },
    // Specifier already imported — no duplicate
    {
      code: dedent`
        import { getBit } from 'foxts/bitwise';
        const has = (a & b) !== 0;
      `,
      output: dedent`
        import { getBit } from 'foxts/bitwise';
        const has = getBit(a, b);
      `,
      errors: [{ messageId: 'default', data: { operator: '&', util: 'getBit' } }]
    }
  ]
}, {}, false);

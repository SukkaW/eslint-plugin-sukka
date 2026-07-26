import mod from '.';
import { runTest } from '@test/run-test';

runTest({
  module: mod,
  valid: [
    // startsWith with multi-char string
    'str.startsWith("ab")',
    // startsWith with variable
    'str.startsWith(prefix)',
    // startsWith with position argument
    'str.startsWith("a", 1)',
    // charCodeAt (not startsWith)
    'str.charCodeAt(0)',
    // empty string
    'str.startsWith("")',
    // already using indexing
    'str[0] === "a"'
  ],
  invalid: [
    // Basic single char
    {
      code: 'str.startsWith("a")',
      output: 'str[0] === "a"',
      errors: [{ messageId: 'default' }]
    },
    // Single quote
    {
      code: 'str.startsWith(\'a\')',
      output: 'str[0] === \'a\'',
      errors: [{ messageId: 'default' }]
    },
    // Negated
    {
      code: '!str.startsWith("a")',
      output: 'str[0] !== "a"',
      errors: [{ messageId: 'default' }]
    },
    // Method call on object
    {
      code: 'foo.bar.startsWith("/")',
      output: 'foo.bar[0] === "/"',
      errors: [{ messageId: 'default' }]
    },
    // Call expression as object
    {
      code: 'getPath().startsWith("/")',
      output: 'getPath()[0] === "/"',
      errors: [{ messageId: 'default' }]
    },
    // Conditional expression needs parens
    {
      code: '(a ? b : c).startsWith("/")',
      output: '(a ? b : c)[0] === "/"',
      errors: [{ messageId: 'default' }]
    },
    // Special char
    {
      code: String.raw`str.startsWith("\n")`,
      output: String.raw`str[0] === "\n"`,
      errors: [{ messageId: 'default' }]
    },
    // Optional call on the receiver keeps the optional index access
    {
      code: 'if (str?.startsWith("a")) {}',
      output: 'if (str?.[0] === "a") {}',
      errors: [{ messageId: 'default' }]
    },
    // Optional call on the method itself
    {
      code: 'if (str.startsWith?.("a")) {}',
      output: 'if (str?.[0] === "a") {}',
      errors: [{ messageId: 'default' }]
    },
    // Negated optional call is always a boolean, so it is fixable anywhere
    {
      code: 'const x = !str?.startsWith("a")',
      output: 'const x = str?.[0] !== "a"',
      errors: [{ messageId: 'default' }]
    },
    // `?.` earlier in the chain already short-circuits the whole access
    {
      code: 'a?.b.startsWith("a")',
      output: 'a?.b[0] === "a"',
      errors: [{ messageId: 'default' }]
    },
    // Other boolean positions
    {
      code: 'while (str?.startsWith("a")) {}',
      output: 'while (str?.[0] === "a") {}',
      errors: [{ messageId: 'default' }]
    },
    {
      code: 'str?.startsWith("a") && foo()',
      output: 'str?.[0] === "a" && foo()',
      errors: [{ messageId: 'default' }]
    },
    // Value position: `undefined` vs `false` is observable, so report only
    {
      code: 'const x = str?.startsWith("a")',
      output: null,
      errors: [{ messageId: 'default' }]
    },
    {
      code: 'foo(str?.startsWith("a"))',
      output: null,
      errors: [{ messageId: 'default' }]
    },
    // `??` forwards the `undefined`, so it is not a pure test position
    {
      code: 'str?.startsWith("a") ?? true',
      output: null,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

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
    }
  ]
}, {}, false);

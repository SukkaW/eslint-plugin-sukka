import type { TestCaseError } from '@typescript-eslint/rule-tester';

import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

function createErrorList({ suggestionOutput: output }: { suggestionOutput?: string } = {}): Array<TestCaseError<'removeAwait' | 'redundantUseOfAwait'>> {
  // pending https://github.com/eslint/espree/issues/304, the type should be "Keyword"
  return [{
    messageId: 'redundantUseOfAwait',
    type: AST_NODE_TYPES.Identifier,
    suggestions: output
      ? [{
        messageId: 'removeAwait', output
      }]
      : []
  } as const];
}

runTest({
  module: mod,
  valid: [
    '\nasync function foo() {\n\tawait bar(); return;\n}\n',
    '\nasync function foo() {\n\tconst x = await bar(); return x;\n}\n',
    '\nasync () => { return bar(); }\n',
    '\nasync () => bar()\n',
    '\nasync function foo() {\nif (a) {\n\t\tif (b) {\n\t\t\treturn bar();\n\t\t}\n\t}\n}\n',
    '\nasync () => {\nif (a) {\n\t\tif (b) {\n\t\t\treturn bar();\n\t\t}\n\t}\n}\n',
    '\nasync function foo() {\n\treturn (await bar() && a);\n}\n',
    '\nasync function foo() {\n\treturn (await bar() || a);\n}\n',
    '\nasync function foo() {\n\treturn (a && await baz() && b);\n}\n',
    '\nasync function foo() {\n\treturn (await bar(), a);\n}\n',
    '\nasync function foo() {\n\treturn (await baz(), await bar(), a);\n}\n',
    '\nasync function foo() {\n\treturn (a, b, (await bar(), c));\n}\n',
    '\nasync function foo() {\n\treturn (await bar() ? a : b);\n}\n',
    '\nasync function foo() {\n\treturn ((a && await bar()) ? b : c);\n}\n',
    '\nasync function foo() {\n\treturn (baz() ? (await bar(), a) : b);\n}\n',
    '\nasync function foo() {\n\treturn (baz() ? (await bar() && a) : b);\n}\n',
    '\nasync function foo() {\n\treturn (baz() ? a : (await bar(), b));\n}\n',
    '\nasync function foo() {\n\treturn (baz() ? a : (await bar() && b));\n}\n',
    '\nasync () => (await bar(), a)\n',
    '\nasync () => (await bar() && a)\n',
    '\nasync () => (await bar() || a)\n',
    '\nasync () => (a && await bar() && b)\n',
    '\nasync () => (await baz(), await bar(), a)\n',
    '\nasync () => (a, b, (await bar(), c))\n',
    '\nasync () => (await bar() ? a : b)\n',
    '\nasync () => ((a && await bar()) ? b : c)\n',
    '\nasync () => (baz() ? (await bar(), a) : b)\n',
    '\nasync () => (baz() ? (await bar() && a) : b)\n',
    '\nasync () => (baz() ? a : (await bar(), b))\n',
    '\nasync () => (baz() ? a : (await bar() && b))\n',
    dedent`
      async function foo() {
        try {
          return await bar();
        } catch (e) {
          baz();
        }
      }
    `,
    dedent`
      async function foo() {
        try {
          return await bar();
        } finally {
          baz();
        }
      }
    `,
    dedent`
      async function foo() {
        try {}
        catch (e) {
          return await bar();
        } finally {
          baz();
        }
      }
    `,
    dedent`
      async function foo() {
        try {
          try {}
          finally {
            return await bar();
          }
        } finally {
          baz();
        }
      }
    `,
    dedent`
      async function foo() {
        try {
          try {}
          catch (e) {
            return await bar();
          }
        } finally {
          baz();
        }
      }
    `,
    dedent`
      async function foo() {
        try {
          return (a, await bar());
        } catch (e) {
          baz();
        }
      }
    `,
    dedent`
      async function foo() {
        try {
          return (qux() ? await bar() : b);
        } catch (e) {
          baz();
        }
      }
    `,
    dedent`
      async function foo() {
        try {
          return (a && await bar());
        } catch (e) {
          baz();
        }
      }
    `
  ],
  invalid: [
    {
      code: '\nasync function foo() {\n\treturn await bar();\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn bar();\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn await(bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (a, await bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (a, bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (a, b, await bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (a, b, bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (a && await bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (a && bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (a && b && await bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (a && b && bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (a || await bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (a || bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (a, b, (c, d, await bar()));\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (a, b, (c, d, bar()));\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (a, b, (c && await bar()));\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (a, b, (c && bar()));\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (await baz(), b, await bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (await baz(), b, bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (baz() ? await bar() : b);\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (baz() ? bar() : b);\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (baz() ? a : await bar());\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (baz() ? a : bar());\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (baz() ? (a, await bar()) : b);\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (baz() ? (a, bar()) : b);\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (baz() ? a : (b, await bar()));\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (baz() ? a : (b, bar()));\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (baz() ? (a && await bar()) : b);\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (baz() ? (a && bar()) : b);\n}\n' })
    },
    {
      code: '\nasync function foo() {\n\treturn (baz() ? a : (b && await bar()));\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\n\treturn (baz() ? a : (b && bar()));\n}\n' })
    },
    {
      code: '\nasync () => { return await bar(); }\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => { return bar(); }\n' })
    },
    {
      code: '\nasync () => await bar()\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => bar()\n' })
    },
    {
      code: '\nasync () => (a, b, await bar())\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => (a, b, bar())\n' })
    },
    {
      code: '\nasync () => (a && await bar())\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => (a && bar())\n' })
    },
    {
      code: '\nasync () => (baz() ? await bar() : b)\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => (baz() ? bar() : b)\n' })
    },
    {
      code: '\nasync () => (baz() ? a : (b, await bar()))\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => (baz() ? a : (b, bar()))\n' })
    },
    {
      code: '\nasync () => (baz() ? a : (b && await bar()))\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => (baz() ? a : (b && bar()))\n' })
    },
    {
      code: '\nasync function foo() {\nif (a) {\n\t\tif (b) {\n\t\t\treturn await bar();\n\t\t}\n\t}\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync function foo() {\nif (a) {\n\t\tif (b) {\n\t\t\treturn bar();\n\t\t}\n\t}\n}\n' })
    },
    {
      code: '\nasync () => {\nif (a) {\n\t\tif (b) {\n\t\t\treturn await bar();\n\t\t}\n\t}\n}\n',
      errors: createErrorList({ suggestionOutput: '\nasync () => {\nif (a) {\n\t\tif (b) {\n\t\t\treturn bar();\n\t\t}\n\t}\n}\n' })
    },
    {
      code: dedent`
        async function foo() {
          try {}
          finally {
            return await bar();
          }
        }
      `,
      errors: createErrorList({
        suggestionOutput: dedent`
          async function foo() {
            try {}
            finally {
              return bar();
            }
          }
        `
      })
    },
    {
      code: dedent`
        async function foo() {
          try {}
          catch (e) {
            return await bar();
          }
        }
      `,
      errors: createErrorList({
        suggestionOutput: dedent`
          async function foo() {
            try {}
            catch (e) {
              return bar();
            }
          }
        `
      })
    },
    {
      code: dedent`
        try {
          async function foo() {
            return await bar();
          }
        } catch (e) {}
      `,
      errors: createErrorList({
        suggestionOutput: dedent`
          try {
            async function foo() {
              return bar();
            }
          } catch (e) {}
        `
      })
    },
    {
      code: dedent`
        try {
          async () => await bar();
        } catch (e) {}
      `,
      errors: createErrorList({
        suggestionOutput: dedent`
          try {
            async () => bar();
          } catch (e) {}
        `
      })
    },
    {
      code: dedent`
        async function foo() {
          try {}
          catch (e) {
            try {}
            catch (e) {
              return await bar();
            }
          }
        }
      `,
      errors: createErrorList({
        suggestionOutput: dedent`
          async function foo() {
            try {}
            catch (e) {
              try {}
              catch (e) {
                return bar();
              }
            }
          }
        `
      })
    },
    {
      code: dedent`
        async function foo() {
          return await new Promise(resolve => {
            resolve(5);
          });
        }
      `,
      errors: createErrorList({
        suggestionOutput: dedent`
          async function foo() {
            return new Promise(resolve => {
              resolve(5);
            });
          }
        `
      })
    },
    {
      code: dedent`
        async () => {
          return await (
            foo()
          )
        };
      `,
      errors: createErrorList({
        suggestionOutput: dedent`
          async () => {
            return (
              foo()
            )
          };
        `
      })
    },
    {
      code: dedent`
        async function foo() {
          return await // Test
            5;
        }
      `,
      errors: createErrorList()
    }
  ]
});

import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    dedent`
      import { noop, trueFn, falseFn, asyncNoop } from 'foxts/noop';
      const a = noop;
      const b = trueFn;
      const c = falseFn;
      const d = asyncNoop;
    `,
    dedent`
      function handler() {
        sideEffect();
      }
    `,
    dedent`
      const predicate = () => condition;
    `,
    dedent`
      async function handler() {
        await sideEffect();
      }
    `,
    'const magic = () => 42;',
    // Empty constructor should not be flagged
    dedent`
      class Foo {
        constructor() {}
      }
    `,
    // Constructor with parameter properties
    dedent`
      class Foo {
        constructor(public name: string) {}
      }
    `,
    // Empty class method
    dedent`
      class Foo {
        handleClick() {}
      }
    `,
    // Override method
    dedent`
      class Foo extends Bar {
        override reset() {}
      }
    `,
    // Getter/setter
    dedent`
      class Foo {
        get value() { return true; }
        set value(v: boolean) {}
      }
    `,
    // Object method shorthand
    dedent`
      const obj = {
        onClick() {}
      };
    `
  ],
  invalid: [
    {
      code: 'function noopHandler() {}',
      errors: [{ messageId: 'noop' }]
    },
    {
      code: 'const noopHandler = () => {}',
      errors: [{ messageId: 'noop' }]
    },
    {
      code: 'const yes = () => true',
      errors: [{ messageId: 'trueFn' }]
    },
    {
      code: 'const no = function () { return false; }',
      errors: [{ messageId: 'falseFn' }]
    },
    {
      code: 'const later = () => Promise.resolve()',
      errors: [{ messageId: 'asyncNoop' }]
    },
    {
      code: 'async function later() {}',
      errors: [{ messageId: 'asyncNoop' }]
    },
    {
      code: 'const later = async () => { return; }',
      errors: [{ messageId: 'asyncNoop' }]
    },
    {
      code: 'function bare() { return; }',
      errors: [{ messageId: 'noop' }]
    },
    {
      code: 'const bare = () => { return; }',
      errors: [{ messageId: 'noop' }]
    }
  ]
}, {}, false);

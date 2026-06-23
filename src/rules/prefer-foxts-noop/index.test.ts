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
    'const magic = () => 42;'
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

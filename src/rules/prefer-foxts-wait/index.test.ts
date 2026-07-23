import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // Already using the util
    dedent`
      import { wait } from 'foxts/wait';
      await wait(1000);
    `,
    // setTimeout that forwards extra args is not a plain delay
    'new Promise(resolve => setTimeout(resolve, 1000, extra))',
    // setTimeout callback does something other than resolve
    'new Promise(resolve => setTimeout(() => resolve(42), 1000))',
    // callback is not the resolve param
    'new Promise(resolve => setTimeout(done, 1000))',
    // Promise executor body has more than the timer
    dedent`
      new Promise((resolve) => {
        doSomething();
        setTimeout(resolve, 1000);
      })
    `,
    // Promise with a reject param used — not a bare delay shape we rewrite
    'new Promise((resolve, reject) => setTimeout(resolve, 1000))',
    // Not the global Promise
    dedent`
      const Promise = MyThing;
      new Promise(resolve => setTimeout(resolve, 1000));
    `,
    // Global setTimeout with a callback — the normal timer, not a delay
    'setTimeout(() => {}, 1000)',
    // Bare global setTimeout(ms) is NOT the promisified form
    'setTimeout(1000)',
    // setTimeout from a non-promises import
    dedent`
      import { setTimeout } from 'node:timers';
      setTimeout(1000);
    `,
    // timers/promise w/ resolved value
    dedent`
      import { setTimeout } from 'node:timers/promise';
      setTimeout(1000, '114514');
    `
  ],
  invalid: [
    // Arrow expression body
    {
      code: 'await new Promise(resolve => setTimeout(resolve, 1000))',
      output: 'import { wait } from \'foxts/wait\';\nawait wait(1000)',
      errors: [{ messageId: 'default' }]
    },
    // Parenthesized param
    {
      code: 'await new Promise((resolve) => setTimeout(resolve, 1000))',
      output: 'import { wait } from \'foxts/wait\';\nawait wait(1000)',
      errors: [{ messageId: 'default' }]
    },
    // Block body with single timer statement
    {
      code: dedent`
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      `,
      output: 'import { wait } from \'foxts/wait\';\nawait wait(500);',
      errors: [{ messageId: 'default' }]
    },
    // function expression executor
    {
      code: 'await new Promise(function (resolve) { setTimeout(resolve, 500); })',
      output: 'import { wait } from \'foxts/wait\';\nawait wait(500)',
      errors: [{ messageId: 'default' }]
    },
    // Non-literal timeout expression is preserved verbatim
    {
      code: 'await new Promise(resolve => setTimeout(resolve, delayMs * 2))',
      output: 'import { wait } from \'foxts/wait\';\nawait wait(delayMs * 2)',
      errors: [{ messageId: 'default' }]
    },
    // Differently-named resolve param
    {
      code: 'await new Promise(done => setTimeout(done, 1000))',
      output: 'import { wait } from \'foxts/wait\';\nawait wait(1000)',
      errors: [{ messageId: 'default' }]
    },
    // Reuse an existing foxts/wait import
    {
      code: dedent`
        import { wait } from 'foxts/wait';
        const p = new Promise(resolve => setTimeout(resolve, 1000));
      `,
      output: dedent`
        import { wait } from 'foxts/wait';
        const p = wait(1000);
      `,
      errors: [{ messageId: 'default' }]
    },

    // timers/promises setTimeout(ms)
    {
      code: dedent`
        import { setTimeout } from 'timers/promises';
        await setTimeout(1000);
      `,
      output: dedent`
        import { setTimeout } from 'timers/promises';
        import { wait } from 'foxts/wait';

        await wait(1000);
      `,
      errors: [{ messageId: 'default' }]
    },
    // node:timers/promises with alias
    {
      code: dedent`
        import { setTimeout as sleep } from 'node:timers/promises';
        await sleep(1000);
      `,
      output: dedent`
        import { setTimeout as sleep } from 'node:timers/promises';
        import { wait } from 'foxts/wait';

        await wait(1000);
      `,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

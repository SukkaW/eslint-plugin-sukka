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
    `,
    // timers/promises setTimeout that resolves to a value is not a plain delay
    dedent`
      import { setTimeout as delay } from 'node:timers/promises';
      await delay(1000, 'value');
    `,
    // timers/promises setTimeout with an abort signal
    dedent`
      import { setTimeout as delay } from 'node:timers/promises';
      await delay(1000, undefined, { signal });
    `,
    // Passed around as a value — can't tell how it is called
    dedent`
      import { setTimeout as delay } from 'node:timers/promises';
      retry(delay);
    `,
    // Unused import is left to no-unused-vars
    'import { setTimeout as delay } from \'node:timers/promises\';',
    // Other timers/promises exports
    dedent`
      import { setImmediate } from 'node:timers/promises';
      await setImmediate();
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

    // node:timers/promises alias keeps its local name
    {
      code: dedent`
        import { setTimeout as delay } from 'node:timers/promises';
        await delay(ms);
      `,
      output: dedent`
        import { wait as delay } from 'foxts/wait';
        await delay(ms);
      `,
      errors: [{ messageId: 'timersPromises', data: { source: 'node:timers/promises' } }]
    },
    // Every call site is a delay — one report, fixed at the import
    {
      code: dedent`
        import { setTimeout as sleep } from 'timers/promises';
        await sleep(1000);
        async function f() {
          await sleep(ms * 2);
        }
      `,
      output: dedent`
        import { wait as sleep } from 'foxts/wait';
        await sleep(1000);
        async function f() {
          await sleep(ms * 2);
        }
      `,
      errors: [{ messageId: 'timersPromises', data: { source: 'timers/promises' } }]
    },
    // Aliased as `wait` already
    {
      code: dedent`
        import { setTimeout as wait } from 'node:timers/promises';
        await wait(1000);
      `,
      output: dedent`
        import { wait } from 'foxts/wait';
        await wait(1000);
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // Quote style and missing semicolon are preserved
    {
      code: dedent`
        import { setTimeout as delay } from "node:timers/promises"
        await delay(1000)
      `,
      output: dedent`
        import { wait as delay } from "foxts/wait"
        await delay(1000)
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // String-literal import name
    {
      code: dedent`
        import { 'setTimeout' as delay } from 'node:timers/promises';
        await delay(1000);
      `,
      output: dedent`
        import { wait as delay } from 'foxts/wait';
        await delay(1000);
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // Unaliased setTimeout is renamed to `wait`
    {
      code: dedent`
        import { setTimeout } from 'timers/promises';
        await setTimeout(1000);
        await setTimeout(2000);
      `,
      output: dedent`
        import { wait } from 'foxts/wait';
        await wait(1000);
        await wait(2000);
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // Unaliased setTimeout reuses an existing foxts/wait import
    {
      code: dedent`
        import { wait as sleep } from 'foxts/wait';
        import { setTimeout } from 'node:timers/promises';
        await setTimeout(1000);
        await sleep(1000);
      `,
      output: dedent`
        import { wait as sleep } from 'foxts/wait';
        await sleep(1000);
        await sleep(1000);
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // Unaliased setTimeout where `wait` is shadowed at a call site keeps the name
    {
      code: dedent`
        import { setTimeout } from 'node:timers/promises';
        function f(wait) {
          return setTimeout(wait);
        }
      `,
      output: dedent`
        import { wait as setTimeout } from 'foxts/wait';
        function f(wait) {
          return setTimeout(wait);
        }
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // Unaliased setTimeout where a global `wait` would be captured keeps the name
    {
      code: dedent`
        import { setTimeout } from 'node:timers/promises';
        await setTimeout(1000);
        wait();
      `,
      output: dedent`
        import { wait as setTimeout } from 'foxts/wait';
        await setTimeout(1000);
        wait();
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // Sibling specifiers stay on timers/promises
    {
      code: dedent`
        import { setInterval, setTimeout as delay } from 'node:timers/promises';
        await delay(1000);
      `,
      output: dedent`
        import { setInterval } from 'node:timers/promises';
        import { wait as delay } from 'foxts/wait';
        await delay(1000);
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    {
      code: dedent`
        import { setTimeout as delay, setInterval, } from 'node:timers/promises'
        await delay(1000)
      `,
      output: dedent`
        import { setInterval, } from 'node:timers/promises'
        import { wait as delay } from 'foxts/wait'
        await delay(1000)
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    {
      code: dedent`
        import timers, { setTimeout as delay } from 'node:timers/promises';
        await delay(1000);
      `,
      output: dedent`
        import timers from 'node:timers/promises';
        import { wait as delay } from 'foxts/wait';
        await delay(1000);
      `,
      errors: [{ messageId: 'timersPromises' }]
    },
    // Also used as the real setTimeout — only the delay call site is rewritten
    {
      code: dedent`
        import { setTimeout as delay } from 'node:timers/promises';
        await delay(1000);
        const v = await delay(1000, 'value');
      `,
      output: dedent`
        import { setTimeout as delay } from 'node:timers/promises';
        import { wait } from 'foxts/wait';

        await wait(1000);
        const v = await delay(1000, 'value');
      `,
      errors: [{ messageId: 'timersPromises' }]
    }
  ]
}, {}, false);

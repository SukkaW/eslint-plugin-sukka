import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    dedent`
      // from argument
      function Component({ matchMedia }) {
        return matchMedia('(min-width: 768px)');
      }
    `,
    dedent`
      // fake window
      function Component() {
        const window = { matchMedia: () => ({ matches: false }) };
        return window.matchMedia('(min-width: 768px)');
      }
    `,
    dedent`
      // fake media match API
      function Component() {
        const media = fakeMediaMatcher();
        return media.matchMedia('(min-width: 768px)');
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function Component() {
          return window.matchMedia('(min-width: 768px)');
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function Component() {
          // bare global API
          return matchMedia('(min-width: 768px)');
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function Component() {
          return globalThis.window.matchMedia('(min-width: 768px)');
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function Component() {
          return self.matchMedia('(min-width: 768px)');
        }
      `,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

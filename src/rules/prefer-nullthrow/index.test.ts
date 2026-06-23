import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    dedent`
      function useEnabled(enabled: boolean) {
        if (!enabled) {
          throw new Error();
        }
        return enabled;
      }
    `,
    dedent`
      function useCount(count: number) {
        if (count === 0) {
          throw new Error();
        }
        return count;
      }
    `,
    dedent`
      function useValue(v) {
        if (v == null) {
          return null;
        }
        return v;
      }
    `,
    dedent`
      function useValue(v) {
        if (v == null) {
          throwSomething();
        }
        return v;
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function useV() {
          const v = useContext(someContext);
          if (!v) {
            throw new Error();
          }
          return v;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function useValue(v) {
          if (v == null) {
            throw new Error();
          }
          return v;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function useValue(v) {
          if (v == null || v === undefined) {
            throw new Error();
          }
          return v;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function useValue(v) {
          if (v === null || typeof v === 'undefined') {
            throw new Error();
          }
          return v;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function useValue(v) {
          if (typeof v === 'undefined') throw new Error();
          return v;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function useValue(v) {
          if (v === null || v === undefined) {
            throw new Error();
          }
          return v;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function useValue(v) {
          if (v != null) return v;
          throw new Error();
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // throw in if-block, no explicit return of the guarded value (still an invariant/nullthrow pattern)
    {
      code: dedent`
        function useValue(v) {
          if (v == null) {
            throw new Error();
          }
          doSomething(v);
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // if/else: nullish check with throw in consequent, return in alternate
    {
      code: dedent`
        function useValue(v) {
          if (v == null) {
            throw new Error();
          } else {
            return v;
          }
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // if/else: non-nullish check with return in consequent, throw in alternate
    {
      code: dedent`
        function useValue(v) {
          if (v != null) {
            return v;
          } else {
            throw new Error();
          }
        }
      `,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

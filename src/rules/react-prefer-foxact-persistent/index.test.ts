import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    dedent`
      function Component({ storage }) {
        storage.getItem('foo');
        return null;
      }
    `,
    dedent`
      function Component() {
        const localStorage = createStorage();
        localStorage.getItem('foo');
        return null;
      }
    `,
    dedent`
      function Component() {
        const sessionStorage = createStorage();
        return sessionStorage;
      }
    `,
    // useLocalStorage result used locally, not returned
    dedent`
      function Component() {
        const [value, setValue] = useLocalStorage('key', '');
        return <div>{value}</div>;
      }
    `,
    // useSessionStorage result used locally, not returned
    dedent`
      function Component() {
        const [value, setValue] = useSessionStorage('key', '');
        return <div>{value}</div>;
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function Component() {
          localStorage.getItem('foo');
          return null;
        }
      `,
      errors: [{ messageId: 'local' }]
    },
    {
      code: dedent`
        function Component() {
          sessionStorage.setItem('foo', 'bar');
          return null;
        }
      `,
      errors: [{ messageId: 'session' }]
    },
    {
      code: dedent`
        function Component() {
          const storage = window.localStorage;
          return storage;
        }
      `,
      errors: [{ messageId: 'local' }]
    },
    {
      code: dedent`
        function Component() {
          globalThis.sessionStorage.removeItem('foo');
          return null;
        }
      `,
      errors: [{ messageId: 'session' }]
    },
    {
      code: dedent`
        function Component() {
          const storage = localStorage;
          return storage;
        }
      `,
      errors: [{ messageId: 'local' }]
    },
    {
      code: dedent`
        function Component() {
          self.sessionStorage.removeItem('foo');
          return null;
        }
      `,
      errors: [{ messageId: 'session' }]
    },
    // return useLocalStorage() directly
    {
      code: dedent`
        function useSharedStorage() {
          return useLocalStorage('key', '');
        }
      `,
      errors: [{ messageId: 'returnLocalStorage' }]
    },
    // return useSessionStorage() directly
    {
      code: dedent`
        function useSharedStorage() {
          return useSessionStorage('key', '');
        }
      `,
      errors: [{ messageId: 'returnSessionStorage' }]
    },
    // arrow function returning useLocalStorage
    {
      code: dedent`
        const useShared = () => useLocalStorage('key', '');
      `,
      errors: [{ messageId: 'returnLocalStorage' }]
    }
  ]
}, {}, false);

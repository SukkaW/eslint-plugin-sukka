import module from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    // Already using foxact/use-abortable-effect
    dedent`
      import { useAbortableEffect } from 'foxact/use-abortable-effect';
      function App() {
        useAbortableEffect((signal) => {
          fetch('/api', { signal });
        }, []);
      }
    `,
    // useEffect with parameter (custom hook providing signal)
    dedent`
      function App() {
        useEffect((signal) => {
          let cancel = false;
          if (!cancel) {}
          return () => { cancel = true; };
        }, []);
      }
    `,
    // useEffect without cancel pattern
    dedent`
      function App() {
        useEffect(() => {
          console.log('hello');
          return () => console.log('bye');
        }, []);
      }
    `,
    // Variable set to true in cleanup but never read in conditional
    dedent`
      function App() {
        useEffect(() => {
          let cancel = false;
          console.log(cancel);
          return () => { cancel = true; };
        }, []);
      }
    `,
    // No cleanup function
    dedent`
      function App() {
        useEffect(() => {
          let cancel = false;
          if (!cancel) { fetch('/api'); }
        }, []);
      }
    `
  ],
  invalid: [
    // Classic cancel flag pattern
    {
      code: dedent`
        function App() {
          useEffect(() => {
            let cancel = false;
            fetch('/api').then(res => {
              if (!cancel) {
                setData(res);
              }
            });
            return () => { cancel = true; };
          }, []);
        }
      `,
      errors: [{ messageId: 'preferAbortableEffect' }]
    },
    // Variant: cancelled variable name
    {
      code: dedent`
        function App() {
          useEffect(() => {
            let cancelled = false;
            fetch('/api').then(res => {
              if (!cancelled) {
                setData(res);
              }
            });
            return () => { cancelled = true; };
          }, []);
        }
      `,
      errors: [{ messageId: 'preferAbortableEffect' }]
    },
    // Variant: isStale / ignore variable name
    {
      code: dedent`
        function App() {
          useEffect(() => {
            let ignore = false;
            fetchData().then(result => {
              if (!ignore) {
                setState(result);
              }
            });
            return () => { ignore = true; };
          }, [url]);
        }
      `,
      errors: [{ messageId: 'preferAbortableEffect' }]
    },
    // Variant: cleanup as arrow expression body
    {
      code: dedent`
        function App() {
          useEffect(() => {
            let active = false;
            if (!active) { doWork(); }
            return () => active = true;
          }, []);
        }
      `,
      errors: [{ messageId: 'preferAbortableEffect' }]
    },
    // with deps
    {
      code: dedent`
        function App({ id }) {
          useEffect(() => {
            let cancel = false;
            fetch('/api/' + id).then(res => {
              if (!cancel) setData(res);
            });
            return () => { cancel = true; };
          }, [id]);
        }
      `,
      errors: [{ messageId: 'preferAbortableEffect' }]
    }
  ]
}, {}, false);

import { dedent } from 'ts-dedent';
import mod from '.';
import { runTest } from '@test/run-test';

runTest({
  module: mod,
  invalid: [
    {
      code: dedent`
        import { useEffect, useState } from "react";

        function Component() {
          const [done, setDone] = useState(false);

          useEffect(() => {
            let cancelled = false;

            Promise.resolve().then(() => {
              if (!cancelled) {
                setDone(true);
              }
            });

            return () => {
              cancelled = true;
            };
          }, []);

          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    }
  ],
  valid: [
    dedent`
      import { useEffect, useState } from "react";

      function Component() {
        const [v, setV] = useState();

        useEffect((signal) => {
          let initRead = false;

          someReadAsync().then((v) => {
            if (signal.aborted) return;
            initRead = true;
            setV(v);
          });

          const off = onSomething((v) => {
            if (!initRead) return;
            if (signal.aborted) return;
            setV(v);
          })

          return () => {
            // this way the onSomething call get extra ignore guard
            initRead = false;
          };
        }, []);

        return null;
      }
    `,
    dedent`
      import { useEffect, useState } from "react";

      function Component() {
        const [done, setDone] = useState(false);

        useEffect(() => {
          let cancelled = false;
          console.log(cancelled);

          return () => {
            cancelled = true;
          };
        }, []);

        return done;
      }
    `
  ]
}, {}, false);

import { dedent } from 'ts-dedent';
import mod from '.';
import { runTest } from '@test/run-test';

runTest({
  module: mod,
  invalid: [
    {
      code: dedent`
        import { useEffect, useState } from "react";

        function Component({ value }) {
          const [open, setOpen] = useState(false);
          useEffect(() => {
            setOpen(Boolean(value));
          }, [value]);
          return null;
        }
      `,
      errors: [{ messageId: 'watchStateWithProps' }]
    },
    {
      code: dedent`
        import { useEffect, useState } from "react";

        function Component(props) {
          const [open, setOpen] = useState(false);
          useEffect(() => {
            setOpen(Boolean(props.value));
          }, [props.value]);
          return null;
        }
      `,
      errors: [{ messageId: 'watchStateWithProps' }]
    },
    {
      code: dedent`
        import { useEffect, useState } from "react";

        function Component() {
          const [value, setValue] = useState(0);
          const [open, setOpen] = useState(false);
          useEffect(() => {
            setOpen(value > 0);
          }, [value]);
          return null;
        }
      `,
      errors: [{ messageId: 'watchState' }]
    },
    {
      code: dedent`
        import { useEffect, useState } from "react";

        function Component() {
          const [value, setValue] = useState(0);

          useEffect(() => {
            function sync() {
              setValue(1);
            }

            sync();
          }, []);

          return value;
        }
      `,
      errors: [{ messageId: 'watchState' }]
    },
    {
      code: dedent`
        import { useEffect, useState } from "react";

        function Component() {
          const [value, setValue] = useState(0);

          useEffect(() => {
            (() => {
              setValue(1);
            })();
          }, []);

          return value;
        }
      `,
      errors: [{ messageId: 'watchState' }]
    }
  ],
  valid: [
    dedent`
      import { useEffect, useState } from "react";

      function Component() {
        const [value, setValue] = useState(0);
        return <button onClick={() => setValue(value + 1)}>Update</button>;
      }
    `,
    dedent`
      import { useEffect, useState } from "react";

      function Component() {
        const [value, setValue] = useState(0);

        useEffect(() => {
          async function sync() {
            setValue(1);
          }

          void sync();
        }, []);

        return value;
      }
    `,
    dedent`
      import { useEffect, useState } from "react";

      function Component() {
        const [value, setValue] = useState(0);

        useEffect(() => {
          Promise.resolve().then(() => {
            setValue(1);
          });
        }, []);

        return value;
      }
    `,
    dedent`
      import { useEffect, useState } from "react";

      function Component() {
        const [value, setValue] = useState(0);

        useEffect(() => {
          setTimeout(() => {
            setValue(1);
          }, 0);
        }, []);

        return value;
      }
    `,
    dedent`
      import { useEffect, useState } from "react";

      function Component() {
        const [value, setValue] = useState(0);

        useEffect(() => {
          (async () => {
            setValue(1);
          })();
        }, []);

        return value;
      }
    `
  ]
}, {}, false);

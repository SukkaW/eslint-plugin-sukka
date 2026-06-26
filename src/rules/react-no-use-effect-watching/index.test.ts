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
    },
    // Arrow function assigned to variable then called synchronously
    {
      code: dedent`
        import { useEffect, useState } from "react";

        function Component() {
          const [value, setValue] = useState(0);

          useEffect(() => {
            const cb = () => {
              setValue(1);
            };
            cb();
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
    `,
    dedent`
      import { useEffect, useState, useRef } from "react";

      function Component() {
        const containerRef = useRef(null);
        const [isFixed, setIsFixed] = useState(false);

        useEffect(() => {
          const el = containerRef.current;
          const observer = new ResizeObserver((entries) => {
            setIsFixed(entries[0].contentRect.width < 500);
          });
          if (el) observer.observe(el);
          return () => observer.disconnect();
        }, []);

        return null;
      }
    `,
    dedent`
      import { useEffect, useState, useRef } from "react";

      function Component() {
        const ref = useRef(null);
        const [visible, setVisible] = useState(false);

        useEffect(() => {
          const observer = new IntersectionObserver(([entry]) => {
            setVisible(entry.isIntersecting);
          });
          if (ref.current) observer.observe(ref.current);
          return () => observer.disconnect();
        }, []);

        return null;
      }
    `,
    dedent`
      import { useEffect, useState, useRef } from "react";

      function Component() {
        const ref = useRef(null);
        const [changed, setChanged] = useState(false);

        useEffect(() => {
          const observer = new MutationObserver(() => {
            setChanged(true);
          });
          if (ref.current) observer.observe(ref.current, { childList: true });
          return () => observer.disconnect();
        }, []);

        return null;
      }
    `,
    dedent`
      import { useEffect, useState, useRef } from "react";

      function Component() {
        const buttonRef = useRef(null);
        const menuRef = useRef(null);
        const [isOpened, setIsOpened] = useState(false);

        useEffect(() => {
          const handleDocumentScroll = () => setIsOpened(false);
          const handleDocumentClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            e.stopPropagation();
            setIsOpened(false);
          };

          document.addEventListener('click', handleDocumentClick);
          window.addEventListener('scroll', handleDocumentScroll);
          return () => {
            document.removeEventListener('click', handleDocumentClick);
            window.removeEventListener('scroll', handleDocumentScroll);
          };
        }, []);

        return null;
      }
    `
  ]
}, {}, false);

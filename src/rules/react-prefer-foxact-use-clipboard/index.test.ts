import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    dedent`
      function Component({ copy }) {
        return <button onClick={() => copy()}>Copy</button>;
      }
    `,
    dedent`
      // not broswer global navigator
      function Component() {
        const navigator = { clipboard: { writeText() {} } };
        navigator.clipboard.writeText('hello');
        return null;
      }
    `,
    dedent`
      // paste, not copy
      function Component() {
        document.execCommand('paste');
        return null;
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function Component() {
          navigator.clipboard.writeText('hello');
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        async function Component() {
          await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob(['hi']) })]);
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function Component() {
          const { writeText } = navigator.clipboard;
          return <button onClick={() => writeText('hello')}>Copy</button>;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function Component() {
          document.execCommand('copy');
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function Component() {
          window.document.execCommand('cut');
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function Component() {
          window.navigator.clipboard.writeText('hello');
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

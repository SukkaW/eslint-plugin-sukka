import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // Has parameters — not useless
    dedent`
      function add(a, b) { return a + b; }
    `,
    // References a let variable — not pre-determinable
    dedent`
      let count = 0;
      function getCount() { return count; }
    `,
    // References a reassigned variable
    dedent`
      let x = 1;
      x = 2;
      const getX = () => x;
    `,
    // Async function — excluded
    dedent`
      async function fetchData() { return await fetch('/api'); }
    `,
    // Generator — excluded
    dedent`
      function* gen() { yield 1; }
    `,
    // Factory pattern — createXxx
    dedent`
      function createStore() { return { count: 0 }; }
    `,
    // Factory pattern — xxxFactory
    dedent`
      function storeFactory() { return { count: 0 }; }
    `,
    // Factory pattern — makeXxx
    dedent`
      function makeConfig() { return { debug: true }; }
    `,
    // Factory pattern — buildXxx
    dedent`
      function buildOptions() { return { strict: true }; }
    `,
    // Factory pattern — initXxx
    dedent`
      function initState() { return { ready: false }; }
    `,
    // Factory returning array
    dedent`
      function createList() { return [1, 2, 3]; }
    `,
    // Factory returning new Map
    dedent`
      function createLookup() { return new Map(); }
    `,
    // Factory returning new Set
    dedent`
      function createSet() { return new Set(); }
    `,
    // Exported function
    dedent`
      export function getConfig() { return { debug: true }; }
    `,
    // Export default function
    dedent`
      export default function getConfig() { return 42; }
    `,
    // Has parameter with default
    dedent`
      function foo(x = 1) { return x; }
    `,
    // References var (mutable)
    dedent`
      var config = {};
      function getConfig() { return config; }
    `
  ],
  invalid: [
    // Simple constant return
    {
      code: dedent`
        function getAnswer() { return 42; }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Arrow function returning constant
    {
      code: dedent`
        const getAnswer = () => 42;
      `,
      errors: [{ messageId: 'default' }]
    },
    // References only const and imports
    {
      code: dedent`
        import { BASE } from './config';
        const MULTIPLIER = 2;
        function getValue() { return BASE * MULTIPLIER; }
      `,
      errors: [{ messageId: 'default' }]
    },
    // References only other functions
    {
      code: dedent`
        function helper() { return 1; }
        function getValue() { return helper(); }
      `,
      errors: [
        { messageId: 'default' },
        { messageId: 'default' }
      ]
    },
    // Arrow with block body
    {
      code: dedent`
        const ITEMS = [1, 2, 3];
        const getFirst = () => { return ITEMS[0]; };
      `,
      errors: [{ messageId: 'default' }]
    },
    // References only globals (console, Math)
    {
      code: dedent`
        function logHello() { console.log("hello"); }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Object method shorthand
    {
      code: dedent`
        const LIMIT = 100;
        const obj = {
          getLimit() { return LIMIT; }
        };
      `,
      errors: [{ messageId: 'default' }]
    },
    // References enum
    {
      code: dedent`
        enum Color { Red, Green, Blue }
        function getDefault() { return Color.Red; }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Nested const references
    {
      code: dedent`
        const A = 1;
        const B = 2;
        const getSum = () => A + B;
      `,
      errors: [{ messageId: 'default' }]
    },
    // Factory name but returns primitive — still useless
    {
      code: dedent`
        function createId() { return 42; }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Factory name but returns string — still useless
    {
      code: dedent`
        const makeKey = () => "static-key";
      `,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

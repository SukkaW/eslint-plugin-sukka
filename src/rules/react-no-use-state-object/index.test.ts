import mod from '.';
import { runTest } from '@test/run-test';

runTest({
  module: mod,
  valid: [
    // No arguments
    'useState()',
    // Primitive
    'useState(0)',
    'useState("")',
    'useState(true)',
    // Array
    'useState([])',
    // Object with <= 1 keys (default)
    'useState({ a: 1 })',
    // Not useState
    'createState({ a: 1, b: 2, c: 3, d: 4 })',
    // Lazy initializer returning small object
    'useState(() => ({ a: 1 }))',
    // Variable reference (not inline object)
    'useState(initialState)',
    // Function call
    'useState(getInitialState())',
    // other object should not be flagged right now
    'useState(() => new Map()); useState(() => new Set());',
    // regression prevention: useStateWithDeps must be allowed
    'useStateWithDeps({ a: 1, b: 2, c: 3, d: 4, e: 5 });',
    // useXxxState - right now 3rd party rule is not our concern
    'useFormState({ name: "", email: "", phone: "", address: "" })'
  ],
  invalid: [
    {
      code: 'useState({ a: 1, b: 2 })',
      errors: [{ messageId: 'default' }]
    },
    {
      code: 'useState({ a: 1, b: 2, c: 3, d: 4 })',
      errors: [{ messageId: 'default' }]
    },
    {
      code: 'useState({ a: 1, b: 2, c: 3, d: 4, e: 5 })',
      errors: [{ messageId: 'default' }]
    },
    // Lazy initializer returning large object
    {
      code: 'useState(() => ({ a: 1, b: 2, c: 3, d: 4 }))',
      errors: [{ messageId: 'default' }]
    },
    // React.useState
    {
      code: 'React.useState({ a: 1, b: 2, c: 3, d: 4 })',
      errors: [{ messageId: 'default' }]
    },
    // Custom maxKeys option
    {
      code: 'useState({ a: 1, b: 2 })',
      options: [{ maxKeys: 1 }],
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

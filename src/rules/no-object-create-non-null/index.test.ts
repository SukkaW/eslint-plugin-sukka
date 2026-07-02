import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // Prototype-less object
    'Object.create(null)',
    // With property descriptors
    'Object.create(null, { foo: { value: 1 } })',
    // Type-cast null
    'Object.create(null as any)',
    // Not the global Object
    dedent`
      const Object = { create(proto) { return proto; } };
      Object.create(base);
    `,
    // Different method
    'Object.assign({}, source)',
    // Not Object
    'Reflect.construct(fn, [])'
  ],
  invalid: [
    {
      code: 'Object.create(proto)',
      errors: [{ messageId: 'default' }]
    },
    {
      code: 'Object.create({})',
      errors: [{ messageId: 'default' }]
    },
    {
      code: 'Object.create(Array.prototype)',
      errors: [{ messageId: 'default' }]
    },
    {
      code: 'Object.create(undefined)',
      errors: [{ messageId: 'default' }]
    },
    // Zero args throws at runtime
    {
      code: 'Object.create()',
      errors: [{ messageId: 'default' }]
    },
    // Spread argument
    {
      code: 'Object.create(...args)',
      errors: [{ messageId: 'default' }]
    },
    // Non-null with descriptors
    {
      code: 'Object.create(base, { foo: { value: 1 } })',
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

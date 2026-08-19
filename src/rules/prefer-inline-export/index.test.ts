import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // already inline
    'export default function Comp() {}',
    'export default class Comp {}',
    'export function Comp() {}',
    'export const Comp = () => {};',
    'export default memo(function Comp() {});',

    // anonymous default export
    'export default function () {}',
    'export default () => {};',

    // the binding is used elsewhere, so it cannot be removed
    dedent`
      function Comp() {}
      register(Comp);
      export default Comp;
    `,
    dedent`
      function Comp() {}
      export default memo(Comp);
      register(Comp);
    `,

    // reassigned binding: the exported value is not the declared one
    dedent`
      function Comp() {}
      Comp = other;
      export default Comp;
    `,

    // not adjacent
    dedent`
      function Comp() {}
      const x = 1;
      export default Comp;
    `,

    // a const holding a non-function cannot be `export default const`
    dedent`
      const value = 1;
      export default value;
    `,
    dedent`
      const Comp = () => {};
      export default Comp;
    `,

    // generators are skipped
    dedent`
      function* gen() {}
      export { gen };
    `,

    // renamed exports cannot be inlined
    dedent`
      function Comp() {}
      export { Comp as default };
    `,
    dedent`
      function Comp() {}
      export { Comp as Other };
    `,
    // arbitrary module namespace name is not a valid binding
    dedent`
      function Comp() {}
      export { Comp as "a-b" };
    `,

    // inlining would leave a second export of the same binding behind
    dedent`
      function Comp() {}
      export { Comp };
      export { Comp as Alias };
    `,

    // re-export from another module
    'export { Comp } from "./comp";',

    // nothing in the list is inlinable: imported and `let` bindings
    dedent`
      import { x } from "m";
      let y = 1;
      export { x, y };
    `,

    // type-only export keeps the type/value distinction
    dedent`
      interface Props {}
      export type { Props };
    `,

    // unknown wrapper is not in the allowlist
    dedent`
      function Comp() {}
      export default somethingElse(Comp);
    `,

    // wrapper argument is not the declaration
    dedent`
      function Comp() {}
      export default memo(Other);
    `,

    // declare / ambient has no body to inline
    dedent`
      declare function Comp(): void;
      export { Comp };
    `,

    // overload sets: exporting only the implementation is a TS error, and the
    // signatures above would be stranded
    dedent`
      function f(a: string): void;
      function f(a: any): void {}
      export { f };
    `,
    dedent`
      function f(a: string): void;
      function f(a: any): void {}
      export default f;
    `,

    // the default-export fix removes the binding, which `typeof` still needs
    dedent`
      function Comp() {}
      export default Comp;
      type T = typeof Comp;
    `,

    // self-reference (recursion) counts as another use of the binding
    dedent`
      function Comp() { return Comp; }
      export default Comp;
    `,
    dedent`
      function Comp() { return Comp; }
      export default memo(Comp);
    `,

    // multiple declarators cannot be split
    dedent`
      const a = 1, b = 2;
      export { a };
    `,

    // let/var may be reassigned before the export is evaluated
    dedent`
      let Comp = () => {};
      export { Comp };
    `,

    // opting out of the wrapped case
    {
      code: dedent`
        function Comp() {}
        export default memo(Comp);
      `,
      options: [{ allowWrapped: false }]
    },

    // custom allowlist that excludes memo
    {
      code: dedent`
        function Comp() {}
        export default memo(Comp);
      `,
      options: [{ wrappers: ['observer'] }]
    }
  ],

  invalid: [
    // case: export default Comp
    {
      code: dedent`
        function Comp() {}
        export default Comp;
      `,
      output: 'export default function Comp() {}',
      errors: [{ messageId: 'inlineDefault' }]
    },
    {
      code: dedent`
        class Comp {}
        export default Comp;
      `,
      output: 'export default class Comp {}',
      errors: [{ messageId: 'inlineDefault' }]
    },
    // TypeScript syntax: unicorn's rule bails on these, we should not
    {
      code: dedent`
        function Comp(props: { a: string }) {}
        export default Comp;
      `,
      output: 'export default function Comp(props: { a: string }) {}',
      errors: [{ messageId: 'inlineDefault' }]
    },
    {
      code: dedent`
        function Comp<T>(x: T): null { return null; }
        export default Comp;
      `,
      output: 'export default function Comp<T>(x: T): null { return null; }',
      errors: [{ messageId: 'inlineDefault' }]
    },

    // case: export default memo(Comp)
    {
      code: dedent`
        function Comp() {}
        export default memo(Comp);
      `,
      output: 'export default memo(function Comp() {});',
      errors: [{ messageId: 'inlineWrapped' }]
    },
    {
      code: dedent`
        function Comp(props: { a: string }) { return null; }
        export default memo(Comp);
      `,
      output: 'export default memo(function Comp(props: { a: string }) { return null; });',
      errors: [{ messageId: 'inlineWrapped' }]
    },
    {
      code: dedent`
        function Comp() {}
        export default React.memo(Comp);
      `,
      output: 'export default React.memo(function Comp() {});',
      errors: [{ messageId: 'inlineWrapped' }]
    },
    {
      code: dedent`
        function Comp() {}
        export default forwardRef(Comp);
      `,
      output: 'export default forwardRef(function Comp() {});',
      errors: [{ messageId: 'inlineWrapped' }]
    },
    // extra arguments are preserved
    {
      code: dedent`
        function Comp() {}
        export default memo(Comp, areEqual);
      `,
      output: 'export default memo(function Comp() {}, areEqual);',
      errors: [{ messageId: 'inlineWrapped' }]
    },
    // custom wrapper allowlist
    {
      code: dedent`
        function Comp() {}
        export default styled(Comp);
      `,
      output: 'export default styled(function Comp() {});',
      options: [{ wrappers: ['styled'] }],
      errors: [{ messageId: 'inlineWrapped' }]
    },

    // case: export { Comp }
    {
      code: dedent`
        function Comp() {}
        export { Comp };
      `,
      output: 'export function Comp() {}',
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        const Comp = () => {};
        export { Comp };
      `,
      output: 'export const Comp = () => {};',
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        class Comp {}
        export { Comp };
      `,
      output: 'export class Comp {}',
      errors: [{ messageId: 'inlineNamed' }]
    },
    // the binding may still be read elsewhere: inlining keeps it
    {
      code: dedent`
        function Comp() {}
        export { Comp };
        register(Comp);
      `,
      output: dedent`
        export function Comp() {}
        register(Comp);
      `,
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        const value: number = 1;
        export { value };
      `,
      output: 'export const value: number = 1;',
      errors: [{ messageId: 'inlineNamed' }]
    },
    // a named export inlines regardless of what the `const` holds — unlike
    // `export default`, there is always an `export const` form
    {
      code: dedent`
        const foo = 1;
        export { foo };
      `,
      output: 'export const foo = 1;',
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: 'const foo = 1; export { foo };',
      output: 'export const foo = 1;',
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        const obj = { a: 1 };
        export { obj };
      `,
      output: 'export const obj = { a: 1 };',
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        const s = "x";
        export { s };
      `,
      output: 'export const s = "x";',
      errors: [{ messageId: 'inlineNamed' }]
    },
    // inlining a named export keeps the binding, so `typeof` still resolves
    {
      code: dedent`
        function Comp() {}
        export { Comp };
        type T = typeof Comp;
      `,
      output: dedent`
        export function Comp() {}
        type T = typeof Comp;
      `,
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        async function Comp() {}
        export default Comp;
      `,
      output: 'export default async function Comp() {}',
      errors: [{ messageId: 'inlineDefault' }]
    },
    {
      code: dedent`
        @dec class Comp {}
        export { Comp };
      `,
      output: 'export @dec class Comp {}',
      errors: [{ messageId: 'inlineNamed' }]
    },

    // multiple specifiers: every eligible binding is inlined and the now-empty
    // export statement is removed
    {
      code: 'const foo = 1; function bar(){} export { foo, bar };',
      output: 'export const foo = 1; export function bar(){}',
      errors: [
        { messageId: 'inlineNamed' },
        { messageId: 'inlineNamed' }
      ]
    },
    {
      code: dedent`
        function a() {}
        function b() {}
        export { a, b };
      `,
      output: dedent`
        export function a() {}
        export function b() {}
      `,
      errors: [
        { messageId: 'inlineNamed' },
        { messageId: 'inlineNamed' }
      ]
    },
    {
      code: dedent`
        function a() {}
        function b() {}
        function c() {}
        export { a, b, c };
      `,
      output: dedent`
        export function a() {}
        export function b() {}
        export function c() {}
      `,
      errors: [
        { messageId: 'inlineNamed' },
        { messageId: 'inlineNamed' },
        { messageId: 'inlineNamed' }
      ]
    },
    // partial eligibility: the ineligible specifier stays in a trimmed list
    {
      code: dedent`
        import { x } from "m";
        function b() {}
        export { x, b };
      `,
      output: dedent`
        import { x } from "m";
        export function b() {}
        export { x };
      `,
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        let y = 1;
        function b() {}
        export { y, b };
      `,
      output: dedent`
        let y = 1;
        export function b() {}
        export { y };
      `,
      errors: [{ messageId: 'inlineNamed' }]
    },
    // the inlinable one is first in the list, so the trailing comma goes
    {
      code: dedent`
        function a() {}
        let y = 1;
        export { a, y };
      `,
      output: dedent`
        export function a() {}
        let y = 1;
        export { y };
      `,
      errors: [{ messageId: 'inlineNamed' }]
    },

    // comments between declaration and export: reported, not fixed
    {
      code: dedent`
        function Comp() {}
        // keep me
        export { Comp };
      `,
      output: null,
      errors: [{ messageId: 'inlineNamed' }]
    },
    {
      code: dedent`
        function Comp() {}
        // keep me
        export default Comp;
      `,
      output: null,
      errors: [{ messageId: 'inlineDefault' }]
    }
  ]
});

import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    // Regular data props are fine
    dedent`
      function MyComponent(props: { value: string; onChange: (v: string) => void }) {
        return null;
      }
    `,
    // Callback returning non-JSX
    dedent`
      function MyComponent(props: { format: (data: number) => string }) {
        return null;
      }
    `,
    // No type annotation
    dedent`
      function MyComponent(props) {
        return null;
      }
    `,
    // Not a component (lowercase)
    dedent`
      function helper(props: { render: (data: any) => React.ReactNode }) {
        return null;
      }
    `,
    // Event handler callbacks are fine
    dedent`
      interface Props {
        onClick: () => void;
        onSubmit: (data: FormData) => Promise<void>;
      }
      function MyForm(props: Props) {
        return null;
      }
    `,
    // Boolean/string return types are fine
    dedent`
      function MyComponent(props: { predicate: (item: any) => boolean }) {
        return null;
      }
    `
  ],
  invalid: [
    // Inline type literal with render function prop
    {
      code: dedent`
        function MyComponent(props: { renderItem: (data: Item) => React.ReactNode }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Referenced interface
    {
      code: dedent`
        interface MyComponentProps {
          renderRow: (row: Row) => ReactElement;
        }
        function MyComponent(props: MyComponentProps) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Referenced type alias
    {
      code: dedent`
        type Props = {
          header: (title: string) => JSX.Element;
        };
        function MyComponent(props: Props) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Arrow function component
    {
      code: dedent`
        const MyComponent = (props: { render: () => ReactNode }) => {
          return null;
        };
      `,
      errors: [{ messageId: 'default' }]
    },
    // Destructured props
    {
      code: dedent`
        function MyComponent({ render }: { render: (data: any) => React.ReactElement }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // children as render function
    {
      code: dedent`
        function MyComponent(props: { children: (data: any) => React.ReactNode }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Optional render prop (union with undefined/null)
    {
      code: dedent`
        function MyComponent(props: { render?: (data: any) => ReactNode }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Multiple render function props
    {
      code: dedent`
        interface Props {
          renderHeader: () => ReactNode;
          renderFooter: (data: any) => ReactElement;
          onChange: () => void;
        }
        function MyComponent(props: Props) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }, { messageId: 'default' }]
    },
    // Nullable render prop: ((data: T) => ReactNode) | null
    {
      code: dedent`
        function MyComponent(props: { render: ((data: any) => ReactNode) | null }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Return type is union containing JSX type: ReactElement | null
    {
      code: dedent`
        function MyComponent(props: { render: (data: any) => ReactElement | null }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // export default function
    {
      code: dedent`
        export default function MyComponent(props: { render: () => React.ReactNode }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // Intersection type in props
    {
      code: dedent`
        type BaseProps = {
          render: (item: any) => ReactNode;
        };
        type Props = BaseProps & { extra: string };
        function MyComponent(props: Props) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    // memo wrapped component
    {
      code: dedent`
        const MyComponent = memo((props: { render: () => ReactNode }) => {
          return null;
        });
      `,
      errors: [{ messageId: 'default' }]
    },
    // React.memo wrapped component
    {
      code: dedent`
        const MyComponent = React.memo((props: { render: () => ReactNode }) => {
          return null;
        });
      `,
      errors: [{ messageId: 'default' }]
    },
    // forwardRef wrapped component
    {
      code: dedent`
        const MyComponent = forwardRef((props: { render: () => ReactNode }, ref) => {
          return null;
        });
      `,
      errors: [{ messageId: 'default' }]
    },
    // export default memo(named function)
    {
      code: dedent`
        export default memo(function MyComponent(props: { render: () => ReactNode }) {
          return null;
        });
      `,
      errors: [{ messageId: 'default' }]
    },
    // export default memo(anonymous arrow)
    {
      code: dedent`
        export default memo((props: { render: () => ReactNode }) => {
          return null;
        });
      `,
      errors: [{ messageId: 'default' }]
    },
    // export default anonymous function
    {
      code: dedent`
        export default function(props: { render: () => ReactNode }) {
          return null;
        }
      `,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

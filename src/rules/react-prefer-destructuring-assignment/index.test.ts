import { runTest } from '@test/run-test';
import module from '.';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    // Destructured params are fine
    'const App = ({ id, className }) => (<div id={id} className={className} />)',
    dedent`
      const App = ({ id, className }) => {
        return <div id={id} className={className} />
      }
    `,
    // Completely destructuring before use
    dedent`
      const App = (props) => {
        const { id, className } = props
        return <div id={id} className={className} />
      }
    `,
    // Using props spread: props itself used but no props.x member access
    'const App = (props) => (<div id={id} props={props} />)',
    // Lowercase-named function (likely not a component)
    dedent`
      const obj = {
        foo(arg) {
          const a = arg.func()
          return null
        }
      }
    `,
    // Array method callbacks are not components
    dedent`
      const columns = [
        {
          render: (val) => {
            if (val.url) {
              return (<a href={val.url}>{val.test}</a>)
            }
            return null
          }
        }
      ]
    `,
    // forwardRef with destructured params is fine
    dedent`
      import { forwardRef } from "react";
      export const App = forwardRef<HTMLDivElement, { day: string }>(
        function App({ day }, ref) {
          return <div ref={ref}>{day}</div>;
        }
      );
    `,
    // memo with destructured params is fine
    dedent`
      import { memo } from "react";
      export const App = memo(
        function App({ day }) {
          return <div ref={ref}>{day}</div>;
        }
      );
    `,
    // HOF returning a component with destructured params
    dedent`
      export function hof(namespace) {
        return ({ x, y }) => {
          if (y) { return <span>{y}</span>; }
          return <span>{x}</span>
        }
      }
    `,
    // props is used as entire object in JSX spread but no member access
    dedent`
      const App = (props) => {
        const { className, ...restProps } = props
        return <div className={className} {...restProps} />
      }
    `,
    // items flatMap callback with lowercase param - not a component
    dedent`
      const items = [{ property: "value" }];
      items.flatMap((item) => {
        console.log(item.property);
        return null;
      });
      items.filter((item) => {
        console.log(item.property);
        return null;
      });
      items.find((item) => {
        console.log(item.property);
        return null;
      });
    `,
    // Using useContext - not component props
    dedent`
      import { useContext } from 'react'
      const App = (props) => {
        const {foo} = useContext(aContext)
        return <div>{foo}</div>
      }
    `,
    // Destructuring with nested props
    dedent`
      const App = ({ title, description, meta }) => {
        return (
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
            <span>{meta.tags.join(', ')}</span>
          </div>
        )
      }
    `,
    // Props destructured then nested props accessed - fine since props itself not accessed via .
    dedent`
      const UserProfile = ({ user }) => {
        const { avatar, name, bio } = user
        return (
          <div>
            <img src={avatar} alt={name} />
            <h2>{name}</h2>
            <p>{bio}</p>
          </div>
        )
      }
    `,
    // export default function is skipped (matches pre-removal isExportDefaultDeclaration skip)
    dedent`
      export default function App(props) {
        return <div>{props.foo}</div>
      }
    `,
    // export default arrow function (anonymous, no name)
    dedent`
      export default (context) => ({ foo: context.bar })
    `,
    // second param is context-like — props not member-accessed
    'const App = (props, { color }) => (<div id={id} props={props} color={color} />)',
    // https://github.com/Rel1cx/eslint-react/issues/1488
    dedent`
      const items = [{ property: "value" }];
      items.map((item) => {
        console.log(item.property);
        return null;
      });
    `
  ],
  invalid: [
    {
      code: dedent`
        const App = (props) => {
          return <div id={props.id} className={props.className} />
        }
      `,
      errors: 2
    },
    {
      code: dedent`
        const App = (props) => {
          const { h, i } = hi
          return <div id={props.id} className={props.className} />
        }
      `,
      errors: 2
    },
    {
      code: dedent`
        function App(props) {
          return <div id={props.id} className={props.className} />
        }
      `,
      errors: 2
    },
    {
      code: dedent`
        const App = (props) => {
          const { h, i } = props
          return <div id={props.id} className={props.className} />
        }
      `,
      errors: 2
    },
    {
      code: dedent`
        import { forwardRef } from "react";
        export const App = forwardRef<HTMLDivElement, { day: string }>(
          function App(props, ref) {
            return <div ref={ref}>{props.day}</div>;
          }
        );
      `,
      errors: 1
    },
    {
      code: dedent`
        import { memo } from "react";
        export const App = memo(
          function App(props: { day: string }) {
            return <div>{props.day}</div>;
          }
        );
      `,
      errors: 1
    },
    {
      code: dedent`
        import { memo, forwardRef } from "react";
        export const App = memo(
          forwardRef<HTMLDivElement, { day: string }>(
            function App(props, ref) {
              return <div ref={ref}>{props.day}</div>;
            }
          )
        );
      `,
      errors: 1
    },
    {
      code: dedent`
        const App = (props) => {
          const { h, i } = props
          return (
            <div>
              <span>{props.name}</span>
              <span>{props.age}</span>
              <button onClick={() => console.log(props.id)}>Click</button>
            </div>
          )
        }
      `,
      errors: 3
    },
    {
      code: dedent`
        const NestedComponent = (props) => {
          const data = props.data || {}
          return (
            <div>
              <span>{data?.user?.name}</span>
              <span>{data?.user?.email}</span>
            </div>
          )
        }
      `,
      errors: 1
    }
  ]
});

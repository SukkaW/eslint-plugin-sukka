import { runTest } from '@test/run-test';
import module from '.';

runTest({
  module,
  valid: [
    '<><div /></>',
    '<><span /><span /></>',
    // Fragment with key prop should not be reported
    '<Fragment key={id}><div /></Fragment>',
    '<React.Fragment key={id}><div /></React.Fragment>'
  ],
  invalid: [
    {
      code: '<Fragment><div /></Fragment>',
      output: '<><div /></>',
      errors: [{ messageId: 'preferShorthandFragment' as const }]
    },
    {
      code: '<React.Fragment><div /></React.Fragment>',
      output: '<><div /></>',
      errors: [{ messageId: 'preferShorthandFragment' as const }]
    },
    {
      code: '<Fragment><span /><span /></Fragment>',
      output: '<><span /><span /></>',
      errors: [{ messageId: 'preferShorthandFragment' as const }]
    },
    {
      code: '<React.Fragment><span /><span /></React.Fragment>',
      output: '<><span /><span /></>',
      errors: [{ messageId: 'preferShorthandFragment' as const }]
    }
  ]
});

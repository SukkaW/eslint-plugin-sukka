import module from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module,
  valid: [
    // Already using foxts utilities
    dedent`
      import { isErrorLikeObject } from 'foxts/is-error-like-object';
      isErrorLikeObject(value);
    `,
    dedent`
      import { extractErrorMessage } from 'foxts/extract-error-message';
      extractErrorMessage(error);
    `,
    // Error.isError is fine
    'Error.isError(value)',
    // Non-Error instanceof
    'value instanceof TypeError',
    'value instanceof MyClass',
    // Shadowed Error
    dedent`
      class Error {}
      value instanceof Error;
    `,
    // Non-error variable names
    'String(value)',
    'JSON.stringify(data)',
    'data.toString()',
    'response.message',
    // error.message in deeper access is ok
    'error.message.includes("timeout")',
    // String with non-error-named variable in non-catch context
    'String(result)',
    'JSON.stringify(response)',
    // Non-Error typed variable with error-like name should not be flagged
    dedent`
      interface ApiError { code: number; message: string }
      const errors: ApiError[] = [];
      errors.map((e) => e.message).join('\\n');
    `,
    dedent`
      const error = { data: { errors: [{ message: 'bad' }] } };
      error.data.errors.map((e) => e.message);
    `,
    dedent`
      const err: string = 'something went wrong';
      String(err);
    `,
    // .message on confirmed Error type is fine
    dedent`
      declare const e: TypeError;
      e.message;
    `
  ],
  invalid: [
    // instanceof Error
    {
      code: 'value instanceof Error',
      output: 'isErrorLikeObject(value)',
      errors: [{ messageId: 'preferIsError' }]
    },
    {
      code: 'foo instanceof Error',
      output: 'isErrorLikeObject(foo)',
      errors: [{ messageId: 'preferIsError' }]
    },
    // Object.prototype.toString.call(x) === '[object Error]'
    {
      code: 'Object.prototype.toString.call(x) === \'[object Error]\'',
      output: 'isErrorLikeObject(x)',
      errors: [{ messageId: 'preferIsErrorToString' }]
    },
    {
      code: 'Object.prototype.toString.call(x) !== \'[object Error]\'',
      output: '!isErrorLikeObject(x)',
      errors: [{ messageId: 'preferIsErrorToString' }]
    },
    {
      code: '\'[object Error]\' === Object.prototype.toString.call(x)',
      output: 'isErrorLikeObject(x)',
      errors: [{ messageId: 'preferIsErrorToString' }]
    },
    // String(error) in catch
    {
      code: dedent`
        try {} catch (e) {
          String(e);
        }
      `,
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    // String(error) with error-like name
    {
      code: 'String(err)',
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    {
      code: 'String(error)',
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    // JSON.stringify(error)
    {
      code: 'JSON.stringify(error)',
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    {
      code: dedent`
        try {} catch (ex) {
          JSON.stringify(ex);
        }
      `,
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    // error.toString()
    {
      code: 'error.toString()',
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    {
      code: dedent`
        try {} catch (e) {
          e.toString();
        }
      `,
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    // error.message
    {
      code: 'error.message',
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    {
      code: dedent`
        try {} catch (e) {
          console.log(e.message);
        }
      `,
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    // TypeScript typed Error variable
    {
      code: dedent`
        const v: Error = getError();
        String(v);
      `,
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    },
    // Error subclass should still be caught
    {
      code: dedent`
        class HTTPError extends Error {}
        const e = new HTTPError('fail');
        String(e);
      `,
      errors: [{ messageId: 'preferExtractErrorMessage' }]
    }
  ]
});

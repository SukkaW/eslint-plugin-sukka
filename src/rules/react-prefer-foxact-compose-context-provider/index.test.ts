import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    dedent`
      // 3 times
      function App({ children }) {
        return (
          <AuthProvider>
            <ThemeProvider>
              <RouteProvider>{children}</RouteProvider>
            </ThemeProvider>
          </AuthProvider>
        );
      }
    `,
    dedent`
      // break by layout
      function App({ children }) {
        return (
          <AuthProvider>
            <Layout>
              <ThemeProvider>
                <RouteProvider>{children}</RouteProvider>
              </ThemeProvider>
            </Layout>
          </AuthProvider>
        );
      }
    `,
    dedent`
      // 3 times
      function App({ children }) {
        return (
          <StoreContext.Provider>
            <InnerProvider>
              <ThemeProvider>{children}</ThemeProvider>
            </InnerProvider>
          </StoreContext.Provider>
        );
      }
    `,
    // chain broken by a fragment
    dedent`
      function App({ children }) {
        return (
          <AuthProvider>
            <ThemeProvider>
              <>
                <RequestConfig>
                  <SidebarState>{children}</SidebarState>
                </RequestConfig>
              </>
            </ThemeProvider>
          </AuthProvider>
        );
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function App({ children }) {
          return (
            <AuthProvider>
              <ThemeProvider>
                <RequestConfig>
                  <SidebarState>{children}</SidebarState>
                </RequestConfig>
              </ThemeProvider>
            </AuthProvider>
          );
        }
      `,
      errors: [{ messageId: 'default' }]
    },
    {
      code: dedent`
        function App({ children }) {
          return (
            <StoreContext.Provider>
              <AuthProvider>
                <ThemeProvider>
                  <SidebarState>{children}</SidebarState>
                </ThemeProvider>
              </AuthProvider>
            </StoreContext.Provider>
          );
        }
      `,
      errors: [{ messageId: 'default' }]
    }
  ]
}, {}, false);

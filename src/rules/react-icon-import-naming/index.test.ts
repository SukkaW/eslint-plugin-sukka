import mod from '.';
import { runTest } from '@test/run-test';
import { dedent } from 'ts-dedent';

runTest({
  module: mod,
  valid: [
    'import { GlobeIcon, SearchIcon } from \'lucide-react\';',
    // Non-icon exports
    'import { Icon, LucideProvider, createLucideIcon, icons, useLucideContext } from \'lucide-react\';',
    'import { IconNode, LucideIcon, LucideIconData, LucideIconNode, LucideProps, SVGAttributes } from \'lucide-react\';',
    // Type-only imports
    'import type { Globe } from \'lucide-react\';',
    'import { type Globe } from \'lucide-react\';',
    // Not an icon library
    'import { Globe } from \'some-other-library\';',
    // Namespace and re-exports are left alone
    'import * as Icons from \'lucide-react\';',
    'export { Globe } from \'lucide-react\';'
  ],
  invalid: [
    {
      code: dedent`
        import { Globe } from 'lucide-react';
        const a = <Globe className="size-4" />;
      `,
      output: dedent`
        import { GlobeIcon } from 'lucide-react';
        const a = <GlobeIcon className="size-4" />;
      `,
      errors: [{ messageId: 'default', data: { name: 'Globe', preferred: 'GlobeIcon', source: 'lucide-react' } }]
    },
    // `Lucide` prefixed
    {
      code: dedent`
        import { LucideGlobe } from 'lucide-react';
        const a = <LucideGlobe />;
      `,
      output: dedent`
        import { GlobeIcon } from 'lucide-react';
        const a = <GlobeIcon />;
      `,
      errors: [{ messageId: 'default', data: { name: 'LucideGlobe', preferred: 'GlobeIcon', source: 'lucide-react' } }]
    },
    // Closing tag
    {
      code: dedent`
        import { Globe } from 'lucide-react';
        const a = <Globe></Globe>;
      `,
      output: dedent`
        import { GlobeIcon } from 'lucide-react';
        const a = <GlobeIcon></GlobeIcon>;
      `,
      errors: 1
    },
    // Multiple specifiers
    {
      code: dedent`
        import { type LucideProps, Globe, HomeIcon, Search } from 'lucide-react';
        const a = <><Globe /><HomeIcon /><Search /></>;
      `,
      output: [
        dedent`
          import { type LucideProps, GlobeIcon, HomeIcon, Search } from 'lucide-react';
          const a = <><GlobeIcon /><HomeIcon /><Search /></>;
        `,
        dedent`
          import { type LucideProps, GlobeIcon, HomeIcon, SearchIcon } from 'lucide-react';
          const a = <><GlobeIcon /><HomeIcon /><SearchIcon /></>;
        `
      ],
      errors: 2
    },
    // Unused
    {
      code: 'import { Globe } from \'lucide-react\';',
      output: 'import { GlobeIcon } from \'lucide-react\';',
      errors: 1
    },
    // Non-JSX references
    {
      code: dedent`
        import { Globe } from 'lucide-react';
        const icons = { Globe, earth: Globe };
        type Props = React.ComponentProps<typeof Globe>;
        export default Globe;
      `,
      output: dedent`
        import { GlobeIcon } from 'lucide-react';
        const icons = { Globe: GlobeIcon, earth: GlobeIcon };
        type Props = React.ComponentProps<typeof GlobeIcon>;
        export default GlobeIcon;
      `,
      errors: 1
    },
    // Export names stay the same
    {
      code: dedent`
        import { Globe, Search } from 'lucide-react';
        export { Globe, Search as Find };
      `,
      output: [
        dedent`
          import { GlobeIcon, Search } from 'lucide-react';
          export { GlobeIcon as Globe, Search as Find };
        `,
        dedent`
          import { GlobeIcon, SearchIcon } from 'lucide-react';
          export { GlobeIcon as Globe, SearchIcon as Find };
        `
      ],
      errors: 2
    },
    // A shadowing binding with the old name is left alone
    {
      code: dedent`
        import { Globe } from 'lucide-react';
        function render(Globe) {
          return <Globe />;
        }
        const a = <Globe />;
      `,
      output: dedent`
        import { GlobeIcon } from 'lucide-react';
        function render(Globe) {
          return <Globe />;
        }
        const a = <GlobeIcon />;
      `,
      errors: 1
    },
    // Aliased: only the imported name changes
    {
      code: dedent`
        import { Globe as Earth, 'Search' as Find } from 'lucide-react';
        const a = <Earth />;
      `,
      output: dedent`
        import { GlobeIcon as Earth, SearchIcon as Find } from 'lucide-react';
        const a = <Earth />;
      `,
      errors: 2
    },
    {
      code: 'import { Globe as GlobeIcon, LucideSearch as SearchIcon } from \'lucide-react\';',
      output: 'import { GlobeIcon, SearchIcon } from \'lucide-react\';',
      errors: 2
    },
    // No autofix when the preferred name is taken
    {
      code: 'import { Globe, GlobeIcon } from \'lucide-react\';',
      output: null,
      errors: 1
    },
    {
      code: dedent`
        import { Globe } from 'lucide-react';
        const GlobeIcon = 1;
      `,
      output: null,
      errors: 1
    },
    {
      code: dedent`
        import { Globe } from 'lucide-react';
        function render(GlobeIcon) {
          return <Globe />;
        }
      `,
      output: null,
      errors: 1
    },
    {
      code: dedent`
        import { Globe } from 'lucide-react';
        const a = <Globe />;
        GlobeIcon();
      `,
      output: null,
      errors: 1
    }
  ]
});

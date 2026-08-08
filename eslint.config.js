'use strict';

module.exports = require('eslint-config-sukka')
  .sukka()
  .then((configs) => [
    ...configs,
    {
      name: 'eslint-plugin-sukka/vibe-proof-migration',
      rules: {
        // TODO: drop this override once eslint-config-sukka is decoupled and
        // pulls these rules from eslint-plugin-vibe-proof instead. They moved
        // out of eslint-plugin-sukka, so the config still enabling them under
        // the `sukka/` prefix makes ESLint fail to build its config at all.
        'sukka/ban-eslint-disable': 'off'
      }
    }
  ]);

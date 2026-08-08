import mod from '.';
import { runTest } from '@test/run-test';

runTest({
  module: mod,
  valid: [
    'const x = s.slice(0, s.indexOf("/"));',
    's.split("/").map(x => x);',
    's.split("/").pop();',
    's.split("/").length;',
    's.split(",")[i];',
    's.split(",")[idx];',
    's.split()[0];',
    String.raw`s.split(/\?|#/)[0];`,
    's.split(separator)[0];',
    ['s.split(`$', '{separator}`)[0];'].join(''),
    's.split(",", limit)[0];',
    's.split(",", 0)[0];',
    's.split(",", 1)[1];',
    's.split(",", 2)[2];',
    's.split(",", 1.5)[0];',
    's.split(",", 0x1_0000_0001)[1];',
    's.split(",", 2, extra)[0];',
    's.split(",")[-1];',
    's.split(",")[0xFFFF_FFFF];',
    'arr[0];',
    'fn()[0];',
    'obj.method()[0];'
  ],

  invalid: [
    {
      code: 'const head = s.split("/")[0];',
      output: 'import { split0th } from \'foxts/split-nth\';\nconst head = split0th(s, "/");',
      errors: [
        {
          messageId: 'prefer_split0th',
          line: 1,
          column: 14
        }
      ]
    },
    {
      code: 'const tail = s.split("=")[1];',
      output: 'import { split1st } from \'foxts/split-nth\';\nconst tail = split1st(s, "=");',
      errors: [{ messageId: 'prefer_split1st' }]
    },
    {
      code: 'const third = s.split(",")[2];',
      output: 'import { prefer_splitNth } from \'foxts/split-nth\';\nconst third = prefer_splitNth(s, ",", 2);',
      errors: [{ messageId: 'preferprefer_splitNth' }]
    },
    {
      code: 'const sixth = s.split(".")[5];',
      output: 'import { prefer_splitNth } from \'foxts/split-nth\';\nconst sixth = prefer_splitNth(s, ".", 5);',
      errors: [{ messageId: 'preferprefer_splitNth' }]
    },
    {
      code: 'const secondCharacter = s.split("")[1];',
      output: 'import { prefer_splitNth } from \'foxts/split-nth\';\nconst secondCharacter = prefer_splitNth(s, "", 1);',
      errors: [{ messageId: 'preferprefer_splitNth' }]
    },
    {
      code: 'const firstCharacter = s.split("")[0];',
      output: 'import { prefer_splitNth } from \'foxts/split-nth\';\nconst firstCharacter = prefer_splitNth(s, "", 0);',
      errors: [{ messageId: 'preferprefer_splitNth' }]
    },
    {
      code: 'const tail = s.split("😀")[1];',
      output: 'import { split1st } from \'foxts/split-nth\';\nconst tail = split1st(s, "😀");',
      errors: [{ messageId: 'prefer_split1st' }]
    },
    {
      code: 'const head = url.toLowerCase().split("?")[0];',
      output: 'import { split0th } from \'foxts/split-nth\';\nconst head = split0th(url.toLowerCase(), "?");',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'doStuff(line.split(":")[0]);',
      output: 'import { split0th } from \'foxts/split-nth\';\ndoStuff(split0th(line, ":"));',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const separator = ":"; const head = line.split(separator)[0];',
      output: 'import { split0th } from \'foxts/split-nth\';\nconst separator = ":"; const head = split0th(line, separator);',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const first = 0; const head = line.split(":")[first];',
      output: 'import { split0th } from \'foxts/split-nth\';\nconst first = 0; const head = split0th(line, ":");',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const tail = line["split"](":" + "", 1 + 1)[1];',
      output: 'import { split1st } from \'foxts/split-nth\';\nconst tail = split1st(line, ":" + "");',
      errors: [{ messageId: 'prefer_split1st' }]
    },
    {
      code: 'const head = s.split(",", 1)[0];',
      output: 'import { split0th } from \'foxts/split-nth\';\nconst head = split0th(s, ",");',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const tail = s.split(",", 2)[1];',
      output: 'import { split1st } from \'foxts/split-nth\';\nconst tail = split1st(s, ",");',
      errors: [{ messageId: 'prefer_split1st' }]
    },
    {
      code: 'import { prefer_splitNth } from \'foxts/split-nth\';\nconst head = s.split(":")[0];',
      output: 'import { prefer_splitNth, split0th } from \'foxts/split-nth\';\nconst head = split0th(s, ":");',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'import { split0th } from \'foxts/split-nth\';\nconst head = s.split(":")[0];',
      output: 'import { split0th } from \'foxts/split-nth\';\nconst head = split0th(s, ":");',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'import x from \'x\';\nconst head = s.split(":")[0];',
      output: 'import x from \'x\';\nimport { split0th } from \'foxts/split-nth\';\n\nconst head = split0th(s, ":");',
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const head = a.split(":")[0]; const tail = b.split(":")[1]; const third = c.split(":")[2];',
      output: 'import { split0th, split1st, prefer_splitNth } from \'foxts/split-nth\';\nconst head = split0th(a, ":"); const tail = split1st(b, ":"); const third = prefer_splitNth(c, ":", 2);',
      errors: [
        { messageId: 'prefer_split0th' },
        { messageId: 'prefer_split1st' },
        { messageId: 'preferprefer_splitNth' }
      ]
    },
    {
      code: 'arr.map(x => x?.split(":")[0]);',
      output: null,
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const head = s?.split(":")[0];',
      output: null,
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const head = s.split(/* keep */ ":")[0];',
      output: null,
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const head = s.split(":", Number(1))[0];',
      output: null,
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const head = s.split(":")[Number(0)];',
      output: null,
      errors: [{ messageId: 'prefer_split0th' }]
    },
    {
      code: 'const split0th = () => {}; const head = s.split(":")[0];',
      output: null,
      errors: [{ messageId: 'prefer_split0th' }]
    }
  ]
}, {}, false);

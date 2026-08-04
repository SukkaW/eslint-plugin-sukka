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
      output: 'import { splitFirst } from \'foxts/split-nth\';\nconst head = splitFirst(s, "/");',
      errors: [
        {
          messageId: 'preferSplitFirst',
          line: 1,
          column: 14
        }
      ]
    },
    {
      code: 'const tail = s.split("=")[1];',
      output: 'import { splitSecond } from \'foxts/split-nth\';\nconst tail = splitSecond(s, "=");',
      errors: [{ messageId: 'preferSplitSecond' }]
    },
    {
      code: 'const third = s.split(",")[2];',
      output: 'import { splitNth } from \'foxts/split-nth\';\nconst third = splitNth(s, ",", 2);',
      errors: [{ messageId: 'preferSplitNth' }]
    },
    {
      code: 'const sixth = s.split(".")[5];',
      output: 'import { splitNth } from \'foxts/split-nth\';\nconst sixth = splitNth(s, ".", 5);',
      errors: [{ messageId: 'preferSplitNth' }]
    },
    {
      code: 'const secondCharacter = s.split("")[1];',
      output: 'import { splitNth } from \'foxts/split-nth\';\nconst secondCharacter = splitNth(s, "", 1);',
      errors: [{ messageId: 'preferSplitNth' }]
    },
    {
      code: 'const firstCharacter = s.split("")[0];',
      output: 'import { splitNth } from \'foxts/split-nth\';\nconst firstCharacter = splitNth(s, "", 0);',
      errors: [{ messageId: 'preferSplitNth' }]
    },
    {
      code: 'const tail = s.split("😀")[1];',
      output: 'import { splitSecond } from \'foxts/split-nth\';\nconst tail = splitSecond(s, "😀");',
      errors: [{ messageId: 'preferSplitSecond' }]
    },
    {
      code: 'const head = url.toLowerCase().split("?")[0];',
      output: 'import { splitFirst } from \'foxts/split-nth\';\nconst head = splitFirst(url.toLowerCase(), "?");',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'doStuff(line.split(":")[0]);',
      output: 'import { splitFirst } from \'foxts/split-nth\';\ndoStuff(splitFirst(line, ":"));',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const separator = ":"; const head = line.split(separator)[0];',
      output: 'import { splitFirst } from \'foxts/split-nth\';\nconst separator = ":"; const head = splitFirst(line, separator);',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const first = 0; const head = line.split(":")[first];',
      output: 'import { splitFirst } from \'foxts/split-nth\';\nconst first = 0; const head = splitFirst(line, ":");',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const tail = line["split"](":" + "", 1 + 1)[1];',
      output: 'import { splitSecond } from \'foxts/split-nth\';\nconst tail = splitSecond(line, ":" + "");',
      errors: [{ messageId: 'preferSplitSecond' }]
    },
    {
      code: 'const head = s.split(",", 1)[0];',
      output: 'import { splitFirst } from \'foxts/split-nth\';\nconst head = splitFirst(s, ",");',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const tail = s.split(",", 2)[1];',
      output: 'import { splitSecond } from \'foxts/split-nth\';\nconst tail = splitSecond(s, ",");',
      errors: [{ messageId: 'preferSplitSecond' }]
    },
    {
      code: 'import { splitNth } from \'foxts/split-nth\';\nconst head = s.split(":")[0];',
      output: 'import { splitNth, splitFirst } from \'foxts/split-nth\';\nconst head = splitFirst(s, ":");',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'import { splitFirst } from \'foxts/split-nth\';\nconst head = s.split(":")[0];',
      output: 'import { splitFirst } from \'foxts/split-nth\';\nconst head = splitFirst(s, ":");',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'import x from \'x\';\nconst head = s.split(":")[0];',
      output: 'import x from \'x\';\nimport { splitFirst } from \'foxts/split-nth\';\n\nconst head = splitFirst(s, ":");',
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const head = a.split(":")[0]; const tail = b.split(":")[1]; const third = c.split(":")[2];',
      output: 'import { splitFirst, splitSecond, splitNth } from \'foxts/split-nth\';\nconst head = splitFirst(a, ":"); const tail = splitSecond(b, ":"); const third = splitNth(c, ":", 2);',
      errors: [
        { messageId: 'preferSplitFirst' },
        { messageId: 'preferSplitSecond' },
        { messageId: 'preferSplitNth' }
      ]
    },
    {
      code: 'arr.map(x => x?.split(":")[0]);',
      output: null,
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const head = s?.split(":")[0];',
      output: null,
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const head = s.split(/* keep */ ":")[0];',
      output: null,
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const head = s.split(":", Number(1))[0];',
      output: null,
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const head = s.split(":")[Number(0)];',
      output: null,
      errors: [{ messageId: 'preferSplitFirst' }]
    },
    {
      code: 'const splitFirst = () => {}; const head = s.split(":")[0];',
      output: null,
      errors: [{ messageId: 'preferSplitFirst' }]
    }
  ]
}, {}, false);

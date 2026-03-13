import * as fs from 'node:fs';
import * as path from 'node:path';
import Delta from 'quill-delta';
import { MarkdownToQuill } from '../src/md-to-delta';

interface TestCase {
  name: string;
  expected: Delta['ops'];
  markdown: string;
}

describe('Markdown to Delta', () => {
  const testDir = __dirname;
  const categories = fs.readdirSync(testDir).filter((name) => fs.statSync(path.join(testDir, name)).isDirectory());

  const tests: TestCase[] = [];

  for (const category of categories) {
    const dir = path.join(testDir, category);
    const mdFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));

    for (const mdFile of mdFiles) {
      const base = mdFile.replace('.md', '');
      const jsonPath = path.join(dir, `${base}.json`);

      if (!fs.existsSync(jsonPath)) {
        throw new Error(`Missing expected output file for ${category}/${mdFile}`);
      }

      tests.push({
        name: `${category}/${base}`,
        markdown: fs.readFileSync(path.join(dir, mdFile), 'utf-8'),
        expected: JSON.parse(fs.readFileSync(jsonPath, 'utf-8')),
      });
    }
  }

  for (const t of tests) {
    test(t.name, () => {
      let id = 0;
      const converter = new MarkdownToQuill({
        tableIdGenerator: () => String(++id),
      });
      const result = converter.convert(t.markdown);
      const expected = new Delta();
      for (const op of t.expected) {
        expected.push(op);
      }
      expect(result.ops).toEqual(expected.ops);
    });
  }
});

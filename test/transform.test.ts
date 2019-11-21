import * as fs from 'fs';
import * as path from 'path';
import Op from 'quill-delta/dist/Op';
import Delta from 'quill-delta';
import { MarkdownToQuill } from '../src/mdToDelta';
interface Test {
  name: string;
  ops: Op[];
  markdown: string;
}

describe('Remark-Delta Transformer', () => {
  const isDirectory = (name: string) => fs.lstatSync(name).isDirectory();

  const folderPath: string = __dirname;
  const directories = fs
    .readdirSync(folderPath)
    .map((fileName: string) => path.join(folderPath, fileName))
    .filter((fileName: string) => isDirectory(fileName));

  const tests: Test[] = [];

  for (const directory of directories) {
    const files = fs.readdirSync(directory);
    while (files.length !== 0) {
      const file = files[0];
      files.splice(0, 1);

      const baseFileName = file.replace('.md', '').replace('.json', '');
      let matchingFileName: string;
      if (file.endsWith('.md')) {
        matchingFileName = `${baseFileName}.json`;
      } else if (file.endsWith('.json')) {
        matchingFileName = `${baseFileName}.md`;
      } else {
        throw Error(
          `Illegal file: ${file}. Allowed file extensions are .md and .json`
        );
      }

      const matchingFileIdx = files.findIndex(f => f === matchingFileName);
      if (matchingFileIdx === -1) {
        throw Error(`No matching file found for ${file}`);
      }
      files.splice(matchingFileIdx, 1);

      const jsonFilePath = path.join(directory, `${baseFileName}.json`);
      const markdownFilePath = path.join(directory, `${baseFileName}.md`);

      tests.push({
        name: `${path.basename(directory)}/${baseFileName}`,
        ops: JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8')),
        markdown: fs.readFileSync(markdownFilePath, 'utf-8')
      });
    }
  }

  for (const t of tests) {
    test(`Markdown to Delta: ${t.name}`, () => {
      const debug = t.name === '';
      const converter = new MarkdownToQuill(t.markdown, {
        debug
      });
      const ops = converter.convert();
      const delta = new Delta();
      t.ops.forEach(op => delta.push(op));
      const expectOps = delta.ops;
      // const diff = delta.diff(new Delta(ops));
      if (debug) {
        console.log(`debug: ${t.name}`, '\n\n', ops, '\n\n', expectOps);
      }
      expect(ops).toEqual(expectOps);
    });
  }
});

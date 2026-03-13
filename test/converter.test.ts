import Delta from 'quill-delta';
import { MarkdownToQuill } from '../src/mdToDelta';

describe('MarkdownToQuill', () => {
  test('empty input produces no ops', () => {
    const converter = new MarkdownToQuill();
    expect(converter.convert('').ops).toEqual([]);
  });

  test('whitespace-only input produces no ops', () => {
    const converter = new MarkdownToQuill();
    expect(converter.convert('   \n\n  ').ops).toEqual([]);
  });

  test('convert returns a Delta instance', () => {
    const converter = new MarkdownToQuill();
    const result = converter.convert('hello');
    expect(result).toBeInstanceOf(Delta);
  });

  test('custom block handler via withBlock', () => {
    const converter = new MarkdownToQuill().withBlock('paragraph', (ctx, child) => {
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      delta.insert('\n', { custom: true });
      return delta;
    });
    const result = converter.convert('hello');
    const lastOp = result.ops[result.ops.length - 1];
    expect(lastOp).toEqual({ insert: '\n', attributes: { custom: true } });
  });
});

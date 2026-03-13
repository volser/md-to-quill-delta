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

  test('custom inline handler via withInline', () => {
    const converter = new MarkdownToQuill().withInline('strong', (ctx, child) => {
      return ctx.converter.inlineFormat(ctx.node, child, ctx.op, { bold: true, color: 'red' });
    });
    const result = converter.convert('**hello**');
    expect(result.ops[0]).toEqual({ insert: 'hello', attributes: { bold: true, color: 'red' } });
  });

  test('withBlock does not mutate the original converter', () => {
    const original = new MarkdownToQuill();
    const modified = original.withBlock('paragraph', (ctx, child) => {
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      delta.insert('\n', { custom: true });
      return delta;
    });
    const originalResult = original.convert('hello');
    const modifiedResult = modified.convert('hello');
    expect(originalResult.ops).not.toEqual(modifiedResult.ops);
    expect(originalResult.ops).toEqual([{ insert: 'hello\n' }]);
  });

  test('withInline does not mutate the original converter', () => {
    const original = new MarkdownToQuill();
    const modified = original.withInline('strong', (ctx, child) => {
      return ctx.converter.inlineFormat(ctx.node, child, ctx.op, { bold: true, color: 'red' });
    });
    const originalResult = original.convert('**hello**');
    const modifiedResult = modified.convert('**hello**');
    expect(originalResult.ops).not.toEqual(modifiedResult.ops);
    expect(originalResult.ops[0]).toEqual({ insert: 'hello', attributes: { bold: true } });
  });

  test('handler error includes node type and position context', () => {
    const converter = new MarkdownToQuill().withBlock('paragraph', () => {
      throw new Error('handler bug');
    });
    expect(() => converter.convert('hello')).toThrow(/Failed to convert "paragraph" node/);
  });

  test('handler error preserves original cause', () => {
    const original = new Error('handler bug');
    const converter = new MarkdownToQuill().withBlock('paragraph', () => {
      throw original;
    });
    try {
      converter.convert('hello');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as Error).cause).toBe(original);
    }
  });

  test('code block preserves language', () => {
    const converter = new MarkdownToQuill();
    const result = converter.convert('```javascript\nconst x = 1;\n```');
    const codeOp = result.ops.find((op) => op.attributes?.['code-block']);
    expect(codeOp?.attributes?.['code-block']).toBe('javascript');
  });

  test('code block without language uses true', () => {
    const converter = new MarkdownToQuill();
    const result = converter.convert('```\nconst x = 1;\n```');
    const codeOp = result.ops.find((op) => op.attributes?.['code-block']);
    expect(codeOp?.attributes?.['code-block']).toBe(true);
  });

  test('image produces embed with alt attribute', () => {
    const converter = new MarkdownToQuill();
    const result = converter.convert('![alt text](https://example.com/img.png)');
    const imageOp = result.ops.find((op) => typeof op.insert === 'object' && op.insert !== null && 'image' in op.insert);
    expect(imageOp).toBeDefined();
    expect((imageOp?.insert as Record<string, unknown>).image).toBe('https://example.com/img.png');
    expect(imageOp?.attributes?.alt).toBe('alt text');
  });

  test('image without alt omits alt attribute', () => {
    const converter = new MarkdownToQuill();
    const result = converter.convert('![](https://example.com/img.png)');
    const imageOp = result.ops.find((op) => typeof op.insert === 'object' && op.insert !== null && 'image' in op.insert);
    expect(imageOp).toBeDefined();
    expect(imageOp?.attributes?.alt).toBeUndefined();
  });

  test('custom block handler via options constructor', () => {
    const converter = new MarkdownToQuill({
      blockHandlers: {
        paragraph: (ctx, child) => {
          const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
          delta.insert('\n', { custom: true });
          return delta;
        },
      },
    });
    const result = converter.convert('hello');
    const lastOp = result.ops[result.ops.length - 1];
    expect(lastOp).toEqual({ insert: '\n', attributes: { custom: true } });
  });

  test('custom inline handler via options constructor', () => {
    const converter = new MarkdownToQuill({
      inlineHandlers: {
        strong: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { bold: true, color: 'blue' }),
      },
    });
    const result = converter.convert('**hello**');
    expect(result.ops[0]).toEqual({ insert: 'hello', attributes: { bold: true, color: 'blue' } });
  });
});

import type { Link } from 'mdast';
import type { InlineHandler } from '../types';

export function createDefaultInlineHandlers(): Record<string, InlineHandler> {
  return {
    strong: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { bold: true }),
    emphasis: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { italic: true }),
    delete: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { strike: true }),
    inlineCode: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { code: true }),
    link: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { link: (child as Link).url }),
  };
}

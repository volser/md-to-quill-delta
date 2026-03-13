import type { Image, Link } from 'mdast';
import { type InlineHandler, inlineHandler } from '../types';

export function createDefaultInlineHandlers(): Record<string, InlineHandler> {
  return {
    strong: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { bold: true }),
    emphasis: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { italic: true }),
    delete: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { strike: true }),
    inlineCode: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { code: true }),
    link: inlineHandler<Link>((ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { link: child.url })),
    image: inlineHandler<Image>((ctx, child) => {
      return ctx.converter.embedFormat(ctx.op, { image: child.url }, child.alt ? { alt: child.alt } : null);
    }),
  };
}

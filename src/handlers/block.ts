import type { AlignType, List, ListItem, TableCell } from 'mdast';
import Delta from 'quill-delta';
import type { BlockHandler } from '../types';

export function createDefaultBlockHandlers(): Record<string, BlockHandler> {
  return {
    paragraph: (ctx, child) => {
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      if (!ctx.parent) {
        delta.insert('\n');
      }
      return delta;
    },
    code: (_ctx, child) => {
      const delta = new Delta();
      const codeNode = child as { value: string };
      const lines = String(codeNode.value).split('\n');
      for (const line of lines) {
        if (line) {
          delta.push({ insert: line });
        }
        delta.push({ insert: '\n', attributes: { 'code-block': true } });
      }
      return delta;
    },
    list: (ctx, child) => {
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent);
    },
    listItem: (ctx, child) => {
      return ctx.converter.convertListItem(ctx.node as List, child as ListItem, ctx.indent);
    },
    table: (ctx, child) => {
      const tableNode = child as { align?: (AlignType | null)[] | null };
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent, {
        align: tableNode.align?.map((a) => a ?? undefined) ?? undefined,
      });
    },
    tableRow: (ctx, child) => {
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent, {
        ...ctx.extra,
        id: ctx.converter.generateId(),
      });
    },
    tableCell: (ctx, child) => {
      const align = ctx.extra?.align;
      const alignCell = align && Array.isArray(align) && align.length > ctx.idx ? align[ctx.idx] : undefined;
      ctx.converter.log('align', alignCell, align, ctx.idx);
      return ctx.converter.convertTableCell(ctx.node, child as TableCell, ctx.extra?.id ?? '', alignCell);
    },
    heading: (ctx, child) => {
      const headingNode = child as { depth?: number };
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      delta.push({
        insert: '\n',
        attributes: { header: headingNode.depth || 1 },
      });
      return delta;
    },
    blockquote: (ctx, child) => {
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      delta.push({ insert: '\n', attributes: { blockquote: true } });
      return delta;
    },
    thematicBreak: () => {
      const delta = new Delta();
      delta.insert({ divider: true });
      delta.insert('\n');
      return delta;
    },
    image: (ctx, child) => {
      const imgNode = child as { url: string; alt?: string | null };
      return ctx.converter.embedFormat(ctx.op, { image: imgNode.url }, imgNode.alt ? { alt: imgNode.alt } : null);
    },
  };
}

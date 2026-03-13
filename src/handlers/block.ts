import type { AlignType, Code, Heading, List, ListItem, Table, TableCell } from 'mdast';
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
      const node = child as Code;
      const delta = new Delta();
      const lines = node.value.split('\n');
      const codeBlock: string | boolean = node.lang || true;
      for (const line of lines) {
        if (line) {
          delta.push({ insert: line });
        }
        delta.push({ insert: '\n', attributes: { 'code-block': codeBlock } });
      }
      return delta;
    },
    list: (ctx, child) => {
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent);
    },
    listItem: (ctx, child) => {
      const parent = ctx.node as List;
      const node = child as ListItem;
      let delta = new Delta();
      for (const item of node.children) {
        delta = delta.concat(ctx.converter.convertChildren(parent, item, {}, ctx.indent + 1));
        if (item.type !== 'list') {
          let listAttribute: string;
          if (parent.ordered) {
            listAttribute = 'ordered';
          } else if (node.checked) {
            listAttribute = 'checked';
          } else if (node.checked === false) {
            listAttribute = 'unchecked';
          } else {
            listAttribute = 'bullet';
          }
          const attributes: { list: string; indent?: number } = { list: listAttribute };
          if (ctx.indent) {
            attributes.indent = ctx.indent;
          }
          delta.push({ insert: '\n', attributes });
        }
      }
      ctx.converter.log('list item', delta.ops);
      return delta;
    },
    table: (ctx, child) => {
      const node = child as Table;
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent, {
        align: node.align ?? undefined,
      });
    },
    tableRow: (ctx, child) => {
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent, {
        ...ctx.extra,
        id: ctx.converter.generateId(),
      });
    },
    tableCell: (ctx, child) => {
      const node = child as TableCell;
      const align = ctx.extra?.align as (AlignType | null)[] | undefined;
      const alignCell = align && align.length > ctx.idx ? align[ctx.idx] : null;
      const tableId = (ctx.extra?.id as string) ?? '';
      ctx.converter.log('align', alignCell, align, ctx.idx);
      let delta = new Delta();
      delta = delta.concat(ctx.converter.convertChildren(ctx.node, node, {}, 1));
      const attributes: Record<string, unknown> = { table: tableId };
      if (alignCell && alignCell !== 'left') {
        attributes.align = alignCell;
      }
      delta.insert('\n', attributes);
      ctx.converter.log('table cell', delta.ops, alignCell);
      return delta;
    },
    heading: (ctx, child) => {
      const node = child as Heading;
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      delta.push({
        insert: '\n',
        attributes: { header: node.depth },
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
  };
}

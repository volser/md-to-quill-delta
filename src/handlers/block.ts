import type { AlignType, Code, Heading, List, ListItem, Table, TableCell } from 'mdast';
import Delta from 'quill-delta';
import { type BlockHandler, blockHandler } from '../types';

export function createDefaultBlockHandlers(): Record<string, BlockHandler> {
  return {
    paragraph: (ctx, child) => {
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      if (!ctx.parent) {
        delta.insert('\n');
      }
      return delta;
    },
    code: blockHandler<Code>((_ctx, child) => {
      const delta = new Delta();
      const lines = child.value.split('\n');
      const codeBlock: string | boolean = child.lang || true;
      for (const line of lines) {
        if (line) {
          delta.push({ insert: line });
        }
        delta.push({ insert: '\n', attributes: { 'code-block': codeBlock } });
      }
      return delta;
    }),
    list: (ctx, child) => {
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent);
    },
    listItem: blockHandler<ListItem>((ctx, child) => {
      const parent = ctx.node as List;
      let delta = new Delta();
      for (const item of child.children) {
        delta = delta.concat(ctx.converter.convertChildren(parent, item, {}, ctx.indent + 1));
        if (item.type !== 'list') {
          let listAttribute: string;
          if (parent.ordered) {
            listAttribute = 'ordered';
          } else if (child.checked) {
            listAttribute = 'checked';
          } else if (child.checked === false) {
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
    }),
    table: blockHandler<Table>((ctx, child) => {
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent, {
        align: child.align ?? undefined,
      });
    }),
    tableRow: (ctx, child) => {
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent, {
        ...ctx.extra,
        id: ctx.converter.generateId(),
      });
    },
    tableCell: blockHandler<TableCell>((ctx, child) => {
      const align = ctx.extra?.align as (AlignType | null)[] | undefined;
      const alignCell = align && align.length > ctx.idx ? align[ctx.idx] : null;
      const tableId = (ctx.extra?.id as string) ?? '';
      ctx.converter.log('align', alignCell, align, ctx.idx);
      let delta = new Delta();
      delta = delta.concat(ctx.converter.convertChildren(ctx.node, child, {}, 1));
      const attributes: Record<string, unknown> = { table: tableId };
      if (alignCell && alignCell !== 'left') {
        attributes.align = alignCell;
      }
      delta.insert('\n', attributes);
      ctx.converter.log('table cell', delta.ops, alignCell);
      return delta;
    }),
    heading: blockHandler<Heading>((ctx, child) => {
      const delta = ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent + 1);
      delta.push({
        insert: '\n',
        attributes: { header: child.depth },
      });
      return delta;
    }),
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

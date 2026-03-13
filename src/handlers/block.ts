import type { AlignType, Code, Heading, Image, List, ListItem, Parents, Table, TableCell } from 'mdast';
import Delta from 'quill-delta';
import type { BlockHandler, HandlerUtils } from '../types';

function convertListItem(utils: HandlerUtils, parent: List, node: ListItem, indent: number): Delta {
  let delta = new Delta();
  for (const child of node.children) {
    delta = delta.concat(utils.convertChildren(parent, child, {}, indent + 1));
    if (child.type !== 'list') {
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
      if (indent) {
        attributes.indent = indent;
      }
      delta.push({ insert: '\n', attributes });
    }
  }
  utils.log('list item', delta.ops);
  return delta;
}

function convertTableCell(utils: HandlerUtils, parent: Parents, node: TableCell, tableId: string, align: AlignType | undefined): Delta {
  let delta = new Delta();
  delta = delta.concat(utils.convertChildren(parent, node, {}, 1));
  const attributes: Record<string, unknown> = { table: tableId };
  if (align && align !== 'left') {
    attributes.align = align;
  }
  delta.insert('\n', attributes);
  utils.log('table cell', delta.ops, align);
  return delta;
}

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
      return convertListItem(ctx.converter, ctx.node as List, child as ListItem, ctx.indent);
    },
    table: (ctx, child) => {
      const node = child as Table;
      return ctx.converter.convertChildren(ctx.node, child, ctx.op, ctx.indent, {
        align: node.align?.map((a) => a ?? undefined),
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
      const alignCell = align && align.length > ctx.idx ? align[ctx.idx] : undefined;
      ctx.converter.log('align', alignCell, align, ctx.idx);
      return convertTableCell(ctx.converter, ctx.node, child as TableCell, ctx.extra?.id ?? '', alignCell);
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
    image: (ctx, child) => {
      const node = child as Image;
      return ctx.converter.embedFormat(ctx.op, { image: node.url }, node.alt ? { alt: node.alt } : null);
    },
  };
}

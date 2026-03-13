import type { AlignType, List, ListItem, Nodes, Parents, Root, RootContent, TableCell } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import type { Extension as MicromarkExtension } from 'micromark-util-types';
import Delta from 'quill-delta';
import type Op from 'quill-delta/dist/Op';

export type Logger = (message: string, ...args: unknown[]) => void;

export interface ConvertContext {
  parent: Parents | null;
  node: Parents;
  op: Op;
  indent: number;
  extra?: ConvertExtra;
  idx: number;
  converter: MarkdownToQuill;
}

export type BlockHandler = (ctx: ConvertContext, child: RootContent) => Delta;
export type InlineHandler = (ctx: ConvertContext, child: RootContent) => Delta | null;

export interface MarkdownToQuillOptions {
  logger?: Logger;
  tableIdGenerator: () => string;
  blockHandlers?: Record<string, BlockHandler>;
  inlineHandlers?: Record<string, InlineHandler>;
  mdastExtensions?: object[];
  micromarkExtensions?: MicromarkExtension[];
}

interface ConvertExtra {
  align?: (AlignType | undefined)[];
  id?: string;
}

const defaultOptions: MarkdownToQuillOptions = {
  tableIdGenerator: () => {
    const id = Math.random().toString(36).slice(2, 6);
    return `row-${id}`;
  },
};

function createDefaultBlockHandlers(): Record<string, BlockHandler> {
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

function createDefaultInlineHandlers(): Record<string, InlineHandler> {
  return {
    strong: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { bold: true }),
    emphasis: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { italic: true }),
    delete: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { strike: true }),
    inlineCode: (ctx, child) => ctx.converter.inlineFormat(ctx.node, child, ctx.op, { code: true }),
    link: (ctx, child) =>
      ctx.converter.inlineFormat(ctx.node, child, ctx.op, {
        link: (child as { url: string }).url,
      }),
  };
}

export class MarkdownToQuill {
  private readonly options: MarkdownToQuillOptions;
  readonly log: Logger;
  private readonly blocks = new Set(['paragraph', 'code', 'heading', 'blockquote', 'list', 'table']);
  private readonly blockHandlers: Map<string, BlockHandler>;
  private readonly inlineHandlers: Map<string, InlineHandler>;

  constructor(options?: Partial<MarkdownToQuillOptions>) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
    this.log = this.options.logger ?? (() => {});

    this.blockHandlers = new Map(Object.entries(createDefaultBlockHandlers()));
    this.inlineHandlers = new Map(Object.entries(createDefaultInlineHandlers()));

    if (options?.blockHandlers) {
      for (const [type, handler] of Object.entries(options.blockHandlers)) {
        this.blockHandlers.set(type, handler);
      }
    }
    if (options?.inlineHandlers) {
      for (const [type, handler] of Object.entries(options.inlineHandlers)) {
        this.inlineHandlers.set(type, handler);
      }
    }
  }

  convert(text: string): Op[] {
    const tree: Root = fromMarkdown(text, {
      extensions: [gfmStrikethrough(), gfmTable(), gfmTaskListItem(), ...(this.options.micromarkExtensions ?? [])],
      mdastExtensions: [
        gfmStrikethroughFromMarkdown(),
        gfmTableFromMarkdown(),
        gfmTaskListItemFromMarkdown(),
        ...(this.options.mdastExtensions ?? []),
      ],
    }) as Root;

    this.log('tree', tree);
    const delta = this.convertChildren(null, tree, {});
    return delta.ops;
  }

  convertChildren(parent: Parents | null, node: Nodes, op: Op = {}, indent = 0, extra?: ConvertExtra): Delta {
    if (!('children' in node)) return new Delta();

    const parentNode = node as Parents;
    let delta = new Delta();
    this.log('children:', parentNode.children, extra);
    let prevType: string | undefined;
    parentNode.children.forEach((child: RootContent, idx: number) => {
      if (prevType && this.isBlock(child.type) && this.isBlock(prevType)) {
        delta.insert('\n');
      }

      const ctx: ConvertContext = {
        parent,
        node: parentNode,
        op,
        indent,
        extra,
        idx,
        converter: this,
      };
      const blockHandler = this.blockHandlers.get(child.type);

      if (blockHandler) {
        delta = delta.concat(blockHandler(ctx, child));
      } else {
        const inlineHandler = this.inlineHandlers.get(child.type);
        if (inlineHandler) {
          const d = inlineHandler(ctx, child);
          if (d) {
            delta = delta.concat(d);
          }
        } else {
          const d = this.inlineFormat(parentNode, child, op, {});
          if (d) {
            delta = delta.concat(d);
          }
        }
      }

      prevType = child.type;
    });
    return delta;
  }

  generateId(): string {
    return this.options.tableIdGenerator();
  }

  private isBlock(type: string): boolean {
    return this.blocks.has(type);
  }

  inlineFormat(parent: Parents, node: RootContent, op: Op, attributes: Record<string, unknown>): Delta | null {
    const text = 'value' in node && typeof node.value === 'string' ? node.value : null;
    const newAttributes = { ...op.attributes, ...attributes };
    op = { ...op };
    if (text) {
      op.insert = text;
    }
    if (Object.keys(newAttributes).length) {
      op.attributes = newAttributes;
    }
    return 'children' in node ? this.convertChildren(parent, node as Parents, op) : op.insert ? new Delta().push(op) : null;
  }

  embedFormat(op: Op, value: Record<string, unknown>, attributes?: Record<string, unknown> | null): Delta {
    return new Delta().push({
      insert: value,
      attributes: { ...op.attributes, ...attributes },
    });
  }

  convertListItem(parent: List, node: ListItem, indent = 0): Delta {
    let delta = new Delta();
    for (const child of node.children) {
      delta = delta.concat(this.convertChildren(parent, child, {}, indent + 1));
      if (child.type !== 'list') {
        let listAttribute = '';
        if (parent.ordered) {
          listAttribute = 'ordered';
        } else if (node.checked) {
          listAttribute = 'checked';
        } else if (node.checked === false) {
          listAttribute = 'unchecked';
        } else {
          listAttribute = 'bullet';
        }
        const attributes: { list: string; indent?: number } = {
          list: listAttribute,
        };
        if (indent) {
          attributes.indent = indent;
        }

        delta.push({ insert: '\n', attributes });
      }
    }
    this.log('list item', delta.ops);
    return delta;
  }

  convertTableCell(parent: Parents, node: TableCell, tableId: string, align: AlignType | undefined): Delta {
    let delta = new Delta();
    delta = delta.concat(this.convertChildren(parent, node, {}, 1));
    const attributes: Record<string, unknown> = { table: tableId };
    if (align && align !== 'left') {
      attributes.align = align;
    }
    delta.insert('\n', attributes);
    this.log('table cell', delta.ops, align);
    return delta;
  }
}

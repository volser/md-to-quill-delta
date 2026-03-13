import type { Nodes, Parents, Root, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import Delta from 'quill-delta';
import { createDefaultBlockHandlers } from './handlers/block';
import { createDefaultInlineHandlers } from './handlers/inline';
import type { BlockHandler, ConvertContext, ConvertExtra, HandlerUtils, InlineHandler, Logger, MarkdownToQuillOptions, Op } from './types';

const DEFAULT_BLOCK_TYPES = ['paragraph', 'code', 'heading', 'blockquote', 'list', 'table'];

function createDefaultIdGenerator(): () => string {
  return () => {
    const id = Math.random().toString(36).slice(2, 6);
    return `row-${id}`;
  };
}

export class MarkdownToQuill implements HandlerUtils {
  private readonly options: MarkdownToQuillOptions;
  readonly log: Logger;
  private readonly blockTypes: Set<string>;
  private readonly blockHandlers: Map<string, BlockHandler>;
  private readonly inlineHandlers: Map<string, InlineHandler>;

  constructor(options?: Partial<MarkdownToQuillOptions>) {
    this.options = {
      tableIdGenerator: createDefaultIdGenerator(),
      ...options,
    };
    this.log = this.options.logger ?? (() => {});
    this.blockTypes = new Set(options?.blockTypes ?? DEFAULT_BLOCK_TYPES);

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

  convert(text: string): Delta {
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
    return this.convertChildren(null, tree, {});
  }

  convertChildren(parent: Parents | null, node: Nodes, op: Op = {}, indent = 0, extra?: ConvertExtra): Delta {
    if (!('children' in node)) return new Delta();

    const parentNode = node as Parents;
    let delta = new Delta();
    this.log('children:', parentNode.children, extra);

    const children = parentNode.children as RootContent[];
    let prevType: string | undefined;
    for (let idx = 0; idx < children.length; idx++) {
      const child = children[idx];
      if (prevType && this.isBlock(child.type) && this.isBlock(prevType)) {
        delta.insert('\n');
      }

      const ctx: ConvertContext = { parent, node: parentNode, op, indent, extra, idx, converter: this };
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
    }
    return delta;
  }

  generateId(): string {
    return this.options.tableIdGenerator();
  }

  private isBlock(type: string): boolean {
    return this.blockTypes.has(type);
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

  withBlock(type: string, handler: BlockHandler): MarkdownToQuill {
    return new MarkdownToQuill({
      ...this.options,
      blockHandlers: { ...Object.fromEntries(this.blockHandlers), [type]: handler },
      inlineHandlers: Object.fromEntries(this.inlineHandlers),
    });
  }

  withInline(type: string, handler: InlineHandler): MarkdownToQuill {
    return new MarkdownToQuill({
      ...this.options,
      blockHandlers: Object.fromEntries(this.blockHandlers),
      inlineHandlers: { ...Object.fromEntries(this.inlineHandlers), [type]: handler },
    });
  }
}

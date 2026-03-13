import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import type Delta from 'quill-delta';
import { createDefaultBlockHandlers } from './handlers/block';
import { createDefaultInlineHandlers } from './handlers/inline';
import { TreeWalker } from './tree-walker';
import type { BlockHandler, InlineHandler, Logger, MarkdownToQuillOptions } from './types';

const DEFAULT_BLOCK_TYPES = ['paragraph', 'code', 'heading', 'blockquote', 'list', 'table'];

function defaultIdGenerator(): string {
  const id = Math.random().toString(36).slice(2, 6);
  return `row-${id}`;
}

export class MarkdownToQuill {
  private readonly options: MarkdownToQuillOptions;
  private readonly log: Logger;
  private readonly blockTypes: Set<string>;
  private readonly blockHandlers: Map<string, BlockHandler>;
  private readonly inlineHandlers: Map<string, InlineHandler>;

  constructor(options?: MarkdownToQuillOptions) {
    this.options = options ?? {};
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

    const walker = new TreeWalker(
      this.log,
      this.blockTypes,
      this.blockHandlers,
      this.inlineHandlers,
      this.options.tableIdGenerator ?? defaultIdGenerator,
    );
    return walker.run(tree);
  }
}

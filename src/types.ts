import type { AlignType, Parents, RootContent } from 'mdast';
import type Delta from 'quill-delta';
import type Op from 'quill-delta/dist/Op';
import type { MarkdownToQuill } from './mdToDelta';

export type Logger = (message: string, ...args: unknown[]) => void;

export interface ConvertExtra {
  align?: (AlignType | undefined)[];
  id?: string;
}

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
  /** Top-level block types that get inter-block newlines inserted between them */
  blockTypes?: string[];
  mdastExtensions?: object[];
  micromarkExtensions?: object[];
}

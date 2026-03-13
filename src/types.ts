import type { AlignType, Nodes, Parents, RootContent } from 'mdast';
import type Delta from 'quill-delta';

export type Logger = (message: string, ...args: unknown[]) => void;

export interface Op {
  insert?: string | object;
  delete?: number;
  retain?: number;
  attributes?: Record<string, unknown>;
}

export interface ConvertExtra {
  align?: (AlignType | undefined)[];
  id?: string;
}

export interface HandlerUtils {
  convertChildren(parent: Parents | null, node: Nodes, op?: Op, indent?: number, extra?: ConvertExtra): Delta;
  inlineFormat(parent: Parents, node: RootContent, op: Op, attributes: Record<string, unknown>): Delta | null;
  embedFormat(op: Op, value: Record<string, unknown>, attributes?: Record<string, unknown> | null): Delta;
  generateId(): string;
  log: Logger;
}

export interface ConvertContext {
  parent: Parents | null;
  node: Parents;
  op: Op;
  indent: number;
  extra?: ConvertExtra;
  idx: number;
  converter: HandlerUtils;
}

export type BlockHandler = (ctx: ConvertContext, child: RootContent) => Delta;
export type InlineHandler = (ctx: ConvertContext, child: RootContent) => Delta | null;

export interface MarkdownToQuillOptions {
  logger?: Logger;
  tableIdGenerator: () => string;
  blockHandlers?: Record<string, BlockHandler>;
  inlineHandlers?: Record<string, InlineHandler>;
  blockTypes?: string[];
  mdastExtensions?: object[];
  micromarkExtensions?: object[];
}

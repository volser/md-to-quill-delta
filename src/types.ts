import type { Nodes, Parents, RootContent } from 'mdast';
import type Delta from 'quill-delta';

export type Logger = (message: string, ...args: unknown[]) => void;

export type Op = Delta['ops'][number];

export type ConvertExtra = Record<string, unknown>;

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

export function blockHandler<T extends RootContent>(fn: (ctx: ConvertContext, child: T) => Delta): BlockHandler {
  return fn as BlockHandler;
}

export function inlineHandler<T extends RootContent>(fn: (ctx: ConvertContext, child: T) => Delta | null): InlineHandler {
  return fn as InlineHandler;
}

export interface MarkdownToQuillOptions {
  logger?: Logger;
  tableIdGenerator?: () => string;
  blockHandlers?: Record<string, BlockHandler>;
  inlineHandlers?: Record<string, InlineHandler>;
  blockTypes?: string[];
  mdastExtensions?: object[];
  micromarkExtensions?: object[];
}

import type { Nodes, Parents, Root, RootContent } from 'mdast';
import Delta from 'quill-delta';
import type { BlockHandler, ConvertContext, ConvertExtra, HandlerUtils, InlineHandler, Logger, Op } from './types';

export class TreeWalker implements HandlerUtils {
  readonly log: Logger;
  private readonly blockTypes: Set<string>;
  private readonly blockHandlers: Map<string, BlockHandler>;
  private readonly inlineHandlers: Map<string, InlineHandler>;
  private readonly idGenerator: () => string;

  constructor(
    log: Logger,
    blockTypes: Set<string>,
    blockHandlers: Map<string, BlockHandler>,
    inlineHandlers: Map<string, InlineHandler>,
    idGenerator: () => string,
  ) {
    this.log = log;
    this.blockTypes = blockTypes;
    this.blockHandlers = blockHandlers;
    this.inlineHandlers = inlineHandlers;
    this.idGenerator = idGenerator;
  }

  run(tree: Root): Delta {
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
      if (prevType && this.blockTypes.has(child.type) && this.blockTypes.has(prevType)) {
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

      try {
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
      } catch (error) {
        const pos = child.position?.start;
        const location = pos ? ` at line ${pos.line}, column ${pos.column}` : '';
        throw new Error(`Failed to convert "${child.type}" node${location}`, { cause: error });
      }

      prevType = child.type;
    }
    return delta;
  }

  generateId(): string {
    return this.idGenerator();
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
}

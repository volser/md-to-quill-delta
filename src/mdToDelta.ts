import type { AlignType, List, ListItem, Nodes, Parents, Root, RootContent, TableCell } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import Delta from 'quill-delta';
import type Op from 'quill-delta/dist/Op';

export type Logger = (message: string, ...args: unknown[]) => void;

export interface MarkdownToQuillOptions {
  logger?: Logger;
  tableIdGenerator: () => string;
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

export class MarkdownToQuill {
  private readonly options: MarkdownToQuillOptions;
  private readonly log: Logger;
  private readonly blocks = new Set(['paragraph', 'code', 'heading', 'blockquote', 'list', 'table']);

  constructor(options?: Partial<MarkdownToQuillOptions>) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
    this.log = this.options.logger ?? (() => {});
  }

  convert(text: string): Op[] {
    const tree: Root = fromMarkdown(text, {
      extensions: [gfmStrikethrough(), gfmTable(), gfmTaskListItem()],
      mdastExtensions: [gfmStrikethroughFromMarkdown(), gfmTableFromMarkdown(), gfmTaskListItemFromMarkdown()],
    }) as Root;

    this.log('tree', tree);
    const delta = this.convertChildren(null, tree, {});
    return delta.ops;
  }

  private convertChildren(parent: Parents | null, node: Nodes, op: Op = {}, indent = 0, extra?: ConvertExtra): Delta {
    if (!('children' in node)) return new Delta();

    const parentNode = node as Parents;
    let delta = new Delta();
    this.log('children:', parentNode.children, extra);
    let prevType: string | undefined;
    parentNode.children.forEach((child: RootContent, idx: number) => {
      if (prevType && this.isBlock(child.type) && this.isBlock(prevType)) {
        delta.insert('\n');
      }
      switch (child.type) {
        case 'paragraph':
          delta = delta.concat(this.convertChildren(parentNode, child, op, indent + 1));
          if (!parent) {
            delta.insert('\n');
          }
          break;
        case 'code': {
          const lines = String(child.value).split('\n');
          lines.forEach((line) => {
            if (line) {
              delta.push({ insert: line });
            }
            delta.push({ insert: '\n', attributes: { 'code-block': true } });
          });

          break;
        }
        case 'list':
          delta = delta.concat(this.convertChildren(parentNode, child, op, indent));
          break;
        case 'listItem':
          delta = delta.concat(this.convertListItem(parentNode as List, child, indent));
          break;
        case 'table':
          delta = delta.concat(
            this.convertChildren(parentNode, child, op, indent, {
              align: child.align ?? undefined,
            }),
          );
          break;
        case 'tableRow':
          delta = delta.concat(
            this.convertChildren(parentNode, child, op, indent, {
              ...extra,
              id: this.generateId(),
            }),
          );
          break;
        case 'tableCell': {
          const align = extra?.align;
          const alignCell = align && Array.isArray(align) && align.length > idx ? align[idx] : undefined;
          this.log('align', alignCell, align, idx);
          delta = delta.concat(this.convertTableCell(parentNode, child, extra?.id ?? '', alignCell));
          break;
        }
        case 'heading':
          delta = delta.concat(this.convertChildren(parentNode, child, op, indent + 1));
          delta.push({
            insert: '\n',
            attributes: { header: child.depth || 1 },
          });
          break;
        case 'blockquote':
          delta = delta.concat(this.convertChildren(parentNode, child, op, indent + 1));
          delta.push({ insert: '\n', attributes: { blockquote: true } });
          break;
        case 'thematicBreak':
          delta.insert({ divider: true });
          delta.insert('\n');
          break;
        case 'image':
          delta = delta.concat(this.embedFormat(op, { image: child.url }, child.alt ? { alt: child.alt } : null));
          break;
        default: {
          const d = this.convertInline(parentNode, child, op);
          if (d) {
            delta = delta.concat(d);
          }
        }
      }

      prevType = child.type;
    });
    return delta;
  }

  private generateId() {
    return this.options.tableIdGenerator();
  }

  private isBlock(type: string) {
    return this.blocks.has(type);
  }

  private convertInline(parent: Parents, child: RootContent, op: Op): Delta | null {
    switch (child.type) {
      case 'strong':
        return this.inlineFormat(parent, child, op, { bold: true });
      case 'emphasis':
        return this.inlineFormat(parent, child, op, { italic: true });
      case 'delete':
        return this.inlineFormat(parent, child, op, { strike: true });
      case 'inlineCode':
        return this.inlineFormat(parent, child, op, { code: true });
      case 'link':
        return this.inlineFormat(parent, child, op, { link: child.url });
      default:
        return this.inlineFormat(parent, child, op, {});
    }
  }

  private inlineFormat(parent: Parents, node: RootContent, op: Op, attributes: Record<string, unknown>): Delta | null {
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

  private embedFormat(op: Op, value: Record<string, unknown>, attributes?: Record<string, unknown> | null): Delta {
    return new Delta().push({
      insert: value,
      attributes: { ...op.attributes, ...attributes },
    });
  }

  private convertListItem(parent: List, node: ListItem, indent = 0): Delta {
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

  private convertTableCell(parent: Parents, node: TableCell, tableId: string, align: AlignType | undefined): Delta {
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

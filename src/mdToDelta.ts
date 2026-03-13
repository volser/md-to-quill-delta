import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import Delta from 'quill-delta';
import type Op from 'quill-delta/dist/Op';
import type { Node, Parent } from 'unist';

export type Logger = (message: string, ...args: unknown[]) => void;

export interface MarkdownToQuillOptions {
  logger?: Logger;
  tableIdGenerator: () => string;
}

const defaultOptions: MarkdownToQuillOptions = {
  tableIdGenerator: () => {
    const id = Math.random().toString(36).slice(2, 6);
    return `row-${id}`;
  },
};

export class MarkdownToQuill {
  options: MarkdownToQuillOptions;
  private log: Logger;

  blocks = ['paragraph', 'code', 'heading', 'blockquote', 'list', 'table'];

  constructor(options?: Partial<MarkdownToQuillOptions>) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
    this.log = this.options.logger ?? (() => {});
  }

  convert(text: string): Op[] {
    const tree: Parent = fromMarkdown(text, {
      extensions: [gfmStrikethrough(), gfmTable(), gfmTaskListItem()],
      mdastExtensions: [gfmStrikethroughFromMarkdown(), gfmTableFromMarkdown(), gfmTaskListItemFromMarkdown()],
    }) as Parent;

    this.log('tree', tree);
    const delta = this.convertChildren(null, tree, {});
    return delta.ops;
  }

  private convertChildren(parent: Node | Parent | null, node: Node | Parent, op: Op = {}, indent = 0, extra?: any): Delta {
    const { children } = node as any;
    let delta = new Delta();
    if (children) {
      this.log('children:', children, extra);
      let prevType: string | undefined;
      children.forEach((child: any, idx: number) => {
        if (prevType && this.isBlock(child.type) && this.isBlock(prevType)) {
          delta.insert('\n');
        }
        switch (child.type) {
          case 'paragraph':
            delta = delta.concat(this.convertChildren(node, child, op, indent + 1));
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
            delta = delta.concat(this.convertChildren(node, child, op, indent));
            break;
          case 'listItem':
            delta = delta.concat(this.convertListItem(node, child, indent));
            break;
          case 'table':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent, {
                align: (child as any).align,
              }),
            );
            break;
          case 'tableRow':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent, {
                ...extra,
                id: this.generateId(),
              }),
            );
            break;
          case 'tableCell': {
            const align = extra?.align;
            const alignCell = align && Array.isArray(align) && align.length > idx && align[idx];
            this.log('align', alignCell, align, idx);
            delta = delta.concat(this.convertTableCell(node, child, extra?.id, alignCell));
            break;
          }
          case 'heading':
            delta = delta.concat(this.convertChildren(node, child, op, indent + 1));
            delta.push({
              insert: '\n',
              attributes: { header: child.depth || 1 },
            });
            break;
          case 'blockquote':
            delta = delta.concat(this.convertChildren(node, child, op, indent + 1));
            delta.push({ insert: '\n', attributes: { blockquote: true } });
            break;
          case 'thematicBreak':
            delta.insert({ divider: true });
            delta.insert('\n');
            break;
          case 'image':
            delta = delta.concat(this.embedFormat(child, op, { image: child.url }, child.alt ? { alt: child.alt } : null));
            break;
          default: {
            const d = this.convertInline(node, child, op);
            if (d) {
              delta = delta.concat(d);
            }
          }
        }

        prevType = child.type;
      });
    }
    return delta;
  }

  private generateId() {
    return this.options.tableIdGenerator();
  }

  private isBlock(type: string) {
    return this.blocks.includes(type);
  }

  private convertInline(parent: any, child: any, op: Op): Delta | null {
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

  private inlineFormat(parent: any, node: any, op: Op, attributes: any): Delta | null {
    const text = node.value && typeof node.value === 'string' ? node.value : null;
    const newAttributes = { ...op.attributes, ...attributes };
    op = { ...op };
    if (text) {
      op.insert = text;
    }
    if (Object.keys(newAttributes).length) {
      op.attributes = newAttributes;
    }
    return node.children ? this.convertChildren(parent, node, op) : op.insert ? new Delta().push(op) : null;
  }

  private embedFormat(_node: any, op: Op, value: any, attributes?: any): Delta {
    return new Delta().push({
      insert: value,
      attributes: { ...op.attributes, ...attributes },
    });
  }

  private convertListItem(parent: any, node: any, indent = 0): Delta {
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
        const attributes: { list: string; indent?: number } = { list: listAttribute };
        if (indent) {
          attributes.indent = indent;
        }

        delta.push({ insert: '\n', attributes });
      }
    }
    this.log('list item', delta.ops);
    return delta;
  }

  private convertTableCell(parent: any, node: any, tableId: string, align: string): Delta {
    let delta = new Delta();
    delta = delta.concat(this.convertChildren(parent, node, {}, 1));
    const attributes: any = { table: tableId };
    if (align && align !== 'left') {
      attributes.align = align;
    }
    delta.insert('\n', attributes);
    this.log('table cell', delta.ops, align);
    return delta;
  }
}

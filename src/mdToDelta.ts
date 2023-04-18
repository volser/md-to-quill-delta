import Op from 'quill-delta/dist/Op';
import Delta from 'quill-delta';
import unified from 'unified';
import markdown from 'remark-parse';
import { Parent } from 'unist';

export interface MarkdownToQuillOptions {
  debug?: boolean;
  tableIdGenerator: () => string;
}

const defaultOptions: MarkdownToQuillOptions = {
  debug: false,
  tableIdGenerator: () => {
    const id = Math.random()
      .toString(36)
      .slice(2, 6);
    return `row-${id}`;
  }
};

export class MarkdownToQuill {
  options: MarkdownToQuillOptions;

  blocks = ['paragraph', 'code', 'heading', 'blockquote', 'list', 'table'];

  constructor(options?: Partial<MarkdownToQuillOptions>) {
    this.options = {
      ...defaultOptions,
      ...options
    };
  }

  convert(text: string): Op[] {
    const processor = unified().use(markdown);
    const tree: Parent = processor.parse(text) as Parent;

    if (this.options.debug) {
      console.log('tree', tree);
    }
    const delta = this.convertChildren(null, tree, {});
    return delta.ops;
  }

  private convertChildren(
    parent: Node | Parent,
    node: Node | Parent,
    op: Op = {},
    indent = 0,
    extra?: any
  ): Delta {
    const { children } = node as any;
    let delta = new Delta();
    if (children) {
      if (this.options.debug) {
        console.log('children:', children, extra);
      }
      let prevType;
      children.forEach((child, idx) => {
        if (this.isBlock(child.type) && this.isBlock(prevType)) {
          delta.insert('\n');
        }
        switch (child.type) {
          case 'paragraph':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent + 1)
            );
            if (!parent) {
              delta.insert('\n');
            }
            break;
          case 'code':
            const lines = String(child.value).split('\n');
            lines.forEach(line => {
              if (line) {
                delta.push({ insert: line });
              }
              delta.push({ insert: '\n', attributes: { 'code-block': true } });
            });

            break;
          case 'list':
            delta = delta.concat(this.convertChildren(node, child, op, indent));
            break;
          case 'listItem':
            delta = delta.concat(this.convertListItem(node, child, indent));
            break;
          case 'table':
            // insert table cols
            const firstRow = child.children[0];
            const colNumber = firstRow.children.length;
            const colsInsertStr = new Array(colNumber).fill('\n').join('');
            delta = delta.concat(
              new Delta().insert(colsInsertStr, { 'table-col': { width: 150 } })
            );

            delta = delta.concat(
              this.convertChildren(node, child, op, indent, {
                align: (child as any).align
              })
            );
            break;
          case 'tableRow':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent, {
                ...extra,
                rowId: this.generateId()
              })
            );
            break;
          case 'tableCell':
            const cellIndex = (children.indexOf(child) + 1) + '';
            const align = extra && extra.align;
            const alignCell =
              align && Array.isArray(align) && align.length > idx && align[idx];
            if (this.options.debug) {
              console.log('align', alignCell, align, idx);
            }
            delta = delta.concat(
              this.convertTableCell(node, child, extra && extra.rowId, alignCell, cellIndex)
            );
            break;
          case 'heading':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent + 1)
            );
            delta.push({
              insert: '\n',
              attributes: { header: child.depth || 1 }
            });
            break;
          case 'blockquote':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent + 1)
            );
            delta.push({ insert: '\n', attributes: { blockquote: true } });
            break;
          case 'thematicBreak':
            delta.insert({ divider: true });
            delta.insert('\n');
            break;
          case 'image':
            delta = delta.concat(
              this.embedFormat(
                child,
                op,
                { image: child.url },
                child.alt ? { alt: child.alt } : null
              )
            );
          default:
            const d = this.convertInline(node, child, op);
            if (d) {
              delta = delta.concat(d);
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

  private convertInline(parent: any, child: any, op: Op): Delta {
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
      case 'text':
      default:
        return this.inlineFormat(parent, child, op, {});
    }
  }

  private inlineFormat(parent: any, node: any, op: Op, attributes: any): Delta {
    const text =
      node.value && typeof node.value === 'string' ? node.value : null;
    const newAttributes = { ...op.attributes, ...attributes };
    op = { ...op };
    if (text) {
      op.insert = text;
    }
    if (Object.keys(newAttributes).length) {
      op.attributes = newAttributes;
    }
    return node.children
      ? this.convertChildren(parent, node, op)
      : op.insert
      ? new Delta().push(op)
      : null;
  }

  private embedFormat(node: any, op: Op, value: any, attributes?: any): Delta {
    return new Delta().push({
      insert: value,
      attributes: { ...op.attributes, ...attributes }
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
        const attributes = { list: listAttribute };
        if (indent) {
          attributes['indent'] = indent;
        }

        delta.push({ insert: '\n', attributes });
      }
    }
    if (this.options.debug) {
      console.log('list item', delta.ops);
    }
    return delta;
  }

  private convertTableCell(
    parent: any,
    node: any,
    rowId: string,
    align: string,
    cellId: string
  ): Delta {
    const SYMBOLS_TO_SPLIT = [
      '<br>',
      '<br/>'
    ];
    const attributes: any = {};
    if (align && align !== 'left') {
      attributes.align = align;
    }
    const tableFormats = {
      'cell': `${rowId}-${cellId}`,
      'row': `${rowId}`,
      'colspan': '1',
      'rowspan': '1'
    };

    let delta = new Delta();
    let hasMultiLineInThisCell = false;
    delta = delta.concat(this.convertChildren(parent, node, {}, 1));
    delta = delta.ops.reduce((newDelta: Delta, op: Op) => {
      if (
        typeof op.insert === 'string' &&
        SYMBOLS_TO_SPLIT.some((symbol) => (op.insert as string).includes(symbol))
      ) {
        hasMultiLineInThisCell = true;
        const lines: Array<string> = SYMBOLS_TO_SPLIT.reduce((strs, symbol) => {
          return strs.reduce((lines, str) => lines.concat(str.split(symbol)), []);
        }, [op.insert]);
        lines
          .map((str) => {
            return this.convert(str);
          })
          .forEach(ops => {
            ops.forEach((op) => {
              if ((op.insert as string).endsWith('\n')) {
                if (
                  op.attributes &&
                  op.attributes.list
                ) {
                  newDelta.insert(
                    op.insert,
                    {
                      ...attributes,
                      list: {
                        ...tableFormats,
                        list: op.attributes.list,
                      }
                    }
                  );
                } else {
                  newDelta.insert(
                    op.insert,
                    {
                      ...attributes,
                      'table-cell-line': tableFormats,
                    }
                  );
                }
              } else {
                newDelta.push(op);
              }
            });
          });
      } else {
        newDelta.push(op);
      }
      return newDelta;
    }, new Delta());

    if (!hasMultiLineInThisCell) {
      delta.insert('\n', {
        ...attributes,
        'table-cell-line': tableFormats
      });
    }

    if (this.options.debug) {
      console.log('table cell', delta.ops, align);
    }
    return delta;
  }
}

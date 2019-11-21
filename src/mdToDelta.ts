import Op from 'quill-delta/dist/Op';
import Delta from 'quill-delta';
import unified from 'unified';
import markdown from 'remark-parse';
import { Parent } from 'unist';

function flatten(arr: any[]): any[] {
  return arr.reduce((flat, next) => flat.concat(next), []);
}

type NodeHandler = (node: Parent, nextType: string, parentOp: Op) => Op[];

export class MarkdownToQuill {
  options: { debug?: boolean };

  constructor(private md: string, options?: any) {
    this.options = { ...options };
  }

  convert(): Op[] {
    const processor = unified().use(markdown);
    const tree: Parent = processor.parse(this.md) as Parent;

    if (this.options.debug) {
      console.log('tree', tree);
    }
    const delta = this.parseItems(tree.children as Parent[]);
    return delta.ops;
  }

  private parseItems(items: Parent[], parentOp?: Op): Delta {
    let delta = new Delta();
    for (let idx = 0; idx < items.length; idx++) {
      const child = items[idx];
      const nextType: string =
        idx + 1 < items.length ? items[idx + 1].type : 'lastOne';

      switch (child.type) {
        case 'paragraph':
          delta = delta.concat(this.paragraphVisitor(child));
          delta.insert('\n');

          if (
            nextType === 'paragraph' ||
            nextType === 'code' ||
            nextType === 'heading'
          ) {
            delta.insert('\n');
          }
          break;
        case 'code':
          const lines = String(child.value).split('\n');
          lines.forEach(line => {
            delta.push({ insert: line });
            delta.push({ insert: '\n', attributes: { 'code-block': true } });
          });

          if (nextType === 'paragraph') {
            delta.insert('\n');
          }
          break;
        case 'list':
          delta = delta.concat(this.listVisitor(child));
          if (nextType === 'list') {
            delta.insert('\n');
          }
          break;
        case 'heading':
          delta = delta.concat(this.paragraphVisitor(child));
          delta.push({
            insert: '\n',
            attributes: { header: child.depth || 1 }
          });
          delta.insert('\n');
          break;
        case 'blockquote':
          delta = delta.concat(this.paragraphVisitor(child));
          delta.push({ insert: '\n', attributes: { blockquote: true } });
          break;
        case 'thematicBreak':
          delta.insert({ divider: true });
          delta.insert('\n');
          break;
        default:
          delta.push({
            insert: String(child.value)
          });
          console.log(`Unsupported child type: ${child.type}, ${child.value}`);
      }
    }
    return delta;
  }

  private visitChildren(node: any, op: Op): Op[] {
    const { children } = node;
    const ops = [];
    for (const child of children) {
      const localOps = this.visitNode(child, op);

      if (localOps instanceof Array) {
        flatten(localOps).forEach(op => ops.push(op));
      } else {
        ops.push(localOps);
      }
    }
    return ops;
  }

  private inlineFormat(node: any, op: Op, attributes: any): Op[] | Op {
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
    return node.children ? this.visitChildren(node, op) : op.insert ? op : null;
  }

  private embedFormat(
    node: any,
    op: Op,
    value: any,
    attributes?: any
  ): Op[] | Op {
    return { insert: value, attributes: { ...op.attributes, ...attributes } };
  }

  private visitNode(node: any, op: Op): Op[] | Op {
    switch (node.type) {
      case 'strong':
        return this.inlineFormat(node, op, { bold: true });
      case 'emphasis':
        return this.inlineFormat(node, op, { italic: true });
      case 'delete':
        return this.inlineFormat(node, op, { strike: true });
      case 'inlineCode':
        return this.inlineFormat(node, op, { code: true });
      case 'link':
        return this.inlineFormat(node, op, { link: node.url });
      case 'image':
        return this.embedFormat(
          node,
          op,
          { image: node.url },
          node.alt ? { alt: node.alt } : null
        );
      case 'paragraph':
        return this.visitChildren(node, op);
      case 'text':
      default:
        return this.inlineFormat(node, op, {});
    }
  }

  private paragraphVisitor(node: any, initialOp: Op = {}, indent = 0): Delta {
    let delta = new Delta();
    const { children } = node;
    if (this.options.debug) {
      console.log('children', children);
    }

    const ops = this.visitChildren(node, initialOp);
    ops.forEach(op => delta.push(op));

    // delta = delta.concat(new Delta(this.visitChildren(node, initialOp)));
    return delta;
  }

  private listItemVisitor(listNode: any, node: any, indent = 0): Delta {
    let delta = new Delta();
    for (const child of node.children) {
      if (child.type === 'list') {
        delta = delta.concat(this.listVisitor(child, indent + 1));
      } else {
        delta = delta.concat(this.paragraphVisitor(child));

        let listAttribute = '';
        if (listNode.ordered) {
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

  private listVisitor(node: any, indent = 0): Delta {
    let delta = new Delta();
    node.children.forEach(n => {
      if (n.type === 'listItem') {
        delta = delta.concat(this.listItemVisitor(node, n, indent));
      }
    });
    if (this.options.debug) {
      console.log('list', delta.ops);
    }
    return delta;
  }
}

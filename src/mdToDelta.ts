import Op from 'quill-delta/dist/Op';
import Delta from 'quill-delta';
import unified from 'unified';
import markdown from 'remark-parse';
import { Parent } from 'unist';

function flatten(arr: any[]): any[] {
  return arr.reduce((flat, next) => flat.concat(next), []);
}

type NodeHandler = (node: Parent, nextType: string, attributes: any) => Op[];

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

  private parseItems(items: Parent[]): Delta {
    let delta = new Delta();
    for (let idx = 0; idx < items.length; idx++) {
      const child = items[idx];
      const nextType: string =
        idx + 1 < items.length ? items[idx + 1].type : 'lastOne';

      if (child.type === 'paragraph') {
        delta = delta.concat(this.paragraphVisitor(child));
        delta.insert('\n');

        if (
          nextType === 'paragraph' ||
          nextType === 'code' ||
          nextType === 'heading'
        ) {
          delta.insert('\n');
        }
      } else if (child.type === 'list') {
        delta = delta.concat(this.listVisitor(child));
        if (nextType === 'list') {
          delta.insert('\n');
        }
      } else if (child.type === 'code') {
        const lines = String(child.value).split('\n');
        lines.forEach(line => {
          delta.push({ insert: line });
          delta.push({ insert: '\n', attributes: { 'code-block': true } });
        });

        if (nextType === 'paragraph') {
          delta.insert('\n');
        }
      } else if (child.type === 'heading') {
        delta = delta.concat(this.headingVisitor(child));
        delta.insert('\n');
      } else if (child.type === 'blockquote') {
        delta = delta.concat(this.paragraphVisitor(child));
        delta.push({ insert: '\n', attributes: { blockquote: true } });
      } else if (child.type === 'thematicBreak') {
        delta.insert({ divider: true });
        delta.insert('\n');
      } else {
        delta.push({
          insert: String(child.value)
        });
        console.log(`Unsupported child type: ${child.type}, ${child.value}`);
      }
    }
    return delta;
  }

  private paragraphVisitor(node: any, initialOp: Op = {}, indent = 0): Delta {
    const delta = new Delta();
    const { children } = node;
    if (this.options.debug) {
      console.log('children', children);
    }

    const visitNode = (node: any, op: Op): Op[] | Op => {
      if (node.type === 'text') {
        op = { ...op, insert: node.value };
      } else if (node.type === 'strong') {
        op = { ...op, attributes: { ...op.attributes, bold: true } };
        return visitChildren(node, op);
      } else if (node.type === 'emphasis') {
        op = { ...op, attributes: { ...op.attributes, italic: true } };
        return visitChildren(node, op);
      } else if (node.type === 'delete') {
        op = { ...op, attributes: { ...op.attributes, strike: true } };
        return visitChildren(node, op);
      } else if (node.type === 'image') {
        op = { insert: { image: node.url } };
        if (node.alt) {
          op = { ...op, attributes: { alt: node.alt } };
        }
      } else if (node.type === 'link') {
        const text = visitChildren(node, op);
        op = { ...text, attributes: { ...op.attributes, link: node.url } };
      } else if (node.type === 'inlineCode') {
        op = {
          insert: node.value,
          attributes: { ...op.attributes, code: true }
        };
      } else if (node.type === 'paragraph') {
        return visitChildren(node, op);
      } else {
        if (node.value) {
          op = {
            insert: node.value
          };
        }
        console.log(
          `Unsupported note type in paragraph: ${node.type}, ${node.value}`
        );
      }
      return op;
    };

    const visitChildren = (node: any, op: Op): Op[] => {
      const { children } = node;
      const ops = children.map((child: any) => visitNode(child, op));
      return ops.length === 1 ? ops[0] : ops;
    };

    for (const child of children) {
      const localOps = visitNode(child, initialOp);

      if (localOps instanceof Array) {
        flatten(localOps).forEach(op => delta.push(op));
      } else {
        delta.push(localOps);
      }
    }
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

  private headingVisitor(node: any): Delta {
    const delta = this.paragraphVisitor(node);
    delta.push({ insert: '\n', attributes: { header: node.depth || 1 } });
    return delta;
  }
}

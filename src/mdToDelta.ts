import * as visit from 'unist-util-visit';
import Op from 'quill-delta/dist/Op';
import * as unified from 'unified';
import * as markdown from 'remark-parse';

function flatten(arr: any[]): any[] {
  return arr.reduce((flat, next) => flat.concat(next), []);
}

export class MarkdownToQuill {
  ops: Op[];
  constructor(private md: string) {}

  convert(): Op[] {
    const processor = unified().use(markdown);
    const tree: any = processor.parse(this.md);

    this.ops = [];

    for (let idx = 0; idx < tree.children.length; idx++) {
      const child = tree.children[idx];
      const nextType: string =
        idx + 1 < tree.children.length
          ? tree.children[idx + 1].type
          : 'lastOne';

      if (child.type === 'paragraph') {
        this.paragraphVisitor(child);

        if (
          nextType === 'paragraph' ||
          nextType === 'code' ||
          nextType === 'heading'
        ) {
          this.addNewline();
          this.addNewline();
        } else if (nextType === 'lastOne' || nextType === 'list') {
          this.addNewline();
        }
      } else if (child.type === 'list') {
        this.listVisitor(child);
        if (nextType === 'list') {
          this.addNewline();
        }
      } else if (child.type === 'code') {
        this.ops.push({ insert: child.value });
        this.ops.push({ insert: '\n', attributes: { 'code-block': true } });

        if (nextType === 'paragraph' || nextType === 'lastOne') {
          this.addNewline();
        }
      } else if (child.type === 'heading') {
        this.headingVisitor(child);
        this.addNewline();
      } else {
        throw new Error(`Unsupported child type: ${child.type}`);
      }
    }

    return this.ops;
  }

  private addNewline() {
    this.ops.push({ insert: '\n' });
  }

  private paragraphVisitor(node: any, initialOp: Op = {}) {
    const { children } = node;

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
          attributes: { ...op.attributes, font: 'monospace' }
        };
      } else {
        throw new Error(`Unsupported note type in paragraph: ${node.type}`);
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
        flatten(localOps).forEach(op => this.ops.push(op));
      } else {
        this.ops.push(localOps);
      }
    }
  }

  private listItemVisitor(listNode: any, node: any) {
    for (const child of node.children) {
      visit(child, 'paragraph', n => this.paragraphVisitor(n));

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
      this.ops.push({ insert: '\n', attributes: { list: listAttribute } });
    }
  }

  private listVisitor(node: any) {
    visit(node, 'listItem', n => this.listItemVisitor(node, n));
  }

  private headingVisitor(node: any) {
    const mapSize = (depth: number): string => {
      switch (depth) {
        case 1:
          return 'huge';
        default:
          return 'large';
      }
    };

    const size = mapSize(node.depth);
    this.paragraphVisitor(node, { attributes: { size: size } });
  }
}

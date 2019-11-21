import Op from 'quill-delta/dist/Op';
import Delta from 'quill-delta';
import unified from 'unified';
import markdown from 'remark-parse';
import { Parent } from 'unist';

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
    const delta = this.convertChildren(null, tree, {});
    return delta.ops;
  }

  private convertChildren(
    parent: Node | Parent,
    node: Node | Parent,
    op: Op = {},
    indent = 0
  ): Delta {
    const { children } = node as any;
    let delta = new Delta();
    for (let idx = 0; idx < children.length; idx++) {
      const child = children[idx];
      const nextType: string =
        idx + 1 < children.length ? children[idx + 1].type : 'lastOne';

      switch (child.type) {
        case 'paragraph':
          delta = delta.concat(
            this.convertChildren(node, child, op, indent + 1)
          );
          if (!parent) {
            delta.insert('\n');

            if (
              nextType === 'paragraph' ||
              nextType === 'code' ||
              nextType === 'heading'
            ) {
              delta.insert('\n');
            }
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
          delta = delta.concat(this.convertChildren(node, child, op, indent));
          if (nextType === 'list') {
            delta.insert('\n');
          }
          break;
        case 'listItem':
          delta = delta.concat(this.convertListItem(node, child, indent));
          break;
        case 'heading':
          delta = delta.concat(
            this.convertChildren(node, child, op, indent + 1)
          );
          delta.push({
            insert: '\n',
            attributes: { header: child.depth || 1 }
          });
          delta.insert('\n');
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
          return this.embedFormat(
            child,
            op,
            { image: child.url },
            child.alt ? { alt: child.alt } : null
          );

        default:
          const d = this.convertInline(parent, child, op);
          if (d) {
            delta = delta.concat(d);
          }
      }
    }
    return delta;
  }

  private convertInline(parent: any, node: any, op: Op): Delta {
    switch (node.type) {
      case 'strong':
        return this.inlineFormat(parent, node, op, { bold: true });
      case 'emphasis':
        return this.inlineFormat(parent, node, op, { italic: true });
      case 'delete':
        return this.inlineFormat(parent, node, op, { strike: true });
      case 'inlineCode':
        return this.inlineFormat(parent, node, op, { code: true });
      case 'link':
        return this.inlineFormat(parent, node, op, { link: node.url });
      case 'text':
      default:
        return this.inlineFormat(parent, node, op, {});
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
}

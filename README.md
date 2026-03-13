# md-to-quill-delta

[![CI](https://github.com/volser/md-to-quill-delta/actions/workflows/ci.yml/badge.svg)](https://github.com/volser/md-to-quill-delta/actions/workflows/ci.yml)
[![NPM](https://nodei.co/npm/md-to-quill-delta.png)](https://nodei.co/npm/md-to-quill-delta/)

Convert Markdown to [Quill Delta](https://quilljs.com/docs/delta/) format.

Supports standard Markdown and GFM extensions (strikethrough, tables, task lists).

## Installation

```bash
npm install md-to-quill-delta
```

## Usage

```typescript
import { MarkdownToQuill } from 'md-to-quill-delta';

const converter = new MarkdownToQuill();
const delta = converter.convert('# Hello **world**');
// delta is a Quill Delta instance; use delta.ops for the raw ops array
```

### Options

All options are optional.

| Option | Type | Description |
|--------|------|-------------|
| `logger` | `(message: string, ...args: unknown[]) => void` | Debug logging function (silent by default) |
| `tableIdGenerator` | `() => string` | Custom row ID generator for table cells (auto-incremented by default) |
| `blockHandlers` | `Record<string, BlockHandler>` | Custom handlers for block-level nodes (e.g. paragraph, heading, list) |
| `inlineHandlers` | `Record<string, InlineHandler>` | Custom handlers for inline-level nodes (e.g. strong, emphasis, link) |
| `blockTypes` | `string[]` | Override the set of node types treated as block-level |
| `mdastExtensions` | `object[]` | Additional [mdast extensions](https://github.com/syntax-tree/mdast-util-from-markdown#options) |
| `micromarkExtensions` | `object[]` | Additional [micromark extensions](https://github.com/micromark/micromark#options) |

```typescript
const converter = new MarkdownToQuill({
  logger: console.log,
});
```

## Supported Markdown

- Text formatting: **bold**, *italic*, ~~strikethrough~~, `inline code`
- Headings (h1-h6)
- Blockquotes
- Ordered and unordered lists
- Task lists (checkboxes)
- Nested lists
- Code blocks
- Links and images
- Tables (with alignment)
- Thematic breaks / horizontal rules

## License

BSD-3-Clause

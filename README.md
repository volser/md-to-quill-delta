# md-to-quill-delta

[![NPM](https://nodei.co/npm/md-to-quill-delta.png)](https://nodei.co/npm/md-to-quill-delta/)  
[![Build Status](https://travis-ci.org/volser/md-to-quill-delta.svg?branch=master)](https://travis-ci.org/volser/md-to-quill-delta)


## Usage

```typescript
import { MarkdownToQuill } from 'md-to-quill-delta';

const options = { debug: false };
const converter = new MarkdownToQuill(options);
const ops = converter.convert(markdown);
```

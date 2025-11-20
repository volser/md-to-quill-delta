const embedCard = 'embedCard';
const embedCardPrefix = 'embed-card';

const openBracketCharCode = '['.charCodeAt(0); // 91
const closeBracketCharCode = ']'.charCodeAt(0); // 93
const crlfCharCode = -3; // \r\n
const lfCharCode = -4; // \n
const crCharCode = -5; // \r

/**
 * Micromark syntax extension for parsing [embed-card:...] syntax
 */
export function embedCardSyntax() {
  return {
    flow: {
      [openBracketCharCode]: {
        name: embedCard,
        tokenize: tokenizeEmbedCard
      }
    }
  };

  function tokenizeEmbedCard(effects: any, ok: any, nok: any) {
    const prefix = embedCardPrefix;
    let prefixIndex = 0;

    return start;

    function start(code: any) {
      if (code !== openBracketCharCode) {
        return nok(code);
      }
      effects.enter(embedCard);
      effects.consume(code);
      return checkPrefix;
    }

    function checkPrefix(code: any) {
      if (prefixIndex < prefix.length) {
        if (code === prefix.charCodeAt(prefixIndex)) {
          effects.consume(code);
          prefixIndex++;
          return prefixIndex < prefix.length ? checkPrefix : data;
        }
        return nok(code);
      }
      return nok(code);
    }

    function data(code: any) {
      if (code === closeBracketCharCode) {
        effects.consume(code);
        effects.exit(embedCard);
        return ok;
      }

      if (
        code === null ||
        code === crCharCode ||
        code === lfCharCode ||
        code === crlfCharCode
      ) {
        // EOF or line endings
        return nok(code);
      }

      effects.consume(code);
      return data;
    }
  }
}

/**
 * Mdast extension for converting embed-card tokens to custom AST nodes
 */
export function embedCardFromMarkdown() {
  return {
    enter: {
      embedCard: function(this: any, token: any) {
        this.enter(
          {
            type: embedCardPrefix,
            data: {}
          } as any,
          token
        );
      }
    },
    exit: {
      embedCard: function(this: any, token: any) {
        const node = this.stack[this.stack.length - 1];
        const raw = this.sliceSerialize(token);

        // Extract JSON from [embed-card:{...}]
        // Remove '[embed-card:' prefix and ']' suffix
        const jsonStart = embedCardPrefix.length + 2; // +1 for '[' and +1 for ':'
        const jsonStr = raw.substring(jsonStart, raw.length - 1);

        try {
          // Parse the JSON data
          const parsedData = JSON.parse(jsonStr);
          node.data = parsedData;
        } catch (e) {
          // If JSON parsing fails, store raw data
          node.data = { raw: jsonStr };
        }

        this.exit(token);
      }
    }
  };
}

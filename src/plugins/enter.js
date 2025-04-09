import {
  serializeState,
  orderedSelection,
  replaceSelection
} from '../core/shared.js';

const PREFIXES = {
  blockquote: '> ',
  unordered_list_item: '* ',
  ordered_list_item: str => `${parseInt(str) + 1}. `,
  todo_item: '- [ ] ',

  // 添加heading类型
  heading: content => content[0] + content[1] // 返回"###"和空格
};

const EMPTY_LENGTHS = {
  blockquote: 2,
  unordered_list_item: 3,
  ordered_list_item: 4,
  todo_item: 3
};

function getPrefix(block) {
  console.log('getPrefix block', block);
  // 添加对标题类型的处理
  if (block.type === 'heading') {
    return block.content[0] + block.content[1]; // 返回"###"和空格
  }


  if (!Object.keys(PREFIXES).includes(block.type)) return '';

  // No indentation
  if (block.type === 'blockquote') return PREFIXES.blockquote;

  const text = typeof PREFIXES[block.type] === 'function' ?
    PREFIXES[block.type](block.content[1]) :
    PREFIXES[block.type];

  return block.content[0] + text;
}

function shouldRemoveBlock(block) {
  const len = EMPTY_LENGTHS[block.type];
  return block.content.length === len && block.content[len - 1] === ' ';
}

export default function enterPlugin() {
  return {
    handlers: {
      keypress(editor, event) {
        // Enter
        if (event.which !== 13) return;

        event.preventDefault();

        const { firstBlock, firstOffset } = orderedSelection(editor.selection);
        const firstLine = serializeState(editor.state[firstBlock].content);
        const { isCollapsed } = editor.element.getRootNode().getSelection();

        // 标题的特殊处理
        if (editor.state[firstBlock].type === 'heading' && firstOffset < firstLine.length) {
          // 在标题中间按Enter，保持标题内容完整并在下方添加空段落
          const newState = [
            ...editor.state.slice(0, firstBlock),
            editor.state[firstBlock], // 保持当前标题块不变
            editor.parser('').next().value, // 添加空段落
            ...editor.state.slice(firstBlock + 1)
          ];

          editor.update(newState, [firstBlock + 1, 0]); // 将光标放在新段落的开始
          return true;
        }

        // Remove empty block
        if (
          isCollapsed &&
          firstOffset === firstLine.length &&
          Object.keys(PREFIXES).includes(editor.state[firstBlock].type) &&
          shouldRemoveBlock(editor.state[firstBlock])
        ) {
          editor.update([
            ...editor.state.slice(0, firstBlock),
            // Generate block from empty line
            editor.parser('').next().value,
            ...editor.state.slice(firstBlock + 1)
          ], [firstBlock, 0]);

          return true;
        }

        const prefix = event.shiftKey || event.altKey || event.ctrlKey ?
          '' : getPrefix(editor.state[firstBlock]);
        replaceSelection(editor, '\n' + prefix);

        return true;
      }
    }
  };
}

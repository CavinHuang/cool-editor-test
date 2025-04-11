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

// 检查当前光标是否在表格中
function isInTableElement() {
  try {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;

    // 向上查找，检查是否在表格中
    while (node) {
      if (node.nodeType === 1) { // 元素节点
        const element = /** @type {Element} */ (node); // 类型转换
        if (element.tagName === 'TABLE' ||
            element.tagName === 'TD' ||
            element.tagName === 'TH' ||
            element.classList.contains('table')) {
          return true;
        }
      }
      node = node.parentNode;
      if (!node) break;
    }

    return false;
  } catch (e) {
    console.error('检查表格状态时出错:', e);
    return false;
  }
}

// 检查表格插件是否已处理Enter键
function isTableEnterHandled(editor) {
  try {
    // 查找表格插件
    for (const plugin of editor.plugins) {
      if (plugin.name === 'table' && typeof plugin.isTableEnterHandled === 'function') {
        return plugin.isTableEnterHandled();
      }
    }
    return false;
  } catch (e) {
    console.error('检查表格Enter处理状态时出错:', e);
    return false;
  }
}

export default function enterPlugin() {
  // 记录是否已处理过Enter键
  let hasHandledEnter = false;

  return {
    handlers: {
      keypress(editor, event) {
        try {
          // Enter
          if (event.which !== 13) return;

          // 重置标志
          hasHandledEnter = false;

          // 首先检查是否在表格中，并且表格插件已处理Enter键
          if (isInTableElement() || isTableEnterHandled(editor)) {
            console.log('表格中的Enter已被表格插件处理，enterPlugin 跳过处理');
            return false; // 跳过处理
          }

          // 在进行任何处理前，先捕获一些关键信息，用于调试
          try {
            console.log('Enter插件处理Enter键事件');
            console.log('当前编辑器状态长度:', editor.state.length);

            const selection = window.getSelection();
            if (!hasHandledEnter && selection && selection.rangeCount) {
              const range = selection.getRangeAt(0);
              console.log('选区起始偏移量:', range.startOffset);

              // 如果选区在div#editor上，需要特殊处理
              if (range.startContainer.nodeType === 1) {
                const containerElement = /** @type {Element} */ (range.startContainer);
                if (containerElement.nodeName === 'DIV' &&
                    containerElement.id === 'editor') {
                  console.log('选区在编辑器根元素上，偏移量:', range.startOffset);

                  // 特殊情况：光标在编辑器的最末尾（即所有块之后）
                  if (range.startOffset >= editor.element.childNodes.length) {
                    console.log('光标在编辑器最末尾，在所有块之后');

                    // 检查最后一个块是否是表格
                    const lastBlockIndex = editor.state.length - 1;
                    if (lastBlockIndex >= 0 && editor.state[lastBlockIndex].type === 'table') {
                      console.log('编辑器最后一个块是表格，在其后添加空段落');

                      event.preventDefault();
                      hasHandledEnter = true;

                      // 创建新段落
                      const newParagraph = { type: 'paragraph', content: [] };
                      const newState = [
                        ...editor.state,
                        newParagraph
                      ];

                      try {
                        // 更新编辑器状态，光标放在新段落开头
                        editor.update(newState, [lastBlockIndex + 1, 0]);
                        console.log('在编辑器末尾的表格后成功插入空段落');
                      } catch (updateError) {
                        console.error('在编辑器末尾插入段落时出错:', updateError);
                      }

                      return true;
                    }
                  }

                  // 检查是否紧跟在表格后面
                  const editorChildren =
                    Array.from(containerElement.childNodes || []);
                  if (!hasHandledEnter && range.startOffset > 0 &&
                      range.startOffset <= editorChildren.length) {
                    const prevNode = editorChildren[range.startOffset - 1];
                    // 如果前一个节点是表格
                    if (prevNode && prevNode.nodeType === 1) {
                      const element = /** @type {Element} */ (prevNode);
                      if (element.classList && element.classList.contains('table')) {
                        console.log('Enter键在表格之后按下');

                        // 查找表格在状态中的位置
                        let tableIndex = -1;
                        let tableCount = 0;
                        const tables = editor.element.querySelectorAll('.table');
                        const tablePosition = Array.from(tables).indexOf(element);

                        for (let i = 0; i < editor.state.length; i++) {
                          if (editor.state[i] && editor.state[i].type === 'table') {
                            if (tableCount === tablePosition) {
                              tableIndex = i;
                              break;
                            }
                            tableCount++;
                          }
                        }

                        if (tableIndex !== -1) {
                          event.preventDefault();
                          hasHandledEnter = true;

                          // 创建一个新的空段落
                          const newParagraph = { type: 'paragraph', content: [] };
                          const newState = [
                            ...editor.state.slice(0, tableIndex + 1),
                            newParagraph,
                            ...editor.state.slice(tableIndex + 1)
                          ];

                          try {
                            editor.update(newState, [tableIndex + 1, 0]);
                            console.log('在表格后成功插入空段落');
                          } catch (updateError) {
                            console.error('在表格后插入段落时出错:', updateError);
                          }

                          return true;
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Enter键处理前置检查出错:', error);
          }

          // 如果已经处理了Enter键，不再继续
          if (hasHandledEnter) {
            return true;
          }

          // 安全检查：如果 firstBlock 超出范围，使用最后一个块的索引
          const { firstBlock: rawFirstBlock, firstOffset } =
            orderedSelection(editor.selection);
          // 安全处理 firstBlock 值，确保在有效范围内
          const firstBlock = Math.min(rawFirstBlock, editor.state.length - 1);

          if (firstBlock !== rawFirstBlock) {
            console.log('已修正超出范围的 firstBlock:',
              {原始值: rawFirstBlock, 修正值: firstBlock});
          }

          event.preventDefault();
          hasHandledEnter = true;

          // 安全检查：确保状态数组和块存在且有效
          if (!editor.state ||
              !Array.isArray(editor.state) ||
              firstBlock < 0 ||
              !editor.state[firstBlock]) {
            console.error('Enter处理：无效的编辑器状态或块索引 (修正后)', {
              stateLength: editor.state ? editor.state.length : 'state不存在',
              firstBlock
            });

            // 如果仍然无效，但编辑器有内容，则在末尾添加空段落
            if (editor.state && editor.state.length > 0) {
              const newParagraph = { type: 'paragraph', content: [] };
              try {
                editor.update([...editor.state, newParagraph],
                  [editor.state.length, 0]);
                console.log('在编辑器末尾添加了新段落');
              } catch (updateError) {
                console.error('在编辑器末尾添加段落时出错:', updateError);
              }

              return true;
            }

            return false;
          }

          // 安全检查：确保content属性存在
          if (!editor.state[firstBlock].content) {
            console.error('Enter处理：块没有content属性', {
              blockType: editor.state[firstBlock].type,
              block: editor.state[firstBlock]
            });
            return false;
          }

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

            try {
              editor.update(newState, [firstBlock + 1, 0]); // 将光标放在新段落的开始
            } catch (updateError) {
              console.error('处理标题Enter时出错:', updateError);
            }

            return true;
          }

          // Remove empty block
          if (
            isCollapsed &&
            firstOffset === firstLine.length &&
            Object.keys(PREFIXES).includes(editor.state[firstBlock].type) &&
            shouldRemoveBlock(editor.state[firstBlock])
          ) {
            try {
              editor.update([
                ...editor.state.slice(0, firstBlock),
                // Generate block from empty line
                editor.parser('').next().value,
                ...editor.state.slice(firstBlock + 1)
              ], [firstBlock, 0]);
            } catch (updateError) {
              console.error('移除空块时出错:', updateError);
            }

            return true;
          }

          const prefix = event.shiftKey || event.altKey || event.ctrlKey ?
            '' : getPrefix(editor.state[firstBlock]);

          try {
            replaceSelection(editor, '\n' + prefix);
          } catch (updateError) {
            console.error('插入换行时出错:', updateError);
          }

          return true;
        } catch (outerError) {
          console.error('Enter键处理顶层错误:', outerError);
          return false;
        }
      }
    }
  };
}

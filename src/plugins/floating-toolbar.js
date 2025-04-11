// 工具栏单例
let toolbarInstance = null;

// 创建工具栏 DOM 元素
function createToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'cub-floating-toolbar';
  toolbar.style.cssText = `
    position: fixed;
    display: none;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px;
    z-index: 1000;
  `;

  // 添加工具栏按钮
  const buttons = [
    { icon: '🅱️', title: '加粗', action: 'bold' },
    { icon: '𝐼', title: '斜体', action: 'italic' },
    { icon: '𝐃', title: '删除线', action: 'strikethrough' },
    { icon: '𝐔', title: '下划线', action: 'underline' }
  ];

  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = 'cub-toolbar-btn';
    button.innerHTML = btn.icon;
    button.title = btn.title;
    button.dataset.action = btn.action;
    button.style.cssText = `
      border: none;
      background: none;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 14px;
      margin: 0 2px;
      border-radius: 2px;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f0f0f0';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'none';
    });
    toolbar.appendChild(button);
  });

  document.body.appendChild(toolbar);
  return toolbar;
}

// 显示工具栏
function showToolbar(rect) {
  if (!toolbarInstance) return;

  // 获取视口信息
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // 计算工具栏尺寸
  const toolbarHeight = toolbarInstance.offsetHeight;
  const toolbarWidth = toolbarInstance.offsetWidth;
  const spacing = 10; // 工具栏和选区之间的间距

  // 计算选区在视口中的相对位置（因为使用 fixed 定位，所以直接使用 rect 的值）
  const rectTop = rect.top;
  const rectBottom = rect.bottom;
  const rectLeft = rect.left;
  const rectWidth = rect.width;

  // 决定工具栏是显示在选区上方还是下方
  let top;
  if (rectTop > toolbarHeight + spacing) {
    // 如果选区上方有足够空间，显示在上方
    top = rectTop - toolbarHeight - spacing;
  } else if (viewportHeight - rectBottom > toolbarHeight + spacing) {
    // 如果选区下方有足够空间，显示在下方
    top = rectBottom + spacing;
  } else {
    // 如果上下都没有足够空间，显示在选区中间
    top = Math.max(spacing, rectTop - (toolbarHeight / 2));
  }

  // 计算水平位置，确保工具栏不会超出视口
  let left = rectLeft + (rectWidth - toolbarWidth) / 2;

  // 确保工具栏不会超出视口左右边界
  left = Math.max(spacing, Math.min(left, viewportWidth - toolbarWidth - spacing));

  // 应用位置
  toolbarInstance.style.top = `${top}px`;
  toolbarInstance.style.left = `${left}px`;
  toolbarInstance.style.display = 'block';

  // 添加调试信息
  console.log('工具栏位置:', {
    top,
    left,
    rectTop,
    rectBottom,
    viewportHeight,
    viewportWidth,
    toolbarHeight,
    toolbarWidth
  });
}

// 隐藏工具栏
function hideToolbar() {
  if (toolbarInstance) {
    toolbarInstance.style.display = 'none';
  }
}

// 处理工具栏按钮点击
function handleToolbarAction(editor, action) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  if (!selectedText) return;

  // 获取选中文本所在的块级元素
  const startBlock = editor.selection.anchorBlock;
  const startOffset = editor.selection.anchorOffset;
  const endOffset = editor.selection.focusOffset;

  // 获取当前状态
  const currentState = editor.state.slice();
  const block = currentState[startBlock];

  if (!block || !block.content) {
    console.error('无法找到选中的文本块');
    return;
  }

  // 根据不同的操作类型，创建不同的节点结构
  let formattedNode;
  switch (action) {
  case 'bold':
    formattedNode = {
      type: 'strong',
      content: ['**', selectedText, '**']
    };
    break;
  case 'italic':
    formattedNode = {
      type: 'emphasis',
      content: ['_', selectedText, '_']
    };
    break;
  case 'underline':
    formattedNode = {
      type: 'underline',
      content: ['~', selectedText, '~']
    };
    break;
  case 'strikethrough':
    formattedNode = {
      type: 'strikethrough',
      content: ['~~', selectedText, '~~']
    };
    break;
  case 'link': {
    const url = prompt('请输入链接地址：');
    if (url) {
      formattedNode = {
        type: 'link',
        content: [selectedText],
        url: url
      };
    }
    break;
  }
  default:
    return;
  }

  if (!formattedNode) return;

  // 获取块的内容
  const content = Array.isArray(block.content) ? block.content : [block.content];

  // 计算实际的文本位置
  let currentPos = 0;
  let startNode = -1;
  let endNode = -1;
  let startPos = 0;
  let endPos = 0;

  // 获取节点的文本内容
  const getNodeText = (node) => {
    if (typeof node === 'string') return node;
    if (!node) return '';
    if (typeof node.content === 'string') return node.content;
    if (Array.isArray(node.content)) {
      return node.content.map(item => getNodeText(item)).join('');
    }
    return '';
  };

  // 遍历内容找到选中文本的位置
  const contentText = content.map(getNodeText).join('');
  console.log('完整文本:', contentText);
  console.log('选中文本:', selectedText);
  console.log('起始位置:', startOffset);
  console.log('结束位置:', endOffset);

  // 遍历内容找到选中文本的位置
  for (let i = 0; i < content.length; i++) {
    const nodeText = getNodeText(content[i]);
    const length = nodeText.length;

    // 检查是否找到起始位置
    if (startNode === -1 && currentPos + length >= startOffset) {
      startNode = i;
      startPos = startOffset - currentPos;
    }

    // 检查是否找到结束位置
    if (currentPos + length >= endOffset) {
      endNode = i;
      endPos = endOffset - currentPos;
      break;
    }

    currentPos += length;
  }

  console.log('定位结果:', {
    startNode,
    endNode,
    startPos,
    endPos,
    currentPos
  });

  if (startNode === -1 || endNode === -1) {
    console.error('无法定位选中文本的位置');
    return;
  }

  // 构建新的内容
  const newContent = [];

  // 添加选中区域之前的内容
  for (let i = 0; i < startNode; i++) {
    newContent.push(content[i]);
  }

  // 处理选中区域
  const startNodeContent = content[startNode];
  const startNodeText = getNodeText(startNodeContent);

  if (startPos > 0) {
    if (typeof startNodeContent === 'string') {
      newContent.push(startNodeContent.slice(0, startPos));
    } else {
      // 处理复杂节点的前半部分
      const beforeText = startNodeText.slice(0, startPos);
      if (beforeText) {
        newContent.push(beforeText);
      }
    }
  }

  // 添加格式化的节点
  newContent.push(formattedNode);

  // 处理选中区域之后的内容
  if (startNode === endNode) {
    // 如果选中内容在同一个节点内
    const afterText = startNodeText.slice(endPos);
    if (afterText) {
      newContent.push(afterText);
    }
  } else {
    // 如果选中内容跨越多个节点
    const endNodeContent = content[endNode];
    const endNodeText = getNodeText(endNodeContent);
    const afterText = endNodeText.slice(endPos);
    if (afterText) {
      newContent.push(afterText);
    }
  }

  // 添加剩余的内容
  for (let i = endNode + 1; i < content.length; i++) {
    newContent.push(content[i]);
  }

  // 创建新的块状态
  const newBlock = {
    ...block,
    content: newContent
  };

  // 更新编辑器状态
  const newState = [...currentState];
  newState[startBlock] = newBlock;

  console.log('更新前的状态:', block);
  console.log('更新后的状态:', newBlock);

  // 应用更新
  editor.update(newState, {
    anchor: [startBlock, startOffset],
    focus: [startBlock, endOffset]
  });

  // 隐藏工具栏
  hideToolbar();
}

// 导出插件
export default function floatingToolbarPlugin() {
  return {
    name: 'floating-toolbar',

    init(editor) {
      if (!toolbarInstance) {
        toolbarInstance = createToolbar();

        // 添加工具栏按钮点击事件监听
        toolbarInstance.addEventListener('click', (e) => {
          const target = e.target;
          if (target instanceof HTMLElement) {
            const button = target.closest('.cub-toolbar-btn');
            if (button instanceof HTMLElement) {
              const action = button.dataset.action;
              if (action) {
                handleToolbarAction(editor, action);
              }
            }
          }
        });
      }
    },

    handlers: {
      selectionchange(editor) {
        console.log('Selection changed');
        const selection = window.getSelection();
        if (!selection) {
          console.log('No selection found');
          return;
        }

        // 确保编辑器存在且有 element 属性
        if (!editor || !editor.element) {
          console.log('No editor or editor.element found');
          return;
        }

        // 检查选区是否在编辑器内部
        const isInEditor = editor.element.contains(selection.anchorNode) ||
                         editor.element.contains(selection.focusNode);
        console.log('Is selection in editor?', isInEditor);

        const isValidSelection = !selection.isCollapsed && isInEditor;
        console.log('Is valid selection?', isValidSelection);

        if (isValidSelection) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          console.log('Selection rect:', rect);

          // 确保选区有有效的大小
          if (rect.width > 0 && rect.height > 0) {
            console.log('Showing toolbar');
            showToolbar(rect);
          } else {
            console.log('Invalid selection size');
            hideToolbar();
          }
        } else {
          console.log('Hiding toolbar');
          hideToolbar();
        }

        // 返回 true 表示已处理此事件
        return true;
      }
    },

    destroy() {
      if (toolbarInstance) {
        toolbarInstance.remove();
        toolbarInstance = null;
      }
    }
  };
}

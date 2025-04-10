// 表格编辑插件
// 用于增强表格的编辑交互体验

// 优先级插件 - 在defaultPlugin之前拦截表格相关事件
export const priorPlugin = {
  name: 'table-prior',
  handlers: {
    // 拦截表格输入事件
    input() {
      // 首先检查是否在表格内
      console.log('表格预处理插件拦截到输入事件1');
      if (!isInTableCell()) return false;
      console.log('表格预处理插件拦截到输入事件2');
      // 记录表格单元格，用于后续处理
      const cell = getActiveTableCell();
      if (!cell) return false;

      console.log('表格预处理插件拦截到输入事件');

      // 返回true阻止defaultPlugin处理
      return true;
    },

    // 拦截表格中的keydown事件
    keydown(_, event) {
      // 首先检查是否在表格内
      if (!isInTableCell()) return false;

      console.log('表格预处理插件拦截到按键事件', event.key);

      // 只拦截可能导致表格内容变更的键
      if (event.key === 'Enter' ||
          event.key === 'Tab' ||
          event.key === 'Backspace' ||
          event.key === 'Delete') {
        return true;
      }

      return false;
    }
  }
};

// 辅助函数：检查当前选区是否在表格单元格内
function isInTableCell() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    console.log('没有有效的选区');
    return false;
  }

  const range = selection.getRangeAt(0);
  console.log('选区容器类型:', range.commonAncestorContainer.nodeType);
  console.log('选区容器:', range.commonAncestorContainer);

  // 检查是否在表格内，无论层级
  const inTable = isNodeInTable(range.commonAncestorContainer);
  console.log('是否在表格内:', inTable);

  return inTable;
}

// 新增：检查节点是否在表格内
function isNodeInTable(node) {
  if (!node) return false;

  // 如果节点本身是表格相关元素
  if (isTableElement(node)) return true;

  // 向上查找父节点是否为表格元素
  let current = node;
  while (current && current.parentNode) {
    // 如果当前节点是文本节点，获取父元素
    if (current.nodeType === 3) { // Text node
      current = current.parentNode;
      continue;
    }

    if (isTableElement(current)) return true;
    current = current.parentNode;
  }

  return false;
}

// 新增：判断节点是否为表格相关元素
function isTableElement(node) {
  if (!node || node.nodeType !== 1) return false;

  // 确保节点是元素节点
  const element = /** @type {Element} */ (node);
  const tagName = element.tagName && element.tagName.toLowerCase();
  console.log('检查节点:', tagName, element.className);

  // 检查是否是表格或表格内部元素
  return tagName === 'table' ||
         tagName === 'thead' ||
         tagName === 'tbody' ||
         tagName === 'tr' ||
         tagName === 'th' ||
         tagName === 'td' ||
         element.className.includes('table_cell') ||
         element.className.includes('table_header') ||
         element.className.includes('table');
}

// 辅助函数：获取当前激活的表格单元格
function getActiveTableCell() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);

  // 尝试标准方法获取单元格
  const standardCell = findClosestCell(range.commonAncestorContainer);
  if (standardCell) return standardCell;

  // 备用方法：向上查找直到找到TD或TH
  let current = range.commonAncestorContainer;
  while (current && current.parentNode) {
    // 如果当前节点是文本节点，获取父元素
    if (current.nodeType === 3) { // Text node
      current = current.parentNode;
      continue;
    }

    // 确保节点是元素节点
    if (current.nodeType === 1) {
      const element = /** @type {Element} */ (current);
      const tagName = element.tagName && element.tagName.toLowerCase();
      if (tagName === 'td' || tagName === 'th') {
        return element;
      }
    }

    current = current.parentNode;
  }

  return null;
}

// 辅助函数：安全地查找最近的表格单元格
function findClosestCell(node) {
  if (!node) return null;

  try {
    // 如果是元素节点，直接尝试closest
    if (node.nodeType === 1) { // ELEMENT_NODE
      if (typeof node.closest === 'function') {
        // 扩展选择器，尝试多种可能的表格单元格类名和标签
        const cell = node.closest('.table_cell, .table_header, td, th');
        console.log('通过closest查找单元格:', cell);
        return cell;
      }
    }
    // 否则通过父元素查找
    else if (node.parentElement) {
      const cell = node.parentElement.closest('.table_cell, .table_header, td, th');
      console.log('通过父元素查找单元格:', cell);
      return cell;
    }
  } catch (e) {
    console.error('查找表格单元格时出错:', e);
  }

  return null;
}

// 主表格插件
export default function tablePlugin() {
  // 跟踪当前正在编辑的单元格
  let activeCell = null;
  let activeEditor = null;
  let originalContent = '';

  // 移除之前的活动单元格编辑状态
  function clearActiveCell() {
    if (activeCell) {
      activeCell.removeAttribute('contenteditable');
      // 如果内容有变化，更新表格
      if (activeCell.textContent !== originalContent && activeEditor) {
        const table = activeCell.closest('table');
        if (table) {
          const tableIndex = findTableIndexInMarkdown(activeEditor, table);
          updateTableInMarkdown(activeEditor, tableIndex, table);
        }
      }
      activeCell = null;
      activeEditor = null;
      originalContent = '';
    }
  }

  return {
    // 插件名称
    name: 'table',

    // 初始化函数
    init({ editor }) {
      // 向编辑器添加表格控制UI
      editor.element.addEventListener('mouseenter', event => {
        const table = event.target.closest('.table');
        if (!table || table.querySelector('.table_controls')) return;

        // 添加表格控制UI
        const controls = createTableControls(table, editor);
        table.parentNode.insertBefore(controls, table);
      }, true);

      // 添加全局点击事件用于取消表格编辑
      document.addEventListener('click', (event) => {
        if (activeCell && !activeCell.contains(event.target)) {
          clearActiveCell();
        }
      });
    },

    // 处理器 - 与编辑器调用机制兼容的格式
    handlers: {
      // 拦截输入事件
      input(editor) {
        // 检查当前选区是否在表格内
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        const cell = findClosestCell(range.commonAncestorContainer);

        if (!cell) return false;

        console.log('表格单元格输入事件捕获');

        // 我们在表格中 - 获取当前内容
        const currentText = cell.textContent || '';

        // 如果还没有处于编辑模式，启用编辑模式
        if (!activeCell || activeCell !== cell) {
          // 设置新的活动单元格
          if (activeCell) clearActiveCell();

          activeCell = cell;
          activeEditor = editor;
          originalContent = activeCell.textContent || '';

          // 设置为可编辑
          activeCell.setAttribute('contenteditable', 'true');
          activeCell.focus();
        }

        // 更新内容 (直接使用DOM API更新，而不是依赖编辑器的更新机制)
        setTimeout(() => {
          // 如果内容已变化，我们记住新的内容但不立即更新源码
          // 等到失焦时再更新，这样就不会频繁重绘表格
          if (cell.textContent !== currentText) {
            console.log('内容已变化:', cell.textContent);
          }
        }, 0);

        // 返回true表示我们已经处理了事件，编辑器应该跳过其他插件
        return true;
      },

      // 处理所有键盘事件，包括方向键
      keydown(editor, event) {
        // 首先检查选区是否在表格内
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        const cellElement = findClosestCell(range.commonAncestorContainer);

        if (!cellElement) return false;

        console.log('表格单元格键盘事件捕获', event.key);

        // 如果这是当前活动的单元格，处理编辑
        if (!activeCell || activeCell !== cellElement) {
          // 清除之前的活动单元格
          clearActiveCell();

          // 设置新的活动单元格
          activeCell = cellElement;
          activeEditor = editor;
          originalContent = activeCell.textContent || '';

          // 设置为可编辑
          activeCell.setAttribute('contenteditable', 'true');
          try {
            activeCell.focus();
          } catch (e) {
            console.error('无法聚焦单元格:', e);
          }
        }

        // 处理Tab键导航
        if (event.key === 'Tab') {
          event.preventDefault();

          const table = cellElement.closest('table');
          if (!table) return true;

          const row = cellElement.parentElement;
          if (!row) return true;

          const allRows = Array.from(table.querySelectorAll('tr'));
          const rowIndex = allRows.indexOf(row);
          const cellIndex = Array.from(row.children || []).indexOf(cellElement);

          let nextCell = null;

          if (event.shiftKey) {
            // 上一个单元格
            if (cellIndex > 0 && row.children) {
              nextCell = row.children[cellIndex - 1];
            } else if (rowIndex > 0) {
              // 上一行最后一个单元格
              const prevRow = allRows[rowIndex - 1];
              if (prevRow && prevRow.lastElementChild) {
                nextCell = prevRow.lastElementChild;
              }
            }
          } else {
            // 下一个单元格
            if (row.children && cellIndex < row.children.length - 1) {
              nextCell = row.children[cellIndex + 1];
            } else if (rowIndex < allRows.length - 1) {
              // 下一行第一个单元格
              const nextRow = allRows[rowIndex + 1];
              if (nextRow && nextRow.firstElementChild) {
                nextCell = nextRow.firstElementChild;
              }
            }
          }

          if (nextCell) {
            // 更新当前单元格的变更
            const tableIndex = findTableIndexInMarkdown(editor, table);
            updateTableInMarkdown(editor, tableIndex, table);

            // 清除当前活动单元格
            clearActiveCell();

            // 激活新单元格
            activeCell = nextCell;
            activeEditor = editor;
            originalContent = activeCell.textContent || '';
            activeCell.setAttribute('contenteditable', 'true');
            try {
              activeCell.focus();
            } catch (e) {
              console.error('无法聚焦单元格:', e);
            }
          }

          return true;
        }

        // 阻止Enter键换行
        if (event.key === 'Enter') {
          event.preventDefault();

          // 完成编辑
          clearActiveCell();
          return true;
        }

        // 允许其他按键通过，如方向键、删除键等
        return false;
      },

      // 选择变化事件，用于检测选区进入表格
      selectionchange() {
        // 由于这个事件触发频率高，首先检查是否已有活动单元格
        if (activeCell) return false;

        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        const cellElement = findClosestCell(range.commonAncestorContainer);

        if (!cellElement) return false;

        // 捕获到表格单元格，但不立即设置编辑状态
        // 等待用户双击或开始输入
        return false;
      },

      // 双击事件，用于快速进入编辑模式
      dblclick(editor) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        const cellElement = findClosestCell(range.commonAncestorContainer);

        if (!cellElement) return false;

        console.log('双击表格单元格');

        // 清除之前的活动单元格
        clearActiveCell();

        // 设置新的活动单元格
        activeCell = cellElement;
        activeEditor = editor;
        originalContent = activeCell.textContent || '';

        // 设置为可编辑
        activeCell.setAttribute('contenteditable', 'true');
        try {
          activeCell.focus();
        } catch (e) {
          console.error('无法聚焦单元格:', e);
        }

        return true;
      },

      // 处理点击事件，用于检测表格工具栏操作
      click(editor, event) {
        // 查看是否点击的是表格控制按钮
        const button = event.target.closest('.table_controls button');
        if (button) {
          // 已经在按钮的onclick中处理
          return true;
        }

        return false;
      }
    },

    // 命令处理
    commands: {
      // 添加行
      addTableRow(editor, table) {
        const tbody = table.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');
        const lastRow = rows[rows.length - 1];
        const newRow = document.createElement('tr');

        // 复制最后一行的单元格结构
        const cells = lastRow.querySelectorAll('td');
        cells.forEach((cell) => {
          const newCell = document.createElement('td');
          newCell.className = 'table_cell';
          newCell.style.textAlign = cell.style.textAlign;
          newCell.textContent = '';
          newRow.appendChild(newCell);
        });

        tbody.appendChild(newRow);
        const startLine = findTableIndexInMarkdown(editor, table);
        updateTableInMarkdown(editor, startLine, table);

        return newRow;
      },

      // 添加列
      addTableColumn(editor, table) {
        // 添加表头
        const thead = table.querySelector('thead tr');
        const headerCell = document.createElement('th');
        headerCell.className = 'table_header';
        headerCell.textContent = '新列';
        thead.appendChild(headerCell);

        // 为每一行添加单元格
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cell = document.createElement('td');
          cell.className = 'table_cell';
          cell.textContent = '';
          row.appendChild(cell);
        });

        const startLine = findTableIndexInMarkdown(editor, table);
        updateTableInMarkdown(editor, startLine, table);
      },

      // 删除行
      deleteTableRow(editor, table, rowIndex) {
        const tbody = table.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');

        if (rowIndex >= 0 && rowIndex < rows.length) {
          tbody.removeChild(rows[rowIndex]);
          const startLine = findTableIndexInMarkdown(editor, table);
          updateTableInMarkdown(editor, startLine, table);
        }
      },

      // 删除列
      deleteTableColumn(editor, table, colIndex) {
        const thead = table.querySelector('thead tr');
        const headers = thead.querySelectorAll('th');

        if (colIndex >= 0 && colIndex < headers.length) {
          // 删除表头单元格
          thead.removeChild(headers[colIndex]);

          // 删除每行对应列的单元格
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (colIndex < cells.length) {
              row.removeChild(cells[colIndex]);
            }
          });

          const startLine = findTableIndexInMarkdown(editor, table);
          updateTableInMarkdown(editor, startLine, table);
        }
      }
    }
  };
}

// 创建表格控制UI
function createTableControls(table, editor) {
  const controls = document.createElement('div');
  controls.className = 'table_controls';

  // 添加行按钮
  const addRowBtn = document.createElement('button');
  addRowBtn.textContent = '添加行';
  addRowBtn.onclick = () => {
    tablePlugin().commands.addTableRow(editor, table);
  };

  // 添加列按钮
  const addColBtn = document.createElement('button');
  addColBtn.textContent = '添加列';
  addColBtn.onclick = () => {
    tablePlugin().commands.addTableColumn(editor, table);
  };

  // 删除行按钮
  const delRowBtn = document.createElement('button');
  delRowBtn.textContent = '删除行';
  delRowBtn.onclick = () => {
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    if (rows.length <= 1) return; // 保留至少一行

    const rowIndexStr = prompt('请输入要删除的行号 (1-' + rows.length + '):', '1');
    if (rowIndexStr === null) return;

    const index = parseInt(rowIndexStr, 10) - 1;
    if (!isNaN(index) && index >= 0 && index < rows.length) {
      tablePlugin().commands.deleteTableRow(editor, table, index);
    }
  };

  // 删除列按钮
  const delColBtn = document.createElement('button');
  delColBtn.textContent = '删除列';
  delColBtn.onclick = () => {
    const thead = table.querySelector('thead tr');
    const headers = thead.querySelectorAll('th');
    if (headers.length <= 1) return; // 保留至少一列

    const colIndexStr = prompt('请输入要删除的列号 (1-' + headers.length + '):', '1');
    if (colIndexStr === null) return;

    const index = parseInt(colIndexStr, 10) - 1;
    if (!isNaN(index) && index >= 0 && index < headers.length) {
      tablePlugin().commands.deleteTableColumn(editor, table, index);
    }
  };

  controls.appendChild(addRowBtn);
  controls.appendChild(addColBtn);
  controls.appendChild(delRowBtn);
  controls.appendChild(delColBtn);

  return controls;
}

// 查找表格在Markdown中的位置
function findTableIndexInMarkdown(editor, tableElement) {
  // 获取所有表格元素
  const tables = Array.from(editor.element.querySelectorAll('.table'));
  const tableIndex = tables.indexOf(tableElement);

  // 获取Markdown内容
  const content = editor.value;
  const lines = content.split('\n');

  // 查找第tableIndex个表格在源码中的位置
  let tableCount = 0;
  let startLine = -1;

  for (let i = 0; i < lines.length; i++) {
    // 检测表格开始行（以|开头的行，后面跟着分隔行）
    if (i < lines.length - 1 &&
        lines[i].trim().startsWith('|') &&
        /^\s*\|[-:|]+\|/.test(lines[i+1].trim())) {

      if (tableCount === tableIndex) {
        startLine = i;
        break;
      }

      tableCount++;
    }
  }

  return startLine;
}

// 更新表格Markdown源码
function updateTableInMarkdown(editor, startLine, tableElement) {
  if (startLine === -1) {
    console.warn('无法找到表格在Markdown中的位置');
    return;
  }

  if (!tableElement || !tableElement.matches('table')) {
    console.error('传入了无效的表格元素:', tableElement);
    return;
  }

  // 获取当前表格在DOM中的位置
  const allTables = Array.from(editor.element.querySelectorAll('table'));
  const tablePos = allTables.indexOf(tableElement);
  if (tablePos === -1) {
    console.error('在DOM中找不到指定的表格元素');
    return;
  }

  // 找到表格对应的状态节点
  let tableNodeIndex = -1;
  let remainingTables = tablePos;

  // 查找对应表格的节点索引
  editor.state.forEach((node, nodeIndex) => {
    if (node.type === 'table') {
      if (remainingTables === 0) {
        tableNodeIndex = nodeIndex;
      }
      remainingTables--;
    }
  });

  if (tableNodeIndex === -1) {
    console.error('找不到表格对应的状态节点');
    return;
  }

  console.log('找到表格节点索引:', tableNodeIndex);

  // 直接从DOM创建表格节点
  let tableNode = generateTableNodeFromDOM(tableElement);
  if (!tableNode) {
    console.error('无法从DOM生成表格节点');

    // 回退方案：使用Markdown中转
    // 生成新的表格Markdown
    const newTableMarkdown = generateTableMarkdown(tableElement);
    console.log('生成的新表格Markdown:', newTableMarkdown);

    // 解析新的表格标记
    const parsedTableNode = Array.from(editor.parser(newTableMarkdown))
      .find(node => node.type === 'table');

    if (!parsedTableNode) {
      console.error('无法解析新的表格标记');
      return;
    }

    console.log('从Markdown解析的表格节点:', parsedTableNode);
    // 使用Markdown解析的节点
    tableNode = parsedTableNode;
  }

  // 再次检查确保tableNode不为null
  if (!tableNode) {
    console.error('无法生成有效的表格节点');
    return;
  }

  // 确保节点类型正确
  if (tableNode.type !== 'table') {
    console.error('生成的节点类型不是table:', tableNode);
    return;
  }

  // 确认节点结构正确
  if (!tableNode.content || !Array.isArray(tableNode.content)) {
    console.error('表格节点缺少content数组:', tableNode);
    // 尝试修复结构
    if (tableNode.cells && Array.isArray(tableNode.cells)) {
      console.log('尝试从cells修复节点结构');
      // 从cells结构提取内容
      const headers = tableNode.cells[0].map(cell => cell.content);
      const aligns = tableNode.cells[0].map(cell => cell.align || 'left');
      const rows = tableNode.cells.slice(1).map(row =>
        row.map(cell => cell.content)
      );

      tableNode = {
        type: 'table',
        content: [headers, aligns, ...rows]
      };
    }
  }

  console.log('最终表格节点结构:', JSON.stringify(tableNode));

  // 替换状态中的表格节点，而不是整个编辑器内容
  const newState = [...editor.state];
  newState[tableNodeIndex] = tableNode;

  // 更新编辑器状态，保持光标位置不变
  try {
    // 保存滚动位置
    const scrollTop = editor.element.scrollTop;

    // 使用update方法更新单个节点
    editor.update(newState);

    // 恢复滚动位置
    editor.element.scrollTop = scrollTop;

    console.log('表格更新成功');
  } catch (error) {
    console.error('更新表格时出错:', error);

    // 如果直接更新失败，尝试回退到旧方法
    // 获取当前Markdown内容
    const content = editor.getValue();
    const lines = content.split('\n');

    // 找到表格结束行
    let endLine = startLine;
    while (
      endLine < lines.length &&
      lines[endLine].trim().startsWith('|')
    ) {
      endLine++;
    }
    endLine--; // 调整到最后一行表格

    // 替换原表格
    const newLines = [
      ...lines.slice(0, startLine),
      ...generateTableMarkdown(tableElement).split('\n'),
      ...lines.slice(endLine + 1)
    ];

    // 使用setValue更新整个内容
    editor.setValue(newLines.join('\n'));
  }
}

// 直接从DOM表格构建表格节点
function generateTableNodeFromDOM(tableElement) {
  try {
    // 提取表头
    const headerCells = Array.from(tableElement.querySelectorAll('th'))
      .map(th => th.textContent.trim());

    // 提取对齐方式
    const aligns = Array.from(tableElement.querySelectorAll('th'))
      .map(th => {
        const textAlign = th.style.textAlign || '';
        if (textAlign === 'center') return 'center';
        if (textAlign === 'right') return 'right';
        return 'left'; // 默认为左对齐
      });

    // 提取表格行数据
    const rows = Array.from(tableElement.querySelectorAll('tbody tr'))
      .map(tr =>
        Array.from(tr.querySelectorAll('td'))
          .map(td => td.textContent.trim())
      )
      .filter(row => row.some(cell => cell !== '')); // 过滤空行

    // 创建表格节点 - 使用content字段而非cells
    return {
      type: 'table',
      content: [
        headerCells,  // 表头行
        aligns,       // 对齐行
        ...rows       // 数据行
      ]
    };
  } catch (error) {
    console.error('从DOM构建表格节点时出错:', error);
    return null;
  }
}

// 根据DOM表格生成Markdown
function generateTableMarkdown(tableElement) {
  const headers = Array.from(tableElement.querySelectorAll('th')).map(th => th.textContent.trim());
  const aligns = Array.from(tableElement.querySelectorAll('th')).map(th => {
    const textAlign = th.style.textAlign;
    if (textAlign === 'center') return ':---:';
    if (textAlign === 'right') return '---:';
    return '---';
  });

  // 过滤空行 - 只保留至少有一个单元格非空的行
  const rows = Array.from(tableElement.querySelectorAll('tbody tr'))
    .map(tr => {
      return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
    })
    .filter(row => row.some(cell => cell !== ''));

  // 构建Markdown表格文本
  let markdown = `| ${headers.join(' | ')} |\n`;
  markdown += `| ${aligns.join(' | ')} |\n`;

  rows.forEach(row => {
    markdown += `| ${row.join(' | ')} |\n`;
  });

  return markdown.trim();
}

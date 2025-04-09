// 表格编辑插件
// 用于增强表格的编辑交互体验

export default function tablePlugin() {
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
    },

    // 事件处理
    events: {
      // 处理单元格点击事件
      click(event, { editor }) {
        const cell = event.target.closest('.table_cell, .table_header');
        if (!cell) return;

        // 获取单元格当前内容
        const currentContent = cell.innerText;

        // 创建编辑模式
        cell.setAttribute('contenteditable', 'true');
        cell.focus();

        // 记录原始表格位置，用于后续更新
        const table = cell.closest('table');
        const tableIndex = findTableIndexInMarkdown(editor, table);

        // 添加一次性blur事件监听器
        const onBlur = () => {
          cell.removeAttribute('contenteditable');

          // 如果内容发生变化，更新Markdown
          if (cell.innerText !== currentContent) {
            updateTableInMarkdown(editor, tableIndex, table);
          }

          cell.removeEventListener('blur', onBlur);
        };

        cell.addEventListener('blur', onBlur);
      },

      // 处理键盘导航
      keydown(event, { editor }) {
        const cell = event.target.closest('.table_cell, .table_header');
        if (!cell || !cell.hasAttribute('contenteditable')) return;

        if (event.key === 'Tab') {
          event.preventDefault();

          // 找到下一个单元格
          const row = cell.parentElement;
          const cellIndex = Array.from(row.children).indexOf(cell);
          let nextCell;

          if (event.shiftKey) {
            // 上一个单元格
            if (cellIndex > 0) {
              nextCell = row.children[cellIndex - 1];
            } else {
              // 上一行最后一个单元格
              const prevRow = row.previousElementSibling;
              if (prevRow) {
                nextCell = prevRow.lastElementChild;
              }
            }
          } else {
            // 下一个单元格
            if (cellIndex < row.children.length - 1) {
              nextCell = row.children[cellIndex + 1];
            } else {
              // 下一行第一个单元格
              const nextRow = row.nextElementSibling;
              if (nextRow) {
                nextCell = nextRow.firstElementChild;
              }
            }
          }

          if (nextCell) {
            // 把当前单元格的变更应用到Markdown
            const table = cell.closest('table');
            updateTableInMarkdown(editor, findTableIndexInMarkdown(editor, table), table);

            // 聚焦到下一个单元格
            nextCell.setAttribute('contenteditable', 'true');
            nextCell.focus();
          }
        }
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
        cells.forEach((cell, index) => {
          const newCell = document.createElement('td');
          newCell.className = 'table_cell';
          newCell.style.textAlign = cell.style.textAlign;
          newCell.textContent = '';
          newRow.appendChild(newCell);
        });

        tbody.appendChild(newRow);
        updateTableInMarkdown(editor, findTableIndexInMarkdown(editor, table), table);

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

        updateTableInMarkdown(editor, findTableIndexInMarkdown(editor, table), table);
      },

      // 删除行
      deleteTableRow(editor, table, rowIndex) {
        const tbody = table.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');

        if (rowIndex >= 0 && rowIndex < rows.length) {
          tbody.removeChild(rows[rowIndex]);
          updateTableInMarkdown(editor, findTableIndexInMarkdown(editor, table), table);
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

          updateTableInMarkdown(editor, findTableIndexInMarkdown(editor, table), table);
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
  const content = editor.getValue();
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
  if (startLine === -1) return;

  // 获取当前表格在DOM中的位置
  const allTables = Array.from(editor.element.querySelectorAll('table'));
  const tablePos = allTables.indexOf(tableElement);
  if (tablePos === -1) return;

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

    // 使用Markdown解析的节点
    tableNode = parsedTableNode;
  }

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

    // 创建表格节点内容
    const cells = [];

    // 添加表头行
    const headerRow = headerCells.map((text, colIndex) => ({
      type: 'th',
      align: aligns[colIndex],
      content: text
    }));
    cells.push(headerRow);

    // 添加数据行
    rows.forEach(row => {
      const rowCells = row.map((text, colIndex) => ({
        type: 'td',
        align: aligns[colIndex],
        content: text
      }));
      cells.push(rowCells);
    });

    // 创建表格节点
    return {
      type: 'table',
      cells: cells
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

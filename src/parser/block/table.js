const TABLE_ROW = /^\s*\|?(.*?)(?:\|\s*)?$/;
const TABLE_DELIMITER = /^\s*\|?(\s*[-:]+[-\s:]*(?:\|\s*[-:]+[-\s:]*)*)\|?\s*$/;

// 解析分隔行，确定每列的对齐方式
function parseAligns(delimiterLine) {
  // 移除行首和行尾的管道符
  let line = delimiterLine.trim();
  if (line.startsWith('|')) line = line.slice(1);
  if (line.endsWith('|')) line = line.slice(0, -1);

  // 分割并解析每列的对齐方式
  return line.split('|').map(col => {
    col = col.trim();
    if (col.startsWith(':') && col.endsWith(':')) return 'center';
    if (col.endsWith(':')) return 'right';
    return 'left';
  });
}

// 分割表格行为单元格
function splitRow(rowLine) {
  let line = rowLine.trim();
  if (line.startsWith('|')) line = line.slice(1);
  if (line.endsWith('|')) line = line.slice(0, -1);

  return line.split('|').map(cell => cell.trim());
}

export default function table({ lines, index, parseInline }) {
  // 检查当前行是否是表格行
  const headerLine = lines[index];
  if (!TABLE_ROW.test(headerLine)) return;

  // 检查下一行是否是表格分隔行
  if (index + 1 >= lines.length) return;
  const delimiterLine = lines[index + 1];
  if (!TABLE_DELIMITER.test(delimiterLine)) return;

  // 解析表头和对齐方式
  const headerCells = splitRow(headerLine);
  const aligns = parseAligns(delimiterLine);

  // 确保表头和对齐方式的列数一致
  const colCount = aligns.length;
  if (headerCells.length !== colCount) return;

  // 解析表头单元格中的内联元素
  const headers = headerCells.map(cell => parseInline(cell));

  // 收集并解析表格数据行
  let rowIndex = index + 2;
  const rows = [];

  while (rowIndex < lines.length) {
    const rowLine = lines[rowIndex];
    if (!TABLE_ROW.test(rowLine)) break;

    const cells = splitRow(rowLine);
    // 确保每行的列数一致，不足的补空白
    while (cells.length < colCount) cells.push('');
    // 多余的列忽略
    cells.length = colCount;

    // 解析单元格中的内联元素
    rows.push(cells.map(cell => parseInline(cell)));
    rowIndex++;
  }

  // 返回解析结果，确保type与渲染函数名称完全匹配
  return {
    type: 'table',  // 这应该与渲染器中的函数名完全匹配（包括大小写）
    content: [
      headers,
      aligns,
      ...rows
    ],
    length: rowIndex - index
  };
}

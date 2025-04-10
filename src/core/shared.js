/**
 * Get the index of the top-level element that contains the node
 */
export function findBlockIndex(container, node, fallback = -1) {
  if (node === container) return fallback;

  while (node.parentNode !== container) {
    node = node.parentNode;
  }
  return Array.from(container.children).indexOf(node);
}

export function getChangeIndexes(editor, event) {
  // Element fired input event
  if (event.target !== editor.element) {
    const blockIndex = findBlockIndex(editor.element, event.target);

    return {
      firstBlockIndex: blockIndex,
      lastBlockIndex: blockIndex
    };
  }

  const { anchorBlock, focusBlock } = editor.selection;
  const firstBlockIndex = Math.min(anchorBlock, focusBlock);
  const lastBlockIndex = Math.max(anchorBlock, focusBlock);


  return { firstBlockIndex, lastBlockIndex };
}

/**
 * Generate a new state array. Replace blocks between `from` and `to`(inclusive)
 * with parsed value of text. Keep unchanged blocks
 */
export function getNewState(editor, from, to, text) {
  // --- ALWAYS use block replacement strategy ---
  console.log('getNewState: Always using block replacement strategy.');
  // Parse the input text into new blocks
  const newBlocks = Array.from(editor.parser(text));
  // Construct the new state by replacing the affected range with new blocks
  const newState = [
    ...editor.state.slice(0, from),
    ...newBlocks,
    ...editor.state.slice(to + 1)
  ];
  return newState;
  // --- Original text-merge logic removed ---
}

/**
 * Replace non-breaking space with regular
 */
const NON_BREAKING_SPACE = new RegExp(String.fromCharCode(160), 'g');

function normalizeText(text) {
  return text.replace(NON_BREAKING_SPACE, ' ');
}

/**
 * Create an Generator for all text nodes and elements with `data-text` attribute
 */
function* iterateNodes(parent) {
  const treeWalker = document.createTreeWalker(
    parent,
    NodeFilter.SHOW_TEXT + NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const accept = node.nodeType === Node.TEXT_NODE || node.dataset.text;
        return accept ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    }
  );

  let node = treeWalker.nextNode();
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const text = node.dataset.text;
      const prefix = node.dataset.prefix || '';
      yield { node, text, prefix };
      node = treeWalker.nextSibling();
    } else {
      const text = normalizeText(node.data);
      console.log('node', node, node.parentNode);
      const prefix = node.parentNode.dataset.prefix || '';
      yield { node, text, prefix };
      node = treeWalker.nextNode();
    }
  }
}

/**
 * Get text of a block
 */
export function getText(node) {
  let text = '';
  // 读取前缀和后缀
  console.log('node2222', node);
  let _node = node;
  const prefix = node.dataset && node.dataset.prefix ? node.dataset.prefix : '';
  const suffix = node.dataset && node.dataset.suffix ? node.dataset.suffix : '';

  for (const val of iterateNodes(node)) {
    text += val.text;
  }

  return { text, prefix, suffix };
}

/**
 * Get caret position in a block
 *
 * @param {Element} parent
 * @param {Node} target
 * @param {Number} offset
 * @returns {Number}
 */
export function getOffset(parent, target, offset) {
  // Start of line
  if (target === parent && offset === 0) return 0;

  if (target.nodeType !== Node.TEXT_NODE) {
    if (target === parent) {
      target = parent.childNodes[offset - 1];
      if (target.tagName === 'BR') return 0;

      if (target.nodeType === Node.TEXT_NODE) {
        offset = target.data.length;
      } else if (target.dataset && 'text' in target.dataset) {
        offset = target.dataset.text.length;
      } else {
        const nodes = Array.from(iterateNodes(target));
        target = nodes[nodes.length - 1].node;
        offset = nodes[nodes.length - 1].text.length;
      }
    } else {
      // Find nearest preceding node with text
      let current = parent;
      for (const { node } of iterateNodes(parent)) {
        if (
          node.compareDocumentPosition(target) ===
          Node.DOCUMENT_POSITION_PRECEDING
        )
          break;
        current = node;
      }
      target = current;
      if (target === parent && offset === 0) return 0;
      offset = target.dataset ? target.dataset.text.length : target.data.length;
    }
  }

  let pos = 0;

  for (const { node, text } of iterateNodes(parent)) {
    if (target === node) {
      return pos + offset;
    }

    pos += text.length;
  }

  return -1;
}

/**
 * @param {Object} editor
 * @param {[Number, Number]|{ anchor: [Number, Number], focus: [Number, Number] }} caret
 */
export function setOffset(editor, caret) {
  try {
    // 安全检查：确保编辑器和元素存在
    if (!editor || !editor.element) {
      console.warn('setOffset: Editor or editor.element is missing');
      return;
    }

    const [anchorBlock, anchorOffset] = caret.anchor || caret;
    const [focusBlock, focusOffset] = caret.focus || caret;

    // 安全检查：确保块索引有效
    if (anchorBlock < 0 || anchorBlock >= editor.element.children.length ||
        focusBlock < 0 || focusBlock >= editor.element.children.length) {
      console.warn(`setOffset: Block indices out of range - anchor: ${anchorBlock}, focus: ${focusBlock}, children: ${editor.element.children.length}`);
      return;
    }

    const startEl = editor.element.children[anchorBlock];
    const endEl = editor.element.children[focusBlock];

    // 安全检查：确保元素存在
    if (!startEl || !endEl) {
      console.warn(`setOffset: Start or end element is missing - startEl: ${!!startEl}, endEl: ${!!endEl}`);
      return;
    }

    const selection = editor.element.getRootNode().getSelection();
    if (!selection) {
      console.warn('setOffset: Selection is missing');
      return;
    }

    selection.removeAllRanges();
    const range = document.createRange();

    // 获取位置并安全处理
    const anchorPosition = getOffsetPosition(startEl, anchorOffset);
    if (!anchorPosition || !anchorPosition.node) {
      console.warn('setOffset: Could not get anchor position');
      return;
    }

    try {
      range.setStart(anchorPosition.node, anchorPosition.offset);
      selection.addRange(range);

      if (anchorBlock !== focusBlock || anchorOffset !== focusOffset) {
        const focusPosition = getOffsetPosition(endEl, focusOffset);
        if (focusPosition && focusPosition.node) {
          selection.extend(focusPosition.node, focusPosition.offset);
        } else {
          console.warn('setOffset: Could not get focus position');
        }
      }
    } catch (error) {
      console.error('Error setting range:', error);
    }
  } catch (error) {
    console.error('Error in setOffset:', error);
  }
}

/**
 * Find node and remaining offset for caret position
 */
export function getOffsetPosition(el, offset) {
  // 安全检查：如果元素为空，返回一个默认位置
  if (!el) {
    console.warn('getOffsetPosition: Element is null or undefined, returning default position');
    return { node: document.body, offset: 0 };
  }

  if (offset < 0) return { node: el, offset: 0 };

  // 安全检查：确保dataset存在
  if (el.dataset && 'prefix' in el.dataset) {
    const prefixLength = el.dataset.prefix.length;
    if (offset <= prefixLength) {
      return { node: el, offset: 0 };
    } else {
      offset = offset - prefixLength;
    }
  }

  // 安全检查：确保可以迭代节点
  try {
    for (let { node, text } of iterateNodes(el)) {
      // 安全检查：确保node不为空
      if (!node) continue;

      if (text.length >= offset) {
        // 安全检查：确保dataset存在
        if (node.dataset && 'text' in node.dataset) {
          const prevOffset = offset;
          // 安全检查：确保parentNode存在且包含childNodes
          if (node.parentNode && node.parentNode.childNodes) {
            offset = Array.from(node.parentNode.childNodes).indexOf(node);
            if (prevOffset >= text.length) offset++;
            node = node.parentNode;
          }
        }

        return { node, offset };
      }

      offset -= text.length;
    }
  } catch (error) {
    console.error('Error in getOffsetPosition iterating nodes:', error);
    return { node: el, offset: 0 };
  }

  // 安全检查：确保nextSibling存在
  if (offset > 0 && el.nextSibling) {
    try {
      return getOffsetPosition(el.nextSibling, offset - 1);
    } catch (error) {
      console.error('Error in getOffsetPosition recursive call:', error);
      return { node: el, offset: 0 };
    }
  }

  return { node: el, offset: 0 };
}

export function serializeState(list, block = false) {
  return list
    .map((token) => {
      if (!token.content) return token;
      return serializeState(token.content);
    })
    .join(block ? '\n' : '');
}

export function orderedSelection({
  anchorBlock,
  focusBlock,
  anchorOffset,
  focusOffset
}) {
  if (
    anchorBlock > focusBlock ||
    (anchorBlock === focusBlock && anchorOffset > focusOffset)
  ) {
    return {
      firstBlock: focusBlock,
      lastBlock: anchorBlock,
      firstOffset: focusOffset,
      lastOffset: anchorOffset
    };
  }

  return {
    firstBlock: anchorBlock,
    lastBlock: focusBlock,
    firstOffset: anchorOffset,
    lastOffset: focusOffset
  };
}

export function replaceSelection(editor, text = '') {
  const { firstBlock, lastBlock, firstOffset, lastOffset } = orderedSelection(
    editor.selection
  );

  // --- BEGIN MODIFICATION: Check for tables involved ---
  let tableInvolved = false;
  if ((editor.state[firstBlock] && editor.state[firstBlock].type === 'table') ||
      (editor.state[lastBlock] && editor.state[lastBlock].type === 'table')) {
    tableInvolved = true;
  }

  if (tableInvolved) {
    console.log('replaceSelection: Table involved, using direct block replacement.');
    // Parse the input text into new blocks
    const newBlocks = Array.from(editor.parser(text));
    // Construct the new state by replacing the affected range with new blocks
    const newState = [
      ...editor.state.slice(0, firstBlock),
      ...newBlocks,
      ...editor.state.slice(lastBlock + 1)
    ];
    // Set caret at the beginning of the first block after the replacement
    // Note: More precise caret positioning might be needed later.
    editor.update(newState, [firstBlock, 0]);
    return; // Skip original logic
  }
  // --- END MODIFICATION ---

  // --- Original replaceSelection logic (only runs if no tables are involved) ---
  console.log('replaceSelection: No table involved, using original logic with serializeState.');
  const firstBlockContent = editor.state[firstBlock].content;

  const firstLine = serializeState(firstBlockContent);
  const lastLine =
    firstBlock === lastBlock
      ? firstLine
      : serializeState(editor.state[lastBlock].content);

  const start = firstLine.slice(0, lastOffset) + text;
  const newState = getNewState(
    editor,
    firstBlock,
    lastBlock,
    start + lastLine.slice(lastOffset)
  );

  let startLines = start.split('\n').length;
  const addedBlocks = newState.slice(firstBlock).findIndex((block) => {
    if (startLines <= block.length) return true;
    startLines -= block.length;
    return false;
  });

  const addedText =
    firstBlock + addedBlocks < 0
      ? ''
      : serializeState(newState[firstBlock + addedBlocks].content)
        .split('\n')
        .slice(0, startLines)
        .join('\n').length;
  console.log('addedText', addedText, lastLine.slice(lastOffset).length);
  console.log('firstBlock, addedBlocks', firstBlock, addedBlocks);
  console.log('lastLine', lastLine);
  editor.update(newState, [
    firstBlock + addedBlocks,
    addedText - lastLine.slice(lastOffset).length
  ]);
}

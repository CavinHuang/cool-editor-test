import {
  getChangeIndexes,
  getText,
  findBlockIndex,
  getNewState,
  serializeState,
  orderedSelection,
  replaceSelection
} from './shared.js';

function onCompositionStart(editor) {
  editor.composing = true;
}

function onCompositionEnd(editor, event) {
  editor.composing = false;
  return onInput(editor, event);
}

// 获取当前光标的上级元素
// eslint-disable-next-line no-unused-vars
function getRangeFoucsNode(_selection, _firstBlock) {
  const range = document.getSelection().getRangeAt(0);
  if (!range) return null;
  const commonAncestorContainer = range.commonAncestorContainer;
  if (commonAncestorContainer.parentElement.dataset.prefix) {
    return {
      prefix: commonAncestorContainer.parentElement.dataset.prefix || '',
      suffix: commonAncestorContainer.parentElement.dataset.suffix || ''
    };
  }
  return {
    prefix: commonAncestorContainer.parentElement.dataset.prefix || '',
    suffix: commonAncestorContainer.parentElement.dataset.suffix || ''
  };
}

function onInput(editor, event) {
  if (editor.composing) return;

  const { firstBlockIndex, lastBlockIndex } = getChangeIndexes(editor, event);

  // Check if any block in the change range is a table
  for (let i = firstBlockIndex; i <= lastBlockIndex; i++) {
    if (editor.state[i] && editor.state[i].type === 'table') {
      console.log('Input involves table block, skipping default update.');
      // Let browser handle contenteditable changes, prevent state corruption
      return false;
    }
  }

  // --- Original onInput logic proceeds only if no table is involved ---
  const firstBlock = editor.element.children[firstBlockIndex];
  const rangeFoucsNode = getRangeFoucsNode(editor.selection, firstBlock);
  let prefix = '';
  let suffix = '';
  if (rangeFoucsNode) {
    prefix = rangeFoucsNode.prefix;
    suffix = rangeFoucsNode.suffix;
  }
  const caretStart =
    event.target === editor.element ? editor.selection.anchorOffset : -1;
  const { text } = getText(firstBlock);

  // 计算考虑前缀的光标位置
  const adjustedCaretStart = caretStart >= 0 ?
    (caretStart + (firstBlock.dataset && firstBlock.dataset.prefix ?
      firstBlock.dataset.prefix.length : 0)) :
    caretStart;

  editor.update(
    getNewState(
      editor, firstBlockIndex, lastBlockIndex, prefix + text + suffix
    ),
    [firstBlockIndex, adjustedCaretStart]
  );

  return true;
}

function onDragstart(editor, event) {
  event.preventDefault();
}

function onBeforeDelete(editor, event, type) {
  const { firstBlock, lastBlock, firstOffset } = orderedSelection(
    editor.selection
  );
  const { isCollapsed } = editor.element.getRootNode().getSelection();

  // Selection
  if (!isCollapsed) {
    event.preventDefault();

    replaceSelection(editor);
    return true;
  }

  const text = serializeState(editor.state[firstBlock].content);
  const backwards = event.inputType.endsWith('Backward');

  // Ignore removing past beginning/end
  if (
    (backwards && firstOffset === 0 && firstBlock === 0) ||
    (!backwards &&
      firstOffset === text.length &&
      lastBlock === editor.state.length - 1)
  )
    return false;

  const changePosition = backwards ? firstOffset - 1 : firstOffset;
  // Let browser handle everything but removing line breaks
  if (text[changePosition]) return false;

  event.preventDefault();

  if (type === 'character') {
    const nextBlock = backwards ? firstBlock - 1 : firstBlock + 1;

    // Check if current or next block is a table before merging
    const currentBlockIsTable = editor.state[firstBlock] && editor.state[firstBlock].type === 'table';
    const nextBlockIndexIsValid = nextBlock >= 0 && nextBlock < editor.state.length;
    const nextBlockIsTable =
      nextBlockIndexIsValid &&
      editor.state[nextBlock] &&
      editor.state[nextBlock].type === 'table';

    if (currentBlockIsTable || nextBlockIsTable) {
      console.log('Boundary deletion involves table block, preventing merge.');
      return true; // Already prevented default, just stop the merge
    }

    const newText = serializeState(editor.state[nextBlock].content);

    editor.update(
      getNewState(
        editor,
        backwards ? firstBlock - 1 : firstBlock,
        backwards ? firstBlock : firstBlock + 1,
        backwards ? newText + text : text + newText
      ),
      backwards ? [firstBlock - 1, newText.length] : [firstBlock, text.length]
    );
  }

  return true;
}

function onBeforeInput(editor, event) {
  const types = {
    deleteContentBackward: 'character',
    deleteContentForward: 'character',
    deleteWordBackward: 'word',
    deleteWordForward: 'word',
    deleteSoftLineBackward: 'line',
    deleteSoftLineForward: 'line',
    deleteHardLineBackward: 'line',
    deleteHardLineForward: 'line'
  };

  const type = types[event.inputType];
  if (!type) return;

  return onBeforeDelete(editor, event, type);
}

function onCopy(editor, event) {
  const { isCollapsed } = editor.element.getRootNode().getSelection();
  if (isCollapsed) return;

  const { firstBlock, lastBlock, firstOffset, lastOffset } = orderedSelection(
    editor.selection
  );

  const blocks = editor.state
    .slice(firstBlock, lastBlock + 1)
    .map((block) => serializeState(block.content));
  const lastBlockLength = blocks[blocks.length - 1].length;
  const selection = blocks
    .join('\n')
    .slice(firstOffset, lastOffset - lastBlockLength || Infinity);

  event.preventDefault();
  event.clipboardData.setData('text/plain', selection);

  return true;
}

function onPaste(editor, event) {
  event.preventDefault();

  replaceSelection(editor, event.clipboardData.getData('text'));

  return true;
}

function onSelectionChange(editor) {
  const sel = editor.element.getRootNode().getSelection();

  // Focus outside editor
  if (!editor.element.contains(sel.anchorNode)) return;

  editor.selection.anchorBlock = findBlockIndex(
    editor.element,
    sel.anchorNode,
    sel.anchorOffset
  );
  editor.selection.focusBlock = findBlockIndex(
    editor.element,
    sel.focusNode,
    sel.focusOffset
  );
}

/**
 * Correct caret position if the line is now in a prior block
 */
function updateCaret(editor, state, [block, offset]) {
  let lineIndex = editor.state
    .slice(0, block + 1)
    .reduce((acc, val) => acc + val.length, 0);
  const newBlock = state.findIndex((block) => {
    if (lineIndex <= block.length) return true;
    lineIndex -= block.length;
    return false;
  });
  console.log('newBlock', newBlock, block);
  if (newBlock === -1) return;
  if (newBlock >= block) return;

  const newOffset =
    serializeState(state[newBlock].content)
      .split('\n')
      .slice(0, block - newBlock)
      .join('\n').length + 1 + offset;

  return [newBlock, newOffset];
}

function onBeforeUpdate(editor, state, caret) {
  if (!editor.state.length) return;

  const anchor = updateCaret(editor, state, caret.anchor);
  const focus = updateCaret(editor, state, caret.focus);
  if (!anchor && !focus) return;

  return {
    state,
    caret: {
      anchor: anchor || caret.anchor,
      focus: focus || caret.focus
    }
  };
}

export default {
  handlers: {
    input: onInput,
    compositionstart: onCompositionStart,
    compositionend: onCompositionEnd,
    dragstart: onDragstart,
    beforeinput: onBeforeInput,
    copy: onCopy,
    paste: onPaste,
    selectionchange: onSelectionChange
  },
  beforeupdate: onBeforeUpdate
};

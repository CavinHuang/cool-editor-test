import { getOffset, serializeState, setOffset } from './shared.js';
import morphdom from 'morphdom';
import defaultPlugin from './default-plugin.js';
import firefoxPlugin from './firefox.js';
import androidPlugin from './android.js';
import { safari, firefox } from './user-agent.js';
import { h } from '../renderer/helpers.js';
import { priorPlugin } from '../plugins/table.js';

function toDOM(renderer, node) {
  if (typeof node === 'string') return node;

  // 对于表格节点，特殊处理以保持结构
  if (node.type === 'table') {
    console.log('表格节点原始内容:', JSON.stringify(node.content));

    // 验证表格内容结构
    if (!Array.isArray(node.content) || node.content.length < 2) {
      console.error('表格内容结构无效:', node);
      // 返回空元素而不是破坏编辑器
      const div = document.createElement('div');
      div.textContent = '表格格式错误';
      return div;
    }

    if (typeof renderer.table !== 'function') {
      console.warn('警告: 没有找到表格渲染函数', node);
      const div = document.createElement('div');
      div.textContent = '表格渲染器不可用';
      return div;
    }

    try {
      // 确保表格内容格式正确 - 深度复制以防止修改原始数据
      const safeContent = JSON.parse(JSON.stringify(node.content));

      // 确保表头是数组
      if (!Array.isArray(safeContent[0])) {
        safeContent[0] = [];
      }

      // 确保有对齐行信息，如果没有则创建默认值
      if (!Array.isArray(safeContent[1])) {
        safeContent[1] = safeContent[0].map(() => 'left');
      }

      // 确保每个数据行是有效的数组
      for (let i = 2; i < safeContent.length; i++) {
        if (!Array.isArray(safeContent[i])) {
          safeContent[i] = safeContent[0].map(() => '');
        }
      }

      // 使用deepFreeze防止渲染函数修改内容
      const frozenContent = deepFreeze([...safeContent]);

      // 渲染表格
      return renderer.table({ content: frozenContent });
    } catch (error) {
      console.error('表格渲染失败:', error);
      const div = document.createElement('div');
      div.textContent = '表格渲染失败: ' + error.message;
      return div;
    }
  }

  // 对其他节点类型进行正常处理
  const content =
    node.content && node.content.map((child) => toDOM(renderer, child));

  if (typeof renderer[node.type] !== 'function') {
    console.warn(`警告: 没有找到节点类型"${node.type}"的渲染函数`, node);
    return content || '';
  }

  return renderer[node.type]({ content });
}

// 辅助函数：深度冻结对象，防止修改
function deepFreeze(obj) {
  // 获取目标对象的属性名
  const propNames = Object.getOwnPropertyNames(obj);

  // 在冻结目标对象之前，冻结它的每个属性
  for (const name of propNames) {
    const value = obj[name];

    // 递归冻结嵌套对象
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  // 冻结目标对象本身
  return Object.freeze(obj);
}

const EVENTS = [
  'beforeinput',
  'compositionstart',
  'compositionend',
  'copy',
  'dragstart',
  'drop',
  'paste',
  'input',
  'keydown',
  'keypress'
];

const DOCUMENT_EVENTS = ['selectionchange'];

/**
 * @typedef {Object} StateNode
 * @property {String} type
 * @property {Array<StateNode|String>} content
 */

function changeHandlers(editor, cmd) {
  for (const name of EVENTS) {
    editor.element[`${cmd}EventListener`](name, editor);
  }
  for (const name of DOCUMENT_EVENTS) {
    document[`${cmd}EventListener`](name, editor);
  }
}

function getPath(obj, path) {
  for (const key of path) {
    obj = obj[key];
    if (!obj) return;
  }
  return obj;
}

/**
 * Call plugins until one returns true
 */
function callPlugins(editor, path, ...args) {
  try {
    for (const plugin of editor.plugins) {
      try {
        const handler = getPath(plugin, path);
        if (handler && handler(editor, ...args)) break;
      } catch (pluginError) {
        console.error(`插件 ${plugin.name || '未命名'} 处理 ${path.join('.')} 事件时出错:`, pluginError);
        // 继续执行其他插件，但跳过当前出错的插件
      }
    }
  } catch (error) {
    console.error(`调用插件 ${path.join('.')} 时发生错误:`, error);
  }
}

export default class Editor {
  constructor({
    element,
    value = '',
    renderer = [],
    plugins = [],
    parser
  } = {}) {
    this._elements = [];
    Object.assign(this, { element, renderer, parser });
    this.plugins = [
      firefoxPlugin,
      androidPlugin,
      priorPlugin,
      defaultPlugin,
      ...plugins
    ].filter(Boolean);
    this._state = [];
    this.composing = false;

    const getTypeOffset = (type) => {
      const sel = this.element.getRootNode().getSelection();
      const block = this.selection[type + 'Block'];
      if (sel[type + 'Node'] === this.element) return 0;
      if (!this.element.contains(sel[type + 'Node'])) return -1;

      return getOffset(
        this.element.children[block],
        sel[type + 'Node'],
        sel[type + 'Offset']
      );
    };
    this.selection = {
      anchorBlock: 0,
      focusBlock: 0,
      get anchorOffset() {
        return getTypeOffset('anchor');
      },
      get focusOffset() {
        return getTypeOffset('focus');
      }
    };

    this.element.contentEditable = true;
    changeHandlers(this, 'add');
    this.value = value;
  }

  /**
   * @private
   */
  handleEvent(event) {
    callPlugins(this, ['handlers', event.type], event);
  }

  /**
   * @param {StateNode[]} state
   * @param {[Number, Number]|{ anchor: [Number, Number], focus: [Number, Number] }} caret
   */
  update(state, caret = [0, 0]) {
    if (!caret.anchor) {
      caret = { focus: caret, anchor: caret.slice() };
    }

    for (const plugin of this.plugins) {
      const handler = plugin.beforeupdate;
      if (!handler) continue;
      const ret = handler(this, state, caret);
      if (!ret) continue;
      state = ret.state;
      caret = ret.caret;
    }

    this.state = state;
    console.log('caret', caret, this);
    setOffset(this, caret);
  }

  /**
   * @param {StateNode[]} state
   */
  set state(state) {
    if (state === this.state) return;

    const prevState = this.state;
    this._state = state;

    state.forEach((node, index) => {
      const current = this.element.children[index];

      if (prevState.includes(node)) {
        // Avoid having to recreate nodes that haven't changed
        const prevIndex = prevState.indexOf(node);
        const el = this._elements[prevIndex];

        if (el === current) return;
        this.element.insertBefore(el, current);
      } else {
        const el = toDOM(this.renderer, node);

        // Improves caret behavior when contenteditable="false"
        // is the last child or when empty
        if (
          !el.childNodes.length ||
          ((safari || firefox) &&
            el.lastChild &&
            el.lastChild.contentEditable === 'false')
        ) {
          el.append(document.createElement('br'));
        }

        const morph = !state.includes(prevState[index]);
        if (morph && this._elements[index]) {
          morphdom(this._elements[index], el);
        } else {
          this.element.insertBefore(el, current);
        }
      }
    });

    // Remove leftover elements
    while (this.element.childElementCount > state.length) {
      this.element.lastElementChild.remove();
    }

    this._elements = Array.from(this.element.children);

    callPlugins(this, ['afterchange']);
  }

  /**
   * @returns {StateNode[]}
   */
  get state() {
    return this._state;
  }

  /**
   * @param {String} value
   */
  set value(value) {
    this.update(Array.from(this.parser(value)));
  }

  /**
   * @returns {String}
   */
  get value() {
    return serializeState(this.state, true);
  }

  destroy() {
    changeHandlers(this, 'remove');
  }

  // 选择变化事件，用于检测选区进入表格
  selectionchange(event) {
    // 调用插件的 selectionchange 处理器
    callPlugins(this, ['handlers', 'selectionchange'], event);
  }
}

import Editor from './core/editor.js';
import renderer from './renderer/index.js';
import styles from './renderer/styles.css';
import parser from './parser/block/index.js';
import enterPlugin from './plugins/enter.js';
import tabPlugin from './plugins/tab.js';
import historyPlugin from './plugins/history.js';
import highlightPlugin from './plugins/highlight.js';
import formatPlugin from './plugins/format.js';
import orderedListPlugin from './plugins/ordered-list.js';
import dropPlugin from './plugins/drop.js';
import tablePlugin from './plugins/table.js';

export default class DefaultEditor extends Editor {
  constructor({ element, value } = {}) {
    element.classList.add(styles.editor);

    const plugins = [
      enterPlugin(),
      tablePlugin()
      // tabPlugin(),
      // historyPlugin(),
      // highlightPlugin(),
      // formatPlugin(),
      // orderedListPlugin(),
      // dropPlugin()
    ];

    // 确保renderer是一个对象而不是数组
    console.log('Renderer type:', typeof renderer);
    if (Array.isArray(renderer)) {
      console.error('Renderer is an array, but should be an object!');
    }

    // 检查渲染器是否有table函数
    console.log('Renderer has table function?', typeof renderer.table === 'function');
    // 打印renderer对象的所有键
    console.log('Renderer available functions:', Object.keys(renderer));

    // 确保renderer为对象类型
    let finalRenderer = renderer;
    if (typeof renderer !== 'object' || renderer === null) {
      console.error('渲染器必须是一个对象，当前类型:', typeof renderer);
      finalRenderer = {}; // 提供一个空对象作为后备
    }

    super({ element, value, plugins, renderer: finalRenderer, parser });
  }
}

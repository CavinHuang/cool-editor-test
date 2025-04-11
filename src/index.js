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
import floatingToolbarPlugin from './plugins/floating-toolbar.js';

export default class DefaultEditor extends Editor {
  constructor({ element, value } = {}) {
    if (!element) {
      throw new Error('必须提供 element 参数');
    }

    element.classList.add(styles.editor);

    // 初始化插件列表
    const plugins = [
      enterPlugin(),
      tablePlugin(),
      floatingToolbarPlugin()
      // tabPlugin(),
      // historyPlugin(),
      // highlightPlugin(),
      // formatPlugin(),
      // orderedListPlugin(),
      // dropPlugin()
    ].filter(Boolean); // 过滤掉可能的 null 或 undefined

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

    // 调用父类构造函数
    super({
      element,
      value,
      plugins,
      renderer: finalRenderer,
      parser
    });

    // 初始化后立即调用插件的 init 方法
    this.plugins.forEach(plugin => {
      if (plugin.init) {
        try {
          plugin.init(this);
        } catch (error) {
          console.error(`插件 ${plugin.name || '未命名'} 初始化失败:`, error);
        }
      }
    });
  }
}

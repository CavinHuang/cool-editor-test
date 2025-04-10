/** @jsx h */
/** @jsxFrag Fragment */
import {
  /* eslint-disable-next-line no-unused-vars */
  h,
  Fragment,
  cls,
  last,
  formatURL
} from './helpers.js';
import styles from './styles.css';
import { get as getFileURL } from './files.js';

function onTodoClick({ target }) {
  const checked = target.getAttribute('aria-checked') === 'true';
  target.dataset.text = `- [${!checked ? 'x' : ' '}]`;
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function preventDefault(event) {
  event.preventDefault();
}

function onTagClick(event) {
  console.log('Tag click', event);
}

function onHeadingClick(event) {
  console.log('Heading click', event);
}

function onLinkClick() {
  const href = formatURL(this.getAttribute('href'));
  window.open(href, '_blank');
}

function onLinkButtonClick(event) {
  console.log('Link button click', event);
}

function selectElement() {
  const selection = this.getRootNode().getSelection();

  selection.removeAllRanges();
  const range = document.createRange();

  range.selectNode(this);
  selection.addRange(range);
}

export default {
  paragraph({ content }) {
    return <p class={styles.p}>{content}</p>;
  },
  heading({ content: [hashes, ...content] }) {
    const level = hashes.length;
    const Heading = `h${level}`;

    return (
      <Heading class={cls('heading', Heading)} data-prefix={hashes}>
        {content}
      </Heading>
    );
  },
  ordered_list_item({ content: [indentation, level, markup, ...content] }) {
    return (
      <li class={styles.ordered_list_item}>
        {indentation}
        <span class={styles.ordered_list_item_number}>{level}</span>
        <span class={styles.ordered_list_item_dot}>{markup}</span>
        {content}
      </li>
    );
  },
  unordered_list_item({ content: [indentation, markup, ...content] }) {
    return (
      <li class={styles.unordered_list_item}>
        {indentation}
        <span class={styles.unordered_list_item_dot}>{markup}</span>
        {content}
      </li>
    );
  },
  todo_item({ content: [indentation, text, space, ...content] }) {
    const checked = text === '- [x]';

    return (
      <li class={styles.todo_item}>
        {indentation}
        <button
          contenteditable='false'
          type='button'
          role='checkbox'
          aria-checked={checked}
          class={styles.checkbox}
          data-text={text}
          onclick={onTodoClick}
          onmousedown={preventDefault /* Prevent editor focus on mobile */}
        >
          {/* Wrapper required for caret position for Chrome */}
          <div class={styles.checkbox_svg}>
            {/* Zero-Width Space makes deleteSoftLineBackward on Chrome */}
            {String.fromCharCode(8203)}
            <svg width='17' height='17' viewBox='0 0 16 16'>
              <path
                d='M.5 12.853A2.647 2.647 0 003.147 15.5h9.706a2.647 2.647 0 002.647-2.647V3.147A2.647 2.647 0 0012.853.5H3.147A2.647 2.647 0 00.5 3.147v9.706z'
                class={styles.checkbox_background}
              />
              {checked ? (
                <path
                  d='M12.526 4.615L6.636 9.58l-2.482-.836a.48.48 0 00-.518.15.377.377 0 00.026.495l2.722 2.91c.086.09.21.144.34.144h.046a.474.474 0 00.307-.156l6.1-7.125a.38.38 0 00-.046-.548.49.49 0 00-.604 0z'
                  class={styles.icon}
                />
              ) : (
                ''
              )}
            </svg>
          </div>
        </button>
        {space}
        <span class={checked ? styles.todo_item_done : ''}>{content}</span>
      </li>
    );
  },
  blockquote({ content: [markup, ...content] }) {
    return (
      <blockquote class={styles.blockquote}>
        <span class={styles.blockquote_markup}>{markup}</span>
        {content}
      </blockquote>
    );
  },
  horizontal_rule({ content }) {
    return (
      /* Enables caret positions */
      <p class={styles.p}>
        <img role='presentation' class={styles.hr} data-text={content} />
      </p>
    );
  },
  table({ content }) {
    console.log('table渲染函数接收到的内容:', JSON.stringify(content));

    try {
      // 验证内容结构
      if (!Array.isArray(content) || content.length < 2) {
        console.error('表格内容格式不正确', content);
        // 返回一个错误提示，而不是破坏表格结构
        return <p class={styles.p}>表格内容格式不正确</p>;
      }

      // 保证内容的每个部分都是数组
      if (!Array.isArray(content[0]) || !Array.isArray(content[1])) {
        console.error('表格头部或对齐行格式错误', content);
        return <p class={styles.p}>表格格式错误</p>;
      }

      // 从数组格式中提取表格数据
      const headers = content[0];
      const aligns = content[1];

      // 确保对齐列数与表头列数一致
      const normalizedAligns = [...aligns];
      while (normalizedAligns.length < headers.length) normalizedAligns.push('left');
      if (normalizedAligns.length > headers.length) normalizedAligns.length = headers.length;

      // 从第三个元素开始的所有元素都是表格行
      // 过滤掉空行（所有单元格都是空字符串的行）
      const rows = content.slice(2).filter(row => {
        if (!Array.isArray(row)) return false;
        return row.some(cell => cell && String(cell).trim() !== '');
      });

      console.log('过滤后表格行数:', rows.length, '表头列数:', headers.length);

      // 确保所有行的单元格数量与表头一致
      const normalizedRows = rows.map(row => {
        if (!Array.isArray(row)) return headers.map(() => '');

        // 复制原始行，确保不修改原始数据
        const newRow = [...row];

        // 如果列数不足，补充空单元格
        while (newRow.length < headers.length) newRow.push('');

        // 如果列数过多，删除多余的单元格
        if (newRow.length > headers.length) newRow.length = headers.length;

        return newRow;
      });

      // 防止空表格
      if (headers.length === 0) {
        return <p class={styles.p}>空表格</p>;
      }

      return (
        <table class={styles.table}>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  class={styles.table_header}
                  style={{ textAlign: normalizedAligns[index] }}
                >
                  {header || ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalizedRows.length > 0 ? (
              normalizedRows.map(row => (
                <tr>
                  {row.map((cell, index) => (
                    <td
                      class={styles.table_cell}
                      style={{ textAlign: normalizedAligns[index] }}
                    >
                      {cell || ''}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  class={styles.table_cell}
                  colSpan={headers.length}
                  style={{ textAlign: 'center' }}
                >
                  (空表格)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    } catch (error) {
      console.error('表格渲染出错:', error);
      return <p class={styles.p}>表格渲染错误: {error.message}</p>;
    }
  },
  code_block({ content: [openMarkup, language, ...content] }) {
    return (
      <code
        class={styles.code_block}
        autocomplete='off'
        autocorrect='off'
        autocapitalize='off'
        spellcheck='false'
      >
        <span class={styles.inline_markup}>{openMarkup}</span>
        <span class={styles.code_language}>{language}</span>
        {content.slice(0, -1)}
        <span class={cls(styles.inline_markup, styles.code_close)}>
          {last(content)}
        </span>
      </code>
    );
  },

  em({ content }) {
    return <em>{content.slice(1, -1)}</em>;
  },
  strong({ content }) {
    return <strong class={styles.strong}>{content}</strong>;
  },
  emphasis({ content }) {
    return <em class={styles.em}>{content}</em>;
  },
  link({ content, url }) {
    return (
      <a
        href={url}
        class={styles.link}
        onclick={onLinkClick}
        onmousedown={preventDefault}
      >
        {content}
      </a>
    );
  },
  code({ content }) {
    return (
      <code
        class={styles.code_span}
        autocomplete='off'
        autocorrect='off'
        autocapitalize='off'
        spellcheck='false'
      >
        <span class={styles.code_span_inner}>
          <span class={styles.code_span_open}>{content[0]}</span>
          {content.slice(1, -1)}
          <span class={styles.code_span_close}>{last(content)}</span>
        </span>
      </code>
    );
  },
  reference({ content }) {
    return <span class={styles.reference} data-prefix={content[0]} data-suffix={last(content)}>{content.slice(1, -1)}</span>;
  },
  mark({ content }) {
    return <mark
      class={styles.mark}
      data-prefix={content[0]}
      data-suffix={last(content)}
    >
      {content.slice(1, -1)}
    </mark>;
  },
  strikethrough({ content }) {
    return (
      <span class={styles.strikethrough}>
        <s>{content.slice(1, -1)}</s>
      </span>
    );
  },
  underline({ content }) {
    return <u class={styles.underline}>{content}</u>;
  },
  tag({ content }) {
    return (
      // <button> can't have multi-line background
      <span role='button' tabindex='0' class={styles.tag} onclick={onTagClick}>
        <span class={styles.tag_markup}>{content[0]}</span>
        {content.slice(1, -1)}
        <span class={styles.tag_markup}>{last(content)}</span>
      </span>
    );
  },
  image({ content }) {
    const [id, name] = content[1].split('/');

    return (
      <img
        src={getFileURL(id)}
        alt={name}
        class={styles.image}
        data-text={content.join('')}
        onclick={selectElement}
      />
    );
  },
  file({ content }) {
    const [id, name] = content[1].split('/');

    return (
      <button
        contenteditable='false'
        type='button'
        class={styles.file}
        data-text={content.join('')}
        data-name={name}
        data-id={id}
        data-date=''
        onmousedown={preventDefault /* Prevent editor focus on mobile */}
        onclick={selectElement}
      >
        {/* Wrapper required for caret position for Chrome */}
        <div class={styles.file_svg}>
          <svg width='32' height='38'>
            <path d='M0 0h20.693L32 10.279V38H0V0zm1 1v36h30V11H19V1H1zm19 0v9h10.207l-9.9-9H20z' />
          </svg>
        </div>
      </button>
    );
  }
};

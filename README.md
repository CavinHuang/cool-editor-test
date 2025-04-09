<button
          contenteditable='false'
          type='button'
          class='heading-button'
          data-text={hashes}
          onclick={onHeadingClick}
          onmousedown={preventDefault /* Prevent editor focus on mobile */}
        >
          <div>
            {/* Wrapper makes deleteSoftLineBackward work on Chrome */}h
            <span class='heading-button-level'>{level}</span>
          </div>
        </button>

## 表格语法使用指南

本编辑器现已支持表格语法，使用方法如下：

### 基本表格语法

```
| 标题1 | 标题2 | 标题3 |
| ----- | ----- | ----- |
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |
```

### 列对齐方式

您可以通过在分隔行中使用冒号来指定列的对齐方式：

```
| 左对齐 | 居中对齐 | 右对齐 |
| :----- | :------: | -----: |
| 内容   | 内容     | 内容   |
```

- `:-----` 表示左对齐（默认）
- `:-----:` 表示居中对齐
- `-----:` 表示右对齐

### 快捷键

- `Ctrl+Alt+T`：插入一个3x3的表格
- 在表格中使用 `Tab` 键可以在单元格之间导航
- 使用 `Shift+Tab` 可以反向导航单元格

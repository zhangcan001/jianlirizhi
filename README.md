# 监理日记生成器

个人监理日记 Word 自动生成 / AI 辅助分析的 Windows 桌面应用（Electron + React 19 + Vite + TypeScript）。

## 目录结构

```
electron/
  main/
    index.cjs   # 主进程：IPC、AI 调用、天气、文档导出入口
    docx.cjs    # 基于 PizZip 的模板渲染（按行列定位单元格）
  preload/
    index.cjs   # 暴露给渲染进程的 diaryApi
frontend/                # ← 渲染进程源码（Vite root）
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx
    styles.css
    types.ts
    api.ts
    constants.ts
    hooks/
      useDiaryStore.ts
      useSettings.ts
    components/
      HistoryList.tsx
      DiaryForm.tsx
      DiaryPreview.tsx
      WeatherBar.tsx
      AiBar.tsx
      SettingsDrawer.tsx
      Notice.tsx
resources/
  templates/
    个人监理日记模板.docx   # 监理日记 docx 模板
package.json
```

## 开发

```bash
npm install            # 首次安装。如果 electron postinstall 卡住，可加 --ignore-scripts，需要 dev 模式再单独跑
npm run build          # 生成 dist-web/
npm run dev            # 同时启动 Vite (127.0.0.1:5173) + Electron
```

## 功能要点

- 监理日记字段录入与本地持久化（`app.getPath('userData')/data/diaries.json`）
- 基于 Open-Meteo 的天气获取（按城市）
- AI 辅助：`polish`（润色 `constructionStatus` / `inspectionWork`）与 `analyze`（全字段生成）两种模式
- AI provider：本地 Ollama 与 OpenAI 兼容协议（OpenRouter 等）
- 严格的防胡编规则：人员、机械、施工部位、验收结论不得虚构
- 机电（MEP）友好：识别土建/钢筋/木工/水电/消防/暖通/智能化/电梯等常见班组与施工机械
- Word 导出：基于 docx 模板按单元格行列位置回填
- 三栏布局：左侧历史日记、中间表单、右侧实时预览
- 右上角 AI 设置抽屉：provider / endpoint / model / apiKey

## 主要 IPC 通道

| Channel | 说明 |
| --- | --- |
| `diary:save` / `diary:get` / `diary:list` / `diary:delete` | 日记 CRUD |
| `diary:export-docx` / `diary:export-docx-to-dir` | 导出 docx |
| `diary:select-export-dir` | 选择导出目录 |
| `diary:data-path` | 获取本地数据库路径 |
| `weather:fetch` | 按城市拉取天气 |
| `ai:run` | 调用 AI 处理日记草稿 |

## 依赖

- 运行时：`react`、`react-dom`、`lucide-react`、`pizzip`、`docxtemplater`
- 开发：`vite`、`@vitejs/plugin-react`、`electron`、`typescript`、`concurrently`、`wait-on`

`docxtemplater` 在 deps 中但当前未直接使用——`electron/main/docx.cjs` 用的是 PizZip + 自写 XML 替换。


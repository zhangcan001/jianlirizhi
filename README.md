# 监理日记生成器 — Electron 主进程源码

个人监理日记 Word 自动生成 / AI 辅助分析的 Windows 桌面应用（Electron + React）。

> 本仓库目前只收录 **Electron 主进程源码**与 **Word 模板**。前端 React/Vite 源码尚未归档（运行时使用的是打包后的 `dist-web/` 压缩产物，不在版本控制内）。

## 目录结构

```
electron/
  main/
    index.cjs   # 主进程：IPC、AI 调用、天气、文档导出入口
    docx.cjs    # 基于 PizZip 的模板渲染（按行列定位单元格）
  preload/
    index.cjs   # 暴露给渲染进程的 diaryApi
resources/
  templates/
    个人监理日记模板.docx   # 监理日记 docx 模板
package.json
```

## 功能要点

- 监理日记字段录入与本地持久化（`app.getPath('userData')/data/diaries.json`）
- 基于 Open-Meteo 的天气获取（按城市）
- AI 辅助：`polish`（润色 `constructionStatus` / `inspectionWork`）与 `analyze`（全字段生成）两种模式
- AI provider：本地 Ollama 与 OpenAI 兼容协议（OpenRouter 等）
- 严格的防胡编规则：人员、机械、施工部位、验收结论不得虚构
- 机电（MEP）友好：识别土建/钢筋/木工/水电/消防/暖通/智能化/电梯等常见班组与施工机械
- Word 导出：基于 docx 模板按单元格行列位置回填

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

`pizzip`（docx 模板渲染主力），`react`、`react-dom`、`lucide-react`（前端，需要原始前端工程支持）。`docxtemplater` 已在 deps 中，但当前 `docx.cjs` 用的是 PizZip + 自写 XML 替换。

## TODO（后续）

- [ ] 归档原始 React/Vite 前端源码
- [ ] 周报 / 月报自动汇总
- [ ] 监理通知单 / 旁站记录 / 隐蔽验收记录派生
- [ ] MEP 专业巡视清单（给排水 / 电气 / 暖通 / 消防 / 智能化 / 电梯）
- [ ] 把 `buildDiaryCoreAnalysisPrompt` 接入 UI（目前未引用）

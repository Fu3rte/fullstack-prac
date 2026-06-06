# AI Agent 知识库

## 一、什么是 AI Agent

AI Agent（智能体）是一个能够**自主感知环境、做出决策并执行行动**的 LLM 应用系统。与单纯的对话模型不同，Agent 具备：

- **工具调用（Tool Use）** — 调用外部 API、执行代码、操作文件
- **记忆管理（Memory）** — 维护短期上下文和长期知识
- **规划能力（Planning）** — 将复杂任务拆解为多步执行
- **反馈循环（Feedback Loop）** — 根据执行结果调整下一步动作

```
用户输入
    │
    ▼
┌──────────────────┐
│    LLM 推理       │  ← 理解意图、选择工具、生成计划
└──────┬───────────┘
       │ 工具调用
       ▼
┌──────────────────┐
│   外部工具        │  ← 文件系统、数据库、API、Shell
└──────┬───────────┘
       │ 执行结果
       ▼
┌──────────────────┐
│   LLM 分析结果    │  ← 判断是否完成，或继续下一步
└──────────────────┘
```

---

## 二、Claude Code 架构分析

Claude Code（`@anthropic-ai/claude-code`）是 Anthropic 推出的 **命令行 AI 编程助手**，本质是一个运行在终端中的 Agent 系统。

### 2.1 整体架构

```
终端（用户）
    │
    ▼
┌─────────────────────────────────────────────┐
│              Claude Code CLI                 │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Agent Loop │  │ Tool Set │  │ MCP Host │  │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  │
└────────┼──────────────┼─────────────┼────────┘
         │              │             │
         ▼              ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Anthropic │  │ 本地文件  │  │ MCP     │
    │  API     │  │ Shell    │  │ Server  │
    │ (Claude) │  │ Git      │  │ (第三方) │
    └──────────┘  └──────────┘  └──────────┘
```

### 2.2 Agent Loop（核心循环）

Claude Code 的核心是一个 **ReAct 风格的 Agent 循环**：

```
Step 1: 读取用户输入 + 系统提示词（System Prompt）
Step 2: LLM 推理 → 决定下一步动作
Step 3: 如果选择了工具 → 执行工具调用 → 将结果返回给 LLM
Step 4: LLM 分析结果 → 要么继续调用工具，要么生成最终回答
Step 5: 输出给用户
         │
         ▼
      回到 Step 2（直到任务完成）
```

这个循环的关键特征：

- **每个工具调用结果都喂回给 LLM**，形成"思考 → 行动 → 观察"的闭环
- LLM 可以连续调用多个工具，不需要每次都询问用户
- 支持 **并行工具调用**（同时发起多个独立操作）

### 2.3 核心工具列表

Claude Code 内置了以下工具（推测，基于公开资料和功能反推）：

| 工具 | 功能 | 说明 |
|---|---|---|
| `Read` | 读取文件 | 支持范围读取、head/tail |
| `Edit` | 编辑文件 | SEARCH/REPLACE 格式，原子化修改 |
| `Write` | 创建文件 | 写入新文件 |
| `Bash` | 执行命令 | 运行 Shell 命令（沙箱化） |
| `Glob` | 文件搜索 | 按模式匹配文件名 |
| `Grep` | 内容搜索 | 在文件内容中搜索 |
| `DirectoryTree` | 目录树查看 | 递归列出目录结构 |
| `WebSearch` | 网络搜索 | 搜索互联网（可选） |
| `WebFetch` | 网页抓取 | 下载 URL 内容 |

### 2.4 系统提示词（System Prompt）设计

Claude Code 的系统提示词（`CLAUDE.md`）是其 Agent 行为的核心控制手段。用户在项目根目录放置 `CLAUDE.md`，内容会注入到每次会话的系统提示词中。

典型的 `CLAUDE.md` 结构：

```markdown
# Project Guide

## Tech Stack
- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI + PostgreSQL
- Database: PostgreSQL 16 + pgvector

## Conventions
- 使用函数式组件和 Hooks
- API 路径统一为 /api/v1/...
- 错误处理使用 HTTPException

## Restrictions
- 不要修改 .env 文件
- 不要直接操作生产数据库
- 所有数据库变更需要通过 migration

## Quality Standards
- 每个新功能需要单元测试
- TypeScript 严格模式
- 代码提交前运行 lint
```

### 2.5 CLAUDE.md 优先级

```
CLAUDE.md（项目根目录）    ← 最高优先级
  └─ .claude/settings.json  ← 项目级配置
       └─ 用户全局配置       ← 最低优先级
```

### 2.6 上下文管理

Claude Code 使用以下策略管理上下文窗口：

- **`/compact`** — 压缩历史记录，保留关键信息，释放 token
- **`/clear`** — 清空当前会话上下文
- **自动摘要** — 当上下文接近限制时，自动对历史进行摘要

---

## 三、MCP 协议（Model Context Protocol）

MCP 是 Anthropic 开源的 **AI 模型与外部工具/数据源的标准化通信协议**。本质上是"AI 应用的 USB-C 接口"。

### 3.1 协议分层

```
┌────────────────────────────────────┐
│            Host（AI 应用）           │
│  Claude Desktop / Cursor / VS Code │
└──────────────┬─────────────────────┘
               │
┌──────────────▼─────────────────────┐
│        MCP Client（协议客户端）       │
│  发现工具 → 调用工具 → 获取结果      │
└──────────────┬─────────────────────┘
               │ JSON-RPC 2.0
               │ (stdio / Streamable HTTP)
┌──────────────▼─────────────────────┐
│        MCP Server（工具服务端）       │
│  文件系统 / 数据库 / GitHub / API    │
└──────────────┬─────────────────────┘
               │
               ▼
          Data Source（数据源）
```

### 3.2 核心概念

| 角色 | 说明 |
|---|---|
| **Host** | 用户直接使用的 AI 应用，负责 LLM 调用和用户交互 |
| **Client** | Host 内部的 MCP 通信层，负责发现和调用 Server |
| **Server** | 暴露具体能力的服务端，封装工具、资源和提示词模板 |

### 3.3 Server 暴露的能力

**Tools（工具）** — 可执行动作，模型主动调用

```json
{
  "name": "read_file",
  "description": "读取指定路径的文件内容",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "文件路径" }
    },
    "required": ["path"]
  }
}
```

**Resources（资源）** — 只读数据，供模型参考

```json
{
  "uri": "file:///logs/app.log",
  "mimeType": "text/plain",
  "name": "application logs"
}
```

**Prompts（提示词模板）** — 可复用的任务模板

```json
{
  "name": "code_review",
  "description": "按团队规范做代码审查",
  "arguments": [
    { "name": "diff", "description": "代码 diff", "required": true }
  ]
}
```

### 3.4 通信方式

| 方式 | 适用场景 | 说明 |
|---|---|---|
| **stdio** | 本地工具/文件 | Server 作为子进程启动，通过 stdin/stdout 通信 |
| **Streamable HTTP** | 远程/团队服务 | 统一 HTTP 端点，支持流式响应 |

### 3.5 一次完整的 MCP 调用流程

```
1. 初始化握手
   Client → Server: {"jsonrpc":"2.0","method":"initialize",...}
   Server → Client: {"jsonrpc":"2.0","result":{"protocolVersion":"2025-03-26",...}}
   Client → Server: {"jsonrpc":"2.0","method":"notifications/initialized"}

2. 获取工具列表
   Client → Server: {"jsonrpc":"2.0","method":"tools/list"}
   Server → Client: {"jsonrpc":"2.0","result":{"tools":[...]}}

3. 调用工具
   Client → Server: {
     "jsonrpc":"2.0",
     "method":"tools/call",
     "params":{"name":"read_file","arguments":{"path":"/repo/main.py"}},
     "id":1
   }
   Server → Client: {
     "jsonrpc":"2.0",
     "id":1,
     "result":{"content":[{"type":"text","text":"文件内容..."}]}
   }
```

---

## 四、相关学术论文

### 4.1 ReAct: Synergizing Reasoning and Acting in Language Models

- **作者**：Shunyu Yao et al. (Google / Princeton)
- **发表**：ICLR 2023 / arXiv:2210.03629
- **核心思想**：

将 **推理（Reasoning）** 和 **行动（Acting）** 交织在一起，而不是分开处理。

```
标准 LLM:  思考 → 思考 → 思考 → 回答
ReAct:     思考 → 行动 → 观察 → 思考 → 行动 → 观察 → 回答
```

- **关键发现**：ReAct 在知识密集型推理任务上优于纯推理或纯行动方法，同时减少了幻觉（模型编造事实）。

### 4.2 Toolformer: Language Models Can Teach Themselves to Use Tools

- **作者**：Timo Schick et al. (Meta AI)
- **发表**：arXiv:2302.04761 (2023)
- **核心思想**：

模型通过**自我监督**学习调用外部工具（计算器、搜索引擎、翻译器、日历等），而不需要人工标注工具调用数据。

- **方法**：模型自行决定哪些 API 调用能帮助生成更好的答案，用这些调用结果微调自己。

### 4.3 Tree of Thoughts (ToT)

- **作者**：Shunyu Yao et al. (Google / Princeton)
- **发表**：arXiv:2305.10601 (2023)
- **核心思想**：

将推理过程扩展为**树状搜索**，而不是线性链。LLM 在每一步生成多个可能的"思考"，并评估每个分支的前景，像人类下棋一样往前推演多步。

```
Chain of Thought:  步骤1 → 步骤2 → 步骤3 → 答案
Tree of Thoughts:  步骤1 → [步骤2a → 步骤3a]
                         → [步骤2b → 步骤3b]
                         → [步骤2c] (剪枝)
```

### 4.4 Reflexion: Language Agents with Verbal Reinforcement Learning

- **作者**：Noah Shinn et al. (Northeastern / Microsoft)
- **发表**：NeurIPS 2023 / arXiv:2303.11366
- **核心思想**：

Agent 在执行任务后，**反思失败原因并存储到记忆**中，下次遇到类似情况时不再犯同样错误。

```
执行 → 失败 → 反思（"为什么失败？"） → 存储经验 → 下次避免
```

### 4.5 Generative Agents: Interactive Simulations of Human Behavior

- **作者**：Joon Sung Park et al. (Stanford / Google)
- **发表**：UIST 2023 / arXiv:2304.03442
- **核心思想**：

用 LLM 驱动 25 个 Agent 在虚拟小镇中生活，每个 Agent 具有：

- **记忆流** — 记录所有经历，按重要性排序
- **反思** — 定期对记忆做更高层次的抽象
- **规划** — 基于记忆和反思制定每日计划

### 4.6 SWE-agent / SWE-bench

- **作者**：John Yang et al. (Princeton)
- **发表**：arXiv:2405.15793 (2024)
- **核心思想**：

专门为 GitHub Issue 修复设计的 Agent 框架，模型通过 **Agent-Computer Interface (ACI)** 与代码仓库交互。SWE-bench 成为评估 coding agent 的事实标准数据集。

### 4.7 其他重要论文

| 论文 | 年份 | 核心贡献 |
|---|---|---|
| **Chain-of-Thought** (Wei et al.) | 2022 | 让模型逐步推理，大幅提升复杂推理能力 |
| **Self-Refine** (Madaan et al.) | 2023 | 模型自我生成反馈并迭代改进输出 |
| **AutoGPT / BabyAGI** | 2023 | 开源项目，展示了"任务队列 + 循环执行"的 Agent 模式 |
| **OpenAI Function Calling** | 2023 | 首次将工具调用内建到模型 API 中 |
| **MetaGPT** (Hong et al.) | 2023 | 多 Agent 协作，模拟软件公司角色分工 |
| **CrewAI** | 2024 | 多 Agent 编排框架，支持角色定义和任务委派 |

---

## 五、Agent 设计模式

### 5.1 单一 Agent 循环（Single Agent Loop）

```
while task not complete:
    1. LLM 观察当前状态 + 历史
    2. LLM 决定下一个动作（调工具/生成回答）
    3. 执行动作
    4. 将结果反馈给 LLM
```

**适用场景**：简单的、明确的、单领域任务。

**代表**：Claude Code、ChatGPT with Plugins。

### 5.2 多 Agent 协作（Multi-Agent Collaboration）

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Product    │     │   Architect  │     │   Engineer   │
│   Manager    │────▶│              │────▶│              │
│  (规划需求)   │     │  (设计方案)   │     │  (编码实现)   │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Tester    │
                    │  (验证质量)   │
                    └──────────────┘
```

**适用场景**：复杂项目、需要不同角色分工的任务。

**代表**：MetaGPT、CrewAI、AutoGen。

### 5.3 分层 Agent（Hierarchical Agent）

```
                    ┌──────────┐
                    │ Orcherator│  ← 顶层调度，任务分解
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ SubAgent │   │ SubAgent │   │ SubAgent │  ← 各子任务执行
    │  (搜索)   │   │  (编码)   │   │  (测试)   │
    └──────────┘   └──────────┘   └──────────┘
```

**特点**：Orchestrator 负责高层规划，SubAgent 专注执行，彼此隔离。

**代表**：Reasonix Code 的 subagent 机制。

### 5.4 Agent 核心能力矩阵

```
                    ┌──────────────────────┐
                    │     记忆 (Memory)     │
                    │  短期：上下文窗口      │
                    │  长期：向量数据库      │
                    └──────────┬───────────┘
                               │
┌──────────────┐    ┌──────────▼───────────┐    ┌──────────────┐
│  规划        │    │     LLM Core         │    │  工具调用     │
│  (Planning)  │◀───│  (推理 + 决策)       │───▶│  (Tool Use)  │
│  - 任务分解   │    │                      │    │  - 读文件     │
│  - 多步推理   │    │                      │    │  - 写代码     │
│  - 优先级排序  │    │                      │    │  - 执行命令   │
└──────────────┘    └──────────────────────┘    └──────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   反思 (Reflection)   │
                    │  自我纠错 / 经验积累   │
                    └──────────────────────┘
```

---

## 六、RAG（检索增强生成）与 Agent 的关系

RAG 是 Agent 的一个重要子集——专门解决"LLM 需要外部知识"的问题。

```
RAG 流程:
用户提问 → 向量检索 → 获取相关文档 → LLM 基于文档回答

Agent 流程:
用户提问 → LLM 推理 → 可能需要多种工具：
    ├─ 向量检索（找知识）
    ├─ 代码执行（算结果）
    ├─ API 调用（查数据）
    └─ 文件读写（整理文档）
         │
         ▼
    综合分析所有结果 → 回答
```

**RAG 是 Agent 的"知识工具"，而 Agent 是 RAG 的"执行引擎"。** 生产系统中的 RAG 通常需要 Agent 来协调：

- 判断是否需要检索
- 选择检索策略（关键词 / 向量 / 混合）
- 对检索结果进行重排序和过滤
- 组合多个来源的信息回答

---

## 七、生产环境 Agent 的关键考量

### 7.1 安全性

- **工具权限最小化** — 文件读取限目录，SQL 执行限只读
- **提示词注入防护** — 外部输入可能包含恶意指令，需做输入消毒
- **操作确认机制** — 写操作、删除操作需用户确认
- **审计日志** — 记录每一步的工具调用和参数

### 7.2 可靠性

- **超时控制** — 每个工具调用设置超时时间
- **重试策略** — 网络失败时自动重试
- **降级处理** — 工具不可用时平滑降级
- **循环检测** — 检测 Agent 陷入死循环

### 7.3 可观测性

- **Trace ID** — 每次用户请求分配唯一追踪 ID
- **工具调用链记录** — 记录每个步骤的输入和输出
- **成本追踪** — 按用户/会话/工具维度统计 Token 消耗
- **性能监控** — 记录每个工具调用的延迟

### 7.4 Token 成本优化

- **压缩历史** — 定期摘要旧对话
- **选择性记忆** — 只保留关键信息，丢弃冗余
- **工具描述精简** — 每个工具的 description 字段也消耗 token
- **子 Agent 隔离** — 复杂任务交给子 Agent 执行，减少主上下文污染

---

## 八、常见问题与最佳实践

### Q: 什么时候用 RAG，什么时候用 Agent？

| 场景 | 方案 |
|---|---|
| 只查固定知识库 | RAG（更简单、更可控） |
| 需要多步推理 + 多种工具 | Agent |
| 知识库 + 需要实时信息 | Agent（RAG + 网络搜索） |
| 帮用户写代码 | Agent（读、写、执行） |

### Q: 如何设计好的工具描述？

工具描述是模型选择工具的关键。遵循"三件套"：

1. **什么场景用这个工具** — "当用户需要读取文件内容时使用"
2. **参数说明** — "path：文件路径，必填"
3. **什么场景不要用** — "如果用户只问文件名，不要调用此工具，用 Glob 搜索"

### Q: Agent 陷入循环怎么办？

- 设置**最大工具调用次数**（如 20 次）
- 设置**超时时间**（如 5 分钟）
- 检测**重复调用模式**（连续 3 次调用同一工具且参数相同）
- 提供**"放弃"工具**，让 Agent 可以主动承认无法完成

---

## 参考资料

1. ReAct: Synergizing Reasoning and Acting in Language Models — arXiv:2210.03629
2. Toolformer: Language Models Can Teach Themselves to Use Tools — arXiv:2302.04761
3. Tree of Thoughts: Deliberate Problem Solving — arXiv:2305.10601
4. Reflexion: Language Agents with Verbal Reinforcement Learning — arXiv:2303.11366
5. Generative Agents: Interactive Simulacra of Human Behavior — arXiv:2304.03442
6. SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering — arXiv:2405.15793
7. MCP 协议规范 — https://modelcontextprotocol.io
8. Anthropic — Claude Code 官方文档
9. Chain-of-Thought Prompting Elicits Reasoning — arXiv:2201.11903
10. MetaGPT: Meta Programming for Multi-Agent Collaborative Framework — arXiv:2308.00352

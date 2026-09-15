# 🧊 AI 冰箱菜谱助手（AI Fridge Chef）

一个基于 DeepSeek 大模型的全栈智能菜谱应用：管理冰箱食材，AI 实时生成菜谱灵感、多日菜单规划、购物清单和营养分析。

> **核心理念：零固定数据。** 项目中不存在任何预置菜谱库、菜系列表或推荐数据，
> 所有内容（食材建议、风格灵感、菜谱、菜单、营养分析）均由 DeepSeek 实时生成，
> 相同的食材组合每次都会得到不同的答案。

## 功能总览

| 模块 | 功能 | 说明 |
|---|---|---|
| 🧊 我的冰箱 | 食材管理 | 卡片式网格 + **AI 生成形象图**（13 种常见食材 3D 黏土风，未收录食材回退 emoji）+ 保质期角标，点击编辑数量/保质期 |
| | **分类/数量自定义** | 每个食材可自定义分类（8 预设 + 任意自定义分区）和数量；输入行支持 `鸡蛋*6个`、`牛肉500g` 快速语法（前后端双端解析） |
| | **默认保质期** | 常见食材入库自动填冷藏保质期（精确表 + 多字关键词兜底，食品常识数据） |
| | **搜索 + 分类筛选** | 关键词搜索 + 横向分类 tabs（肉蛋/水产/蔬菜/豆乳/水果/主食/调味） |
| | **常买食材记忆** | 记录历史添加的食材，一键补回常用食材（localStorage） |
| | **已过期一键清理** | 已过期食材一键从冰箱移除 |
| | **AI 冰箱体检** | AI 营养师分析食材结构：A/B/C/D 评级 + 营养亮点/缺口 + 采购建议 |
| | **保质期预警** | 快过期食材橙色高亮专区，一键进入"拯救模式"让 AI 优先消耗 |
| | **拍照识别** | DeepSeek 视觉模型（v4-flash-vision-exp）识别照片中的食材，带置信度勾选后一键加入冰箱 |
| | AI 采购灵感 | DeepSeek 结合已有食材动态生成分类采购建议，可一键补充 |
| 👨‍🍳 发现菜谱 | AI 风格灵感 | 根据食材生成 6 个风格方向（每次不同），如「深夜食堂风」「低卡轻食风」 |
| | AI 菜谱生成 | **SSE 流式输出**：按食材 + 风格 + 人数 + 口味偏好实时生成 3~5 道菜（道数可选），打字机效果逐字渲染，首屏 ~2 秒可见 |
| | **食材参与筛选** | 折叠面板勾选哪些食材参与本次生成，精确控制方向 |
| | **快捷偏好标签** | 微辣/下饭/减脂/一人食等 8 个标签一键注入偏好，可叠加/取消 |
| | **往期灵感** | 每批生成结果自动归档（保留 6 批），折叠回看不丢失 |
| | 换一批 | 自动排除已生成过的菜名，避免重复 |
| | 营养分析 | AI 营养师分析热量/蛋白/碳水/脂肪/纤维 + 改进建议 |
| | **做菜打卡** | 详情页"做完了打卡"：星级评分 + 一句话心得，累积厨艺档案 |
| 🍳 我的厨房 | **成就系统** | 初次开火/小试牛刀/十全十美/百炼成厨，基于真实打卡数据规则点亮 |
| | **AI 美食评审** | 拍成品照，视觉模型点评色泽/摆盘 + 打分 + 改进建议 |
| | 做菜记录 | 打卡时间线（评分/心得/相对日期），连续开火天数统计 |
| 📅 菜单规划 | 多日菜单 | 按天数生成菜单，**餐次自定义**（早餐/午餐/晚餐任选），标注已有/缺失食材 |
| | **缺料采购清单** | 全菜单缺料自动汇总（按出现次数排序），勾选状态 localStorage 持久化 |
| | **保存菜单** | 一键保存菜单（持久化），已保存列表可回看/删除 |
| | **复制导出** | 菜单一键复制为文本，方便分享 |
| | 购物清单 | 输入想吃的菜，AI 对比冰箱食材生成采购清单 |
| ❤️ 收藏 | 菜谱收藏 | 收藏喜欢的菜谱，随时回看 |

## 技术栈

- **前端**：React 18 + TypeScript + Vite + TailwindCSS + Zustand + React Router
- **后端**：Python FastAPI + SQLAlchemy 2.0 + SQLite
- **AI**：DeepSeek Chat API（`response_format: json_object` 结构化输出，SSE 流式）+ DeepSeek Vision（`deepseek-v4-flash-vision-exp` 图像理解，图片按 token 计费）
- **工程**：RESTful API / SSE 流式推送 / Canvas 端侧图片压缩 / 环境变量管理密钥 / Vite 开发代理解决跨域

## 项目结构

```
ai-fridge-chef/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口 + CORS
│   │   ├── config.py            # 配置（密钥从 .env 读取，不硬编码）
│   │   ├── database.py          # SQLAlchemy 引擎与会话
│   │   ├── models.py            # Ingredient / Favorite 数据模型
│   │   ├── schemas.py           # Pydantic 请求/响应模型
│   │   ├── deepseek.py          # DeepSeek 客户端封装（JSON 解析 + 重试 + 随机温度 + 流式 + 视觉）
│   │   ├── prompts.py           # Prompt 模板（文本 + 视觉识别，含随机灵感因子）
│   │   └── routers/
│   │       ├── ingredients.py   # 食材 CRUD + AI 采购建议 + 拍照识别
│   │       ├── recipes.py       # 风格灵感 / 菜谱生成（含 SSE 流式）/ 营养分析 / 收藏
│   │       ├── planner.py       # 菜单规划 / 购物清单 / 保存菜单
│   │       └── kitchen.py       # 做菜打卡 / 成就统计 / AI 美食评审
│   ├── .env                     # 环境变量（已加入 .gitignore，勿提交）
│   ├── .env.example             # 环境变量模板
│   ├── requirements.txt
│   ├── run.py                   # 启动脚本（端口 8730）
│   ├── seed.py                  # 演示数据脚本（--reset 可清空重写）
│   ├── test_deepseek.py         # 密钥连通性自检
│   ├── test_sse.py              # SSE 流式接口直连测试
│   ├── test_recognize.py        # 拍照识别接口测试（需 test_food_photo.jpg）
│   ├── test_kitchen.py          # 打卡/成就/统计 20 个测试用例
│   ├── test_planner.py          # 道数/餐次校验 + 保存菜单 CRUD 12 个用例
│   ├── test_fridge.py           # 保质期映射 + 自定义分类/数量 + 体检校验 30 个用例
│   └── test_food_photo.jpg      # 视觉识别测试样图
└── frontend/
    ├── src/
    │   ├── api/client.ts        # 统一 API 封装（含 SSE 流式读取器）
    │   ├── stores/fridge.ts     # Zustand 全局状态
    │   ├── types/index.ts       # TypeScript 类型定义
    │   ├── utils/partialJson.ts # 部分 JSON 渐进解析器（流式打字机效果核心）
    │   ├── utils/foodEmoji.ts   # 食材 emoji 图标库 + 保质期计算
    │   ├── utils/compress.ts    # 图片端侧压缩（拍照识别/AI 评审共用）
    │   ├── components/          # AILoading / RecipeCard / RecipeDetailSheet / PhotoRecognizer / IngredientEditSheet / CritiquePanel
    │   └── pages/               # 冰箱 / 菜谱 / 规划 / 厨房 / 收藏 五页面
    ├── vite.config.ts           # 端口 5174 + /api 代理
    └── ...
```

## 快速启动

### 1. 后端（端口 8730）

```bash
cd backend
pip install -r requirements.txt
python run.py
```

> 首次使用请将 `.env.example` 复制为 `.env` 并填入你的 DeepSeek API Key
> （本机已配置好）。密钥自检：`python test_deepseek.py`

### 2. 前端（端口 5174）

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5174 即可使用（已配置 `/api` 代理到后端，无需额外跨域配置）。

## 防“逻辑固化”设计（面试重点）

这是本项目区别于普通 CRUD 应用的核心，三层机制保证 AI 输出不死板：

1. **零预置数据**：后端没有菜谱表、没有菜系枚举、没有推荐词库，一切由模型生成；
2. **随机灵感因子**（`prompts.py → _spark()`）：每次请求注入不同的方向提示
   （时令搭配 / 快手菜 / 慢料理 / 异国风味 / 减脂需求…），主动引导输出差异化；
3. **动态温度扰动**（`deepseek.py → creative_temperature()`）：采样温度在 0.75~1.15
   间随机浮动，进一步降低同质化；生成类接口用高温（多样性），营养分析用低温（准确性）。

辅助机制：`excluded` 字段携带历史生成菜名做去重；风格灵感支持“换一批”重生成。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/ingredients` | 食材增删改查 |
| POST | `/api/ingredients/recognize` | 拍照识别食材（视觉模型） |
| GET | `/api/ingredients/suggestions` | AI 采购灵感 |
| GET | `/api/ingredients/health-check` | AI 冰箱体检（评级/亮点/缺口/建议） |
| PATCH | `/api/ingredients/{id}` | 更新食材数量/保质期 |
| POST | `/api/kitchen/checkin` | 做菜打卡（评分/心得） |
| GET | `/api/kitchen/stats` | 厨房统计（成就/连续天数/记录） |
| POST | `/api/kitchen/critique` | AI 美食评审（视觉模型点评成品照） |
| POST | `/api/recipes/styles` | AI 风格灵感 |
| POST | `/api/recipes/generate` | AI 菜谱生成（一次性 JSON） |
| POST | `/api/recipes/generate-stream` | AI 菜谱生成（SSE 流式，打字机效果） |
| POST | `/api/recipes/nutrition` | AI 营养分析 |
| GET/POST/DELETE | `/api/recipes/favorites` | 收藏管理 |
| POST | `/api/planner/meal-plan` | 多日菜单规划（支持自定义餐次） |
| POST | `/api/planner/groceries` | 购物清单生成 |
| GET/POST | `/api/planner/saved-plans` | 已保存菜单列表 / 保存菜单 |
| DELETE | `/api/planner/saved-plans/{id}` | 删除已保存菜单 |

完整交互文档：启动后端后访问 http://127.0.0.1:8730/docs （FastAPI 自动生成）。

## 面试亮点话术

- **LLM 工程实践**：OpenAI 兼容协议接入 DeepSeek、`json_object` 结构化输出、
  三重 JSON 解析兜底（裸 JSON → code fence → 花括号截取）、失败自动重试；
- **SSE 流式 + 自研渐进解析器**：后端流式转发模型输出，前端在 JSON 未闭合时
  通过字符级状态机（字符串/转义/深度三态）实时提取已完成字段与数组元素，
  实现"菜名先现、描述逐字、步骤逐条"的打字机渲染，首屏反馈从 8s+ 优化到 ~2s；
- **多模态落地**：接入 DeepSeek 视觉模型（v4-flash-vision-exp）实现拍照识别食材，
  前端 Canvas 端侧压缩（最长边 1024 / JPEG 0.82，原图数 MB → 数百 KB）降低
  传输与 token 成本，识别结果带置信度勾选回流；实测 5 种食材 5/5 命中、~3s 返回；
- **Prompt Engineering**：角色设定 + 结构化要求 + 随机灵感因子 + 排除列表的组合设计；
- **全栈能力**：FastAPI 分层架构（routers/models/schemas）、SQLAlchemy 2.0
  Mapped 注解风格、React Hooks + Zustand 状态管理、Vite 代理跨域方案；
- **产品质量意识**：为核心解析器编写 9 个流式中间态断言（覆盖转义/嵌套/未闭合
  数组等边界），SSE 提供 `X-Accel-Buffering: no` 防代理缓冲。

> 完整的简历项目经历、30 秒口头介绍与面试 Q&A 预演见 [简历描述.md](./简历描述.md)。

## 安全说明

- API Key 存放于 `backend/.env`，通过 `python-dotenv` 注入，`.gitignore` 已排除；
- 请勿将 `.env` 提交到公开仓库，密钥泄露请及时在 DeepSeek 平台重置。

## 后续可扩展方向

- 接入视觉模型（如通义千问 VL / GPT-4V）实现拍照识别冰箱食材；
- 流式输出（SSE）实现打字机效果；用户系统与多设备同步；
- 换用 PostgreSQL + Redis（缓存食材建议类低频变化内容）支撑生产部署。

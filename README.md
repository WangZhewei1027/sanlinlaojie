二、目录的三大层级（非常重要）

① 全局可复用（跨路由）

👉 放在 /components（根目录）

② 路由内复用（只服务一个路由）

👉 放在 /app/xxx/components

③ 只被一个文件用

👉 就地定义 / 同级文件


类型放哪里

全局通用（User / Pagination）
/types

路由专用（Workspace / Asset）
/app/route/types.ts

API schema
/lib/schemas

app/manage/
├─ page.tsx            # 只做组合（<70 行）
├─ layout.tsx          # 可选
├─ components/
│  ├─ ManageSidebar.tsx
│  ├─ ViewerFrame.tsx
│  ├─ WorkspaceSelect.tsx
│  ├─ ClickedLocationCard.tsx
├─ hooks/
│  ├─ useWorkspaces.ts
│  ├─ useAssets.ts
│  ├─ useViewerMessaging.ts
├─ types.ts
├─ constants.ts


七、你可以直接贴在项目里的“拆分决策 checklist” ✅

在新建文件前，逐条问自己：

	•	这个组件是否被 多个路由 使用？
	•	它是否 不包含业务语义？
→ ✅ 是 → /components
	•	它是否 只服务当前路由？
	•	它的名字是否带业务含义？
→ ✅ 是 → /app/route/components
	•	它是否 < 20 行且无复用价值？
→ ✅ 是 → 留在当前文件
	•	这个文件是否 > 120 行？
→ ✅ 是 → 必须拆
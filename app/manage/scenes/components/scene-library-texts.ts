import { ERROR_TEXTS } from "../../lib/content-errors";
import type { IntegrationTexts } from "../../lib/integration-text";

export const SCENE_LIBRARY_TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.sceneLibrary.label": ["模型素材", "Model assets"],
  "contentModel.integration.sceneLibrary.views.scene": ["本场景", "In scene"],
  "contentModel.integration.sceneLibrary.views.team": ["团队模型", "Team models"],
  "contentModel.integration.sceneLibrary.search": ["搜索模型…", "Search models…"],
  "contentModel.integration.sceneLibrary.add": ["添加 {{name}}", "Add {{name}}"],
  "contentModel.integration.sceneLibrary.drag": ["拖入场景，或点击 + 添加", "Drag into the scene or click +"],
  "contentModel.integration.sceneLibrary.upload": ["上传并添加", "Upload and add"],
  "contentModel.integration.sceneLibrary.uploading": ["正在上传…", "Uploading…"],
  "contentModel.integration.sceneLibrary.loadMore": ["加载更多", "Load more"],
  "contentModel.integration.sceneLibrary.emptyScene": ["从团队模型选择，或上传一个模型，开始编排。", "Choose a team model or upload one to start arranging."],
  "contentModel.integration.sceneLibrary.emptyTeam": ["团队还没有 3D 模型。可直接上传，上传后整个团队都能看到。", "The team has no 3D models yet. Upload one; the whole team will see it."],
  "contentModel.integration.sceneLibrary.noResults": ["没有匹配的模型", "No matching models"],
  "contentModel.integration.sceneLibrary.instances": ["{{count}} 个对象", "{{count}} objects"],
  "contentModel.integration.sceneLibrary.missing": ["文件缺失", "File missing"],
  "contentModel.integration.sceneLibrary.retry": ["重新加载", "Try again"],
  "contentModel.integration.sceneLibrary.loading": ["正在加载模型…", "Loading models…"],
  "contentModel.integration.sceneLibrary.limit": ["场景对象数量已达上限。移除对象后可继续添加。", "This scene is at its object limit. Remove an object to add another."],
};

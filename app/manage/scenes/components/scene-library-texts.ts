import { ERROR_TEXTS } from "../../lib/content-errors";
import type { IntegrationTexts } from "../../lib/integration-text";

export const SCENE_LIBRARY_TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.sceneLibrary.label": ["素材库", "Asset library"],
  "contentModel.integration.sceneLibrary.views.scene": ["本场景", "In scene"],
  "contentModel.integration.sceneLibrary.views.team": ["团队素材", "Team assets"],
  "contentModel.integration.sceneLibrary.search": ["搜索素材…", "Search assets…"],
  "contentModel.integration.sceneLibrary.add": ["添加 {{name}}", "Add {{name}}"],
  "contentModel.integration.sceneLibrary.drag": ["拖入舞台或时间轴，或点击 + 添加", "Drag onto the stage or timeline, or click +"],
  "contentModel.integration.sceneLibrary.upload": ["上传并添加", "Upload and add"],
  "contentModel.integration.sceneLibrary.uploading": ["正在上传…", "Uploading…"],
  "contentModel.integration.sceneLibrary.loadMore": ["加载更多", "Load more"],
  "contentModel.integration.sceneLibrary.emptyScene": ["从团队素材选择，或上传一个模型，开始编排。", "Add models, images, audio or video from your team."],
  "contentModel.integration.sceneLibrary.emptyTeam": ["没有可用素材。上传后整个团队都能使用。", "No assets yet. Upload one to share with your team."],
  "contentModel.integration.sceneLibrary.noResults": ["没有匹配的素材", "No matching assets"],
  "contentModel.integration.sceneLibrary.instances": ["{{count}} 个对象", "{{count}} objects"],
  "contentModel.integration.sceneLibrary.missing": ["文件缺失", "File missing"],
  "contentModel.integration.sceneLibrary.retry": ["重新加载", "Try again"],
  "contentModel.integration.sceneLibrary.loading": ["正在加载素材…", "Loading assets…"],
  "contentModel.integration.sceneLibrary.limit": ["场景对象数量已达上限。移除对象后可继续添加。", "This scene is at its object limit. Remove an object to add another."],
};

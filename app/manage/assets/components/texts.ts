import { ERROR_TEXTS } from "@/app/manage/lib/content-errors";
import type { IntegrationTexts } from "@/app/manage/lib/integration-text";

/**
 * zh/en fallbacks for every string the asset pages render through `tx`. The
 * locale files win once they carry these keys (see integration-text.ts).
 */
export const ASSET_TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  // Library
  "contentModel.integration.assets.title": ["素材库", "Asset library"],
  "contentModel.integration.assets.unknownOrganization": ["当前组织", "Current organization"],
  "contentModel.integration.assets.endpointMissing": ["素材服务尚未就绪，请稍后再试。", "The asset service is not available yet. Try again later."],
  "contentModel.integration.assets.loadMoreFailed": ["加载更多失败", "Could not load more"],
  "contentModel.integration.assets.created": ["已上传“{{name}}”", "Uploaded “{{name}}”"],
  "contentModel.integration.assets.open": ["打开", "Open"],
  "contentModel.integration.assets.addedToProject": ["已加入当前项目", "Added to the current project"],
  // Create dialog
  "contentModel.integration.assets.create.title": ["上传素材", "Upload asset"],
  "contentModel.integration.assets.create.body": [
    "素材会加入“{{project}}”并获得使用授权，不会自动投放到地图。",
    "The asset is added to “{{project}}” with a use grant. Nothing is placed on the map.",
  ],
  "contentModel.integration.assets.create.type": ["类型", "Type"],
  "contentModel.integration.assets.create.name": ["名称", "Name"],
  "contentModel.integration.assets.create.file": ["文件", "File"],
  "contentModel.integration.assets.create.text": ["文字内容", "Text"],
  "contentModel.integration.assets.create.url": ["链接地址", "Link"],
  "contentModel.integration.assets.create.urlHint": ["支持网址或 iframe 嵌入代码。", "A web address or an iframe embed code."],
  "contentModel.integration.assets.create.visibility": ["共享范围", "Sharing"],
  "contentModel.integration.assets.create.restricted": ["仅授权项目", "Granted projects only"],
  "contentModel.integration.assets.create.restrictedHint": ["只有维护者、管理员和获授权的项目可以使用。", "Only the maintainer, admins and granted projects can use it."],
  "contentModel.integration.assets.create.organization": ["组织共享", "Shared with organization"],
  "contentModel.integration.assets.create.organizationHint": ["同组织成员可以浏览，项目编辑者可以选用。", "Organization members can browse it; project editors can use it."],
  "contentModel.integration.assets.create.submit": ["上传", "Upload"],
  "contentModel.integration.assets.create.retry": ["重试", "Retry"],
  "contentModel.integration.assets.create.cancel": ["取消", "Cancel"],
  "contentModel.integration.assets.create.preparing": ["正在处理文件…", "Processing file…"],
  "contentModel.integration.assets.create.uploading": ["正在上传…", "Uploading…"],
  "contentModel.integration.assets.create.creating": ["正在创建素材…", "Creating asset…"],
  // Detail
  "contentModel.integration.assetDetail.back": ["素材库", "Asset library"],
  "contentModel.integration.assetDetail.rename": ["重命名", "Rename"],
  "contentModel.integration.assetDetail.renameTitle": ["重命名素材", "Rename asset"],
  "contentModel.integration.assetDetail.renameBody": ["新名称在所有项目中同步显示，已有引用不受影响。", "The new name shows in every project; existing references are unaffected."],
  "contentModel.integration.assetDetail.name": ["名称", "Name"],
  "contentModel.integration.assetDetail.save": ["保存", "Save"],
  "contentModel.integration.assetDetail.cancel": ["取消", "Cancel"],
  "contentModel.integration.assetDetail.duplicate": ["另存素材副本", "Save as copy"],
  "contentModel.integration.assetDetail.duplicateBody": [
    "副本是一个新素材，拥有独立的版本序列；原素材及其引用保持不变。",
    "The copy is a new asset with its own version history; the original and its references stay unchanged.",
  ],
  "contentModel.integration.assetDetail.duplicateName": ["{{name}} 副本", "{{name}} copy"],
  "contentModel.integration.assetDetail.duplicateAction": ["保存副本", "Save copy"],
  "contentModel.integration.assetDetail.targetProject": ["目标项目", "Target project"],
  "contentModel.integration.assetDetail.targetChecking": ["正在确认项目权限…", "Checking project permissions…"],
  "contentModel.integration.assetDetail.targetNoEdit": ["你在该项目没有编辑权限。", "You cannot edit this project."],
  "contentModel.integration.assetDetail.targetArchived": ["该项目已归档。", "This project is archived."],
  "contentModel.integration.assetDetail.noProjects": ["当前组织没有可选项目。", "This organization has no projects to choose from."],
  "contentModel.integration.assetDetail.notFound": ["素材不存在，或已不在你可访问的范围内。", "The asset does not exist or is no longer available to you."],
  "contentModel.integration.assetDetail.forbidden": ["你没有查看该素材的权限。", "You do not have access to this asset."],
  "contentModel.integration.assetDetail.noUploadProject": [
    "找不到接收上传的项目：该素材没有来源项目，也没有项目授权。",
    "No project can receive the upload: the asset has no origin project and no project grants.",
  ],
  "contentModel.integration.assetDetail.archivedTitle": ["素材已归档", "Asset archived"],
  "contentModel.integration.assetDetail.archivedImpact": ["以下引用继续使用已固定的版本：", "These references keep using their pinned version:"],
  "contentModel.integration.assetDetail.archivedNoImpact": ["目前没有引用。", "Nothing references it."],
  "contentModel.integration.assetDetail.refreshFailed": ["刷新失败，页面显示的可能不是最新数据。", "Refresh failed; this page may not show the latest data."],
  "contentModel.integration.assetDetail.dismiss": ["关闭", "Dismiss"],
  "contentModel.integration.assetDetail.text": ["文字内容", "Text"],
  "contentModel.integration.assetDetail.link": ["链接", "Link"],
};

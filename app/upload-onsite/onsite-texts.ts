import type { IntegrationTexts } from "@/app/manage/lib/integration-text";

/**
 * zh/en fallbacks for the v2 onsite upload path. Locale files own the final
 * wording; until they carry these keys, `useIntegrationText` uses this table.
 */
export const ONSITE_TEXTS: IntegrationTexts = {
  // Shared keys that already exist in locales (kept here so tx always has a fallback).
  "onsite.title": ["现场上传", "Onsite upload"],
  "onsite.subtitle": ["使用实时GPS定位记录现场信息", "Record what is on site with live GPS"],
  "contentModel.action.retry": ["重试", "Retry"],

  "contentModel.integration.onsite.checkingState": ["正在确认组织的内容模式", "Checking the organization's content mode"],
  "contentModel.integration.onsite.stateError": ["没能确认组织的内容模式", "Could not check the organization's content mode"],
  "contentModel.integration.onsite.readonlyTitle": ["组织正在迁移，暂时不能上传", "The organization is migrating; uploads are paused"],
  "contentModel.integration.onsite.readonlyBody": ["迁移完成后即可继续现场上传。已有投放不受影响。", "Onsite uploads resume once the migration finishes. Existing placements are not affected."],
  "contentModel.integration.onsite.checkingAccess": ["正在确认你在此项目的权限…", "Checking your access to this project…"],
  "contentModel.integration.onsite.accessError": ["没能确认项目权限", "Could not check your project access"],
  "contentModel.integration.onsite.noEditTitle": ["你不能在此项目上传", "You cannot upload to this project"],
  "contentModel.integration.onsite.noEditBody": ["上传需要此项目的编辑者或管理者角色。请联系项目管理者，或切换到其他项目。", "Uploading needs the editor or manager role in this project. Ask a project manager, or switch to another project."],
  "contentModel.integration.onsite.archivedTitle": ["项目已归档", "This project is archived"],
  "contentModel.integration.onsite.archivedBody": ["归档项目的内容只读。恢复项目后才能上传。", "Archived projects are read-only. Restore the project to upload."],
  "contentModel.integration.onsite.missing": ["请先选择项目并确认投放位置。", "Choose a project and confirm the location first."],

  "contentModel.integration.onsite.location.confirm": ["使用此位置", "Use this location"],
  "contentModel.integration.onsite.location.hint": ["上传的内容会投放在你确认的位置。照片自带的拍摄位置只作为来源记录。", "Uploads are placed at the location you confirm. A photo's own GPS data is kept as provenance only."],
  "contentModel.integration.onsite.location.waiting": ["等待定位后再确认位置。", "Wait for a GPS fix, then confirm the location."],
  "contentModel.integration.onsite.location.confirmed": ["已确认投放位置", "Location confirmed"],
  "contentModel.integration.onsite.location.coords": ["经度 {{lon}} · 纬度 {{lat}}", "Lon {{lon}} · Lat {{lat}}"],
  "contentModel.integration.onsite.location.accuracy": ["精度 ±{{meters}} m", "Accuracy ±{{meters}} m"],
  "contentModel.integration.onsite.location.altitude": ["海拔 {{meters}} m", "Altitude {{meters}} m"],
  "contentModel.integration.onsite.location.update": ["改用当前位置", "Use current location"],
  "contentModel.integration.onsite.location.clear": ["取消确认", "Clear"],
  "contentModel.integration.onsite.location.drift": ["你已离开确认位置约 {{meters}} 米。", "You are about {{meters}} m from the confirmed location."],
  "contentModel.integration.onsite.location.lowAccuracy": ["当前定位精度较低（±{{meters}} m），可以稍等片刻再确认。", "GPS accuracy is low (±{{meters}} m). Waiting a moment may help."],
  "contentModel.integration.onsite.location.required": ["先确认投放位置，再拍照、录音或输入文字。", "Confirm the location before taking a photo, recording or writing."],

  "contentModel.integration.onsite.defaultName.image": ["现场照片", "Onsite photo"],
  "contentModel.integration.onsite.defaultName.audio": ["现场录音", "Onsite recording"],
  "contentModel.integration.onsite.defaultName.text": ["现场文字", "Onsite note"],

  "contentModel.integration.onsite.error.title": ["上传没有完成", "Upload did not finish"],
  "contentModel.integration.onsite.error.keepCapture": ["当前内容已保留，再次点击上传即可重试。", "Your capture is kept. Tap upload again to retry."],
  "contentModel.integration.onsite.error.idempotency": ["这次采集已经以不同内容提交过。请重新拍摄、录音或输入后再上传。", "This capture was already submitted with different content. Start a new capture and upload again."],
  "contentModel.integration.onsite.error.receipt": ["上传凭证已失效，重试时会重新上传文件。", "The upload receipt expired. Retrying uploads the file again."],

  "contentModel.integration.onsite.receipt.title": ["已上传并投放", "Uploaded and placed"],
  "contentModel.integration.onsite.receipt.replayed": ["与之前的提交相同，以下是第一次提交的结果。", "This matched an earlier submission; showing its result."],
  "contentModel.integration.onsite.receipt.asset": ["素材", "Asset"],
  "contentModel.integration.onsite.receipt.version": ["版本", "Version"],
  "contentModel.integration.onsite.receipt.project": ["项目", "Project"],
  "contentModel.integration.onsite.receipt.placementId": ["投放 ID", "Placement ID"],
  "contentModel.integration.onsite.receipt.publicId": ["公开 ID", "Public ID"],
  "contentModel.integration.onsite.receipt.location": ["位置", "Location"],
  "contentModel.integration.onsite.receipt.openMap": ["在投放地图中查看", "Open on placement map"],
  "contentModel.integration.onsite.receipt.openAsset": ["查看素材", "View asset"],
  "contentModel.integration.onsite.receipt.dismiss": ["继续采集", "Capture another"],
  "contentModel.integration.onsite.receipt.untitled": ["未命名素材", "Untitled asset"],

  "contentModel.integration.onsite.context.pinned": ["由链接指定的项目", "Project set by the link"],
  "contentModel.integration.onsite.context.clear": ["改为手动选择", "Choose manually"],
  "contentModel.integration.onsite.context.unknownProject": ["项目", "Project"],
};

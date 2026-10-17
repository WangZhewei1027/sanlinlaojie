import type { IntegrationTexts } from "@/app/manage/lib/integration-text";

/**
 * zh/en fallbacks for the onsite upload path. Locale files own the final
 * wording; until they carry these keys, `useIntegrationText` uses this table.
 */
export const ONSITE_TEXTS: IntegrationTexts = {
  // Shared keys that already exist in locales (kept here so tx always has a fallback).
  "onsite.title": ["现场上传", "Onsite upload"],
  "onsite.subtitle": ["使用实时GPS定位记录现场信息", "Record what is on site with live GPS"],
  "contentModel.action.retry": ["重试", "Retry"],

  "contentModel.integration.onsite.checkingState": ["正在确认团队的内容模式", "Checking the team's content mode"],
  "contentModel.integration.onsite.stateError": ["没能确认团队的内容模式", "Could not check the team's content mode"],
  "contentModel.integration.onsite.readonlyTitle": ["团队已归档，不能上传", "The team is archived"],
  "contentModel.integration.onsite.readonlyBody": ["恢复团队后可以继续现场上传。", "Restore the team to resume onsite uploads."],
  "contentModel.integration.onsite.checkingAccess": ["正在确认合集权限…", "Checking access to this collection…"],
  "contentModel.integration.onsite.accessError": ["没能确认合集权限", "Could not check access to this collection"],
  "contentModel.integration.onsite.noEditTitle": ["你不能在这个团队上传", "You cannot upload in this team"],
  "contentModel.integration.onsite.noEditBody": ["现场上传需要团队成员及以上角色。查看者只能浏览。", "Onsite uploads need the member role or above. Viewers can only browse."],
  "contentModel.integration.onsite.archivedTitle": ["合集已归档", "This collection is archived"],
  "contentModel.integration.onsite.archivedBody": ["已归档合集只读。在合集页恢复后才能上传，或换一个合集。", "Archived collections are read-only. Restore it on the collections page, or pick another collection."],
  "contentModel.integration.onsite.missing": ["请先选择地图合集并确认投放位置。", "Choose a map collection and confirm the location first."],

  "contentModel.integration.onsite.target.title": ["上传到", "Upload to"],
  "contentModel.integration.onsite.target.collection": ["地图合集", "Map collection"],
  "contentModel.integration.onsite.target.placeholder": ["选择地图合集", "Choose a map collection"],
  "contentModel.integration.onsite.target.loading": ["正在读取合集…", "Loading collections…"],
  "contentModel.integration.onsite.target.loadFailed": ["没能读取地图合集", "Could not load map collections"],
  "contentModel.integration.onsite.target.none": ["团队还没有地图合集。", "The team has no map collections yet."],
  "contentModel.integration.onsite.target.create": ["去新建合集", "Create one"],
  "contentModel.integration.onsite.target.required": ["选择一个地图合集后才能上传。", "Choose a map collection before uploading."],
  "contentModel.integration.onsite.target.linkedInvalid": ["链接指定的合集已归档或不存在。请重新选择一个合集后再上传。", "The collection in this link is archived or no longer exists. Choose a collection before uploading."],

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
  "contentModel.integration.onsite.receipt.collection": ["合集", "Collection"],
  "contentModel.integration.onsite.receipt.placementId": ["投放 ID", "Placement ID"],
  "contentModel.integration.onsite.receipt.publicId": ["公开 ID", "Public ID"],
  "contentModel.integration.onsite.receipt.location": ["位置", "Location"],
  "contentModel.integration.onsite.receipt.openMap": ["在合集地图中查看", "Open on the collection map"],
  "contentModel.integration.onsite.receipt.openAsset": ["查看素材", "View asset"],
  "contentModel.integration.onsite.receipt.dismiss": ["继续采集", "Capture another"],
  "contentModel.integration.onsite.receipt.untitled": ["未命名素材", "Untitled asset"],

};

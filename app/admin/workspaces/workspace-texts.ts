import type { IntegrationTexts } from "@/app/manage/lib/integration-text";

/**
 * zh/en fallbacks for project members and project lifecycle on
 * /admin/workspaces. Locale files own the final wording.
 */
export const WORKSPACE_TEXTS: IntegrationTexts = {
  // Existing locale keys, repeated so tx always has a fallback.
  "common.cancel": ["取消", "Cancel"],
  "common.close": ["关闭", "Close"],
  "common.edit": ["编辑", "Edit"],
  "common.delete": ["删除", "Delete"],
  "contentModel.action.retry": ["重试", "Retry"],
  "admin.organization.roles.owner": ["所有者", "Owner"],
  "admin.organization.roles.admin": ["管理员", "Admin"],
  "admin.organization.roles.member": ["成员", "Member"],
  "admin.organization.roles.viewer": ["查看者", "Viewer"],

  "contentModel.integration.members.action": ["成员", "Members"],
  "contentModel.integration.members.title": ["项目成员", "Project members"],
  "contentModel.integration.members.description": ["{{name}} · 项目角色决定成员在此项目中能做什么。", "{{name}} · The project role decides what each member can do here."],
  "contentModel.integration.members.endpointMissing": ["项目成员管理将在权限升级后启用", "Project member management arrives with the permission upgrade"],
  "contentModel.integration.members.endpointMissingBody": ["在此之前，可以在成员管理中为成员分配项目。", "Until then, assign projects to members on the Members page."],
  "contentModel.integration.members.openOrgMembers": ["前往成员管理", "Open Members"],
  "contentModel.integration.members.loadFailed": ["没能加载项目成员", "Could not load project members"],
  "contentModel.integration.members.readOnly": ["你可以查看项目成员。只有项目管理者或组织管理员可以修改。", "You can view project members. Only project managers and organization admins can change them."],
  "contentModel.integration.members.empty": ["此项目还没有成员。", "This project has no members yet."],
  "contentModel.integration.members.implicit": ["{{role}} · 自动管理所有项目", "{{role}} · manages every project automatically"],
  "contentModel.integration.members.orgRole": ["组织角色：{{role}}", "Organization role: {{role}}"],
  "contentModel.integration.members.unnamed": ["未命名用户", "Unnamed user"],
  "contentModel.integration.members.changeRole": ["更改角色", "Change role"],
  "contentModel.integration.members.save": ["保存", "Save"],
  "contentModel.integration.members.remove": ["移除", "Remove"],
  "contentModel.integration.members.removeConfirm": ["移除后，{{name}} 将不能再访问此项目。之后可以重新添加。", "{{name}} will lose access to this project. You can add them again later."],
  "contentModel.integration.members.removeConfirmAction": ["确认移除", "Remove access"],
  "contentModel.integration.members.add.title": ["添加成员", "Add a member"],
  "contentModel.integration.members.add.member": ["组织成员", "Organization member"],
  "contentModel.integration.members.add.placeholder": ["选择组织成员", "Choose a member"],
  "contentModel.integration.members.add.submit": ["添加", "Add"],
  "contentModel.integration.members.add.hint": ["只能添加本组织已有成员。邀请新成员请使用成员管理中的邀请链接。", "Only existing organization members can be added. Invite new people from the Members page."],
  "contentModel.integration.members.add.inviteLink": ["邀请新成员", "Invite people"],
  "contentModel.integration.members.add.noCandidates": ["所有组织成员都已在此项目中。", "Every organization member is already in this project."],

  "contentModel.integration.members.archive.action": ["归档", "Archive"],
  "contentModel.integration.members.archive.restore": ["恢复", "Restore"],
  "contentModel.integration.members.archive.badge": ["已归档", "Archived"],
  "contentModel.integration.members.archive.title": ["归档项目「{{name}}」？", "Archive “{{name}}”?"],
  "contentModel.integration.members.archive.body": [
    "归档后，此项目的投放会在所有入口停止展示，项目内容变为只读，不能再上传、编排或投放。其他项目已引用的已发布场景继续播放。管理员可以随时恢复。",
    "Its placements stop showing everywhere and the project becomes read-only: no uploads, scene edits or new placements. Published scenes used by other projects keep playing. Admins can restore it at any time.",
  ],
  "contentModel.integration.members.archive.confirm": ["归档项目", "Archive project"],
  "contentModel.integration.members.archive.failed": ["操作没有完成", "The action did not finish"],
};

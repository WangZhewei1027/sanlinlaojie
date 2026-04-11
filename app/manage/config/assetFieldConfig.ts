/**
 * Asset 字段配置
 * 根据 asset 类型控制前端可编辑的字段
 */

// 可编辑字段类型
export type EditableField =
  | "name" // 资源名称
  | "text_content" // 文本内容
  | "anchor_id" // 关联锚点
  | "tag_ids" // 标签
  | "location" // 位置信息（longitude, latitude, height）
  | "is_huge"; // 是否为大型模型（仅 model 类型）

// 预览组件类型
export type PreviewType =
  | "image"
  | "audio"
  | "text"
  | "anchor"
  | "link"
  | "model"
  | "none";

// 单个 asset 类型的配置
export interface AssetTypeConfig {
  // 可编辑的字段列表
  editableFields: EditableField[];
  // 预览类型
  previewType: PreviewType;
  // 字段标签自定义（可选）
  fieldLabels?: Partial<Record<EditableField, string>>;
  // 字段占位符自定义（可选）
  fieldPlaceholders?: Partial<Record<EditableField, string>>;
}

// 所有 asset 类型的配置映射
export type AssetFieldConfigMap = Record<string, AssetTypeConfig>;

// 默认配置
const defaultConfig: AssetTypeConfig = {
  editableFields: ["tag_ids", "location"],
  previewType: "none",
};

// Asset 类型字段配置
export const assetFieldConfig: AssetFieldConfigMap = {
  // 锚点类型
  anchor: {
    editableFields: ["name", "text_content", "tag_ids", "location"],
    previewType: "anchor",
    fieldLabels: {
      name: "assetFields.anchor.name",
      text_content: "assetFields.anchor.description",
    },
    fieldPlaceholders: {
      name: "assetFields.anchor.namePlaceholder",
      text_content: "assetFields.anchor.descriptionPlaceholder",
    },
  },

  // 文本类型
  text: {
    editableFields: [
      "name",
      "text_content",
      "anchor_id",
      "tag_ids",
      "location",
    ],
    previewType: "text",
    fieldLabels: {
      text_content: "assetFields.text.content",
    },
    fieldPlaceholders: {
      text_content: "assetFields.text.contentPlaceholder",
    },
  },

  // 图片类型
  image: {
    editableFields: [
      "name",
      "text_content",
      "anchor_id",
      "tag_ids",
      "location",
    ],
    previewType: "image",
  },

  // 音频类型
  audio: {
    editableFields: [
      "name",
      "text_content",
      "anchor_id",
      "tag_ids",
      "location",
    ],
    previewType: "audio",
  },

  // 视频类型
  video: {
    editableFields: ["anchor_id", "tag_ids", "location"],
    previewType: "none", // 可以后续添加视频预览
  },

  link: {
    editableFields: [
      "name",
      "text_content",
      "anchor_id",
      "tag_ids",
      "location",
    ],
    previewType: "link",
  },

  // 店铺类型
  shop: {
    editableFields: [
      "name",
      "text_content",
      "anchor_id",
      "tag_ids",
      "location",
    ],
    previewType: "image",
    fieldLabels: {
      name: "assetFields.shop.name",
      text_content: "assetFields.shop.description",
    },
    fieldPlaceholders: {
      name: "assetFields.shop.namePlaceholder",
      text_content: "assetFields.shop.descriptionPlaceholder",
    },
  },

  // 3D 模型类型
  model: {
    editableFields: ["name", "anchor_id", "tag_ids", "location", "is_huge"],
    previewType: "model",
    fieldLabels: {
      name: "assetFields.model.name",
      is_huge: "assetFields.model.isHuge",
    },
    fieldPlaceholders: {
      name: "assetFields.model.namePlaceholder",
    },
  },

  // 默认/其他类型
  default: defaultConfig,
};

/**
 * 获取指定 asset 类型的配置
 * @param fileType asset 的 file_type
 * @returns 对应的配置，如果没有则返回默认配置
 */
export function getAssetConfig(fileType: string): AssetTypeConfig {
  return assetFieldConfig[fileType] || assetFieldConfig.default;
}

/**
 * 检查指定 asset 类型是否可以编辑某个字段
 * @param fileType asset 的 file_type
 * @param field 字段名
 * @returns 是否可编辑
 */
export function isFieldEditable(
  fileType: string,
  field: EditableField,
): boolean {
  const config = getAssetConfig(fileType);
  return config.editableFields.includes(field);
}

/**
 * 获取字段的显示标签
 * @param fileType asset 的 file_type
 * @param field 字段名
 * @param defaultLabel 默认标签
 * @returns 字段标签
 */
export function getFieldLabel(
  fileType: string,
  field: EditableField,
  defaultLabel: string,
): string {
  const config = getAssetConfig(fileType);
  return config.fieldLabels?.[field] || defaultLabel;
}

/**
 * 获取字段的占位符
 * @param fileType asset 的 file_type
 * @param field 字段名
 * @param defaultPlaceholder 默认占位符
 * @returns 字段占位符
 */
export function getFieldPlaceholder(
  fileType: string,
  field: EditableField,
  defaultPlaceholder: string,
): string {
  const config = getAssetConfig(fileType);
  return config.fieldPlaceholders?.[field] || defaultPlaceholder;
}

/**
 * 获取 asset 的预览类型
 * @param fileType asset 的 file_type
 * @returns 预览类型
 */
export function getPreviewType(fileType: string): PreviewType {
  const config = getAssetConfig(fileType);
  return config.previewType;
}

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// 中文翻译
const zhTranslations = {
  translation: {
    // 导航栏
    nav: {
      home: "首页",
      admin: "管理后台",
      workspace: "工作空间",
      upload: "上传",
      manage: "管理",
      display: "展示",
    },
    // 通用
    common: {
      welcome: "欢迎",
      loading: "加载中...",
      save: "保存",
      cancel: "取消",
      delete: "删除",
      edit: "编辑",
      create: "创建",
      search: "搜索",
      filter: "筛选",
      logout: "退出登录",
      login: "登录",
      signup: "注册",
    },
    // 工作空间
    workspace: {
      title: "工作空间管理",
      create: "创建工作空间",
      select: "选择工作空间",
      manage: "管理工作空间",
    },
    // 上传
    upload: {
      title: "上传资源",
      selectFile: "选择文件",
      uploading: "上传中...",
      success: "上传成功",
      failed: "上传失败",
    },
    // 资源管理
    assets: {
      title: "资源管理",
      list: "资源列表",
      edit: "编辑资源",
      delete: "删除资源",
    },
    // 现场上传
    onsite: {
      title: "现场上传",
      subtitle: "使用实时GPS定位记录现场信息",
      gpsStatus: "GPS定位状态",
      gettingLocation: "正在获取位置...",
      location: "位置：",
      altitude: "海拔：",
      accuracy: "精度：",
      cameraMode: "拍照上传",
      textMode: "文本上传",
      takePhoto: "拍照",
      uploading: "上传中...",
      confirmUpload: "确认上传",
      retake: "重新拍照",
      textContent: "文本内容",
      textPlaceholder: "输入要记录的文本信息...",
      uploadText: "上传文本",
      uploadSuccess: "上传成功！",
      uploadFailed: "上传失败：",
      missingInfo: "缺少必要信息",
      cameraError: "无法访问相机：",
    },
  },
};

// 英文翻译
const enTranslations = {
  translation: {
    // Navigation
    nav: {
      home: "Home",
      admin: "Admin",
      workspace: "Workspace",
      upload: "Upload",
      manage: "Manage",
      display: "Display",
    },
    // Common
    common: {
      welcome: "Welcome",
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      search: "Search",
      filter: "Filter",
      logout: "Logout",
      login: "Login",
      signup: "Sign Up",
    },
    // Workspace
    workspace: {
      title: "Workspace Management",
      create: "Create Workspace",
      select: "Select Workspace",
      manage: "Manage Workspace",
    },
    // Upload
    upload: {
      title: "Upload Assets",
      selectFile: "Select File",
      uploading: "Uploading...",
      success: "Upload Successful",
      failed: "Upload Failed",
    },
    // Assets
    assets: {
      title: "Asset Management",
      list: "Asset List",
      edit: "Edit Asset",
      delete: "Delete Asset",
    },
    // Onsite Upload
    onsite: {
      title: "Onsite Upload",
      subtitle: "Record onsite information using real-time GPS location",
      gpsStatus: "GPS Status",
      gettingLocation: "Getting location...",
      location: "Location:",
      altitude: "Altitude:",
      accuracy: "Accuracy:",
      cameraMode: "Photo Upload",
      textMode: "Text Upload",
      takePhoto: "Take Photo",
      uploading: "Uploading...",
      confirmUpload: "Confirm Upload",
      retake: "Retake",
      textContent: "Text Content",
      textPlaceholder: "Enter text information to record...",
      uploadText: "Upload Text",
      uploadSuccess: "Upload successful!",
      uploadFailed: "Upload failed:",
      missingInfo: "Missing required information",
      cameraError: "Unable to access camera:",
    },
  },
};

i18n.use(initReactI18next).init({
  resources: {
    en: enTranslations,
    zh: zhTranslations,
  },
  lng:
    typeof window !== "undefined"
      ? localStorage.getItem("language") || "zh"
      : "zh",
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

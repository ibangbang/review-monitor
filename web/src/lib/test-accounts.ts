/**
 * 测试阶段使用的演示账号。仅在开发模式（或显式设置 VITE_SHOW_TEST_ACCOUNTS=true）下
 * 由登录页预填，生产构建默认不会展示。
 */
export const SHOW_TEST_ACCOUNTS =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_TEST_ACCOUNTS === 'true';

export const TEST_ACCOUNT = {
  email: 'demo-ui@reviewmonitor.local',
  password: 'demo12345',
  hint: '演示工作区 · 含 2 个应用、48 条示例评价',
};

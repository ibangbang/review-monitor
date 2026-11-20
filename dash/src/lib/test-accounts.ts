/**
 * 测试阶段使用的管理员账号。仅在开发模式（或显式设置 VITE_SHOW_TEST_ACCOUNTS=true）
 * 下由登录页预填，生产构建默认不会展示。
 */
export const SHOW_TEST_ACCOUNTS =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_TEST_ACCOUNTS === 'true';

export const TEST_ADMIN = {
  email: 'admin@reviewmonitor.local',
  password: 'af1d118f308728b3e15df740',
  hint: '平台管理员 · 登录行为会写入审计日志',
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, Message, Typography } from '@arco-design/web-react';
import { IconLock, IconUser } from '@arco-design/web-react/icon';
import { adminLogin } from '@/lib/api/admin';

const FormItem = Form.Item;

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<{ email: string; password: string }>();
  const [submitting, setSubmitting] = useState(false);

  const mutation = useMutation({
    mutationFn: adminLogin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'me'] });
      Message.success('登录成功');
      navigate('/overview', { replace: true });
    },
    onError: (error: unknown) => {
      Message.error(error instanceof Error ? error.message : '登录失败');
    },
    onSettled: () => setSubmitting(false),
  });

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">
          <span className="dash-logo-mark">RM</span>
          <Typography.Title heading={5} style={{ margin: 0 }}>
            ReviewMonitor 管理后台
          </Typography.Title>
        </div>
        <p className="login-sub">管理员账号独立于工作区成员，登录行为将写入审计日志。</p>
        <Form
          form={form}
          layout="vertical"
          onSubmit={(values) => {
            setSubmitting(true);
            mutation.mutate({ email: values.email.trim(), password: values.password });
          }}
        >
          <FormItem
            field="email"
            label="管理员邮箱"
            rules={[{ required: true, message: '请输入管理员邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
          >
            <Input prefix={<IconUser />} placeholder="admin@reviewmonitor.local" autoComplete="username" />
          </FormItem>
          <FormItem field="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<IconLock />} placeholder="请输入密码" autoComplete="current-password" />
          </FormItem>
          <Button type="primary" htmlType="submit" long loading={submitting || mutation.isPending}>
            登录
          </Button>
        </Form>
      </div>
    </div>
  );
}

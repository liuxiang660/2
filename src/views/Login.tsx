import React, { useState } from 'react';
import { LogIn, AlertCircle, Shield, Radar, KeyRound } from 'lucide-react';
import { login } from '../utils/authService';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username || !password) {
        setError('用户名和密码不能为空');
        return;
      }

      await login(username, password);
      onLoginSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060e20] text-[#dae2fd] relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-20 w-96 h-96 bg-[#4b8eff]/15 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-24 -right-20 w-96 h-96 bg-[#ffbc7c]/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 rounded-2xl overflow-hidden border border-[#414755]/20 shadow-2xl shadow-[#000814]/60">
        <div className="hidden lg:flex lg:col-span-2 bg-[#0b1326] p-10 flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#adc6ff]/20 bg-[#adc6ff]/10 text-[#adc6ff] text-xs font-bold mb-6">
              <Radar className="w-3 h-3" />
              供应链风险预警
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight mb-4">
              Sentry Intelligence
            </h1>
            <p className="text-sm text-[#8b90a0] leading-relaxed">
              实时聚合多源事件，洞察全球风险传导路径，帮助你在中断发生前做出决策。
            </p>
          </div>
          <div className="space-y-3">
            <Feature title="多源事件融合" desc="媒体、港口、气象与企业数据统一视图" />
            <Feature title="风险路径追踪" desc="从起因到影响节点全链路可视化" />
            <Feature title="行动建议生成" desc="自动输出可执行应对建议" />
          </div>
        </div>

        <div className="lg:col-span-3 bg-[#131b2e] p-8 md:p-10">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#adc6ff] to-[#4b8eff] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#001a41]" />
              </div>
              <div>
                <h2 className="text-2xl font-black">账户登录</h2>
                <p className="text-xs text-[#8b90a0]">进入智能监控工作台</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[#ff5545]/10 border border-[#ff5545]/30 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-[#ff5545] mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-[#ffd3cf] text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#c1c6d7] mb-1">
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
                className="w-full px-4 py-2.5 bg-[#0b1326] border border-[#414755]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#adc6ff]/50 focus:border-[#adc6ff] transition"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#c1c6d7] mb-1">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full px-4 py-2.5 bg-[#0b1326] border border-[#414755]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#adc6ff]/50 focus:border-[#adc6ff] transition"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#adc6ff] to-[#4b8eff] disabled:from-[#5f6f8f] disabled:to-[#5f6f8f] text-[#001a41] font-bold py-2.5 px-4 rounded-lg transition duration-200 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin mr-2">
                    <div className="w-4 h-4 border-2 border-[#001a41] border-t-transparent rounded-full"></div>
                  </div>
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  登录
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-[#0b1326] border border-[#414755]/20 rounded-lg">
            <p className="text-[#adc6ff] text-sm flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              <strong>演示账户：</strong>
            </p>
            <p className="text-[#c1c6d7] text-sm mt-1">
              用户名: <code className="bg-[#171f33] px-2 py-1 rounded">admin</code>
            </p>
            <p className="text-[#c1c6d7] text-sm mt-1">
              密码: <code className="bg-[#171f33] px-2 py-1 rounded">admin123</code>
            </p>
          </div>

          <p className="text-center text-[#8b90a0] text-xs mt-6">
            供应链风险预警系统 © 2026
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg bg-[#131b2e] border border-[#414755]/20">
      <p className="text-sm font-bold text-[#dae2fd]">{title}</p>
      <p className="text-xs text-[#8b90a0] mt-1">{desc}</p>
    </div>
  );
}

export default Login;

import React from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  Library, 
  Network, 
  UserCircle2,
  Menu,
  X,
  Settings, 
  Bell, 
  Search, 
  RefreshCw,
  HelpCircle,
  MessageSquare,
  LogOut,
  Shield
} from 'lucide-react';
import { cn } from '../utils';
import { ViewType } from '../types';
import { getCurrentUser, logout } from '../utils/authService';
import { getNotifyEventName, notifyAction } from '../utils/notify';
import { downloadTextFile, openMailTo } from '../utils/actions';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const user = getCurrentUser();
  const safeDisplayName = React.useMemo(() => {
    const fullName = String(user?.fullName || '').trim();
    if (fullName && fullName !== '系统管理员') {
      return fullName;
    }
    return user?.username || '用户';
  }, [user?.fullName, user?.username]);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [notifications, setNotifications] = React.useState([
    '汉堡港口异常延误 +72h',
    '亚太航线风险指数上升 9.1%',
    '新增高风险事件 2 条',
  ]);
  const [settingsState, setSettingsState] = React.useState({
    autoRefresh: true,
    showAdvancedMapLayer: true,
  });

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentView]);

  React.useEffect(() => {
    let timer: number | undefined;

    const handleNotify = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const message = customEvent.detail?.message;
      if (!message) {
        return;
      }

      setToastMessage(message);
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => setToastMessage(null), 2200);
    };

    window.addEventListener(getNotifyEventName(), handleNotify as EventListener);

    return () => {
      window.removeEventListener(getNotifyEventName(), handleNotify as EventListener);
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const handleLogout = () => {
    if (confirm('确定要登出吗？')) {
      logout();
      window.location.href = '/';
    }
  };

  const handleGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const keyword = searchKeyword.trim();
    if (!keyword) {
      notifyAction('请输入搜索关键词');
      return;
    }

    window.open(`https://www.google.com/search?q=${encodeURIComponent(`供应链 风险 ${keyword}`)}`, '_blank', 'noopener,noreferrer');
    notifyAction(`已搜索关键词: ${keyword}`);
  };

  const exportReport = () => {
    const reportText = [
      `导出时间: ${new Date().toLocaleString()}`,
      `当前视图: ${currentView}`,
      `用户: ${user?.fullName || user?.username || '未知用户'}`,
      `自动刷新: ${settingsState.autoRefresh ? '开启' : '关闭'}`,
      `高级图层: ${settingsState.showAdvancedMapLayer ? '开启' : '关闭'}`,
    ].join('\n');

    downloadTextFile('sentry-report.txt', reportText);
    notifyAction('报告已导出');
  };

  const navItems = [
    { id: 'dashboard' as ViewType, label: '工作台', icon: LayoutDashboard },
    { id: 'map' as ViewType, label: '风险地图', icon: Globe },
    { id: 'events' as ViewType, label: '事件库', icon: Library },
    { id: 'supply-chain' as ViewType, label: '供应链', icon: Network },
    { id: 'profile' as ViewType, label: '个人中心', icon: UserCircle2 },
  ];

  const quickMobileItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans selection:bg-[#adc6ff]/30">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 z-50 w-full flex justify-between items-center px-4 md:px-6 py-3 bg-[#0b1326]/85 backdrop-blur-md border-b border-[#414755]/20">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-[#adc6ff] hover:bg-[#2d3449]/50 transition-colors"
            aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="text-[#adc6ff] font-black text-xl italic tracking-tighter font-headline">
            Sentry Intelligence
          </span>
          <nav className="hidden md:flex items-center gap-6 font-headline font-bold text-sm tracking-tight">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'transition-colors hover:text-[#adc6ff]',
                  currentView === item.id ? 'text-[#adc6ff] border-b-2 border-[#adc6ff] pb-1' : 'text-[#414755]'
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <form onSubmit={handleGlobalSearch} className="hidden lg:flex relative items-center bg-[#171f33] px-3 py-1.5 rounded-lg border border-[#414755]/20">
            <Search className="w-4 h-4 text-[#414755] mr-2" />
            <input
              type="text"
              placeholder="搜索地点..."
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              className="bg-transparent border-none text-xs focus:ring-0 p-0 text-[#dae2fd] placeholder:text-[#414755] w-48"
            />
          </form>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffbc7c]/10 border border-[#ffbc7c]/25">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffbc7c] animate-pulse"></span>
            <span className="text-[10px] font-bold text-[#ffbc7c]">实时监控中</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowNotifications((prev) => !prev);
                setShowSettings(false);
              }}
              className="relative p-2 text-[#414755] hover:bg-[#2d3449]/50 transition-all rounded-lg"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5545] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff5545]"></span>
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setShowSettings((prev) => !prev);
                setShowNotifications(false);
              }}
              className="p-2 text-[#414755] hover:bg-[#2d3449]/50 transition-all rounded-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-2 text-[#414755] hover:bg-[#2d3449]/50 transition-all rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          <div className="w-8 h-8 rounded-full border border-[#414755]/20 overflow-hidden">
            <img 
              src="https://picsum.photos/seed/user/100/100" 
              alt="User" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#060e20]/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {showNotifications && (
        <div className="fixed right-16 top-16 z-[65] w-80 p-3 rounded-lg border border-[#414755]/20 bg-[#131b2e]/95 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#adc6ff]">通知中心</span>
            <button
              onClick={() => {
                setNotifications([]);
                notifyAction('通知已全部标记已读');
              }}
              className="text-[10px] text-[#8b90a0] hover:text-[#adc6ff]"
            >
              全部已读
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-[#8b90a0] py-2">暂无未读通知</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((message) => (
                <div key={message} className="text-xs text-[#c1c6d7] bg-[#0b1326] rounded px-2 py-1.5 border border-[#414755]/20">
                  {message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <div className="fixed right-16 top-16 z-[65] w-80 p-3 rounded-lg border border-[#414755]/20 bg-[#131b2e]/95 backdrop-blur-xl shadow-xl">
          <div className="text-xs font-bold text-[#adc6ff] mb-3">个人偏好</div>
          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between text-[#c1c6d7]">
              自动刷新
              <input
                type="checkbox"
                checked={settingsState.autoRefresh}
                onChange={(event) => setSettingsState((prev) => ({ ...prev, autoRefresh: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between text-[#c1c6d7]">
              地图高级图层
              <input
                type="checkbox"
                checked={settingsState.showAdvancedMapLayer}
                onChange={(event) => setSettingsState((prev) => ({ ...prev, showAdvancedMapLayer: event.target.checked }))}
              />
            </label>
          </div>
          <button
            onClick={() => {
              onViewChange('profile');
              setShowSettings(false);
            }}
            className="mt-3 w-full py-2 rounded-lg bg-[#2d3449] text-[#adc6ff] text-xs font-bold"
          >
            打开个人中心
          </button>
        </div>
      )}

      {/* Side Navigation Bar */}
      <aside
        className={cn(
          'h-screen w-64 fixed left-0 top-0 flex flex-col py-6 bg-[#131b2e] z-40 pt-20 border-r border-[#414755]/10 transition-transform',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#adc6ff] to-[#4b8eff] rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-[#001a41]" />
            </div>
            <div>
              <h3 className="text-[#adc6ff] font-bold text-sm">全球运营</h3>
              <p className="text-[10px] text-[#8b90a0] uppercase tracking-widest">企业级服务</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-6 py-3 transition-all duration-150 text-sm font-medium",
                currentView === item.id 
                  ? "bg-[#2d3449] text-[#adc6ff] border-l-4 border-[#adc6ff]" 
                  : "text-[#414755] hover:bg-[#2d3449]/30 hover:text-[#adc6ff]"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-6 mt-auto space-y-4">
          <div className="bg-[#2d3449]/50 p-3 rounded-lg border border-[#414755]/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#adc6ff] to-[#4b8eff] flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#001a41]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-[#adc6ff]">{safeDisplayName}</p>
                <p className="text-[10px] text-[#8b90a0]">已登录用户</p>
              </div>
            </div>
          </div>
          <button
            onClick={exportReport}
            className="w-full py-2 bg-gradient-to-br from-[#adc6ff] to-[#4b8eff] text-[#001a41] font-bold text-sm rounded-lg shadow-lg shadow-[#adc6ff]/10 transition-transform active:scale-95"
          >
            导出报告
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[#2d3449]/50 text-[#ff5545] hover:bg-[#2d3449] font-bold text-sm rounded-lg transition-colors border border-[#ff5545]/20"
          >
            <LogOut className="w-4 h-4" />
            登出
          </button>
          <div className="pt-4 space-y-2">
            <button
              onClick={() => openMailTo('support@sentry.local', '技术支持请求', '请描述你遇到的问题：')}
              className="w-full text-left flex items-center gap-3 text-[#414755] hover:text-[#adc6ff] text-xs transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              技术支持
            </button>
            <button
              onClick={() => openMailTo('feedback@sentry.local', '产品反馈', '我的建议：')}
              className="w-full text-left flex items-center gap-3 text-[#414755] hover:text-[#adc6ff] text-xs transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              意见反馈
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 pt-20 min-h-screen pb-20 md:pb-0">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0b1326]/95 backdrop-blur-xl border-t border-[#414755]/20 px-2 py-2 grid grid-cols-5 gap-1">
        {quickMobileItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-colors',
              currentView === item.id ? 'bg-[#adc6ff]/15 text-[#adc6ff]' : 'text-[#8b90a0]'
            )}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {toastMessage && (
        <div className="fixed right-4 top-24 z-[70] px-4 py-2 rounded-lg border border-[#adc6ff]/30 bg-[#0b1326]/95 text-xs font-bold text-[#adc6ff] shadow-xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

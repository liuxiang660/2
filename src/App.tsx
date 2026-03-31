import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { RiskMap } from './views/RiskMap';
import { EventLibrary } from './views/EventLibrary';
import { SupplyChainView } from './views/SupplyChainView';
import { EventDetail } from './views/EventDetail';
import { PersonalCenter } from './views/PersonalCenter';
import { Login } from './views/Login';
import { ViewType } from './types';
import { isAuthenticated, getMaxPermissionLevel } from './utils/authService';

function parseHashRoute(): { view: ViewType; eventId: string | null } {
  const hash = window.location.hash || '#/';
  const path = hash.replace(/^#/, '');
  const [pathname] = path.split('?');

  if (pathname.startsWith('/events/')) {
    const id = decodeURIComponent(pathname.slice('/events/'.length));
    return { view: 'detail', eventId: id || null };
  }

  if (pathname === '/events') return { view: 'events', eventId: null };
  if (pathname === '/map') return { view: 'map', eventId: null };
  if (pathname === '/supply-chain') return { view: 'supply-chain', eventId: null };
  if (pathname === '/profile') return { view: 'profile', eventId: null };
  if (pathname === '/login') return { view: 'login', eventId: null };

  return { view: 'dashboard', eventId: null };
}

function toHash(view: ViewType, eventId?: string | null): string {
  if (view === 'detail' && eventId) {
    return `#/events/${encodeURIComponent(eventId)}`;
  }

  const pathMap: Record<ViewType, string> = {
    login: '#/login',
    dashboard: '#/dashboard',
    map: '#/map',
    events: '#/events',
    detail: '#/events',
    'supply-chain': '#/supply-chain',
    profile: '#/profile',
  };

  return pathMap[view] || '#/dashboard';
}

export default function App() {
  const route = parseHashRoute();
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    if (!isAuthenticated()) {
      return 'login';
    }
    return route.view === 'login' ? 'dashboard' : route.view;
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => route.eventId);
  const [userLevel, setUserLevel] = useState(0);

  useEffect(() => {
    // 更新用户权限等级
    if (isAuthenticated()) {
      setUserLevel(getMaxPermissionLevel());
    }
  }, [currentView]);

  useEffect(() => {
    const syncFromHash = () => {
      const next = parseHashRoute();
      if (!isAuthenticated()) {
        setCurrentView('login');
        setSelectedEventId(null);
        return;
      }

      if (next.view === 'detail') {
        setSelectedEventId(next.eventId);
        setCurrentView('detail');
        return;
      }

      setSelectedEventId(null);
      setCurrentView(next.view === 'login' ? 'dashboard' : next.view);
    };

    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const navigateTo = (view: ViewType, eventId?: string | null) => {
    const hash = toHash(view, eventId);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
      return;
    }

    if (view === 'detail') {
      setSelectedEventId(eventId || null);
    }
    setCurrentView(view);
  };

  const handleEventSelect = (id: string) => {
    setSelectedEventId(id);
    navigateTo('detail', id);
  };

  // 如果用户未认证且不在登录页面，重定向到登录页面
  useEffect(() => {
    if (!isAuthenticated() && currentView !== 'login') {
      navigateTo('login');
    }
  }, [currentView]);

  const renderView = () => {
    switch (currentView) {
      case 'login':
        return <Login onLoginSuccess={() => navigateTo('dashboard')} />;
      case 'dashboard':
        return isAuthenticated() ? <Dashboard /> : <Login onLoginSuccess={() => navigateTo('dashboard')} />;
      case 'map':
        return isAuthenticated() ? <RiskMap /> : <Login onLoginSuccess={() => navigateTo('map')} />;
      case 'events':
        return isAuthenticated() ? <EventLibrary onEventClick={handleEventSelect} /> : <Login onLoginSuccess={() => navigateTo('events')} />;
      case 'supply-chain':
        return isAuthenticated() ? <SupplyChainView /> : <Login onLoginSuccess={() => navigateTo('supply-chain')} />;
      case 'profile':
        return isAuthenticated() ? <PersonalCenter /> : <Login onLoginSuccess={() => navigateTo('profile')} />;
      case 'detail':
        return isAuthenticated() ? <EventDetail eventId={selectedEventId} onBack={() => navigateTo('events')} /> : <Login onLoginSuccess={() => navigateTo('events')} />;
      default:
        return isAuthenticated() ? <Dashboard /> : <Login onLoginSuccess={() => navigateTo('dashboard')} />;
    }
  };

  // 如果未认证，不显示Layout
  if (!isAuthenticated() && currentView === 'login') {
    return renderView();
  }

  return (
    <Layout currentView={currentView} onViewChange={(view) => navigateTo(view)}>
      {renderView()}
    </Layout>
  );
}

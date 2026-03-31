import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  clearToken,
  createEvent,
  createProduct,
  deleteEvent,
  deleteProduct,
  fetchEvents,
  fetchUsers,
  fetchProducts,
  getToken,
  login,
  registerUser,
  saveToken,
  updateEvent,
  updateProduct,
  updateUserPermissions,
  updateUserStatus
} from './api';
import type { EventItem, Permission, ProductItem, UserItem } from './types';

type ViewTab = 'data' | 'events' | 'users';

const PERMISSION_OPTIONS: Permission[] = [
  { id: 1, code: 'ADMIN', name: '管理员', level: 3 },
  { id: 2, code: 'EDITOR', name: '编辑员', level: 2 },
  { id: 3, code: 'VIEWER', name: '查看员', level: 1 }
];

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function LoginView({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('登录中...');
    try {
      const data = await login(username, password);
      saveToken(data.token);
      setMessage('登录成功');
      onLoggedIn();
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : '登录失败');
    }
  }

  return (
    <div className="app-shell">
      <div className="panel" style={{ maxWidth: 460, margin: '7vh auto' }}>
        <h2 style={{ marginTop: 0 }}>管理端登录</h2>
        <p>独立地址，用于前端数据与用户统一管理。</p>
        <form onSubmit={onSubmit} className="grid-2">
          <label className="form-row" style={{ gridColumn: '1 / -1' }}>
            <span>用户名</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="form-row" style={{ gridColumn: '1 / -1' }}>
            <span>密码</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="primary-btn" type="submit" style={{ gridColumn: '1 / -1' }}>
            登录管理台
          </button>
        </form>
        {message ? <div className="msg ok">{message}</div> : null}
        {error ? <div className="msg error">{error}</div> : null}
      </div>
    </div>
  );
}

function DataPanel() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [editing, setEditing] = useState<ProductItem | null>(null);
  const [form, setForm] = useState({
    name: '',
    hs_code: '',
    gpc_code: '',
    category: '',
    description: '',
    supply_chain_stage: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadData(nextPage = 1) {
    setError('');
    setMessage('加载数据库数据中...');
    try {
      const data = await fetchProducts(nextPage, 20);
      setItems(asArray<ProductItem>(data.items));
      setPage(data.page || 1);
      setTotalPages(data.total_pages || 1);
      setLastSyncTime(new Date().toLocaleTimeString('zh-CN'));
      setMessage(`实时同步完成（${new Date().toLocaleTimeString('zh-CN')}）`);
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }

  useEffect(() => {
    void loadData(1);
    const timer = window.setInterval(() => {
      void loadData(page);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [page]);

  async function handleCreateOrUpdate() {
    setError('');
    try {
      if (!form.name.trim()) {
        setError('产品名称不能为空');
        return;
      }

      if (editing) {
        await updateProduct(editing.id, form);
        setMessage('更新成功');
      } else {
        await createProduct(form);
        setMessage('新增成功');
      }

      setEditing(null);
      setForm({
        name: '',
        hs_code: '',
        gpc_code: '',
        category: '',
        description: '',
        supply_chain_stage: ''
      });
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function handleDelete(itemId: string) {
    if (!window.confirm(`确认删除 ID=${itemId} ?`)) {
      return;
    }

    setError('');
    try {
      await deleteProduct(itemId);
      setMessage('删除成功');
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  function startEdit(item: ProductItem) {
    setEditing(item);
    setForm({
      name: item.name || '',
      hs_code: item.hs_code || '',
      gpc_code: item.gpc_code || '',
      category: item.category || '',
      description: item.description || '',
      supply_chain_stage: item.supply_chain_stage || ''
    });
  }

  function resetForm() {
    setEditing(null);
    setForm({
      name: '',
      hs_code: '',
      gpc_code: '',
      category: '',
      description: '',
      supply_chain_stage: ''
    });
  }

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>业务数据管理（数据库直连）</h3>
      <div className="grid-2">
        <label className="form-row">
          <span>实时状态</span>
          <input value={lastSyncTime ? `已同步 ${lastSyncTime}` : '等待首次同步'} readOnly />
        </label>
        <div className="row-actions" style={{ alignItems: 'end' }}>
          <button className="ghost-btn" onClick={() => void loadData(page)}>
            刷新
          </button>
          <span className="badge">每 5 秒自动同步数据库</span>
        </div>
      </div>

      {message ? <div className="msg ok">{message}</div> : null}
      {error ? <div className="msg error">{error}</div> : null}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>HS</th>
            <th>GPC</th>
            <th>分类</th>
            <th>供应链环节</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const id = String(item.id);
            return (
              <tr key={id || idx}>
                <td>{id}</td>
                <td>{item.name}</td>
                <td>{item.hs_code || '-'}</td>
                <td>{item.gpc_code || '-'}</td>
                <td>{item.category || '-'}</td>
                <td>{item.supply_chain_stage || '-'}</td>
                <td>{item.description || '-'}</td>
                <td>
                  <div className="row-actions">
                    <button className="ghost-btn" onClick={() => startEdit(item)}>
                      编辑
                    </button>
                    <button className="danger-btn" onClick={() => void handleDelete(id)} disabled={!id}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="ghost-btn" disabled={page <= 1} onClick={() => void loadData(page - 1)}>
          上一页
        </button>
        <span className="badge">
          第 {page} / {totalPages} 页
        </span>
        <button className="ghost-btn" disabled={page >= totalPages} onClick={() => void loadData(page + 1)}>
          下一页
        </button>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <label className="form-row">
          <span>{editing ? `编辑产品 #${editing.id}` : '新增产品'}</span>
          <input
            placeholder="产品名称 *"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
          <input
            placeholder="HS 编码"
            value={form.hs_code}
            onChange={(e) => setForm((s) => ({ ...s, hs_code: e.target.value }))}
          />
          <input
            placeholder="GPC 编码"
            value={form.gpc_code}
            onChange={(e) => setForm((s) => ({ ...s, gpc_code: e.target.value }))}
          />
          <input
            placeholder="产品分类"
            value={form.category}
            onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
          />
          <input
            placeholder="供应链环节"
            value={form.supply_chain_stage}
            onChange={(e) => setForm((s) => ({ ...s, supply_chain_stage: e.target.value }))}
          />
          <textarea
            rows={5}
            placeholder="描述"
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          />
          <div className="row-actions">
            <button className="primary-btn" onClick={() => void handleCreateOrUpdate()}>
              {editing ? '保存更新' : '新增'}
            </button>
            <button className="ghost-btn" onClick={resetForm}>
              清空
            </button>
          </div>
        </label>
        <label className="form-row">
          <span>说明</span>
          <textarea
            rows={14}
            value={[
              '1. 这里是数据库业务表 products 的管理面板。',
              '2. 所有新增/编辑/删除都会立即写入数据库。',
              '3. 页面每 5 秒自动刷新一次，用于实时看到变化。',
              '4. 如多人同时操作，你会在下一次自动刷新看到最新值。'
            ].join('\n')}
            readOnly
          />
          <button className="ghost-btn" onClick={() => void loadData(page)}>
            立即同步数据库
          </button>
        </label>
      </div>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    email: '',
    fullName: '',
    permissionId: 3
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadUsers() {
    setError('');
    try {
      const data = await fetchUsers();
      const userList = asArray<UserItem>(data);
      setUsers(userList);
      setMessage(`用户数: ${userList.length}`);
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : '用户加载失败');
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await registerUser({
        username: registerForm.username,
        password: registerForm.password,
        email: registerForm.email,
        fullName: registerForm.fullName,
        permissionId: Number(registerForm.permissionId)
      });
      setMessage('用户创建成功');
      setRegisterForm({ username: '', password: '', email: '', fullName: '', permissionId: 3 });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建用户失败');
    }
  }

  async function onToggleStatus(user: UserItem) {
    setError('');
    try {
      await updateUserStatus(user.id, user.isActive !== 1);
      setMessage('用户状态已更新');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新状态失败');
    }
  }

  async function onUpdatePermission(user: UserItem, permissionId: number) {
    setError('');
    try {
      await updateUserPermissions(user.id, [permissionId]);
      setMessage('权限已更新');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '权限更新失败');
    }
  }

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>用户管理</h3>

      <form className="grid-2" onSubmit={onRegister}>
        <label className="form-row">
          <span>用户名</span>
          <input
            value={registerForm.username}
            onChange={(e) => setRegisterForm((s) => ({ ...s, username: e.target.value }))}
            required
          />
        </label>
        <label className="form-row">
          <span>邮箱</span>
          <input
            value={registerForm.email}
            onChange={(e) => setRegisterForm((s) => ({ ...s, email: e.target.value }))}
            required
          />
        </label>
        <label className="form-row">
          <span>密码</span>
          <input
            type="password"
            value={registerForm.password}
            onChange={(e) => setRegisterForm((s) => ({ ...s, password: e.target.value }))}
            required
          />
        </label>
        <label className="form-row">
          <span>姓名</span>
          <input
            value={registerForm.fullName}
            onChange={(e) => setRegisterForm((s) => ({ ...s, fullName: e.target.value }))}
          />
        </label>
        <label className="form-row">
          <span>初始权限</span>
          <select
            value={registerForm.permissionId}
            onChange={(e) => setRegisterForm((s) => ({ ...s, permissionId: Number(e.target.value) }))}
          >
            {PERMISSION_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row-actions" style={{ alignItems: 'end' }}>
          <button className="primary-btn" type="submit">
            创建用户
          </button>
          <button className="ghost-btn" type="button" onClick={() => void loadUsers()}>
            刷新列表
          </button>
        </div>
      </form>

      {message ? <div className="msg ok">{message}</div> : null}
      {error ? <div className="msg error">{error}</div> : null}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>状态</th>
            <th>权限</th>
            <th>登录次数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <span className="badge">{u.isActive === 1 ? '启用' : '禁用'}</span>
              </td>
              <td>{asArray<Permission>(u.permissions).map((p) => p.name).join(' / ') || '-'}</td>
              <td>{u.loginCount || 0}</td>
              <td>
                <div className="row-actions">
                  <button className="ghost-btn" onClick={() => void onToggleStatus(u)}>
                    {u.isActive === 1 ? '禁用' : '启用'}
                  </button>
                  <select
                    value={asArray<Permission>(u.permissions)[0]?.id || 3}
                    onChange={(e) => void onUpdatePermission(u, Number(e.target.value))}
                  >
                    {PERMISSION_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsPanel() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    image_url: '',
    event_type_text: '',
    location: '',
    source_id: '',
    locode_point_id: '',
    risk_tier2_type_id: '',
    product_tier3_ids: '',
    domain_focus_l2_id: '',
    supplychain_tier2_id: '',
    target: '',
    severity: 'warning' as 'critical' | 'warning' | 'info',
    confidence_score: 70,
    occurred_at: new Date().toISOString().slice(0, 16)
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadData(nextPage = 1) {
    setError('');
    setMessage('加载事件库中...');
    try {
      const data = await fetchEvents(nextPage, 20);
      setItems(asArray<EventItem>(data.items));
      setPage(data.page || 1);
      setTotalPages(data.total_pages || 1);
      setLastSyncTime(new Date().toLocaleTimeString('zh-CN'));
      setMessage(`事件库同步完成（${new Date().toLocaleTimeString('zh-CN')}）`);
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }

  useEffect(() => {
    void loadData(1);
    const timer = window.setInterval(() => {
      void loadData(page);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [page]);

  async function handleCreateOrUpdate() {
    setError('');
    try {
      if (!form.title.trim()) {
        setError('事件标题不能为空');
        return;
      }

      if (!form.occurred_at) {
        setError('发生时间不能为空');
        return;
      }

      if (editing) {
        await updateEvent(editing.id, {
          title: form.title,
          description: form.description,
          image_url: form.image_url || undefined,
          event_type_text: form.event_type_text,
          location: form.location,
          source_id: form.source_id ? Number(form.source_id) : undefined,
          locode_point_id: form.locode_point_id ? Number(form.locode_point_id) : undefined,
          risk_tier2_type_id: form.risk_tier2_type_id ? Number(form.risk_tier2_type_id) : undefined,
          product_tier3_ids: form.product_tier3_ids
            ? form.product_tier3_ids
                .split(',')
                .map((x) => Number(x.trim()))
                .filter((x) => Number.isFinite(x))
            : undefined,
          domain_focus_l2_id: form.domain_focus_l2_id ? Number(form.domain_focus_l2_id) : undefined,
          supplychain_tier2_id: form.supplychain_tier2_id ? Number(form.supplychain_tier2_id) : undefined,
          target: form.target,
          severity: form.severity,
          confidence_score: Number(form.confidence_score),
          occurred_at: new Date(form.occurred_at).toISOString()
        });
        setMessage('事件更新成功');
      } else {
        await createEvent({
          title: form.title,
          description: form.description,
          image_url: form.image_url || undefined,
          event_type_text: form.event_type_text,
          location: form.location,
          source_id: form.source_id ? Number(form.source_id) : undefined,
          locode_point_id: form.locode_point_id ? Number(form.locode_point_id) : undefined,
          risk_tier2_type_id: form.risk_tier2_type_id ? Number(form.risk_tier2_type_id) : undefined,
          product_tier3_ids: form.product_tier3_ids
            ? form.product_tier3_ids
                .split(',')
                .map((x) => Number(x.trim()))
                .filter((x) => Number.isFinite(x))
            : undefined,
          domain_focus_l2_id: form.domain_focus_l2_id ? Number(form.domain_focus_l2_id) : undefined,
          supplychain_tier2_id: form.supplychain_tier2_id ? Number(form.supplychain_tier2_id) : undefined,
          target: form.target,
          severity: form.severity,
          confidence_score: Number(form.confidence_score),
          occurred_at: new Date(form.occurred_at).toISOString()
        });
        setMessage('事件新增成功');
      }

      setEditing(null);
      setForm({
        title: '',
        description: '',
        image_url: '',
        event_type_text: '',
        location: '',
        source_id: '',
        locode_point_id: '',
        risk_tier2_type_id: '',
        product_tier3_ids: '',
        domain_focus_l2_id: '',
        supplychain_tier2_id: '',
        target: '',
        severity: 'warning',
        confidence_score: 70,
        occurred_at: new Date().toISOString().slice(0, 16)
      });
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function handleDelete(itemId: string) {
    if (!window.confirm(`确认删除事件 ID=${itemId} ?`)) {
      return;
    }

    setError('');
    try {
      await deleteEvent(itemId);
      setMessage('事件删除成功');
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  function startEdit(item: EventItem) {
    setEditing(item);
    const locations = asArray<{ location_name?: string }>(item.event_locations);
    const impacts = asArray<{ impact_type?: string; supply_chain_stage?: string; affected_area?: string }>(item.event_impacts);
    const firstLocation = locations[0]?.location_name || '';
    const firstType = impacts.find((x) => x.impact_type === 'event_type')?.supply_chain_stage || '';
    const firstTarget =
      impacts.find((x) => x.impact_type === 'target')?.supply_chain_stage ||
      impacts.find((x) => x.impact_type === 'target')?.affected_area ||
      '';
    setForm({
      title: item.title || '',
      description: item.description || '',
      image_url: item.cover_image || item.cover_url || item.image_url || item.image || '',
      event_type_text: firstType,
      location: firstLocation,
      source_id: '',
      locode_point_id: '',
      risk_tier2_type_id: '',
      product_tier3_ids: '',
      domain_focus_l2_id: '',
      supplychain_tier2_id: '',
      target: firstTarget,
      severity: (item.severity as 'critical' | 'warning' | 'info') || 'warning',
      confidence_score: item.confidence_score || 70,
      occurred_at: item.occurred_at ? new Date(item.occurred_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    });
  }

  function resetForm() {
    setEditing(null);
    setForm({
      title: '',
      description: '',
      image_url: '',
      event_type_text: '',
      location: '',
      source_id: '',
      locode_point_id: '',
      risk_tier2_type_id: '',
      product_tier3_ids: '',
      domain_focus_l2_id: '',
      supplychain_tier2_id: '',
      target: '',
      severity: 'warning',
      confidence_score: 70,
      occurred_at: new Date().toISOString().slice(0, 16)
    });
  }

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>事件库管理（数据库直连）</h3>
      <div className="grid-2">
        <label className="form-row">
          <span>实时状态</span>
          <input value={lastSyncTime ? `已同步 ${lastSyncTime}` : '等待首次同步'} readOnly />
        </label>
        <div className="row-actions" style={{ alignItems: 'end' }}>
          <button className="ghost-btn" onClick={() => void loadData(page)}>
            刷新
          </button>
          <span className="badge">每 5 秒自动同步事件库</span>
        </div>
      </div>

      {message ? <div className="msg ok">{message}</div> : null}
      {error ? <div className="msg error">{error}</div> : null}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>等级</th>
            <th>类型</th>
            <th>地点</th>
            <th>关联对象</th>
            <th>置信度</th>
            <th>发生时间</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const id = String(item.id);
            const locations = asArray<{ location_name?: string }>(item.event_locations);
            const impacts = asArray<{ impact_type?: string; supply_chain_stage?: string; affected_area?: string }>(item.event_impacts);
            return (
              <tr key={id || idx}>
                <td>{id}</td>
                <td>{item.title}</td>
                <td>{item.severity || '-'}</td>
                <td>{impacts.find((x) => x.impact_type === 'event_type')?.supply_chain_stage || '-'}</td>
                <td>{locations[0]?.location_name || '-'}</td>
                <td>{impacts.find((x) => x.impact_type === 'target')?.supply_chain_stage || impacts.find((x) => x.impact_type === 'target')?.affected_area || '-'}</td>
                <td>{item.confidence_score ?? '-'}</td>
                <td>{item.occurred_at ? new Date(item.occurred_at).toLocaleString('zh-CN') : '-'}</td>
                <td>{item.description || '-'}</td>
                <td>
                  <div className="row-actions">
                    <button className="ghost-btn" onClick={() => startEdit(item)}>
                      编辑
                    </button>
                    <button className="danger-btn" onClick={() => void handleDelete(id)} disabled={!id}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="ghost-btn" disabled={page <= 1} onClick={() => void loadData(page - 1)}>
          上一页
        </button>
        <span className="badge">
          第 {page} / {totalPages} 页
        </span>
        <button className="ghost-btn" disabled={page >= totalPages} onClick={() => void loadData(page + 1)}>
          下一页
        </button>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <label className="form-row">
          <span>{editing ? `编辑事件 #${editing.id}` : '新增事件'}</span>
          <input
            placeholder="事件标题 *"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          />
          <input
            placeholder="事件类型（如 劳资纠纷 / 自然灾害）"
            value={form.event_type_text}
            onChange={(e) => setForm((s) => ({ ...s, event_type_text: e.target.value }))}
          />
          <input
            placeholder="图片链接（可选，http/https）"
            value={form.image_url}
            onChange={(e) => setForm((s) => ({ ...s, image_url: e.target.value }))}
          />
          <input
            placeholder="地点（如 鹿特丹, 荷兰）"
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
          />
          <input
            placeholder="source_id（可选，数据源ID）"
            value={form.source_id}
            onChange={(e) => setForm((s) => ({ ...s, source_id: e.target.value }))}
          />
          <input
            placeholder="locode_point_id（可选，地图点位ID）"
            value={form.locode_point_id}
            onChange={(e) => setForm((s) => ({ ...s, locode_point_id: e.target.value }))}
          />
          <input
            placeholder="risk_tier2_type_id（可选，风险二级类型ID）"
            value={form.risk_tier2_type_id}
            onChange={(e) => setForm((s) => ({ ...s, risk_tier2_type_id: e.target.value }))}
          />
          <input
            placeholder="product_tier3_ids（可选，逗号分隔，如 3,8）"
            value={form.product_tier3_ids}
            onChange={(e) => setForm((s) => ({ ...s, product_tier3_ids: e.target.value }))}
          />
          <input
            placeholder="domain_focus_l2_id（可选，内容域ID）"
            value={form.domain_focus_l2_id}
            onChange={(e) => setForm((s) => ({ ...s, domain_focus_l2_id: e.target.value }))}
          />
          <input
            placeholder="supplychain_tier2_id（可选，供应链二级ID）"
            value={form.supplychain_tier2_id}
            onChange={(e) => setForm((s) => ({ ...s, supplychain_tier2_id: e.target.value }))}
          />
          <input
            placeholder="关联对象（如 一级供应商 / 海运物流）"
            value={form.target}
            onChange={(e) => setForm((s) => ({ ...s, target: e.target.value }))}
          />
          <select
            value={form.severity}
            onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value as 'critical' | 'warning' | 'info' }))}
          >
            <option value="critical">critical</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
          </select>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="置信度 0-100"
            value={form.confidence_score}
            onChange={(e) => setForm((s) => ({ ...s, confidence_score: Number(e.target.value) }))}
          />
          <input
            type="datetime-local"
            value={form.occurred_at}
            onChange={(e) => setForm((s) => ({ ...s, occurred_at: e.target.value }))}
          />
          <textarea
            rows={5}
            placeholder="事件描述"
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          />
          <div className="row-actions">
            <button className="primary-btn" onClick={() => void handleCreateOrUpdate()}>
              {editing ? '保存更新' : '新增'}
            </button>
            <button className="ghost-btn" onClick={resetForm}>
              清空
            </button>
          </div>
        </label>
        <label className="form-row">
          <span>说明</span>
          <textarea
            rows={14}
            value={[
              '1. 这里是 events + 风险地图链路(event_main/geo/risk/product) 的管理面板。',
              '2. 新增/编辑/删除会立即写入数据库；新增/编辑会自动同步风险地图表。',
              '3. 页面每 5 秒自动同步一次，支持多人协作下近实时查看。',
              '4. 删除为软删除（后端写入 deleted_at）。',
              '5. 若不填 source_id / locode_point_id / risk_tier2_type_id，后端会自动兜底匹配。'
            ].join('\n')}
            readOnly
          />
          <button className="ghost-btn" onClick={() => void loadData(page)}>
            立即同步事件库
          </button>
        </label>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthed, setIsAuthed] = useState(Boolean(getToken()));
  const [tab, setTab] = useState<ViewTab>('data');

  if (!isAuthed) {
    return <LoginView onLoggedIn={() => setIsAuthed(true)} />;
  }

  return (
    <div className="app-shell">
      <div className="header">
        <div className="brand">
          <h1>Sentry Admin Console</h1>
          <p>独立后台地址，管理字典数据与用户权限</p>
        </div>
        <div className="row-actions">
          <button
            className="ghost-btn"
            onClick={() => {
              clearToken();
              setIsAuthed(false);
            }}
          >
            退出登录
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>
          业务数据
        </button>
        <button className={`tab-btn ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
          事件库管理
        </button>
        <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          用户管理
        </button>
      </div>

      {tab === 'data' ? <DataPanel /> : tab === 'events' ? <EventsPanel /> : <UsersPanel />}
    </div>
  );
}

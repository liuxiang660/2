# 独立管理端

## 目标

提供一个和主前端分离的后台管理页面，独立网址运行，用于：

- 管理数据字典（查询、新增、删除、导入、导出）
- 管理用户（创建用户、启停账户、权限调整）

## 启动

在项目根目录执行：

```bash
npm --prefix admin install
npm --prefix admin run dev
```

默认地址：

- http://localhost:3002

## 后端依赖

管理端调用后端接口（默认）：

- http://localhost:3001/api

如果你要改后端地址，请设置环境变量：

- VITE_API_BASE_URL

例如：

```bash
VITE_API_BASE_URL=http://127.0.0.1:3001/api npm run dev
```

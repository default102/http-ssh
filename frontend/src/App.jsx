import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Plus, Trash2, Key, Server, Settings, Monitor, Play, Menu, X, XCircle, RefreshCw, Copy } from 'react-feather';
import TerminalWindow from './components/TerminalWindow';
import './index.css';

function App() {
  const [servers, setServers] = useState([]);
  const [keys, setKeys] = useState([]);
  
  // Tabbed Terminals State
  const [activeTabs, setActiveTabs] = useState([]); // [{id: 1, server: {...}}]
  const [currentTabId, setCurrentTabId] = useState(null);
  const terminalRefs = useRef({});
  
  // Modals & Menu State
  const [showAddServer, setShowAddServer] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Forms state
  const [newServer, setNewServer] = useState({ name: '', host: '', port: 22, username: '', auth_type: 'password', password: '', private_key_id: '' });
  const [newKey, setNewKey] = useState({ name: '', private_key: '' });
  const [editingServerId, setEditingServerId] = useState(null);
  const [editingKeyId, setEditingKeyId] = useState(null);

  const fetchServers = () => fetch('/api/servers').then(r => r.json()).then(setServers);
  const fetchKeys = () => fetch('/api/keys').then(r => r.json()).then(setKeys);

  useEffect(() => {
    fetchServers();
    fetchKeys();
  }, []);

  const handleAddServer = async (e) => {
    e.preventDefault();
    if (editingServerId) {
      await fetch(`/api/servers/${editingServerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer)
      });
    } else {
      await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer)
      });
    }
    setShowAddServer(false);
    setEditingServerId(null);
    fetchServers();
  };

  const handleAddKey = async (e) => {
    e.preventDefault();
    if (editingKeyId) {
      await fetch(`/api/keys/${editingKeyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKey)
      });
    } else {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKey)
      });
    }
    setShowAddKey(false);
    setEditingKeyId(null);
    fetchKeys();
  };

  const deleteServer = async (id) => {
    if(confirm('确认要删除这个服务器配置吗？')) {
      await fetch(`/api/servers/${id}`, { method: 'DELETE' });
      fetchServers();
    }
  };

  const deleteKey = async (id) => {
    if(confirm('确认要删除这个 SSH 密钥吗？')) {
      await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    }
  };

  const openAddServer = () => {
    setNewServer({ name: '', host: '', port: 22, username: '', auth_type: 'password', password: '', private_key_id: '' });
    setEditingServerId(null);
    setShowAddServer(true);
  };

  const openEditServer = (s) => {
    setNewServer({ ...s, password: s.password || '', private_key_id: s.private_key_id || '' });
    setEditingServerId(s.id);
    setShowAddServer(true);
  };

  const openAddKey = () => {
    setNewKey({ name: '', private_key: '' });
    setEditingKeyId(null);
    setShowAddKey(true);
  };

  const openEditKey = (k) => {
    setNewKey({ name: k.name, private_key: '' });
    setEditingKeyId(k.id);
    setShowAddKey(true);
  };

  // Tab Logic
  const openServerConnection = (server) => {
    const tabId = `tab_${server.id}_${Date.now()}`; // Allow multiple connections to same server
    setActiveTabs(tabs => [...tabs, { id: tabId, server, status: 'initializing', reconnectKey: 0 }]);
    setCurrentTabId(tabId);
    if (window.innerWidth <= 768) {
        setIsSidebarOpen(false); // Auto-close sidebar on mobile
    }
  };

  const updateTabStatus = (tabId, status) => {
    setActiveTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, status } : t));
  };

  const closeTab = (tabId, e) => {
    e.stopPropagation(); // prevent switching to this tab
    
    // Check if the connection is still active before closing
    const tabToClose = activeTabs.find(t => t.id === tabId);
    if (tabToClose && (tabToClose.status === 'connected' || tabToClose.status === 'connecting')) {
      if (!window.confirm('当前会话仍在连接中，确定要关闭标签页并断开连接吗？')) {
        return; // do not close
      }
    }
    
    const newTabs = activeTabs.filter(t => t.id !== tabId);
    if (currentTabId === tabId) {
      // If we closed the active tab, switch to the last one available
      setCurrentTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
    setActiveTabs(newTabs);
  };

  const reconnectTab = (tabId, e) => {
    if(e) e.stopPropagation();
    setActiveTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, status: 'initializing', reconnectKey: (t.reconnectKey || 0) + 1 } : t));
  };

  return (
    <div className="app-container dark-theme">
      
      {/* Mobile Top Nav */}
      <div className="mobile-nav glass-panel">
        <button className="icon-btn" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="brand" style={{marginBottom: 0}}>
          <Terminal size={20} className="brand-icon" />
          <h1 style={{fontSize: '1rem'}}>Web SSH</h1>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* Sidebar */}
      <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header-mobile">
            <div className="brand" style={{marginBottom: 0}}>
                <Terminal size={24} className="brand-icon" />
                <h1>Web SSH</h1>
            </div>
            <button className="icon-btn close-sidebar-btn" onClick={() => setIsSidebarOpen(false)}>
                <X size={24} />
            </button>
        </div>

        <div className="menu-section">
          <div className="section-header">
            <span><Server size={16}/> 服务器列表</span>
            <button className="icon-btn" onClick={openAddServer}><Plus size={16}/></button>
          </div>
          <ul className="item-list">
            {servers.map(s => (
              <li key={s.id}>
                <div className="item-info" onClick={() => openServerConnection(s)}>
                  <Monitor size={16} />
                  <span>{s.name} <small>({s.host})</small></span>
                </div>
                <div style={{display: 'flex', gap: '4px'}}>
                  <button className="icon-btn" onClick={() => openEditServer(s)}><Settings size={14}/></button>
                  <button className="icon-btn danger" onClick={() => deleteServer(s.id)}><Trash2 size={14}/></button>
                </div>
              </li>
            ))}
            {servers.length === 0 && <p className="empty-text">暂无服务器配置</p>}
          </ul>
        </div>

        <div className="menu-section mt-4">
          <div className="section-header">
            <span><Key size={16}/> SSH 密钥</span>
            <button className="icon-btn" onClick={openAddKey}><Plus size={16}/></button>
          </div>
          <ul className="item-list">
            {keys.map(k => (
              <li key={k.id}>
                <div className="item-info">
                  <Key size={16} />
                  <span>{k.name}</span>
                </div>
                <div style={{display: 'flex', gap: '4px'}}>
                  <button className="icon-btn" onClick={() => openEditKey(k)}><Settings size={14}/></button>
                  <button className="icon-btn danger" onClick={() => deleteKey(k.id)}><Trash2 size={14}/></button>
                </div>
              </li>
            ))}
            {keys.length === 0 && <p className="empty-text">未添加密钥</p>}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTabs.length > 0 ? (
          <div className="terminal-container wrapper-glass">
            
             {/* Tabs Header */}
             <div className="tabs-header">
                {activeTabs.map(tab => (
                   <div 
                      key={tab.id} 
                      className={`tab-item ${currentTabId === tab.id ? 'active' : ''}`}
                      onClick={() => setCurrentTabId(tab.id)}
                      title={tab.status}
                   >
                       <span className={`status-dot ${tab.status || 'closed'}`}></span>
                       <Monitor size={14} />
                       <span className="tab-title">{tab.server.name}</span>
                       <div className="tab-actions">
                         <button className="tab-icon-btn copy" title="复制内容" onClick={(e) => {
                             e.stopPropagation();
                             if(terminalRefs.current[tab.id]) terminalRefs.current[tab.id].copySelectionOrAll();
                         }}>
                             <Copy size={12} />
                         </button>
                         {tab.status === 'closed' && (
                           <button className="tab-icon-btn reconnect" title="重新连接" onClick={(e) => reconnectTab(tab.id, e)}>
                             <RefreshCw size={12} />
                           </button>
                         )}
                         <button className="tab-icon-btn close" title="关闭标签" onClick={(e) => closeTab(tab.id, e)}>
                             <X size={14} />
                         </button>
                       </div>
                   </div>
                ))}
             </div>

             {/* Tab Contents: Render ALL to maintain WebSocket connection, but hide inactive ones */}
             <div className="tabs-content">
                {activeTabs.map(tab => (
                    <div 
                       key={tab.id} 
                       className="tab-pane" 
                       style={{ display: currentTabId === tab.id ? 'flex' : 'none' }}
                    >
                        <TerminalWindow 
                            ref={(el) => { terminalRefs.current[tab.id] = el; }}
                            key={`${tab.id}_${tab.reconnectKey}`}
                            server={tab.server} 
                            isActive={currentTabId === tab.id}
                            onConnectionChange={(status) => updateTabStatus(tab.id, status)} 
                        />
                    </div>
                ))}
             </div>

          </div>
        ) : (
          <div className="welcome-screen">
             <div className="hero-text glass-panel">
                 <Terminal size={64} className="hero-icon" />
                 <h2>欢迎使用 Web SSH</h2>
                 <p>请从左侧栏选择一台服务器进行连接，或配置一台新的服务器。支持同时打开多个终端标签页。</p>
             </div>
          </div>
        )}
      </main>

      {/* Modals for Add Server/Key */}
      {showAddServer && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h3>{editingServerId ? '编辑服务器' : '添加服务器'}</h3>
            <form onSubmit={handleAddServer}>
              <div className="form-group">
                <label>服务器名称 / 备注</label>
                <input required type="text" value={newServer.name} onChange={e => setNewServer({...newServer, name: e.target.value})} placeholder="例如：生产服务器" />
              </div>
              <div className="row">
                <div className="form-group">
                  <label>主机地址 / IP</label>
                  <input required type="text" value={newServer.host} onChange={e => setNewServer({...newServer, host: e.target.value})} placeholder="192.168.1.1" />
                </div>
                <div className="form-group" style={{width: '80px', flexGrow: 0}}>
                  <label>端口号</label>
                  <input type="number" value={newServer.port} onChange={e => setNewServer({...newServer, port: parseInt(e.target.value, 10)})} placeholder="22" />
                </div>
              </div>
              <div className="form-group">
                <label>登录用户名</label>
                <input required type="text" value={newServer.username} onChange={e => setNewServer({...newServer, username: e.target.value})} placeholder="例如：root" />
              </div>
              <div className="form-group">
                <label>认证方式</label>
                <select value={newServer.auth_type} onChange={e => setNewServer({...newServer, auth_type: e.target.value})}>
                  <option value="password">使用密码</option>
                  <option value="private_key">使用 SSH 密钥</option>
                </select>
              </div>
              {newServer.auth_type === 'password' ? (
                <div className="form-group">
                  <label>密码</label>
                  <input required type="password" value={newServer.password} onChange={e => setNewServer({...newServer, password: e.target.value})} />
                </div>
              ) : (
                <div className="form-group">
                  <label>选择密钥</label>
                  <select required value={newServer.private_key_id} onChange={e => setNewServer({...newServer, private_key_id: parseInt(e.target.value, 10)})}>
                    <option value="">-- 请选择要使用的密钥 --</option>
                    {keys.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddServer(false)}>取消</button>
                <button type="submit" className="btn-primary">保存服务器配置</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddKey && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h3>{editingKeyId ? '编辑 SSH 密钥' : '添加 SSH 密钥'}</h3>
            <form onSubmit={handleAddKey}>
              <div className="form-group">
                <label>密钥名称 / 备注</label>
                <input required type="text" value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} placeholder="例如：我的 Mac 密钥" />
              </div>
              <div className="form-group">
                <label>私钥内容 (PEM/OpenSSH 格式)</label>
                <textarea required rows={5} value={newKey.private_key} onChange={e => setNewKey({...newKey, private_key: e.target.value})} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddKey(false)}>取消</button>
                <button type="submit" className="btn-primary">保存密钥</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

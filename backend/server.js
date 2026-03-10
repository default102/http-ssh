const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const { Client } = require('ssh2');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// 静态文件服务 (用于生产环境)
app.use(express.static(path.join(__dirname, 'public')));

// API: 获取所有密钥
app.get('/api/keys', (req, res) => {
    db.all('SELECT id, name, created_at FROM keys', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: 添加密钥
app.post('/api/keys', (req, res) => {
    const { name, private_key } = req.body;
    db.run('INSERT INTO keys (name, private_key) VALUES (?, ?)', [name, private_key], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name });
    });
});

// API: 删除密钥
app.delete('/api/keys/:id', (req, res) => {
    db.run('DELETE FROM keys WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted successfully' });
    });
});

// API: 更新密钥
app.put('/api/keys/:id', (req, res) => {
    const { name, private_key } = req.body;
    db.run(
        'UPDATE keys SET name = ?, private_key = ? WHERE id = ?',
        [name, private_key, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Updated successfully' });
        }
    );
});

// API: 获取所有服务器
app.get('/api/servers', (req, res) => {
    db.all('SELECT id, name, host, port, username, auth_type, private_key_id, created_at FROM servers', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: 添加服务器
app.post('/api/servers', (req, res) => {
    const { name, host, port, username, auth_type, password, private_key_id } = req.body;
    db.run(
        `INSERT INTO servers (name, host, port, username, auth_type, password, private_key_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, host, port || 22, username, auth_type || 'password', password, private_key_id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, name, host });
        }
    );
});

// API: 删除服务器
app.delete('/api/servers/:id', (req, res) => {
    db.run('DELETE FROM servers WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted successfully' });
    });
});

// API: 更新服务器
app.put('/api/servers/:id', (req, res) => {
    const { name, host, port, username, auth_type, password, private_key_id } = req.body;
    db.run(
        `UPDATE servers SET name = ?, host = ?, port = ?, username = ?, auth_type = ?, password = ?, private_key_id = ? 
         WHERE id = ?`,
        [name, host, port || 22, username, auth_type || 'password', password, private_key_id, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Updated successfully' });
        }
    );
});

// WebSocket: SSH 会话连接
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const serverId = url.searchParams.get('serverId');

    if (!serverId) {
        ws.send('Error: serverId is required\r\n');
        return ws.close();
    }

    db.get('SELECT * FROM servers WHERE id = ?', [serverId], (err, serverConfig) => {
        if (err || !serverConfig) {
            ws.send(`Error: Server not found\r\n`);
            return ws.close();
        }

        const sshConfig = {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
        };

        const connectSSH = (config) => {
            const ssh = new Client();
            
            ws.on('close', () => ssh.end());
            
            ssh.on('ready', () => {
                ws.send('\r\n*** SSH CONNECTION ESTABLISHED ***\r\n');
                
                ssh.shell({ term: 'xterm-256color' }, (err, stream) => {
                    if (err) {
                        ws.send(`\r\n*** SSH SHELL ERROR: ${err.message} ***\r\n`);
                        return ws.close();
                    }

                    // Handle terminal resize events from client
                    ws.on('message', (data) => {
                        const message = data.toString();
                        // 简单的 resize 协议: JSON 格式 {"type":"resize","cols":80,"rows":24}
                        if (message.startsWith('{"type":"resize"')) {
                            try {
                                const { cols, rows } = JSON.parse(message);
                                stream.setWindow(rows, cols, 0, 0);
                            } catch (e) {
                                // ignore parse errors
                            }
                        } else {
                            // 普通按键输入数据
                            stream.write(data);
                        }
                    });

                    // SSH 输出发给前端
                    stream.on('data', (d) => ws.send(d.toString('utf-8')));
                    stream.on('close', () => {
                        ws.send('\r\n*** SSH CONNECTION CLOSED ***\r\n');
                        ws.close();
                    });
                });
            }).on('error', (err) => {
                ws.send(`\r\n*** SSH CONNECTION ERROR: ${err.message} ***\r\n`);
                ws.close();
            }).connect(config);
        };

        if (serverConfig.auth_type === 'private_key') {
            db.get('SELECT private_key FROM keys WHERE id = ?', [serverConfig.private_key_id], (err, key) => {
                if (err || !key) {
                    ws.send('\r\n*** ERROR: Private key not found ***\r\n');
                    return ws.close();
                }
                
                // 确保 key 结尾有换行符，且替换掉可能因为 JSON 传输导致的多余反斜杠
                let pk = key.private_key.replace(/\\n/g, '\n');
                if (!pk.endsWith('\n')) pk += '\n';

                sshConfig.privateKey = pk;
                
                // 为了排查问题，添加 debug log
                sshConfig.debug = (info) => console.log(`[SSH Debug ${serverConfig.host}]: ${info}`);
                
                try {
                    connectSSH(sshConfig);
                } catch(e) {
                    ws.send(`\r\n*** SSH EXCEPTION: ${e.message} ***\r\n`);
                    ws.close();
                }
            });
        } else {
            sshConfig.password = serverConfig.password;
            // 为了排查问题，添加 debug log
            sshConfig.debug = (info) => console.log(`[SSH Debug ${serverConfig.host}]: ${info}`);
            
            try {
                connectSSH(sshConfig);
            } catch(e) {
                ws.send(`\r\n*** SSH EXCEPTION: ${e.message} ***\r\n`);
                ws.close();
            }
        }
    });
});

// 所有未匹配的 GET 路由回退到前端 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Backend API and WebSocket server running on port ${PORT}`);
});

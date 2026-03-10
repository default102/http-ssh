import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const TerminalWindow = ({ server, onConnectionChange, isActive }) => {
    const terminalRef = useRef(null);
    const wsRef = useRef(null);
    const termInstance = useRef(null);
    const fitAddon = useRef(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        termInstance.current = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#000000',
                foreground: '#e6edf3',
                cursor: '#2f81f7',
                selectionBackground: 'rgba(47, 129, 247, 0.3)',
                black: '#000000',
                red: '#ff7b72',
                green: '#3fb950',
                yellow: '#d2a8ff',
                blue: '#79c0ff',
                magenta: '#bc8cff',
                cyan: '#a5d6ff',
                white: '#f0f6fc',
            },
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 14,
        });

        fitAddon.current = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        termInstance.current.loadAddon(fitAddon.current);
        termInstance.current.loadAddon(webLinksAddon);
        termInstance.current.open(terminalRef.current);
        fitAddon.current.fit();

        // 建立 WebSocket 连接
        // 使用相对路径加上当前 host，如果开发环境下可能需要处理代理
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 假设端口是 3001，如果是同一端口可以使用 window.location.host
        // 使用 Vite 的代理，或者直接连 3001
        const wsUrl = import.meta.env.MODE === 'development' 
           ? `ws://localhost:3001/ws?serverId=${server.id}` 
           : `${protocol}//${window.location.host}/ws?serverId=${server.id}`;
           
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
            termInstance.current.writeln('Connecting to server...');
            if(onConnectionChange) onConnectionChange('connecting');
        };

        wsRef.current.onmessage = (event) => {
            termInstance.current.write(event.data);
            if (event.data.includes('*** SSH CONNECTION ESTABLISHED ***')) {
                if(onConnectionChange) onConnectionChange('connected');
            }
            if (event.data.includes('*** SSH CONNECTION CLOSED ***') || event.data.includes('*** SSH CONNECTION ERROR:')) {
                if(onConnectionChange) onConnectionChange('closed');
            }
            if (event.data.includes('*** ERROR') || event.data.includes('*** SSH EXCEPTION')) {
                if(onConnectionChange) onConnectionChange('closed');
            }
        };

        termInstance.current.onData(data => {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(data);
            }
        });

        // Resize handler
        const handleResize = () => {
            fitAddon.current.fit();
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ 
                    type: 'resize', 
                    cols: termInstance.current.cols, 
                    rows: termInstance.current.rows 
                }));
            }
        };

        window.addEventListener('resize', handleResize);
        // Initial resize sync
        setTimeout(handleResize, 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (wsRef.current) wsRef.current.close();
            if (termInstance.current) termInstance.current.dispose();
            if(onConnectionChange) onConnectionChange('closed');
        };

    }, [server.id]);

    useEffect(() => {
        if (isActive && termInstance.current) {
            // Give layout a tiny bit of time to render flex, then fit and focus
            setTimeout(() => {
                if(fitAddon.current) fitAddon.current.fit();
                termInstance.current.focus();
            }, 50);
        }
    }, [isActive]);

    return (
        <div 
           ref={terminalRef} 
           className="terminal-wrapper" 
           onClick={() => termInstance.current && termInstance.current.focus()} 
        />
    );
};

export default TerminalWindow;

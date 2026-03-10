import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const TerminalWindow = forwardRef(({ server, onConnectionChange, isActive }, ref) => {
    const terminalRef = useRef(null);
    const wsRef = useRef(null);
    const termInstance = useRef(null);
    const fitAddon = useRef(null);

    useImperativeHandle(ref, () => ({
        copySelectionOrAll: () => {
            if (!termInstance.current) return;
            let text = termInstance.current.getSelection();
            if (!text) {
                // If no active selection, select all text and copy
                termInstance.current.selectAll();
                text = termInstance.current.getSelection();
                setTimeout(() => termInstance.current.clearSelection(), 200);
            }
            if (text) {
                navigator.clipboard.writeText(text).catch(err => console.error('Copy failed', err));
                return true;
            }
            return false;
        }
    }));

    useEffect(() => {
        if (!terminalRef.current) return;

        termInstance.current = new Terminal({
            cursorBlink: true,
            allowTransparency: true,
            theme: {
                background: 'transparent',
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
            fontSize: 13,
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
            if (fitAddon.current) {
                try {
                    fitAddon.current.fit();
                } catch (e) {
                    console.error('Fit error', e);
                }
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && termInstance.current) {
                wsRef.current.send(JSON.stringify({ 
                    type: 'resize', 
                    cols: termInstance.current.cols, 
                    rows: termInstance.current.rows 
                }));
            }
        };

        window.addEventListener('resize', handleResize);
        
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
        }

        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        
        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        // Initial resize sync
        setTimeout(handleResize, 100);

        // Handle mobile native keyboard scrolling
        const handleFocusIn = (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('xterm-helper-textarea')) {
                // Allow the body to scroll natively when keyboard pushes up
                document.body.style.overflow = 'auto';
                document.body.style.overscrollBehavior = 'auto';
                
                // Give the keyboard time to animate up, then scroll terminal to bottom
                setTimeout(() => {
                    if (termInstance.current) {
                        termInstance.current.scrollToBottom();
                    }
                    // Scroll the actual window to the bottom to push the input into view
                    window.scrollTo(0, document.body.scrollHeight);
                }, 300);
            }
        };

        const handleFocusOut = (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('xterm-helper-textarea')) {
                // Revert to fixed non-scrolling body when keyboard is closed
                window.scrollTo(0, 0);
                document.body.style.overflow = 'hidden';
                document.body.style.overscrollBehavior = 'none';
            }
        };

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
            
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
            }
            resizeObserver.disconnect();
            
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
});

export default TerminalWindow;

import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { io, Socket } from 'socket.io-client';

interface WebSocketMessage {
  event: string;
  data: any;
  timestamp: Date;
}

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = import.meta.env.VITE_WS_URL || 'http://localhost:3001',
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 10,
    reconnectionDelay = 1000
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const messageHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    if (!autoConnect) return;

    socketRef.current = io(url, {
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('[WS] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[WS] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      setError(err);
      console.error('[WS] Connection error:', err);
    });

    socket.on('message', (data: any) => {
      const message: WebSocketMessage = {
        event: data.event || 'message',
        data: data.data || data,
        timestamp: new Date()
      };
      setLastMessage(message);
      
      const handlers = messageHandlersRef.current.get(message.event);
      if (handlers) {
        handlers.forEach(handler => handler(message.data));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, autoConnect, reconnection, reconnectionAttempts, reconnectionDelay]);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!messageHandlersRef.current.has(event)) {
      messageHandlersRef.current.set(event, new Set());
    }
    messageHandlersRef.current.get(event)!.add(handler);
    
    return () => {
      messageHandlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (handler) {
      messageHandlersRef.current.get(event)?.delete(handler);
    } else {
      messageHandlersRef.current.delete(event);
    }
  }, []);

  return { socket: socketRef.current, isConnected, lastMessage, error, emit, on, off };
}

export function useTrackingSocket(requestId: string | null) {
  const { socket, isConnected, on, off, emit } = useWebSocket();
  const [trackingData, setTrackingData] = useState<{
    position?: { lat: number; lng: number };
    eta?: number;
    status?: string;
    distance?: number;
    speed?: number;
  } | null>(null);

  useEffect(() => {
    if (!requestId || !socket) return;

    emit('join:tracking', { requestId });

    const unsubPosition = on('tracking:position', (data: any) => {
      setTrackingData(prev => ({ ...prev, ...data }));
    });

    const unsubStatus = on('tracking:status', (data: any) => {
      setTrackingData(prev => ({ ...prev, status: data.status }));
    });

    const unsubETA = on('tracking:eta', (data: any) => {
      setTrackingData(prev => ({ ...prev, eta: data.eta }));
    });

    return () => {
      emit('leave:tracking', { requestId });
      unsubPosition();
      unsubStatus();
      unsubETA();
    };
  }, [requestId, socket, emit, on, off]);

  return { isConnected, trackingData };
}

export function useChatSocket(requestId: string | null) {
  const { socket, isConnected, on, off, emit } = useWebSocket();
  const [messages, setMessages] = useState<Array<{
    id: string;
    from: 'client' | 'pro' | 'system';
    type: 'text' | 'image' | 'voice' | 'location';
    content: string;
    timestamp: Date;
    read?: boolean;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!requestId || !socket) return;

    emit('join:chat', { requestId });

    const unsubMessage = on('chat:message', (data: any) => {
      const message = {
        id: data.id || `msg-${Date.now()}`,
        from: data.from,
        type: data.type || 'text',
        content: data.content,
        timestamp: new Date(data.timestamp || Date.now()),
        read: false
      };
      setMessages(prev => [...prev, message]);
      setUnreadCount(prev => prev + 1);
    });

    const unsubHistory = on('chat:history', (data: any) => {
      setMessages(data.messages || []);
    });

    const unsubRead = on('chat:read', (data: any) => {
      setMessages(prev => prev.map(m => 
        m.id === data.messageId ? { ...m, read: true } : m
      ));
    });

    return () => {
      emit('leave:chat', { requestId });
      unsubMessage();
      unsubHistory();
      unsubRead();
    };
  }, [requestId, socket, emit, on, off]);

  const sendMessage = useCallback((type: 'text' | 'image' | 'voice' | 'location', content: string) => {
    if (!requestId || !socket) return;
    
    const message = {
      requestId,
      type,
      content,
      timestamp: new Date().toISOString()
    };
    
    emit('chat:send', message);
    
    const optimisticMessage = {
      id: `msg-${Date.now()}`,
      from: 'pro' as const,
      type,
      content,
      timestamp: new Date(),
      read: false
    };
    setMessages(prev => [...prev, optimisticMessage]);
  }, [requestId, socket, emit]);

  const markAsRead = useCallback((messageId: string) => {
    if (!socket) return;
    emit('chat:read', { requestId, messageId });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [socket, emit, requestId]);

  return { isConnected, messages, unreadCount, sendMessage, markAsRead };
}
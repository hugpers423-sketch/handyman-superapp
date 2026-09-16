import { useState, useRef, useEffect } from 'preact/hooks';
import { useChatSocket } from '../hooks/useWebSocket';

interface ChatProps {
  requestId: string | null;
  currentUserRole: 'client' | 'pro';
  professionalName?: string;
  clientName?: string;
  height?: number;
}

const MESSAGE_TYPES = {
  text: { icon: '💬', label: 'Texto' },
  image: { icon: '🖼️', label: 'Imagen' },
  voice: { icon: '🎤', label: 'Voz' },
  location: { icon: '📍', label: 'Ubicación' }
};

export function Chat({ 
  requestId, 
  currentUserRole, 
  professionalName = 'Profesional',
  clientName = 'Cliente',
  height = 400
}: ChatProps) {
  const { isConnected, messages, unreadCount, sendMessage, markAsRead } = useChatSocket(requestId);
  const [inputValue, setInputValue] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: Event) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage('text', inputValue.trim());
    setInputValue('');
  };

  const handleImageUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      sendMessage('image', event.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVoiceStart = () => {
    setRecording(true);
    // En producción: MediaRecorder API
    setTimeout(() => {
      setRecording(false);
      sendMessage('voice', 'data:audio/wav;base64,UklGRiQ...'); // placeholder
    }, 3000);
  };

  const handleLocationShare = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        sendMessage('location', JSON.stringify({ lat: latitude, lng: longitude }));
      },
      () => alert('No se pudo obtener la ubicación')
    );
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  };

  const isOwn = (from: string) => {
    if (currentUserRole === 'pro') return from === 'pro';
    return from === 'client';
  };

  return (
    <div className="chat-container" style={{ 
      display: 'flex', flexDirection: 'column', height, 
      background: '#fff', borderRadius: '8px', overflow: 'hidden',
      border: '1px solid #dfe3dc'
    }}>
      <header className="chat-header" style={{
        padding: '12px 16px', borderBottom: '1px solid #dfe3dc',
        background: '#faf9f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={`avatar ${currentUserRole === 'pro' ? 'client' : 'pro'}`} style={{
            width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: currentUserRole === 'pro' ? '#e3f2fd' : '#e8f5e9',
            fontSize: 12, fontWeight: 800, color: '#0a2922'
          }}>
            {currentUserRole === 'pro' ? clientName[0] : professionalName[0]}
          </div>
          <div>
            <div style="font-weight: 600; font-size: 14px;">
              {currentUserRole === 'pro' ? clientName : professionalName}
            </div>
            <div style="font-size: 11px; color: {isConnected ? '#69a128' : '#ff7043'};">
              {isConnected ? '🟢 En línea' : '🔴 Desconectado'}
            </div>
          </div>
        </div>
        {unreadCount > 0 && (
          <span style={{
            background: '#ff7043', color: '#fff', borderRadius: '999px',
            padding: '2px 8px', fontSize: '11px', fontWeight: 700
          }}>
            {unreadCount} nuevos
          </span>
        )}
      </header>

      <div className="chat-messages" style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '12px'
      }}>
        {messages.length === 0 ? (
          <div className="chat-empty" style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#65756d', textAlign: 'center', padding: '24px'
          }}>
            <div style="font-size: 48px; margin-bottom: 12px;">💬</div>
            <p style="margin: 0; font-size: 14px;">No hay mensajes aún</p>
            <p style="margin: 4px 0 0; font-size: 12px;">Envía el primer mensaje</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const own = isOwn(msg.from);
            const prevMsg = messages[idx - 1];
            const showTime = !prevMsg || 
              new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 5 * 60 * 1000;
            
            return (
              <div 
                key={msg.id} 
                className={`chat-message ${own ? 'own' : ''}`}
                style={{
                  display: 'flex', flexDirection: own ? 'row-reverse' : 'row',
                  gap: 8, maxWidth: '80%', alignSelf: own ? 'flex-end' : 'flex-start'
                }}
              >
                {!own && (
                  <div className="avatar small" style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    background: msg.from === 'pro' ? '#d7ff61' : '#e3f2fd',
                    fontSize: 10, fontWeight: 800, color: '#0a2922', flexShrink: 0
                  }}>
                    {msg.from === 'pro' ? professionalName[0] : clientName[0]}
                  </div>
                )}
                <div className="message-bubble" style={{
                  background: own ? '#0a2922' : '#f5f3eb',
                  color: own ? '#fff' : '#0a2922',
                  borderRadius: own ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '10px 14px', maxWidth: '100%',
                  boxShadow: '0 1px 3px #0001'
                }}>
                  {showTime && (
                    <div style="font-size: 10px; opacity: 0.6; margin-bottom: 4px; text-align: {own ? 'right' : 'left'};">
                      {formatTime(msg.timestamp)}
                    </div>
                  )}
                  {msg.type === 'text' && (
                    <p style="margin: 0; line-height: 1.4; white-space: pre-wrap;">{msg.content}</p>
                  )}
                  {msg.type === 'image' && (
                    <img 
                      src={msg.content} 
                      alt="Imagen compartida" 
                      style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }}
                      onClick={() => window.open(msg.content, '_blank')}
                    />
                  )}
                  {msg.type === 'voice' && (
                    <audio controls src={msg.content} style={{ width: '100%' }} />
                  )}
                  {msg.type === 'location' && (
                    <button 
                      className="location-btn"
                      onClick={() => {
                        try {
                          const loc = JSON.parse(msg.content);
                          window.open(`https://maps.google.com/?q=${loc.lat},${loc.lng}`, '_blank');
                        } catch {}
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', color: 'inherit',
                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, font: 'inherit'
                      }}
                    >
                      📍 Ver ubicación en Google Maps
                    </button>
                  )}
                  {own && msg.read && (
                    <div style="font-size: 10px; opacity: 0.6; margin-top: 4px; text-align: right;">✓✓ Leído</div>
                  )}
                </div>
                {own && (
                  <div className="avatar small" style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    background: '#d7ff61', fontSize: 10, fontWeight: 800, color: '#0a2922', flexShrink: 0
                  }}>
                    {currentUserRole === 'pro' ? professionalName[0] : clientName[0]}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSend} style={{
        padding: '12px 16px', borderTop: '1px solid #dfe3dc',
        background: '#faf9f6', display: 'flex', gap: 8, alignItems: 'center'
      }}>
        <button 
          type="button"
          className="attach-btn"
          onClick={() => setShowAttachments(!showAttachments)}
          style={{
            background: 'none', border: 'none', padding: 8, cursor: 'pointer',
            fontSize: 20, color: '#65756d', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          aria-label="Adjuntar"
        >
          📎
        </button>

        {showAttachments && (
          <div className="attachments-menu" style={{
            display: 'flex', gap: 4, padding: '4px 0'
          }}>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} hidden />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'none', border: 'none', padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderRadius: '8px', color: '#0a2922' }}
            >
              🖼️ Foto/Galería
            </button>
            <button 
              type="button" 
              onClick={handleVoiceStart}
              disabled={recording}
              style={{ background: recording ? '#ff7043' : 'none', border: 'none', padding: '8px 12px', cursor: recording ? 'not-allowed' : 'pointer', fontSize: 13, borderRadius: '8px', color: recording ? '#fff' : '#0a2922' }}
            >
              {recording ? '🎤 Grabando...' : '🎤 Nota de voz'}
            </button>
            <button 
              type="button" 
              onClick={handleLocationShare}
              style={{ background: 'none', border: 'none', padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderRadius: '8px', color: '#0a2922' }}
            >
              📍 Ubicación
            </button>
          </div>
        )}

        <input
          type="text"
          value={inputValue}
          onChange={(e: Event) => setInputValue((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
          placeholder="Escribe un mensaje..."
          style={{
            flex: 1, padding: '10px 14px', border: '1px solid #dfe3dc',
            borderRadius: '20px', fontSize: '14px', outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s'
          }}
          onFocus={(e: FocusEvent) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#69a128'; (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px #d7ff6144'; }}
          onBlur={(e: FocusEvent) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#dfe3dc'; (e.currentTarget as HTMLInputElement).style.boxShadow = 'none'; }}
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          style={{
            background: inputValue.trim() ? '#0a2922' : '#dfe3dc',
            color: inputValue.trim() ? '#fff' : '#65756d',
            border: 'none', width: 40, height: 40, borderRadius: '50%',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'all 0.2s'
          }}
          aria-label="Enviar mensaje"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
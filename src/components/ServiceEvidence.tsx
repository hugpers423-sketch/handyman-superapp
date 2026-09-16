import { useState, useRef, useEffect } from 'preact/hooks';

interface EvidenceFile {
  id: string;
  type: 'before' | 'after' | 'signature';
  file: File;
  preview: string;
  timestamp: Date;
  uploaded: boolean;
}

interface ServiceEvidenceProps {
  requestId: string;
  professionalName: string;
  serviceType: string;
  onComplete: (evidence: EvidenceFile[]) => void;
  onCancel: () => void;
}

export function ServiceEvidence({ 
  requestId, 
  professionalName, 
  serviceType,
  onComplete,
  onCancel
}: ServiceEvidenceProps) {
  const [beforeFiles, setBeforeFiles] = useState<EvidenceFile[]>([]);
  const [afterFiles, setAfterFiles] = useState<EvidenceFile[]>([]);
  const [signature, setSignature] = useState<EvidenceFile | null>(null);
  const [currentStep, setCurrentStep] = useState<'before' | 'after' | 'signature'>('before');
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  const steps = [
    { id: 'before', label: 'Antes', icon: '📸', desc: 'Fotos del problema inicial' },
    { id: 'after', label: 'Después', icon: '✨', desc: 'Fotos del trabajo terminado' },
    { id: 'signature', label: 'Firma', icon: '✍️', desc: 'Firma digital del cliente' }
  ];

  const handleFileSelect = (e: Event, type: 'before' | 'after') => {
    const target = e.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    const newFiles: EvidenceFile[] = files.map(file => ({
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type,
      file,
      preview: URL.createObjectURL(file),
      timestamp: new Date(),
      uploaded: false
    }));

    if (type === 'before') {
      setBeforeFiles(prev => [...prev, ...newFiles]);
    } else {
      setAfterFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string, type: 'before' | 'after') => {
    if (type === 'before') {
      setBeforeFiles(prev => prev.filter(f => f.id !== id));
    } else {
      setAfterFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleCanvasMouseDown = (e: MouseEvent) => {
    setDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
      ctx.strokeStyle = '#0a2922';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }
  };

  const handleCanvasMouseUp = () => {
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const blob = dataURLtoBlob(dataUrl);
      const file = new File([blob], `firma-${requestId}-${Date.now()}.png`, { type: 'image/png' });
      
      setSignature({
        id: `sig-${Date.now()}`,
        type: 'signature',
        file,
        preview: dataUrl,
        timestamp: new Date(),
        uploaded: false
      });
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignature(null);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'before': return beforeFiles.length > 0;
      case 'after': return afterFiles.length > 0;
      case 'signature': return signature !== null;
    }
  };

  const handleNext = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id as any);
    }
  };

  const handlePrev = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id as any);
    }
  };

  const handleFinish = async () => {
    setUploading(true);
    const allEvidence = [...beforeFiles, ...afterFiles, ...(signature ? [signature] : [])];
    
    for (const ev of allEvidence) {
      if (!ev.uploaded) {
        await uploadEvidence(ev);
      }
    }
    
    setUploading(false);
    onComplete(allEvidence);
  };

  const uploadEvidence = async (evidence: EvidenceFile): Promise<void> => {
    const formData = new FormData();
    formData.append('file', evidence.file);
    formData.append('type', evidence.type);
    formData.append('requestId', requestId);
    
    try {
      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Error subiendo');
    } catch (error) {
      console.error('[Evidence] Upload failed:', error);
    }
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'before':
        return (
          <div className="evidence-step">
            <div className="drop-zone" 
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                handleFileSelect({ target: { files: e.dataTransfer?.files || [] } } as any, 'before');
              }}
            >
              <input type="file" accept="image/*,video/*" multiple onChange={(e) => handleFileSelect(e, 'before')} hidden ref={beforeInputRef} />
              <div className="drop-content">
                <span className="drop-icon">📸</span>
                <p><strong>Arrastra fotos o haz clic</strong></p>
                <p style={{ fontSize: '13px', color: '#65756d', marginTop: 4 }}>
                  Mínimo 1 foto del problema inicial
                </p>
                <button className="secondary" onClick={() => beforeInputRef.current?.click()} style={{ marginTop: 12 }}>
                  Seleccionar archivos
                </button>
              </div>
            </div>
            {beforeFiles.length > 0 && (
              <div className="file-preview" style={{ marginTop: 16 }}>
                <div style="font: 500 12px 'DM Mono'; color: #65756d; marginBottom: 8;">Fotos del ANTES ({beforeFiles.length})</div>
                <div className="preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {beforeFiles.map(f => (
                    <div key={f.id} className="preview-item" style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid #dfe3dc' }}>
                      <img src={f.preview} alt="Antes" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeFile(f.id, 'before')} style={{
                        position: 'absolute', top: 4, right: 4, width: 24, height: 24,
                        borderRadius: '50%', background: '#ff7043', color: '#fff', border: 'none', cursor: 'pointer'
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'after':
        return (
          <div className="evidence-step">
            <div className="drop-zone" 
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                handleFileSelect({ target: { files: e.dataTransfer?.files || [] } } as any, 'after');
              }}
            >
              <input type="file" accept="image/*,video/*" multiple onChange={(e) => handleFileSelect(e, 'after')} hidden ref={afterInputRef} />
              <div className="drop-content">
                <span className="drop-icon">✨</span>
                <p><strong>Arrastra fotos o haz clic</strong></p>
                <p style={{ fontSize: '13px', color: '#65756d', marginTop: 4 }}>
                  Mínimo 1 foto del trabajo terminado
                </p>
                <button className="secondary" onClick={() => afterInputRef.current?.click()} style={{ marginTop: 12 }}>
                  Seleccionar archivos
                </button>
              </div>
            </div>
            {afterFiles.length > 0 && (
              <div className="file-preview" style={{ marginTop: 16 }}>
                <div style="font: 500 12px 'DM Mono'; color: #65756d; marginBottom: 8;">Fotos del DESPUÉS ({afterFiles.length})</div>
                <div className="preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {afterFiles.map(f => (
                    <div key={f.id} className="preview-item" style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid #dfe3dc' }}>
                      <img src={f.preview} alt="Después" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeFile(f.id, 'after')} style={{
                        position: 'absolute', top: 4, right: 4, width: 24, height: 24,
                        borderRadius: '50%', background: '#ff7043', color: '#fff', border: 'none', cursor: 'pointer'
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'signature':
        return (
          <div className="evidence-step">
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: '#65756d', marginBottom: 12 }}>
                Pide al cliente que firme en el recuadro confirmando que el servicio <strong>{serviceType}</strong> 
                fue realizado satisfactoriamente por <strong>{professionalName}</strong>.
              </p>
            </div>
            
            {signature ? (
              <div className="signature-preview" style={{ marginBottom: 16 }}>
                <div style="font: 500 12px 'DM Mono'; color: #65756d; marginBottom: 8;">Firma capturada</div>
                <div style={{ border: '2px solid #dfe3dc', borderRadius: '8px', padding: 4 }}>
                  <img src={signature.preview} alt="Firma digital" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
                </div>
                <button className="secondary" onClick={clearSignature} style={{ marginTop: 8 }}>
                  Borrar y firmar de nuevo
                </button>
              </div>
            ) : (
              <div className="signature-canvas" style={{ 
                border: '2px dashed #dfe3dc', borderRadius: '8px', 
                background: '#faf9f6', touchAction: 'none',
                cursor: 'crosshair'
              }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onTouchStart={(e) => handleCanvasMouseDown(e as any)}
                  onTouchMove={(e) => handleCanvasMouseMove(e as any)}
                  onTouchEnd={handleCanvasMouseUp}
                  style={{ width: '100%', height: '200px', display: 'block', touchAction: 'none' }}
                />
                <p style={{ textAlign: 'center', marginTop: 12, color: '#65756d', fontSize: '13px' }}>
                  Firma aquí con el dedo o mouse
                </p>
              </div>
            )}
          </div>
        );
    }
  };

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-title" style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#0008', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="evidence-container" style={{
        background: '#fff', borderRadius: '12px', maxWidth: '640px', width: '100%',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px #0003'
      }}>
        <header className="evidence-header" style={{
          padding: '20px 24px', borderBottom: '1px solid #dfe3dc',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <h2 id="evidence-title" style="margin: 0; font: 700 22px 'Playfair Display';">Evidencia de Servicio</h2>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', fontSize: 24, color: '#65756d', cursor: 'pointer'
          }}>✕</button>
        </header>

        <nav className="evidence-steps" style={{
          display: 'flex', padding: '16px 24px', background: '#faf9f6', borderBottom: '1px solid #dfe3dc',
          gap: 8, overflowX: 'auto'
        }}>
          {steps.map((step, idx) => (
            <button
              key={step.id}
              className={`step-btn ${currentStep === step.id ? 'active' : ''} ${idx < steps.findIndex(s => s.id === currentStep) ? 'completed' : ''}`}
              onClick={() => setCurrentStep(step.id as any)}
              disabled={idx > steps.findIndex(s => s.id === currentStep) && !canProceed()}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                background: currentStep === step.id ? '#0a2922' : idx < steps.findIndex(s => s.id === currentStep) ? '#d8ffeb' : '#f5f3eb',
                color: currentStep === step.id ? '#fff' : idx < steps.findIndex(s => s.id === currentStep) ? '#69a128' : '#65756d',
                transition: 'all 0.2s'
              }}
            >
              <span>{step.icon}</span> {step.label}
              {idx < steps.findIndex(s => s.id === currentStep) && <span style={{ fontSize: 14 }}>✓</span>}
            </button>
          ))}
        </nav>

        <main className="evidence-content" style={{
          flex: 1, padding: '24px', overflowY: 'auto'
        }}>
          <div className="step-info" style={{ marginBottom: 20 }}>
            <h3 style="margin: 0 0 4px; font: 700 18px 'Playfair Display';">
              {steps.find(s => s.id === currentStep)?.label}
            </h3>
            <p style="margin: 0; color: #65756d; font-size: 14px;">
              {steps.find(s => s.id === currentStep)?.desc}
            </p>
          </div>
          {renderStepContent()}
        </main>

        <footer className="evidence-footer" style={{
          padding: '16px 24px', borderTop: '1px solid #dfe3dc',
          display: 'flex', justifyContent: 'space-between', gap: 12
        }}>
          <button className="secondary" onClick={handlePrev} disabled={currentStep === 'before'}>
            ← Anterior
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {currentStep === 'signature' ? (
              <button 
                className="primary" 
                onClick={handleFinish} 
                disabled={!canProceed() || uploading}
                style={{ padding: '12px 24px' }}
              >
                {uploading ? 'Subiendo...' : 'Finalizar y Generar PDF'}
              </button>
            ) : (
              <button 
                className="primary" 
                onClick={handleNext} 
                disabled={!canProceed()}
                style={{ padding: '12px 24px' }}
              >
                Siguiente →
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
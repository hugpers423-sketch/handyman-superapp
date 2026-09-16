import { useEffect, useRef, useState } from 'preact/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTrackingSocket } from '../hooks/useWebSocket';

const DEFAULT_CENTER: [number, number] = [-12.0464, -77.0428];
const DEFAULT_ZOOM = 13;

const iconPro = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjIiIGZpbGw9IiMyRDc0MzYiLz4KPHBhdGggZD0iTTI0IDE2QzI0LjU1MjMgMTYgMjUgMTYuNDQ3NyAyNSAxN1YyN0MyNSAyNy41NTIzIDI0LjU1MjMgMjggMjQgMjhDMjMuNDQ3NyAyOCAyMyAyNy41NTIzIDIzIDI3VjE3QzIzIDE2LjQ0NzcgMjMuNDQ3NyAxNiAyNCAxNloiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjI0IiBjeT0iMjIiIHI9IjMiIGZpbGw9IiMyRDc0MzYiLz4KPC9zdmc+',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24]
});

const iconClient = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwQTI5MjIiLz4KPHBhdGggZD0iTTIwIDEyQzIwLjU1MjMgMTIgMjEgMTIuNDQ3NyAyMSAxM1YyM0MyxMMjEuNTUyMyAyMSAyMCAyMUMxOS40NDc3IDIxIDE5IDIwLjU1MjMgMTkgMjBWMTNDMTkgMTIuNDQ3NyAxOS40NDc3IDEyIDIwIDEyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

interface TrackingMapProps {
  requestId: string | null;
  clientLocation?: { lat: number; lng: number; address: string };
  professionalName?: string;
  clientName?: string;
  height?: number;
  readOnly?: boolean;
}

export function TrackingMap({ 
  requestId, 
  clientLocation, 
  professionalName = 'Profesional',
  clientName = 'Cliente',
  height = 350,
  readOnly = false
}: TrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerProRef = useRef<L.Marker | null>(null);
  const markerClientRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { isConnected, trackingData } = useTrackingSocket(requestId);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: !readOnly,
      dragging: !readOnly
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    if (clientLocation) {
      markerClientRef.current = L.marker([clientLocation.lat, clientLocation.lng], { 
        icon: iconClient,
        interactive: false
      }).addTo(map).bindPopup(`<b>${clientName}</b><br>${clientLocation.address}`);
    }

    map.on('load', () => setMapReady(true));

    return () => {
      map.off();
      map.remove();
      mapInstanceRef.current = null;
      markerProRef.current = null;
      markerClientRef.current = null;
      routeLineRef.current = null;
    };
  }, [clientLocation, clientName, readOnly]);

  useEffect(() => {
    if (!mapInstanceRef.current || !trackingData?.position) return;

    const { lat, lng } = trackingData.position;
    
    if (!markerProRef.current) {
      markerProRef.current = L.marker([lat, lng], { 
        icon: iconPro,
        interactive: false
      }).addTo(mapInstanceRef.current).bindPopup(`<b>${professionalName}</b><br>En ruta`);
    } else {
      markerProRef.current.setLatLng([lat, lng]);
      markerProRef.current.getPopup()?.setContent(`<b>${professionalName}</b><br>${trackingData.status || 'En ruta'}`);
    }

    if (clientLocation && routeLineRef.current) {
      mapInstanceRef.current.removeLayer(routeLineRef.current);
    }
    
    if (clientLocation) {
      routeLineRef.current = L.polyline([
        [lat, lng],
        [clientLocation.lat, clientLocation.lng]
      ], {
        color: '#69a128',
        weight: 3,
        dashArray: '10, 10',
        opacity: 0.8
      }).addTo(mapInstanceRef.current);
    }

    if (!readOnly) {
      mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom(), { animate: true });
    }
  }, [trackingData, clientLocation, professionalName, readOnly]);

  useEffect(() => {
    if (!mapInstanceRef.current || !trackingData?.position) return;
    
    const bounds = L.latLngBounds([
      trackingData.position,
      clientLocation || DEFAULT_CENTER
    ]);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
  }, [trackingData?.position, clientLocation]);

  const formatETA = (minutes?: number) => {
    if (!minutes) return '—';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const formatDistance = (meters?: number) => {
    if (!meters) return '—';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div className="tracking-map-container" style={{ position: 'relative' }}>
      <div 
        ref={mapRef} 
        className="tracking-map" 
        style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden' }}
      />
      
      {!mapReady && (
        <div className="map-loading" style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f5f3eb', color: '#65756d', fontSize: '14px', zIndex: 10
        }}>
          Cargando mapa...
        </div>
      )}

      <div className="tracking-info" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="info-card" style={{ background: '#f8fef9', border: '1px solid #d8ffeb', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style="font: 500 11px 'DM Mono'; color: #65756d; textTransform: uppercase; marginBottom: 4px;">Estado</div>
          <div style="font: 700 16px 'Playfair Display'; color: #0a2922;">{trackingData?.status || 'Esperando...'}</div>
        </div>
        <div className="info-card" style={{ background: '#fff8e8', border: '1px solid #f5e6c8', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style="font: 500 11px 'DM Mono'; color: #65756d; textTransform: uppercase; marginBottom: 4px;">ETA</div>
          <div style="font: 700 16px 'Playfair Display'; color: #d37018;">{formatETA(trackingData?.eta)}</div>
        </div>
        <div className="info-card" style={{ background: '#e8f5ff', border: '1px solid #c5e0ff', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style="font: 500 11px 'DM Mono'; color: #65756d; textTransform: uppercase; marginBottom: 4px;">Distancia</div>
          <div style="font: 700 16px 'Playfair Display'; color: #53d2ed;">{formatDistance(trackingData?.distance)}</div>
        </div>
        <div className="info-card" style={{ background: '#f5f3eb', border: '1px solid #dfe3dc', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style="font: 500 11px 'DM Mono'; color: #65756d; textTransform: uppercase; marginBottom: 4px;">Conexión</div>
          <div style="font: 700 16px 'Playfair Display'; color: {isConnected ? '#69a128' : '#ff7043'};">
            {isConnected ? '🟢 Live' : '🔴 Offline'}
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="map-legend" style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: '12px', color: '#65756d', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={iconPro.options.iconUrl as string} width={20} height={20} alt="" />
            {professionalName}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={iconClient.options.iconUrl as string} width={20} height={20} alt="" />
            {clientName}
          </span>
        </div>
      )}
    </div>
  );
}
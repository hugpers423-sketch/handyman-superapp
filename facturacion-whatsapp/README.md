# Facturación WhatsApp Bot - MVP

Bot de facturación electrónica para emprendedores peruanos (Gamarra, Malvinas, mercados mayoristas) que operan 100% por WhatsApp.

## Características MVP

- **WhatsApp Business API** (Meta Cloud API) - Sin instalar apps, usan su WhatsApp habitual
- **Notas de voz** → Transcripción con Whisper local (gratis, offline, español peruano)
- **Fotos de productos** → Reconocimiento visual con CLIP + FAISS (reduce 50% el proceso)
- **Facturación electrónica** → Integración con Nubefact (SUNAT)
- **PDF/XML** → Entrega inmediata por el mismo chat (< 5 segundos)
- **Inventario automático** → Descuenta stock al facturar

## Flujo principal

```
Usuario (WhatsApp) 
  → Audio: "Polo negro talla M, 30 soles, DNI 12345678"
  → Foto de producto registrado + "5 unidades DNI 87654321"
  → Bot procesa → Nubefact → SUNAT
  → Respuesta: PDF + XML en WhatsApp
```

## Stack Tecnológico

- **Backend**: FastAPI + Python 3.11
- **DB**: PostgreSQL + Redis
- **Queue**: Celery + Redis
- **Audio**: OpenAI Whisper (local)
- **Visión**: CLIP (OpenAI) + FAISS
- **OCR**: EasyOCR + pyzbar (códigos de barras)
- **Facturación**: Nubefact API
- **WhatsApp**: Meta Cloud API / Twilio / WAPI

## Instalación Rápida

### 1. Clonar y configurar
```bash
cd facturacion-whatsapp
cp .env.example .env
# Editar .env con tus credenciales
```

### 2. Con Docker (Recomendado)
```bash
# Desarrollo con hot reload
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Exponer webhook localmente (ngrok)
docker-compose --profile dev up -d ngrok
```

### 3. Variables de entorno requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `WHATSAPP_PHONE_NUMBER_ID` | ID de número de Meta Business | `123456789` |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso Meta | `EAA...` |
| `WHATSAPP_VERIFY_TOKEN` | Token verificación webhook | `facturacion_bot_verify_2024` |
| `NUBEFACT_TOKEN` | Token API Nubefact | `abc123` |
| `NUBEFACT_RUC` | RUC de la empresa emisora | `20123456789` |

## Configuración WhatsApp (Meta Cloud API)

1. Crear app en [Meta for Developers](https://developers.facebook.com/)
2. Agregar producto **WhatsApp Business API**
3. Configurar webhook: `https://tu-dominio.com/api/v1/webhook`
4. Suscribir a eventos: `messages`, `message_deliveries`, `message_reads`
5. Obtener `Phone Number ID` y `Access Token`

## Configuración Nubefact

1. Crear cuenta en [Nubefact](https://nubefact.com/)
2. Obtener credenciales API (Token, RUC, Usuario, Password)
3. Modo sandbox para pruebas: `NUBEFACT_SANDBOX=True`

## Desarrollo Local

```bash
# Instalar dependencias
pip install -r requirements.txt

# Levantar solo DB y Redis
docker-compose up -d postgres redis

# Ejecutar API
uvicorn app.main:app --reload

# Ejecutar Celery worker
celery -A app.tasks worker --loglevel=info

# Ejecutar tests
pytest tests/ -v
```

## Estructura del Proyecto

```
facturacion-whatsapp/
├── app/
│   ├── api/              # Endpoints (webhook WhatsApp)
│   ├── core/             # Config, DB, security
│   ├── models/           # SQLAlchemy models
│   ├── services/         # Lógica de negocio
│   │   ├── whatsapp_service.py
│   │   ├── audio_service.py          # Whisper
│   │   ├── nlp_service.py            # Parser español peruano
│   │   ├── invoice_service.py        # Nubefact
│   │   └── product_recognition_service.py  # CLIP + FAISS + OCR
│   ├── tasks.py          # Celery tasks
│   └── main.py           # FastAPI app
├── tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/webhook` | Verificación Meta |
| POST | `/api/v1/webhook` | Recibir mensajes WhatsApp |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |

## Comandos de Usuario (WhatsApp)

### Crear factura/boleta
```
Texto: "Polo negro M, 30 soles, DNI 12345678"
Voz: [Nota de voz con los datos]
```

### Registrar producto
```
Foto del producto + Texto: "Polo algodón, 45 soles, 50 unidades"
```

### Ver stock
```
"stock" o "inventario"
```

### Factura por foto (producto ya registrado)
```
Foto del producto + Caption: "5 DNI 87654321"
```

## Despliegue Producción

### Opción A: VPS + Docker
```bash
# En servidor
git clone <repo>
cd facturacion-whatsapp
cp .env.example .env
# Editar .env con credenciales producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Opción B: Railway/Render/Fly.io
- Conectar repo
- Configurar variables de entorno
- Deploy automático

### Dominio y SSL
- Configurar dominio `api.tudominio.com`
- SSL con Let's Encrypt (Certbot) o Cloudflare
- Webhook URL: `https://api.tudominio.com/api/v1/webhook`

## Modelo de Negocio

| Plan | Precio | Comprobantes/mes |
|------|--------|------------------|
| Starter | S/ 49 | 500 |
| Professional | S/ 149 | 2,000 |
| Enterprise | S/ 399 | Ilimitado |

## Próximos Pasos (Roadmap)

- [ ] Dashboard web para comerciantes
- [ ] Múltiples sedes/almacenes
- [ ] Integración con Yape/Plin para pagos
- [ ] Reportes SUNAT (ventas, compras, diario)
- [ ] App móvil complementaria (opcional)
- [ ] IA para sugerir precios/stock

## Licencia

MIT - Uso libre para fines comerciales
# Morf AI Auto & Morf Lite — Master Roadmap & Architecture Specification

## Visión General: Morf Universal AI Router

Queremos convertir Morf en un **Gateway y Universal AI Router autónomo**.

El cliente solamente debe necesitar:
- **ONE API KEY:** Clave maestra o clave de cliente (`morf_live_...`).
- **ONE BASE URL:** `https://morf.codes/api/morf`
- **ONE API:** Compatible 100% con el estándar de OpenAI.
- **ONE AUTO MODEL:** `morf-ai-auto`

El cliente **NO** tiene que saber si internamente usamos:
- OpenRouter
- Runware
- Firecrawl
- Tavily
- Exa
- Laya
- DeepSeek, OpenAI, Anthropic, Google, xAI, Mistral, Qwen, MiniMax, Kling, Runway, Recraft, Ideogram, FLUX, Luma, Krea, ByteDance, etc.

Morf lo resuelve de forma transparente y optimizada.

---

## 🏛️ Arquitectura Objetivo

```
CLIENTE (morf-lite / OpenAI SDK)
   │
   │ Morf API Key
   ▼
MORF GATEWAY (FastAPI / Express Proxy)
   │
   ▼
MORF AI AUTO
   │
   ├──▶ Laya Decision Router (System-1 Ultra-rápido: task, complexity, freshness, quality)
   │
   ├──▶ Text / Reasoning / Coding Router
   │       ├── OpenRouter (Catálogo dinámico, auto-rankings, failover)
   │       └── Proveedores directos (DeepSeek, Mistral, Groq, Kimi, etc.)
   │
   ├──▶ Web Intelligence Router
   │       ├── Tavily (búsqueda rápida de hechos, noticias, frescura requerida)
   │       ├── Exa (investigación semántica profunda, neural search)
   │       └── Firecrawl (scraping limpio, crawling recursivo, extracción estructurada)
   │
   └──▶ Media Router (Runware Engine)
           └── Runware
                   ├── Images (text-to-image, edit, upscale, erase, try-on, outpainting)
                   ├── Video (text-to-video, image-to-video, upscale, replace, animate)
                   ├── Audio (TTS, voice, generation)
                   ├── 3D Generation
                   └── LoRA / Style Training
```

---

## 🔒 Regla Absoluta: Compatibilidad con morf-lite

El paquete actual `CodeMorf/morf-lite` **YA funciona en producción**.

Actualmente expone:
- `MorfClient` / `Morf`
- `MorfSession`
- `chat.completions.create()` (streaming y no-streaming)
- `models.list()`
- `stats()`
- `health()`

Utiliza:
- `MORF_API_KEY`
- `MORF_BASE_URL` (default: `https://morf.codes/api/morf`)

Llama:
- `POST /chat/completions`
- `GET /models`
- `GET /stats`
- `GET /health`

**Directiva permanente:**
1. Mantener **TODO** esto funcionando sin romper contratos.
2. **NO** meter SDKs pesados dentro de `morf-lite`.
3. `morf-lite` debe continuar siendo un SDK cliente pequeño (cero dependencias).
4. Toda la inteligencia (routing, search, scraping, catalog, cost calculation, provider keys, wallet, fallback, cache, Laya, Runware, OpenRouter, Exa, Tavily, Firecrawl) **debe ejecutarse SERVER-SIDE**.

---

## 🔑 Variables de Entorno del Servidor (Vault / Secret Storage)

Las credenciales reales se gestionan a través de la bóveda central del servidor y variables de entorno seguras (nunca expuestas al frontend ni en respuestas públicas):

| Variable | Proveedor | Función Principal |
| :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | OpenRouter | Pool dinámico de modelos de texto, código y razonamiento |
| `RUNWARE_API_KEY` | Runware | Catálogo completo de Imagen, Video, Audio, 3D y Training |
| `TAVILY_API_KEY` | Tavily | Búsqueda web ultra-rápida orientada a hechos recientes |
| `EXA_API_KEY` | Exa | Investigación semántica profunda y neural web search |
| `FIRECRAWL_API_KEY` | Firecrawl | Web scraping, crawling recursivo y extracción Markdown |

---

## 🧩 Componentes del Sistema

### 1. LAYA — Morf Auto Router Selection (System-1)
- Repositorio: `https://github.com/NandhaKishorM/laya`
- Instalación: `pip install "laya[serve]"`
- Ejecutado como microservicio interno en localhost.
- **NO genera la respuesta al usuario:** Es el System-1 determinista para toma de decisiones en < 2 ms.
- Determina: `task_type` (30+ tipos: `simple_chat`, `code`, `research`, `web_search`, `scrape`, `image_generation`, `image_edit`, `video_generation`, `audio`, etc.), `complexity` (`trivial` a `extreme`), `freshness` (`none`, `optional`, `required`), `quality` (`economy` a `maximum`), `latency` y `confidence`.

### 2. Scoring Dinámico & Auto-Rankings
- Evaluación multi-criterio ponderada:
  $$\text{final\_score} = w_{\text{cap}} \cdot \text{cap\_match} + w_{\text{qual}} \cdot \text{quality} + w_{\text{lat}} \cdot \text{latency} + w_{\text{cost}} \cdot \text{cost\_eff} + w_{\text{rel}} \cdot \text{health} + w_{\text{cache}} \cdot \text{cache\_adv}$$
- Perfiles soportados: `AUTO` (default), `ECONOMY`, `BALANCED`, `QUALITY`, `FAST`.

### 3. OpenRouter — Catálogo Dinámico
- Sincronización dinámica vía API.
- Generación automática de rankings:
  - TOP 50 QUALITY / TOP 50 ECONOMY
  - TOP CODING / TOP REASONING / TOP FAST / TOP LONG CONTEXT / TOP VISION / TOP CHEAP.
- Nuevos modelos entran al catálogo sin necesidad de despliegue.

### 4. Runware — Importación del 100% del Catálogo
- Consulta paginada (`offset=0, ...`) vía Model Search API hasta agotar resultados.
- Importación y clasificación por **Capability**:
  - `image.text_to_image`, `image.edit`, `image.erase`, `image.object_removal`, `image.background_removal`, `image.outpaint`, `image.upscale`, `image.virtual_try_on`
  - `video.text_to_video`, `video.image_to_video`, `video.edit`, `video.upscale`, `video.replace`, `video.animate`
  - `audio.tts`, `audio.voice`, `audio.generation`
  - `3d.generation`, `training.lora`
- El usuario pide "quita esa persona de la foto" y Morf selecciona automáticamente el modelo de `image.object_removal`.

### 5. Web Intelligence: Firecrawl + Tavily + Exa
- **Tavily:** Búsqueda rápida de hechos y noticias del día (solo cuando `freshness=required`).
- **Exa:** Deep semantic research implementado siguiendo el skill oficial `build-with-exa`.
- **Firecrawl:** Ingesta de URLs, scraping limpio en Markdown y crawling recursivo de documentación.
- **Smart Context Compression:** Deduplicar, filtrar navegación/boilerplate y comprimir antes de enviar contexto al LLM.

### 6. Caché Multinivel (L0 a L7)
- **L0:** In-memory ultra-fast
- **L1:** Gateway Redis / Local Store
- **L2:** Exact prompt cache
- **L3:** Semantic cache
- **L4:** Provider prompt caching (cache-aware routing)
- **L5:** Tool / search cache
- **L6:** Firecrawl extraction cache
- **L7:** Catálogo de modelos y metadatos

### 7. Slash Commands Registry (80+ Modos Modulares)
- Registro declarativo (`/brief`, `/research`, `/ceo`, `/critic`, `/debug`, `/viral`, `/ultimate`, etc.).
- Sin duplicar system prompts: cada comando define modificadores de profundidad, perfil de costo, política de herramientas y formato de salida.
- `/debug` multimodal: detecta si la entrada es código, imagen, video, audio o JSON.

### 8. Gestión de API Keys: Master Key vs Client Keys
- **Master Key:** Conservada en `https://morf.codes/terminal` para administración y SaaS interno.
- **Client API Keys (`morf_live_...`):** Generadas desde `https://morf.codes/chat` con almacenamiento de hash, cuotas diarias/mensuales, rate limits y scopes configurables.

---

## 🗺️ Fases de Implementación (Orden Estricto)

1. **FASE 0:** Backup / Branch / Auditoría profunda.
2. **FASE 1:** Mapeo de código actual (`router.py`, `decision_engine.py`, `providers.py`, `storage.py`).
3. **FASE 2:** Abstracciones unificadas de proveedores (`ProviderAdapter`).
4. **FASE 3:** Sistema de almacenamiento seguro de secretos y bóveda en backend.
5. **FASE 4:** Instalación y servicio de Laya (`pip install "laya[serve]"`).
6. **FASE 5:** OpenRouter catalog dinámico + ejecución + rankings.
7. **FASE 6:** Runware catalog paginado (100% de modelos) + capability router.
8. **FASE 7:** Tavily adapter para web search condicional.
9. **FASE 8:** Exa adapter con skill `build-with-exa`.
10. **FASE 9:** Firecrawl adapter (scrape, crawl, extract).
11. **FASE 10:** Motor de scoring dinámico y routing adaptativo.
12. **FASE 11:** Implementación de caché multinivel (L0 a L7).
13. **FASE 12:** Fallback jerárquico y Circuit Breaker (Closed, Open, Half-Open).
14. **FASE 13:** Cost Engine unificado (tokens, megapíxeles, segundos, créditos) + snapshots.
15. **FASE 14:** Transmisión de eventos en tiempo real a `/terminal` (SSE / WebSocket).
16. **FASE 15:** Actualización de `/settings/cuenta` para listar cuentas y balances.
17. **FASE 16:** Consolidación de `/super-admin/cuentas-ia` como fuente única de verdad.
18. **FASE 17:** Client API keys con hash y cuotas en `/chat`.
19. **FASE 18:** Actualización de documentación en `/terminal/docs/api`.
20. **FASE 19:** Batería obligatoria de 20 pruebas reales.
21. **FASE 20:** Validación final en producción y entrega de reporte.

---

## 🧪 Protocolo de 20 Tests Reales Obligatorios

- **TEST 1:** Simple chat (`"hola"` ➔ modelo económico ultra-rápido).
- **TEST 2:** Coding (prompt de código ➔ modelo especializado).
- **TEST 3:** Complex reasoning (problema lógico ➔ modelo de razonamiento).
- **TEST 4:** Tavily current search (hechos de hoy ➔ búsqueda web en tiempo real).
- **TEST 5:** Exa semantic research (investigación técnica profunda ➔ Exa).
- **TEST 6:** Firecrawl URL scrape (análisis de página web ➔ Markdown limpio).
- **TEST 7:** Firecrawl crawl (crawling estructurado).
- **TEST 8:** Runware cheap image (generación de imagen ➔ Runware).
- **TEST 9:** Runware image edit (edición / inpainting ➔ modelo de edición).
- **TEST 10:** Runware video (generación o verificación de video).
- **TEST 11:** Audio / TTS (síntesis de voz).
- **TEST 12:** OpenRouter dynamic model (modelo obtenido del catálogo dinámico).
- **TEST 13:** Laya routing (verificación de System-1 decision).
- **TEST 14:** Provider failure fallback (salto automático ante fallo).
- **TEST 15:** Cache hit (consulta idéntica ➔ `cache_hit: true` y \$0 costo).
- **TEST 16:** Streaming (flujo continuo Server-Sent Events).
- **TEST 17:** Tool calling (ciclo completo de herramientas).
- **TEST 18:** Client API key (petición exitosa con `morf_live_...`).
- **TEST 19:** Master key (petición exitosa con clave maestra).
- **TEST 20:** Models dynamic refresh (verificación de recarga de catálogo).

---

## 🎯 Criterio de Aceptación Final

Cualquier integración externa debe poder operar con la máxima simplicidad:

```typescript
import { MorfClient } from 'morf-lite';

const client = new MorfClient({
  apiKey: process.env.MORF_API_KEY,
  baseUrl: 'https://morf.codes/api/morf',
});

// Morf resuelve internamente la intención, las herramientas y los modelos
const response = await client.chat.completions.create({
  model: 'morf-ai-auto',
  messages: [{ role: 'user', content: 'Investiga las novedades de React.' }],
});
```

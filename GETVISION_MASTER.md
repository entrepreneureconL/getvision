# GETVISION — Master Document

> **Propósito**: documento único de verdad para el proyecto. Negocio + técnica + roadmap + aprendizajes de mercado + fundamentos de la empresa, en un solo lugar.
> **Mantener este archivo actualizado al cierre de cada fase.** Si entra en conflicto con cualquier otro doc, este gana hasta que el otro se actualice.
> **Última revisión**: Junio 2026 — **F1-D mayormente cerrada**: Design System aplicado a Welcome/Login/Dashboard simple/Onboarding/Settings, transactions enriquecidas (categorías finas + método de pago visible), edición/eliminación de movimientos. Falta F1-D #8 (bottom tabs + Stats + Perfil).
> **Doc técnico complementario**: `GETVISION_TECH.md` (schema DB, capas, catálogos, cookbook). Este file es producto+negocio; el tech doc es código+arquitectura.

---

## 1. Visión

**GetVision te dice cuánto ganás de verdad — descontando inflación, costos ocultos y lo que todavía no te pagaron.**

App de gestión financiera para PyMEs, monotributistas y emprendedores informales en Argentina (LATAM en fases tardías). Diseñada desde la realidad del emprendedor que no tiene contador, no factura todo, y no entiende balances — pero necesita saber si su negocio gana plata.

### Tres problemas que resolvemos

1. **No saber el costo real** de prestar un servicio o vender un producto.
2. **No ver el flujo de caja real** (efectivo + cuentas + lo que falta cobrar/pagar).
3. **No poder decidir** porque los números viven en cuadernos, WhatsApps y Excel.

### Propuesta de valor diferencial

| Eje | Cómo lo hacemos |
|---|---|
| Adaptación sectorial | Dashboard cambia según `income_model` (services / products / mixed). Peluquería ve KPIs distintos que un kiosco. |
| Economía informal | Aceptamos estimaciones y registros parciales. No obligamos a registrar ventas formales. |
| Contexto macro | Indicadores INDEC + BCRA filtrados por rubro — "inflación de tu rubro". |
| Freemium real | Free 100% funcional. Plan paid agrega features avanzadas, no bloquea el core. |
| Voz local | Español rioplatense, copies hechos por humanos, no por contadores. |

---

## 2. Mercado y competencia (junio 2026)

### Mapa competitivo en 3 capas

**Capa A — Contables formales (no son competencia, son techo)**
- **Xubio**: 50.000 empresas AR + CO + MX. Apunta a contadores y PyMEs con estructura. Plan PyME desde ~$15-30K ARS/mes.
- **Contabilium**: barato, integración nativa AFIP/ARCA, ideal startups con factura electrónica.
- **Tango / Líder**: ERP completo legacy, $60K-600K/mes. Cero amenaza directa.

**Capa B — Competidor real: Alegra ⚠️**
- Plan **gratis funcional** (mismo move que nosotros).
- AR + CO + MX + 10 países. Equipo grande y financiados.
- Tiene Alegra Academy (capacitación) → marketing de contenido a escala.
- **Cómo le ganamos**: ser más simple y más local. Alegra es contabilidad real; nosotros somos "es plata, no es contabilidad".

**Capa C — Riesgo a largo plazo**
- **Mercado Pago Business Account + Point Tap**: 1M+ usuarios cobrando con celular en AR+BR. El día que agreguen un dashboard de KPIs decente, ganan por defecto porque ya tienen el flujo transaccional.
- **Tiendanube** (e-commerce), **Ualá / Naranja X** (bancos digitales).

### Posicionamiento elegido

```
ALTA COMPLEJIDAD
    Tango ──── Xubio ──── Contabilium
                    │
                  Alegra
                    │
        ╔═══════════╪═══════════╗
        ║       GETVISION       ║   ← simple + local + contexto macro
        ╚═══════════╪═══════════╝
                    │
              Mercado Pago (transaccional)
BAJA COMPLEJIDAD
```

### Insights de la investigación

- **El segmento informal monetiza pésimo por suscripción.** El camino real es ser puerta de entrada a productos financieros (scoring + crédito en partnership) — confirmado por Konfío (US$2.5B en créditos PyME 2026-2028) y por la estrategia de MP.
- **El "blockchain v2.0" del handover es una trampa.** Ningún banco argentino mira on-chain hoy. Se difiere a fase ≥5.
- **TikTok consolidado como canal real para PyMEs en 2026** (programa `#EmprendeEnTikTok` con New Ventures, CPMs 1-2 USD).
- **Instagram + WhatsApp Business** siguen anclando la conversión final.

---

## 3. Modelo de negocio

### Freemium con tres motores de revenue

| Motor | Cuándo | Cómo |
|---|---|---|
| **1. Suscripción paid** | Fase 3 | Plan ~$3-7 USD/mes ARS equiv: multi-negocio, export PDF para contador, predicción cashflow, alertas. Objetivo 5% conversion. |
| **2. Lead-gen contadores** | Fase 3 | Marketplace de contadores. Revenue share por lead cualificado. |
| **3. Productos financieros** | Fase 4 | Con 6+ meses de historial transaccional → scoring propio → partnership con prestamista (Ualá/MP/fintech) para crédito de capital de trabajo dentro de la app. Revenue share. **Este es el moat real.** |

### Métricas norte por fase

| Fase | Métrica clave | Threshold |
|---|---|---|
| 0 | Build estable + 5 usuarios beta usando 2 semanas | binario |
| 1 | D7 retention | > 30% |
| 2 | M3 retention | > 20% |
| 3 | Paid conversion | > 5% |
| 4 | LTV/CAC | > 3 |

---

## 4. Stack técnico (estado real, junio 2026)

> **Importante**: la siguiente tabla es el código actual en disco, **no** el handover. El handover decía SDK 52 lockeado; en realidad el repo ya está en SDK 55.

| Capa | Tecnología | Versión real |
|---|---|---|
| Runtime | React Native + Expo | SDK **55** / RN 0.83.4 |
| Lenguaje | TypeScript | 5.9 |
| UI | StyleSheet nativo | — |
| Auth + DB + Storage | Supabase | @supabase/supabase-js 2.99 |
| DB | PostgreSQL (Supabase) | 15+ |
| Estado app | useState + máquina manual | — |
| Navegación instalada (NO usada) | `@react-navigation/native` 7.1 | ⚠️ deuda |
| Validación runtime | **falta** | F0-4 |
| Error capture | **falta** | F0-4 |
| Server state cache | **falta** | Fase 1+ |
| Tests | **falta** | Fase 2+ |

### Estructura actual de archivos

```
GetVision/
├── App.tsx                            # máquina de estados manual
├── index.ts
├── package.json
├── .env                               # NUNCA al repo
├── assets/
├── src/
│   ├── components/
│   │   ├── SaleForm.tsx
│   │   ├── CostForm.tsx
│   │   └── MovementForm.tsx
│   ├── lib/
│   │   └── supabase.ts                # cliente singleton
│   ├── screens/
│   │   ├── WelcomeScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   └── SettingScreen.tsx          # ⚠️ typo: "Setting" no "Settings"
│   └── utils/
│       └── businessProfile.ts         # tipos + getDashboardConfig
```

### Estructura objetivo al cierre de Fase 0

```
src/
├── components/
│   ├── forms/                         # mover Sale/Cost/Movement acá
│   ├── ErrorBoundary.tsx              # NUEVO F0-4
│   ├── Money.tsx                      # NUEVO F0-4 — formato balance reusable
│   └── TransactionList.tsx            # NUEVO F0-3
├── repos/                             # NUEVO F0-4 — capa data
│   ├── businesses.ts
│   └── transactions.ts
├── schemas/                           # NUEVO F0-4 — zod
│   ├── business.ts
│   └── transaction.ts
├── screens/
│   ├── SettingsScreen.tsx             # renombrar de SettingScreen
│   └── ...
└── ...
```

### Modelo de datos (Supabase)

**`businesses`**
```sql
id                   UUID PK
user_id              UUID FK auth.users
name                 VARCHAR(150)
owner_name           VARCHAR(100)
sector               VARCHAR(30)         -- 'services'|'commerce'|'industry'|'agro'
rubro                VARCHAR(80)
business_profile     VARCHAR(80)
income_model         VARCHAR(20)         -- 'services'|'products'|'mixed'
logo_url             TEXT
onboarding_completed BOOLEAN
created_at           TIMESTAMP
-- RLS: user_id = auth.uid()
```

**`transactions`**
```sql
id             UUID PK
business_id    UUID FK businesses
type           VARCHAR(20)               -- 'income'|'expense'|'income_extraordinary'|'expense_extraordinary'
amount         DECIMAL(12,2)             -- siempre positivo
date           DATE
payment_method VARCHAR(30)
category       VARCHAR(60)
description    VARCHAR(120)
status         VARCHAR(20)               -- 'completed'|'pending'
product_id     UUID                      -- FK pendiente
client_id      UUID                      -- FK pendiente
quantity       DECIMAL(10,2)
installments   INT
created_at     TIMESTAMP
-- RLS: business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
```

**Pendientes de schema** (Fase 1+): `products`, `costs_catalog`, `clients`, `suppliers`, `receivables`, `payables`, `economic_indicators`, `indicator_cache`.

### Convenciones de código

- **PascalCase** clases y componentes. **camelCase** funciones y vars. **UPPER_SNAKE** constantes.
- **Estilos**: `StyleSheet.create` al final del archivo del componente. Sin librería UI hasta Fase 2.
- **Strings de UI en español rioplatense.** Logs internos en inglés OK.
- **Formato monetario**: `Intl.NumberFormat('es-AR')`. Negativos como `(−1.234,56)` en rojo `#C0392B`. Positivos verde `#27AE60`.
- **Async**: siempre `try/catch`. Hasta que llegue ErrorBoundary, console.error explícito.
- **Imports**: `react` y `react-native` primero, libs externas, libs internas, archivos relativos.
- **Sin LINQ-style chains en render hot path**. Calcular fuera del JSX.

---

## 5. Decisiones (ADR-style)

| # | Decisión | Elegido | Descartado | Motivo |
|---|---|---|---|---|
| 1 | Stack mobile | RN + Expo | Flutter, Ionic | Mayor ecosistema JS/TS. Curva más amable para dev base C++/Python. |
| 2 | Backend | Supabase | Server propio, Firebase | $0 en MVP, Postgres real, RLS nativo, sin lock-in fuerte. |
| 3 | SDK Expo | **SDK 55** (estado real) | SDK 52 (handover decía esto) | Actualizado más allá del handover. Expo Go 2026 ya soporta. |
| 4 | Navegación | Máquina de estados manual en App.tsx | React Navigation (instalado pero no usado) | Legibilidad para 5 pantallas. **Reevaluar al llegar a 8+ pantallas → migrar a expo-router**. |
| 5 | Validación runtime | **zod (F0-4)** | Solo TypeScript | TS es compile-time. Una migración rota silencia errores hoy. |
| 6 | Cache server state | Diferido | react-query | Sumarlo cuando haya 2+ pantallas con misma data. Hoy no justifica el overhead. |
| 7 | Bucket logos | Público | Privado con signed URLs | Logos no sensibles, evita overhead de tokens. |
| 8 | Analytics MVP | Vistas SQL Supabase | GA / Mixpanel | $0, no requiere SDK extra. PostHog en Fase 2. |
| 9 | Blockchain Polygon | **Diferido a Fase ≥5** | v2.0 (handover) | Ningún banco argentino mira on-chain en 2026. Resuelve problema sin demanda. |
| 10 | Mercado LATAM #2 | México | Colombia/Chile | Mercado 3× más grande, fintech maduro, capital para levantar. |
| 11 | Color de acento UI | **Teal `#1F8579`** (del logo) | Azul iCloud `#3B82F6` | Decisión revertida en F1-D al ver los logos reales en `Diseño/Logo/`. La app respira la marca, no compite con ella. Bonus: nos diferencia de bancos AR (todos azul). |
| 12 | Design System | **Custom in-house** (tokens + 9 primitivos) | Tamagui / RN UI Kitten / NativeBase | Control total + aprendizaje de primitivos + sin lock-in. 9 componentes cubren 90% del uso actual. |
| 13 | Navegación mobile objetivo | **Bottom tabs iOS-style** (4 fijos: Dashboard / Movimientos / Stats / Perfil) | Hamburger + máquina manual | Estándar iPhone. Adelanta deuda técnica F2 (`expo-router`) pero la difiere todavía: F1-D sub-paso 8.2 hace el componente custom, 8.3 (expo-router) puede esperar. |
| 14 | Comparativa period-vs-period | **Solo cuando hay 2+ períodos con datos** | Mostrar siempre con cero | Si previousValue es 0 o ambos isEmpty, devolvemos `null`. Evita "↑ ∞%" o "↓ 100%" que confunden. |
| 15 | Categorías de transactions | **Catálogo central + `category` libre en DB** | Enum estricto en zod | Backwards compat con strings legacy ("Venta de producto"). `resolveCategory()` mapea ambos al CategoryDef. Sin migration de DB. |
| 16 | Estructura de datos a cargar (F1 alcance) | **Mínimo**: enriquecer transactions | Medio (clients + product_id) / Completo (receivables/payables) | El medio retrasa D7 retention 3-4 semanas. El completo es F2-F3 según master. F1-D Task #10 cerró el mínimo. |
| 17 | Edición de movimientos | **Tap sobre item → form en modo edit** | Botón "..." aparte / sheet de detalle | Más Apple-style. Form precargado + botón "Eliminar" al final. Extraordinarios NO editables hoy (deuda chica documentada en Task #11). |

### Reglas no-negociables

1. **`.env` nunca al repo.** Hay `.gitignore` cubriendo.
2. **Solo `EXPO_PUBLIC_*` viaja al bundle.** Nunca `service_role` ni secrets de OAuth ahí.
3. **RLS activado en toda tabla nueva** antes del primer insert.
4. **Toda query con potencial de `null` usa `.maybeSingle()`**, no `.single()`. (Evita 406.)
5. **Toda escritura financiera valida con zod antes de hacer `.insert`.** (Desde F0-4.)
6. **Cero `any` no justificado.** Si aparece, marcar con `// TODO: tipar` y abrir tarea.

---

## 6. Roadmap por fases

> Cada fase es una **decisión de prioridad**, no un timeline rígido. Pasamos de fase cuando se cumple la métrica norte, no por calendario.

### Fase 0 — Cimientos (ESTÁ EN CURSO) — ver §7 detalle
**Meta**: tener el dashboard 100% diferenciado + historial real + base técnica endurecida + APK instalable.
**Métrica norte**: 5 usuarios beta usando la app 2 semanas seguidas.

### Fase 1 — MVP público
- Wizard de productos/servicios + catálogo.
- Integración INDEC/BCRA con Edge Function + caché 24h.
- Widget de contexto macro en dashboard ("inflación de tu rubro").
- Web app desplegada (no solo mobile) — clave en AR.
- Onboarding < 2 minutos cronometrado.
- **Métrica norte**: D7 retention > 30%, NPS > 40.

### Fase 2 — Integración tributaria
- **ARCA (ex-AFIP) — emisión de factura electrónica monotributo** desde GetVision. Este es el gancho más fuerte que tiene Contabilium hoy.
- Link a cobros (MP, Modo) — no competir con MP, ser el receptor del dato.
- Importación CSV/Excel de extractos bancarios.
- Migración a `expo-router` (cuando haya 8+ pantallas).
- Incorporar `react-query`.
- Incorporar tests críticos.
- **Métrica norte**: M3 retention > 20%.

### Fase 3 — Monetización
- Plan paid: multi-negocio, export PDF para contador, predicción cashflow, alertas.
- Marketplace de contadores con revenue share.
- **Métrica norte**: paid conversion > 5%, CAC < 3 meses LTV.

### Fase 4 — Producto financiero (el moat real)
- Scoring crediticio basado en 6+ meses de historial transaccional del usuario.
- Partnership con fintech prestamista (Ualá/MP/nueva) para crédito de capital de trabajo dentro de la app.
- **Métrica norte**: LTV/CAC > 3.

### Fase 5 — LATAM (México primero)
- Reemplazar AFIP→SAT, INDEC→INEGI. La capa de `economic_indicators` ya está abstraída.
- Localización de copies (sacar rioplatense).
- Polygon como nice-to-have de marketing si hay tracción.

---

## 7. Fase 0 — CERRADA (resumen ejecutivo)

> Cerrada en **junio 2026**. Status: **APK distribuible funcionando en celular Android real**.

### Lo que se construyó

**Producto**:
- Dashboard adaptable con dos modos (`simple` y `detailed`), elección del usuario.
- Hero metric por subrubro: el dashboard muestra la métrica más relevante a la actividad declarada.
- Sistema de búsqueda transversal en onboarding: tipear "peluquería" en cualquier paso autocompleta sector + rubro + subrubro.
- Onboarding sin fricción innecesaria: 3-4 pasos dinámicos según rubro elegido.
- Settings con 3 tabs (General, Actividad, Preferencias).
- 5 forms operativos: SaleForm, CostForm, MovementForm, QuickProductForm, QuickHoursForm.
- Historial de movimientos con fechas relativas en español rioplatense.
- FAB flotante como único entry point para registrar.

**Arquitectura**:
- 4 schemas zod (`business`, `transaction`, `product`, `hoursLog`) con parseo seguro y enums centralizados.
- 5 repos (`businesses`, `transactions`, `products`, `hoursLog`, `analytics`) — los componentes nunca tocan Supabase directo.
- 6 computers puros de métricas (`effective_hourly_rate`, `daily_revenue`, `ticket_average`, `margin_per_sale`, `cost_to_revenue_ratio`, `monthly_balance`) testeables sin DB.
- `effectiveKey` pattern: cuando un cálculo se vuelve engañoso (e.g., hourly rate con balance negativo), el computer redirige al spec correcto.
- ErrorBoundary global atrapa crashes de render.
- Container responsive (`maxWidth: 640`) evita layouts "rústicos" en desktop.
- Componentes UI reusables: `<Money/>`, `<HeroMetricCard/>`, `<TransactionList/>`, `<Container/>`, `<FAB/>`, `<HighlightedText/>`.

**Base de datos**:
- `businesses` extendida con `detail_level`, `operator_role`, `threshold_hourly_rate`, `subrubro` + constraints.
- Nuevas tablas: `products` (catálogo con stock + soft delete), `hours_log` (registro de horas con billable flag).
- RLS activado en todas. Constraints de enum como defensa en profundidad.

**Estructura de actividades**:
- 4 sectores (services, commerce, industry, agro), **2 visibles en primera versión** (services, commerce).
- 22 rubros activos (sin contar industry/agro que están ocultos).
- 80+ subrubros distribuidos en los rubros donde aportan precisión.
- Mapa `HERO_METRICS_BY_SUBRUBRO` que decide qué métrica destacar.

**Distribución**:
- `app.json` con bundle id `ar.com.getvision.app`, splash en color de marca.
- `eas.json` con 3 perfiles (development/preview/production).
- `.easignore` que incluye `.env` en el bundle (caso particular: sin esto, las claves Supabase no llegan al APK).
- APK ya instalado y funcionando en celular Android real.

### Definition of Done — Fase 0 ✅ todos cumplidos

- [x] Dashboard adaptable simple ⇄ detailed según preferencia del usuario.
- [x] Hero metric por subrubro con hint constructivo + fallback elegante para casos edge.
- [x] Historial scrollable con fechas relativas, íconos y montos con signo.
- [x] Validación zod en toda lectura/escritura de DB crítica.
- [x] ErrorBoundary global con fallback amable + botón reintentar.
- [x] Repos centralizan acceso a DB; componentes son agnósticos.
- [x] `<Money/>` único componente para formato monetario.
- [x] EAS Build genera APK instalable; abre y funciona en celular Android real.
- [x] Onboarding redesignado: sin paso income_model, con subrubro condicional + detail_level + buscador transversal.

### Lo que aprendimos haciendo Fase 0

| Lección | Cómo se reflejó |
|---|---|
| **El usuario sabe mejor que nosotros qué es "su sector"** | Una peluquería es percibida como Comercio, no Servicio. Movimos Belleza y Estética + Gastronomía a Comercio. |
| **Pocos datos > muchos datos** | Apps gig (Uber/Rappi) no van a cargar viaje por viaje. 3 datos diarios + costos = salud vital. Pensado para F1. |
| **Adaptarnos al usuario, no que el usuario se ajuste** | Eliminado el paso obligatorio de income_model. La app infiere lo posible y deja lo opcional para Settings. |
| **El feedback visual es irreemplazable** | Las primeras pantallas se veían "rústicas" en desktop full-width. Container responsive + FAB lo arreglaron. |
| **Las métricas matemáticamente correctas pueden ser pedagógicamente malas** | `hourly_rate` con balance negativo da número engañoso (más horas = "menos malo"). Redirigimos a `monthly_balance` en ese caso. |
| **Distribuir un APK Android sin Play Store tiene fricción real** | EAS no respeta `.env` automáticamente (sigue `.gitignore`). Hay que crear `.easignore`. Documentado para que no vuelva a pasar. |

### Deuda técnica conocida (no bloqueante, va a F1+)

| Item | Cuándo se ataca |
|---|---|
| Sin realtime entre web y app — hay que F5 manual | F2 con Supabase Realtime |
| ~~Inline styles en cada componente (sin design system)~~ | **✅ resuelto en F1-D #1-7**: tokens + 9 primitivos aplicados en Welcome/Login/Dashboard/Onboarding/Settings |
| Sin tests automáticos | F2 (Vitest + Maestro o Detox) |
| Sin observabilidad: console.error pero sin captura externa | F1+ con Sentry o PostHog |
| `versionCode` en `app.json` ignorado (warning EAS) | Cleanup cosmético, sin urgencia |
| Bug latente en F0: rename `SettingScreen.tsx` → `SettingsScreen.tsx` (typo) | Bug "cosmético" — funciona por el import string. Renombrar cuando se toque ese archivo |
| Industria y Agro: rubros existen en el modelo pero ocultos en UI | F2+ cuando tengamos métricas específicas (rendimiento por hectárea, etc.) |
| Extraordinarios no editables vía tap (MovementForm no soporta `transaction?` prop) | F1+ cuando rediseñemos MovementForm para soportar edit. Hoy: tap en extraordinario es no-op |
| Color amount column: para `cost_to_revenue_ratio`, subir = malo. Hoy el ComparisonBadge usa "subir = success". | F1-A (toggle hero KPI múltiple) — agregar `higherIsBetter: boolean` al HeroMetricSpec |
| Forms (SaleForm/CostForm/MovementForm/QuickProductForm/QuickHoursForm) tienen StyleSheet legacy inline aunque consuman el catálogo de categorías | F1 limpieza tardía o F2 — el rewrite completo al DS de los forms grandes no aporta tanto valor visible |
| MovementForm guarda con `type: 'income'/'expense'` y label "Ingreso extraordinario" en `category` — debería usar `type: 'income_extraordinary'`. Sobrevive vía LEGACY_MAP. | F2 limpieza de schema |

---

## 8. Marketing (preparación, ejecución en Fase 1+)

### Canales priorizados

| Canal | Rol | Frecuencia objetivo |
|---|---|---|
| **TikTok** | Top-funnel adquisición | 4-7×/sem |
| **Instagram** | Brand + casos | 3×/sem |
| **WhatsApp Business** | Conversión + soporte | Always-on |
| **YouTube Shorts/Long** | SEO + trust | Shorts 2×/sem, long 1×/sem |
| **Blog SEO** | Captura search | 1-2 posts/sem |
| **LinkedIn** | B2B partnerships | 2×/sem |

### Ideas de contenido reusables del producto

- **"El semáforo de tu rubro"** — video semanal con INDEC. Data ya disponible en el producto.
- **"Auditoría de 5 minutos"** — antes/después con emprendedores reales.
- **"Cuánto gana realmente un [rubro]"** — usando datos agregados anonimizados.
- **Calculadoras SEO** — precio servicio, monotributo 2026. Capturan tráfico de búsqueda directo.

### Lo que NO hacemos al principio

- Meta Ads pagos (CAC altísimo en fintech AR).
- TV, vía pública, banners.
- Copy del playbook Alegra Academy 1:1 (su academia es para contadores; nosotros hablamos al emprendedor directo).

---

## 9. Instrucción de reinicio (paste en nueva sesión Claude)

```
Estoy continuando GetVision, app financiera para PyMEs argentinas.

Stack: React Native + Expo SDK 55 + TypeScript + Supabase (PostgreSQL + Auth + Storage).
Trabajo en Windows con VS Code. Carpeta: C:\Users\Cristopher\GetVision\
Doc maestro completo: C:\Users\Cristopher\GetVision\GETVISION_MASTER.md (leer §4, §5, §7, §12 y §13 antes de tocar nada).

Estado actual: Fase 0 CERRADA (junio 2026). APK Android distribuible funcionando en celular real.
Arquitectura: 4 schemas zod, 5 repos, 6 computers de métricas, 8 componentes UI reusables.
Dashboard dual mode (simple/detailed). Onboarding con buscador transversal. Forms operativos.

Próximo paso: Fase 1 — primer foco es F1-D (Design System básico). Después F1-A (hero metric múltiple) + F1-B (flujo apps gig) + F1-C (KPIs industria estándar).

Soy desarrollador con base C++/Python/VB aprendiendo TS/RN. Explicá conceptos nuevos comparándolos con lo que sé. Cuando edites un archivo existente, dame el archivo completo si es chico, o Edit puntuales si es grande.

Filosofía del producto (§12 del master): pocos datos = salud vital. Adaptarnos al usuario, no que el usuario se ajuste a nosotros. Tres tipos de usuario distintos (tradicional / autónomo / apps gig) requieren tres tipos de UX dentro de la misma app.

Próximo paso concreto: [DESCRIBIR ACÁ].
```

---

## 10. Cambios desde el handover original

| Tema | Handover decía | Realidad / decisión nueva |
|---|---|---|
| Expo SDK | 52 lockeado por incompat de Expo Go | **SDK 55 ya en uso** (package.json). Sin restricción. |
| React Navigation | "Considerar en v2.0" | Instalado pero no usado. Migrar en Fase 2 a `expo-router`. |
| Blockchain Polygon | Feature de v2.0 | **Diferido a Fase ≥5**. No es prioridad ni resuelve demanda probada. |
| Validación de datos | No mencionada | **Zod desde F0-4**. Quick win acordado. |
| Error capture | No mencionada | **ErrorBoundary desde F0-4**. Sentry en Fase 1. |
| Capa data | Acceso directo a Supabase | **Repos pattern desde F0-4**. |
| Monetización | "Freemium con paid" sin detalle | Tres motores: suscripción + lead-gen contadores + **productos financieros (moat real)**. |
| LATAM | Colombia, Chile, México | **México primero** (Fase 5). |

---

## 11. Changelog

- **Junio 2026 — F0-1** — Creación inicial del master. Auditoría del código real vs handover. Definición de Fase 0 con 5 tareas (F0-1 a F0-5). Decisiones nuevas: diferir blockchain, adoptar zod + ErrorBoundary + repos en Fase 0, México como primer país LATAM en Fase 5.

- **Junio 2026 — F0-4** — Hardening base. Sumadas dependencias: zod 4.4. Nuevos archivos: `src/schemas/{business,transaction}.ts`, `src/repos/{businesses,transactions}.ts`, `src/components/{ErrorBoundary,Money}.tsx`. Refactor: App.tsx y DashboardScreen consumen repos en vez de tocar Supabase directo. Bug latente arreglado en `handleSettingsSaved` (tipo de callback).

- **Junio 2026 — F0-2** — Tablas nuevas en Supabase: `products` (catálogo con stock) y `hours_log` (registro de horas). Schemas zod + repos correspondientes. Forms rápidos `QuickProductForm` y `QuickHoursForm`. Dashboard con tarjetas Stock/Horas tocables y badges de alerta.

- **Junio 2026 — F0-2.5 (rediseño adaptable)** — Pivot estructural a partir del feedback del usuario. Cambios:
  - **Filosofía**: `income_model` deja de ser **gate** (oculta/muestra) y pasa a ser **lens** (ordena/enfatiza). Nuevo eje: `detail_level` ('simple' | 'detailed') — el usuario elige cuán denso ver su negocio. **`income_model` removido del onboarding obligatorio**; default 'mixed' en DB, editable opcional desde Settings.
  - **Schema DB**: agregadas a `businesses` las columnas `detail_level`, `operator_role`, `threshold_hourly_rate`, `subrubro` + constraints de enum.
  - **Estructura de actividades**: 3 niveles (Sector → Rubro → Subrubro). Nuevos rubros: "Transporte Pesado y Fletes", "Transporte de Personas", "Taller Mecánico", "Gimnasio y Wellness", "Repuestos y Accesorios Automotrices". Removidos como tales: "Logística y Transporte", "Automotriz". ~80 subrubros definidos.
  - **Hero KPI por subrubro**: módulo `src/utils/heroMetrics.ts` con 6 métricas (`effective_hourly_rate`, `daily_revenue`, `ticket_average`, `margin_per_sale`, `cost_to_revenue_ratio`, `monthly_balance`) y mapa `HERO_METRICS_BY_SUBRUBRO`. Resolución en cascada: subrubro → rubro → fallback. Cada métrica tiene `buildHint(ctx)` que genera mensaje constructivo según valor.
  - **`analyticsRepo`** (`src/repos/analytics.ts`): orquestador que carga selectivamente datos según la métrica resuelta y dispatchea al computer puro correspondiente. 6 computers exportables y testeables.
  - **`<HeroMetricCard/>`**: tarjeta destacada con valor + hint + badge "Datos parciales" cuando aplica. Slot preparado para comparativa INDEC en Fase 1.
  - **Dashboard dual mode**: en `simple` muestra solo HeroMetricCard + lista de últimos 3 movimientos + FAB. En `detailed` muestra todo: KPIs financieros, Stock/Horas tarjetas, Split (si mixed), Balance + lista de 10.
  - **Onboarding rediseñado**: pasos dinámicos (3 si rubro no tiene subrubros, 4 si tiene). Último paso: detail_level. Sin pregunta de income_model.
  - **Settings rediseñado**: 3 tabs (General, Actividad, Preferencias). Preferencias incluye toggle detail_level + threshold_hourly_rate opcional + income_model opcional con hint claro.
  - **Container responsive** (`src/components/Container.tsx`): wrapper con `maxWidth: 640` para evitar el "rústico" en desktop. Aplicado a Dashboard, Onboarding, Settings.
  - **FAB flotante** (`src/components/FAB.tsx`): botón circular abajo-derecha, single point of entry para registrar movimientos. Reemplaza el botón gigante "Registrar movimiento" del modo simple.
  - **Action picker simplificado**: 3 primarias (Cobrar / Pagar / Horas trabajadas) + colapsable "Más opciones ▼" con Producto y Movimiento extraordinario. Aplicación de Hick's Law.

- **Junio 2026 — F0-3** — Historial de movimientos scrollable. Componente `src/components/TransactionList.tsx` con fechas relativas ("Hoy", "Ayer", "Hace N días", "DD MMM"), íconos por tipo (income/expense/extraordinary), montos con signo y color. Integrado en Dashboard: 3 últimos en modo simple, 10 en detailed. Reemplaza el empty state hardcoded.

- **Junio 2026 — F0-5** — Configuración EAS Build. `app.json` con `package: "ar.com.getvision.app"` y splash en color de marca. `eas.json` con 3 perfiles (development/preview/production). `.gitignore` cubre `*.apk`, `*.aab`, `credentials.json`. Build APK queda como acción del usuario.

- **Junio 2026 — F0-6** — Welcome simplificado: eliminado link chico "Ya tengo cuenta" (era no-op). Hint discreto. Un solo botón "Comenzar gratis" que lleva a LoginScreen donde el toggle decide signup/login.

- **Junio 2026 — F0-7** — Fix hourly_rate negativo. Cuando `balance < 0`, el computer redirige a `monthly_balance` vía `effectiveKey?: HeroMetricKey` opcional en `ComputeResult`. Evita mostrar números engañosos como "$-2.500/hora" que se "achican" con más horas trabajadas. Patrón reusable para otros casos futuros.

- **Junio 2026 — F0-8** — Excel `GetVision_RubrosReview.xlsx` con estructura completa SECTORS/RUBROS/SUBRUBROS/Hero KPI para que el usuario revise y proponga cambios. 3 hojas: Estructura, Diccionario, Cambios libres.

- **Junio 2026 — F0-9** — Reorganización aplicada del Excel: Belleza y Estética + Gastronomía movidos de Servicios a Comercio. Creado rubro "Remisería y Agencia de Transporte" en Comercio (empresa con flota, vs Transporte de Personas en Servicios que es individuo). Búsqueda básica en paso Rubro/Subrubro del onboarding.

- **Junio 2026 — F0-10** — **Buscador transversal** en todos los pasos del onboarding. Busca simultáneamente en SECTORS + RUBROS + SUBRUBROS. Resultados con jerarquía visible ("Peluquería" → "Comercio › Belleza y Estética") + highlight de coincidencia. Al elegir un resultado: auto-completa toda la jerarquía y salta al paso correcto. Nuevo `src/utils/search.ts` con `searchAllLevels()`. Nuevo componente `<HighlightedText/>` reusable.

- **Junio 2026 — F0-11** — Industria y Agro **ocultos** en onboarding (primera versión). El modelo zod sigue aceptando los 4 valores. `VISIBLE_SECTOR_KEYS = ['services', 'commerce']`. Cuando tengamos métricas específicas para industry/agro (rendimiento por hectárea, etc.) en F2+, se reactivan.

- **Junio 2026 — F0-12** — Fix race condition en `handleSearchResultPick`. El `setState` async hacía que `goToStep` leyera valores stale del state. Refactor: calcular el target step desde los valores nuevos (del SearchResult), no del state actual.

- **Junio 2026 — F0-5** (definitivo) — APK Android instalado y funcionando en celular real. **Cierre operativo de Fase 0**. Documentado el gotcha del `.easignore` (EAS por default respeta `.gitignore`, que excluye `.env`, lo cual rompía el bundle final). `supabase.ts` hardening: lanza error claro si faltan vars en lugar de crashear silencioso.

- **Junio 2026 — F1-D #1-3 (Design System base)** — Cimiento visual. Nuevo módulo `src/design/`:
  - `tokens.ts` con `color` (bg/border/text/accent/success/danger/warning/info × base/hover/muted/subtle), `space` (8pt grid keys '0'..'20'), `radius`, `text` (xs→5xl + lineHeight + weight + letterSpacing), `shadow` (none/subtle/raised).
  - 9 primitivos: `<Heading level="display|1|2|3|4">`, `<Text variant>`, `<Stack direction gap>`, `<Divider>`, `<Card variant padding>`, `<Button variant size loading>`, `<Input label error rightIcon onRightIconPress>`, `<SegmentedControl<T>>`, `<Chip variant>`.
  - Decisión de acento revertida a **teal del logo `#1F8579`** (ADR #11) al cargar las 3 variantes de logo en `Diseño/Logo/`. Welcome + Login heredan el cambio sin tocarlas — único punto de cambio en `tokens.ts`.

- **Junio 2026 — F1-D #4 (Refactor Welcome + Login)** — Primera aplicación del DS en superficie chica. SegmentedControl reemplaza el toggle custom Login/Registrarme. Inputs unificados con eye-toggle de password vía `onRightIconPress`. Error/success boxes ahora son Cards con bg tintado (no border rojo grueso). State `isLogin: boolean` migrado a `mode: 'login'|'signup'`.

- **Junio 2026 — F1-D #9 (Period comparator)** — Nuevo módulo `src/utils/periods.ts`: `Period = 'day'|'week'|'month'` + `getPeriodRange(p, anchor)` timezone-safe (no usa `toISOString`). Extensión de `transactionsRepo` (`listByDateRange`, `getKPIsForRange`) y `hoursLogRepo` (`listByDateRange`, `getSummaryForRange`). `analyticsRepo` gana:
  - `computePeriodComparison(current, previous)` — computer puro que devuelve `null` si previous es empty o 0 (ADR #14).
  - `getHeroMetricForPeriod(business, period)` orquesta current + previous en paralelo, devuelve `MetricResultWithPeriod` con `comparison`, `periodLabel`, `previousLabel`, `meta` (salesCount, hoursTotal, activeDays para sub-info F1-E).
  - `getHeroMetricForBusiness` queda como thin wrapper sobre el nuevo para compat.

- **Junio 2026 — F1-D #5 (Refactor Dashboard simple mode)** — HeroMetricCard rediseñada al lenguaje iPhone Screen Time: número 32px → 44px (`Heading display`), sin border lateral, `<Chip variant="warning">` para "Datos parciales", `<ComparisonBadge>` "↗ 12% vs semana pasada" condicional. SegmentedControl Día/Semana/Mes funcional debajo de la card (cambio de período recarga SOLO heroMetric, no toda la pantalla). Sub-info "X ventas · Yh trabajadas · Z días activos". TransactionList con icon cuadrado tintado + dividers subtle entre items. Header compacto con avatar `radius.md` + saludo dinámico ("Buenos días/tardes/noches").

- **Junio 2026 — F1-D #10 (Enriquecer transactions)** — Catálogo central `src/utils/transactionCategories.ts`: 6 income + 9 expense + 2 extraordinary CategoryDefs (`value/label/icon/tint/type`). `LEGACY_MAP` mapea strings F0 ("Venta de servicio") a values nuevos ('service_main'). PAYMENT_METHODS unificado. **Fix bug oculto**: `transactionsRepo.aggregate` chequeaba `t.category === 'service'` literal contra strings legacy → kpis.serviceIncome contaba en cero. Ahora usa `resolveCategory()`. Lista muestra ícono/tinte por categoría + sub-info "(categoría · fecha · método)". Forms guardan `value` (snake_case), no label.

- **Junio 2026 — F1-D #11 (Editar y eliminar movimientos)** — `transactionsRepo.update(id, patch)` y `.remove(id)`. SaleForm y CostForm reciben `transaction?: Transaction` opcional → modo edit con valores precargados, título "✏️ Editar", botón "Guardar cambios" + botón rojo "🗑 Eliminar" con `Alert.alert` confirmation. TransactionList recibe `onItemPress?: (t) => void` → cuando está, items son TouchableOpacity. DashboardScreen wiring: state `editingTransaction`, handler detecta type y abre form correcto. Extraordinarios no editables hoy (ADR #17, deuda chica).

- **Junio 2026 — F1-D #7 (Primitivos extra)** — Input, SegmentedControl, Chip, Divider. Toolkit completo de 9 primitivos antes de aplicar a pantallas grandes (Onboarding, Settings).

- **Junio 2026 — F1-D #6 (Refactor Onboarding + Settings)** — Migración cosmética a tokens del DS. Tabs de Settings ahora son `<SegmentedControl>`. Botones unificados con `<Button>`. Headings con `<Heading>`. Lógica de auth/save sin cambios. Acento azul `#2E86C1` legacy reemplazado por `color.accent.base` (teal). Subcomponentes locales `DetailLevelOption` y `DetailOption` para no duplicar.

- **Junio 2026 — F1-D fix lista (deuda inmediata)** — Lista en modo simple sube de 3 a 10 items. `relativeDate()` distingue "Mañana" (+1) de "En N días" (+2 a +6). Causa raíz del confused user: el contador hero del período mostraba "4 ventas" pero la lista solo cargaba 3 ítems globales → discrepancia visual. Limit subido + fix de display.

### Estado al cierre de Fase 0

- App con dashboard adaptable funcional (simple ⇄ detailed).
- 4 schemas zod + 5 repos + 6 computers de métricas + 8 componentes reutilizables.
- Onboarding sin fricción innecesaria (income_model removido, buscador transversal funcional).
- Settings completo con 3 tabs.
- APK distribuible vía EAS Build, **probado en celular Android real**.
- Listo para validar con 5 usuarios beta.

---

## 12. Fundamentos de GetVision (manifesto)

> Esta sección es el "por qué" de la empresa, no del producto. Lo que orienta cuando los detalles tácticos confunden.

### 12.1 Misión

**Que cualquier emprendedor o pequeña empresa en Argentina pueda saber, en menos de un minuto al día, si su negocio está bien o mal — y qué hacer al respecto.**

No somos una herramienta de contabilidad. Somos una herramienta de **claridad**.

### 12.2 Visión a 3 años

GetVision como **la primera app que el emprendedor argentino abre cada mañana** para saber cómo está su negocio. No por obligación contable, sino porque le da control y le sugiere qué mejorar.

Más adelante: la puerta de entrada a productos financieros para gente que hoy es invisible para el sistema bancario.

### 12.3 Los 3 tipos de usuario (decisión fundamental)

Toda decisión de producto debe preguntar: **¿para quién de los 3?**

| Tipo | Quién es | Qué necesita de nosotros | Cómo lo tratamos |
|---|---|---|---|
| **Tradicional establecido** | Restaurantero, peluquero, kioskero, indumentaria, abogado, médico. Tiene local físico, años de experiencia, sabe qué números mirar. | Que hablemos SU vocabulario (food cost, ticket promedio, rotación). | Como un par. Sin paternalismo. Sin enseñarle lo que ya sabe. |
| **Autónomo nueva normalidad** | Freelance software, diseñador, nutricionista, coach, vendedor particular. Viene de relación de dependencia o trabajo informal. Sin mapas mentales de gestión propia. | Guía pedagógica. Métricas con explicación. Sugerencias proactivas. | Como un mentor accesible. Le mostramos lo que no sabe que necesita saber. |
| **Apps gig** | Uber, Cabify, Didi, Rappi, PedidosYa. La app ya le da estadísticas operativas (viajes, horas conectadas). | Lo que la app NO le da: **comparativa entre días, rendimiento neto post-costos, valor real por hora**. | Como un dashboard externo independiente. Pocos datos diarios → mucho insight. |

**Implicación operativa**: la misma app GetVision debe presentarse distinto según el tipo. No es un buyer persona — son 3 productos distintos dentro del mismo binario.

### 12.4 Principios de producto (no negociables)

1. **Pocos datos > muchos datos.** Si pedimos 10 inputs para responder "¿estás bien?", perdemos al usuario. 3 inputs bien elegidos + un cálculo claro vale más que 10 campos.
2. **Adaptarnos al usuario, no que el usuario se ajuste a nosotros.** Si un peluquero piensa que su negocio es Comercio (no Servicio), ahí lo ponemos. Sin discusión.
3. **El número solo no alcanza — el hint constructivo es parte de la métrica.** Mostrar "tu hora rinde $1.800" sin sugerencia es ruido. Mostrar "$1.800 — subí 10% tu tarifa, los leales lo aceptan" es valor.
4. **Cero violencia conceptual.** No le pedimos al unipersonal que se autoclasifique en "services / products / mixed". Esas son categorías nuestras, internas, derivadas de lo que él haga.
5. **Honestidad sobre lo que no sabemos hacer (aún).** Agro tiene métricas únicas que requieren schema dedicado. En lugar de fingir, mostramos un mensaje claro: _"Estamos diseñando métricas específicas para Agro. Por ahora ves tu balance mensual."_
6. **Lo que se carga, se respeta.** Si un usuario carga horas pero no ventas, la app NO le dice "completá las ventas para ver". Le da el insight posible con lo que tiene, y le sugiere qué sumar después.

### 12.5 Cultura de trabajo con los usuarios — **los llamamos socios clientes**

Decisión semántica: no son "clientes" (palabra transaccional) ni "usuarios" (palabra técnica). Son **socios clientes**:
- **Socios** porque su éxito es el nuestro. Si su negocio crece, GetVision crece. Modelo de negocio diseñado para que eso sea literal, no metafórico (productos financieros en F4).
- **Clientes** porque entendemos que están eligiendo entre opciones, y nos tienen que elegir todos los días.

Implicaciones operativas de esto:
- **Cero dark patterns.** Sin suscripciones que se renuevan ocultas, sin features arrancan free y se vuelven paid sin avisar.
- **Free plan tiene que ser USABLE**, no un demo. Si alguien nunca paga y le sirve, vale la pena igual — eventualmente refiere a alguien que sí paga.
- **Soporte humano accesible.** WhatsApp directo, no bot. Especialmente en los primeros usuarios.
- **Feedback como insumo, no como interrupción.** Cuando un socio cliente dice "esto está mal", actuamos en 48h o le explicamos por qué no. Como hicimos con el feedback de Belleza y Estética → Comercio.

### 12.6 Valores

| Valor | Cómo se ve en la práctica |
|---|---|
| **Simplicidad militante** | Antes de agregar un feature, preguntamos: ¿se puede lograr el mismo valor con MENOS? Si sí, ese es el diseño. |
| **Respeto por el tiempo del usuario** | Onboarding < 2 minutos. Carga de un movimiento < 30 segundos. Si rompemos eso, lo arreglamos antes de seguir. |
| **Verdad sobre el negocio del usuario** | No maquillamos números. Si está perdiendo plata, lo decimos claro. Pero con tono constructivo, no como reto. |
| **Local antes que global** | El producto se diseña pensando en el unipersonal de Mataderos o Tucumán antes que en el SaaS para todo LATAM. Cuando crezcamos, traducimos. No al revés. |
| **Datos del usuario son del usuario** | Export a CSV/Excel gratuito, siempre. Si decide irse, se lleva todo. Sin lock-in artificial. |

### 12.7 Cómo construimos (cultura interna)

> Aplicable cuando GetVision deje de ser una persona y pase a ser un equipo.

- **Decisiones documentadas.** Los ADRs del §5 son ejemplo. Cada decisión grande deja huella escrita explicando *por qué* se eligió ese camino y *qué se descartó*.
- **El master file gana sobre cualquier doc.** Si hay conflicto entre código, Slack, README y este master, el master gana hasta que el otro se actualice.
- **Lean en infraestructura, generoso en producto.** Supabase free, Resend free, Expo free, hasta que el costo de NO escalar supere el costo de escalar.
- **Las métricas norte son sagradas.** D7 retention, NPS, paid conversion, LTV/CAC. No se cambian arbitrariamente. Si no se cumplen, se diagnostica.
- **El roadmap es público al equipo, no se mueve por capricho.** Si entra algo nuevo, sale algo viejo. Sin "agregar y agregar".

---

## 13. Fase 1 — Plan ejecutable

> **Métrica norte**: D7 retention > 30%, NPS > 40 con 5+ usuarios beta usándola activamente.

### 13.1 Foco del primer paso: F1-D Design System ⭐ (mayormente cerrada)

**Estado**: 11 sub-tareas cerradas, 1 abierta (#8 bottom tabs). Detalle en §11 changelog.

| # | Sub-tarea | Estado |
|---|---|---|
| #1 | Alineación de dirección visual (referencias, paleta inicial) | ✅ |
| #2 | `src/design/tokens.ts` | ✅ |
| #3 | Primitivos base (Heading, Text, Stack, Card, Button) | ✅ |
| #7 | Primitivos extra (Input, SegmentedControl, Chip, Divider) | ✅ |
| #4 | Refactor Welcome + Login con DS | ✅ |
| #9 | Period comparator en analyticsRepo (current vs previous) | ✅ |
| #5 | Refactor Dashboard simple mode | ✅ |
| #10 | Enriquecer transactions (categorías finas + método de pago) | ✅ |
| #11 | Editar y eliminar movimientos | ✅ |
| #6 | Refactor Onboarding + Settings con DS | ✅ |
| #8 | **Bottom tabs + Stats + Perfil + (expo-router)** | pendiente |

**Lo que entregó F1-D**:
- `src/design/tokens.ts` (paleta, 8pt grid, escala tipográfica, radii, shadows). Acento teal `#1F8579` del logo (ADR #11).
- `src/design/components/` con 9 primitivos. Decisión: **DS custom**, no Tamagui ni UI Kitten (ADR #12).
- 5 pantallas refactorizadas: Welcome, Login, Dashboard simple, Onboarding, Settings.
- HeroMetricCard rediseñada al lenguaje iPhone Screen Time + comparativa period-vs-period condicional + sub-info contextual.
- TransactionList con ícono cuadrado tintado por categoría + sub-info "(cat · fecha · método)".
- Forms (SaleForm/CostForm) con modo edit + delete confirmation.
- Catálogo central `transactionCategories.ts` + módulo `periods.ts`.
- `transactionsRepo` y `hoursLogRepo` ganan `listByDateRange` + agregados por rango.

**Lo que F1-D NO entregó (queda en #8)**:
- Bottom tabs (4: Dashboard / Movimientos / Stats / Perfil).
- Pantallas Stats + Perfil (no existen todavía).
- Migración a `expo-router` (puede esperar — sub-paso 8.3 opcional).

### 13.2 Tareas de F1 en orden de ejecución

| # | Tarea | Razón del orden | Tiempo estimado |
|---|---|---|---|
| **F1-D** | Design System básico (tokens + primitivos + refactor) | Cimiento visual. Habilita el resto sin rework. | 1-2 semanas |
| **F1-A** | Hero KPI múltiple swicheable + persistencia | Implementa el modelo "primario + alternativas" que pidió el usuario en el Excel. Toggle de tabs en HeroMetricCard. | 3-5 días |
| **F1-B** | Flujo Apps gig: "Cerrar mi día" con 4 datos | Diferencial competitivo único (lo que las apps NO dan). Métrica norte: "día vs promedio". | 5-7 días |
| **F1-C** | KPIs industria estándar: `food_cost_ratio`, `inventory_turnover`, `labor_cost_ratio`, `revenue_per_sqm`, `top_sellers`, `billable_ratio` | Hablar el vocabulario del usuario tradicional establecido. Disponibles vía toggle de F1-A. | 4-6 días |
| **F1-E** | Sub-info contextual en HeroMetricCard ("Sobre 3 ventas", "Día 12/30") | Evita el bug de UX que vimos en F0 (ticket promedio sin contexto confunde). | 1-2 días |
| **F1-F** | Integración INDEC + caché Edge Function | Habilita la línea de comparativa "tu hora vs promedio del rubro" que tiene slot reservado en HeroMetricCard. | 1 semana |
| **F1-G** | Web app desplegada (Vercel o similar) | En AR, mucha gente prefiere desktop. Hoy `expo start --web` solo corre local. | 2-3 días |
| **F1-H** | Onboarding cronometrado < 2 minutos | Validación de la métrica de simplicidad. Si tarda más, hay que recortar más fricción. | 1-2 días |

**Total estimado F1**: 6-8 semanas de trabajo coherente.

### 13.3 Definition of Done — Fase 1

- [x] **Design system con tokens + primitivos aplicado a todas las pantallas existentes** (F1-D #1-7 + refactor de 5 screens en #4 #5 #6). Stats + Perfil quedan para #8.
- [x] **HeroMetricCard muestra sub-info contextual** ("X ventas · Yh trabajadas · Z días activos") (F1-D #5, computed por `analyticsRepo.getHeroMetricForPeriod().meta`).
- [x] **Editar y eliminar movimientos** desde la lista (tap → form en modo edit, botón delete con confirm) (F1-D #11, nuevo más allá del DoD original).
- [x] **Categorías finas y método de pago visibles en lista** (F1-D #10, nuevo más allá del DoD original).
- [ ] Cada subrubro relevante tiene 2-3 hero KPIs disponibles. Usuario puede switchear con un tap. (F1-A pendiente)
- [ ] Flujo "Cerrar mi día" para Apps gig funcional, con métrica "día vs promedio". (F1-B pendiente)
- [ ] Métricas industria estándar disponibles cuando el subrubro lo amerita. (F1-C pendiente)
- [ ] Widget de contexto INDEC en HeroMetricCard cuando hay benchmark sectorial. (F1-F pendiente; slot ya reservado en HeroMetricCard)
- [ ] Web app deployada y accesible desde URL pública. (F1-G pendiente)
- [ ] Onboarding cronometrado en < 2 minutos para usuario promedio. (F1-H pendiente)
- [ ] 5 usuarios beta usando la app 4 semanas consecutivas, D7 ≥ 30%, NPS ≥ 40.

### 13.4 Riesgos identificados de F1

| Riesgo | Mitigación |
|---|---|
| Design system extiende refactor más de lo estimado | Time-boxing: 2 semanas max. Lo que no esté listo se aplica gradualmente en F1-A/B/C. |
| Flujo gig: usuarios de Uber/Rappi pueden no cargar nada (la app de origen ya les da el dato) | Validar con 2-3 usuarios reales ANTES de invertir 1 semana. Si no hay interés genuino, mover F1-B a F2. |
| INDEC API cambia formato/IDs sin aviso | Caché 24h en Edge Function + fallback al último valor conocido. Patrón ya documentado en plan original. |
| Web app expone vulnerabilidades nuevas (XSS, etc.) | Auditoría de seguridad antes de deploy. Sentry para detectar issues post-deploy. |
| NPS bajo en beta porque la app sirve a 3 tipos de usuario distintos pero no destaca en ninguno | Plan B: reducir el scope a 1 tipo (el más prometedor según data) y volver a los otros 2 con datos. |

### 13.5 Lo que NO entra en F1 (consciente)

- **Multi-negocio**: difiere a F3 (plan paid).
- **Export PDF para contador**: F3.
- **Notificaciones push**: F2.
- **Modo oscuro/claro toggle**: actualmente solo oscuro, ok para target.
- **i18n / multi-idioma**: F5 con LATAM.
- **Blockchain Polygon**: F5+ si justifica.

---

*Si este archivo cambia: dejar nota corta en sección 11 (changelog) con fecha y motivo.*

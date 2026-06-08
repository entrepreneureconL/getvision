# GETVISION — Tech Document

> **Propósito**: documento técnico complementario al `GETVISION_MASTER.md`.
> Master = producto + negocio + roadmap. Tech = código + arquitectura + cómo agregar features.
> **Última revisión**: Junio 2026 — F1-D mayormente cerrada.
> **Cuándo usarlo**: abrir esto ANTES de tocar código. Si vas a sumar una tabla, una pantalla, una métrica o una categoría — la receta está en §9.

---

## 1. Snapshot técnico

| Capa | Tecnología | Versión real | Estado |
|---|---|---|---|
| Runtime | React Native + Expo | SDK **55** / RN 0.83.4 | OK |
| Lenguaje | TypeScript | 5.9 | OK |
| UI | **Design System propio** (`src/design/`) | F1-D | Aplicado en 5 pantallas |
| Auth + DB + Storage | Supabase | @supabase/supabase-js 2.99 | OK |
| DB | PostgreSQL (Supabase) | 15+ | OK |
| Estado app | useState + máquina manual en `App.tsx` | — | Reevaluar en F1-D #8 (8+ pantallas) |
| Navegación | Máquina de estados manual | — | `@react-navigation/native` instalado pero no usado. Plan: `<BottomTabs>` custom en F1-D #8.2, `expo-router` opcional en 8.3 o F2 |
| Validación runtime | zod 4.4 | — | OK |
| Error capture | `ErrorBoundary` global | F0-4 | OK. Sentry pendiente F1+ |
| Server state cache | — | — | Diferido hasta tener 2+ pantallas con misma data (F2 con `react-query`) |
| Tests | — | — | F2 (Vitest + Maestro/Detox) |
| Distribución | EAS Build (Android APK) | F0-5 | OK. Web app F1-G |

**Comandos clave**:
```bash
# Dev
npx expo start                # web + Android via Expo Go
npx expo start --web          # solo web

# Build APK
eas build -p android --profile preview     # APK de testing
eas build -p android --profile production  # AAB para Play Store (futuro)

# Type-check sin emitir
npx tsc --noEmit
```

---

## 2. Schema de DB (Supabase)

### 2.1 Diagrama relacional

```
┌─────────────────┐
│  auth.users     │  (gestionado por Supabase Auth)
└─────────┬───────┘
          │ 1:1
          ▼
┌─────────────────┐
│   businesses    │  ← un usuario = un negocio (en F0-F1; multi-negocio en F3)
└─────────┬───────┘
          │ 1:N
          ├──────────────┐──────────────┐──────────────┐
          ▼              ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │transactns│   │ products │   │hours_log │   │ (futuro) │
   └──────────┘   └──────────┘   └──────────┘   │ clients  │
                                                │suppliers │
                                                │receivable│
                                                │ payables │
                                                └──────────┘
```

**Reglas de oro**:
- **Toda tabla tiene `business_id UUID FK businesses`** + RLS `business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())`.
- **No foreign keys cruzadas** entre transactions/products/hours_log todavía (ADR pendiente: vincular en F2).
- **`maybeSingle()` siempre** que la query puede no devolver fila. Nunca `.single()` salvo si hay constraint que garantiza 1 row.

### 2.2 Tabla `businesses`

```sql
id                       UUID PK DEFAULT gen_random_uuid()
user_id                  UUID FK auth.users  -- RLS: = auth.uid()
name                     VARCHAR(150)
owner_name               VARCHAR(100)
sector                   VARCHAR(30)   CHECK IN ('services','commerce','industry','agro')
rubro                    VARCHAR(80)
subrubro                 VARCHAR(80)   NULL    -- F0-2.5
business_profile         VARCHAR(80)   NULL
income_model             VARCHAR(20)   CHECK IN ('services','products','mixed') DEFAULT 'mixed'
detail_level             VARCHAR(20)   CHECK IN ('simple','detailed') DEFAULT 'simple'  -- F0-2.5
operator_role            VARCHAR(40)   NULL    -- F0-2.5 (futuro: roles diferenciados)
threshold_hourly_rate    DECIMAL(10,2) NULL    -- F0-2.5
logo_url                 TEXT          NULL
onboarding_completed     BOOLEAN       DEFAULT false
created_at               TIMESTAMP     DEFAULT now()
```

**Schema zod**: `src/schemas/business.ts`. Enums centralizados: `DetailLevelEnum`, `IncomeModelEnum`, `SectorEnum`.

### 2.3 Tabla `transactions`

```sql
id              UUID PK DEFAULT gen_random_uuid()
business_id     UUID FK businesses
type            VARCHAR(20)  CHECK IN ('income','expense','income_extraordinary','expense_extraordinary')
amount          DECIMAL(12,2)         -- siempre positivo; el signo lo da `type`
date            DATE                  -- YYYY-MM-DD
payment_method  VARCHAR(30)   NULL    -- 'cash'|'transfer'|'credit'|'digital'|'pending'
category        VARCHAR(60)   NULL    -- string libre — F1-D usa values del catálogo (ver §6.1)
description     VARCHAR(120)  NULL
status          VARCHAR(20)   CHECK IN ('completed','pending') DEFAULT 'completed'
product_id      UUID          NULL    -- FK pendiente F2 (vincular venta con producto)
client_id       UUID          NULL    -- FK pendiente F2 (cuando clients exista)
quantity        DECIMAL(10,2) NULL
installments    INT           NULL
created_at      TIMESTAMP     DEFAULT now()
```

**Decisión**: `category` se mantiene como **string libre** aún con catálogo central (ADR #15). Permite backwards compat con datos F0 sin migration.

### 2.4 Tabla `products`

```sql
id              UUID PK
business_id     UUID FK businesses
name            VARCHAR(150)
unit_price      DECIMAL(12,2)  NULL
unit_cost       DECIMAL(12,2)  NULL
stock           DECIMAL(10,2)  NULL  -- soft delete: stock=0 + deleted_at
min_stock       INT            NULL  -- alerta
sku             VARCHAR(60)    NULL
deleted_at      TIMESTAMP      NULL
created_at      TIMESTAMP      DEFAULT now()
```

### 2.5 Tabla `hours_log`

```sql
id              UUID PK
business_id     UUID FK businesses
date            DATE
hours           DECIMAL(6,2)          -- horas trabajadas
hourly_rate     DECIMAL(10,2) NULL    -- tarifa pactada (opcional)
billable        BOOLEAN       DEFAULT true
client_name     VARCHAR(100)  NULL    -- precursor de clients table
description     VARCHAR(120)  NULL
created_at      TIMESTAMP     DEFAULT now()
```

### 2.6 Tablas pendientes (F2+)

| Tabla | Para qué | Fase |
|---|---|---|
| `clients` | Vincular ventas + horas con quien las paga | F2 (parte del "medio" descartado en F1-D #10) |
| `suppliers` | Vincular costos con quién vende insumos | F2 |
| `receivables` | Cobranzas pendientes (lo que falta cobrar) | F2 |
| `payables` | Pagos pendientes (lo que falta pagar) | F2 |
| `costs_catalog` | Estructura fina de costos recurrentes | F2 |
| `economic_indicators` | Snapshot INDEC + BCRA (caché de 24h) | F1-F |
| `indicator_cache` | Edge Function cache | F1-F |

---

## 3. Arquitectura de capas

```
┌─────────────────────────────────────────────────────────────┐
│  screens/        ← composición de pantalla                  │
│  components/     ← UI específica del producto               │
│  ─────────────────────────────────────────────────          │
│  design/         ← DS (tokens + primitivos)                 │
│  utils/          ← lógica pura sin estado                   │
│  ─────────────────────────────────────────────────          │
│  repos/          ← acceso DB (Supabase calls)               │
│  schemas/        ← validación runtime (zod)                 │
│  ─────────────────────────────────────────────────          │
│  lib/            ← clientes externos (supabase)             │
└─────────────────────────────────────────────────────────────┘
```

**Reglas**:
1. **Screens no tocan Supabase directo.** Siempre vía `repos/`.
2. **Repos no son tocados por components/design.** Solo por screens (y otros repos).
3. **Schemas son el único lugar que define forma de datos.** Cualquier `.insert()` / `.update()` pasa por `safeParse`.
4. **Design no importa de components.** Es la capa más baja del UI.
5. **Utils no importa de repos.** Lógica pura, testeable sin DB.
6. **Imports circulares prohibidos.** Si aparece uno, hay un layering wrong.

---

## 4. Estructura de carpetas

```
GetVision/
├── App.tsx                            ← máquina de estados manual (Welcome→Login→Onboarding→Dashboard→Settings)
├── index.ts
├── app.json                           ← bundle id ar.com.getvision.app, splash
├── eas.json                           ← perfiles development / preview / production
├── .easignore                         ← incluye .env en el bundle (gotcha documentado)
├── package.json
├── tsconfig.json
├── assets/                            ← logos splash + iconos app
├── GETVISION_MASTER.md                ← producto + negocio + ADRs + changelog
├── GETVISION_TECH.md                  ← (este file)
│
└── src/
    ├── design/                        ★ F1-D — Design System propio
    │   ├── tokens.ts                  ← paleta + space + radius + text + shadow
    │   ├── components/
    │   │   ├── Heading.tsx            ← display/1/2/3/4
    │   │   ├── Text.tsx               ← body/caption/micro
    │   │   ├── Stack.tsx              ← flex + gap
    │   │   ├── Divider.tsx            ← línea sutil
    │   │   ├── Card.tsx               ← bloque iPhone-style sin border
    │   │   ├── Button.tsx             ← primary/secondary/ghost/danger × sm/md/lg
    │   │   ├── Input.tsx              ← label + error + leftIcon + rightIcon tappable
    │   │   ├── SegmentedControl.tsx   ← genérico en T, iPhone Week/Day style
    │   │   └── Chip.tsx               ← variantes semánticas
    │   └── index.ts                   ← barrel
    │
    ├── components/
    │   ├── Container.tsx              ← maxWidth: 640 + alignSelf center (web responsive)
    │   ├── ErrorBoundary.tsx          ← captura crashes de render
    │   ├── FAB.tsx                    ← floating action button (único entry para registrar)
    │   ├── HeroMetricCard.tsx         ← card hero con número 44px + comparison + slot chart
    │   ├── HighlightedText.tsx        ← highlight de match en buscador
    │   ├── Money.tsx                  ← format $ y signo + color condicional
    │   ├── TransactionList.tsx        ← card densa con dividers + onItemPress
    │   ├── SaleForm.tsx               ← modo new + edit (transaction?)
    │   ├── CostForm.tsx               ← modo new + edit (transaction?)
    │   ├── MovementForm.tsx           ← extraordinarios + pendientes (NO edit todavía)
    │   ├── QuickProductForm.tsx       ← agregar producto al catálogo
    │   └── QuickHoursForm.tsx         ← registrar horas
    │
    ├── lib/
    │   └── supabase.ts                ← cliente singleton, fail-fast si faltan envs
    │
    ├── repos/                         ← capa de acceso DB
    │   ├── analytics.ts               ← orquestador hero metric + computers puros + comparison
    │   ├── businesses.ts              ← ensureForUser, update
    │   ├── hoursLog.ts                ← listByMonth + listByDateRange + getSummaryForRange + create
    │   ├── products.ts                ← listActive + getStockSummary
    │   └── transactions.ts            ← listByMonth + listByDateRange + getKPIsForRange + listRecent + update + remove
    │
    ├── schemas/                       ← validación zod
    │   ├── business.ts                ← enums + Business + parse helpers
    │   ├── hoursLog.ts
    │   ├── product.ts
    │   └── transaction.ts             ← TransactionType + Status + PaymentMethod + parse
    │
    ├── screens/
    │   ├── WelcomeScreen.tsx          ← landing + único CTA
    │   ├── LoginScreen.tsx            ← Supabase auth + Google OAuth
    │   ├── OnboardingScreen.tsx       ← 3-4 pasos dinámicos + buscador transversal
    │   ├── DashboardScreen.tsx        ← orquestador principal
    │   └── SettingScreen.tsx          ← (typo histórico) 3 tabs: General/Actividad/Preferencias
    │
    └── utils/                         ← lógica pura
        ├── businessProfile.ts         ← SECTORS + RUBROS + SUBRUBROS + getDashboardConfig
        ├── heroMetrics.ts             ← 6 HeroMetricSpec + maps por subrubro/rubro + resolveHeroMetric
        ├── periods.ts                 ★ F1-D — Period type + getPeriodRange (timezone-safe)
        ├── search.ts                  ← buscador transversal sector/rubro/subrubro
        └── transactionCategories.ts   ★ F1-D — catálogo income+expense+extra + LEGACY_MAP + resolveCategory
```

---

## 5. Pipeline de datos

### 5.1 Carga del Dashboard

```
DashboardScreen.useEffect
   ↓
loadDashboardData()
   ↓
businessesRepo.ensureForUser(user.id)
   ↓
   ├─ transactionsRepo.getKPIsForCurrentMonth()    [solo si detailed]
   ├─ productsRepo.getStockSummary()                [solo si detailed + mixed/products]
   ├─ hoursLogRepo.getSummaryForCurrentMonth()      [solo si detailed + mixed/services]
   ├─ analyticsRepo.getHeroMetricForPeriod(biz, period)   ← orquestador
   └─ transactionsRepo.listRecent(biz.id, 10)
```

### 5.2 Cálculo de hero metric (F1-D)

```
getHeroMetricForPeriod(business, period: 'day'|'week'|'month')
   ↓
1. resolveHeroMetric(business.rubro, business.subrubro) → HeroMetricSpec
   (mapa subrubro → rubro → fallback monthly_balance)
   ↓
2. getPeriodRange(period) → { start, end, prevStart, prevEnd, labels }
   ↓
3. Promise.all paralelo (current + previous):
   - transactionsRepo.getKPIsForRange (×2)
   - transactionsRepo.listByDateRange (×2)
   - hoursLogRepo.getSummaryForRange (×2)  [solo si spec.key requiere horas]
   - productsRepo.listActive (×1)          [solo si spec.key === 'margin_per_sale']
   ↓
4. runCompute(spec.key, ...) → ComputeResult (current)
   runCompute(spec.key, ...) → ComputeResult (previous)
   (dispatcher único; computers son puros y exportables)
   ↓
5. Si current.effectiveKey override → cambiar spec (caso hourly_rate negativo)
   ↓
6. spec.buildHint(ctx) → mensaje constructivo
   ↓
7. computePeriodComparison(current, previous) → MetricComparison | null
   (null si: alguno isEmpty || previous.value === 0)
   ↓
8. buildMeta(transactions, kpis, hours) → { salesCount, hoursTotal, activeDays }
   ↓
Return MetricResultWithPeriod
```

### 5.3 Crear/editar/borrar una transaction

```
[CREAR]
SaleForm / CostForm (transaction undefined)
   ↓
input zod validation [futuro: schema strict]
   ↓
supabase.from('transactions').insert(...)
   ↓
DashboardScreen.closeModal() → loadDashboardData()

[EDITAR]
TransactionList tap → DashboardScreen.handleTransactionPress(t)
   ↓
setEditingTransaction(t) + setActiveModal('sales'|'costs')
   ↓
SaleForm / CostForm (transaction=t) → precarga state
   ↓
handleSave → transactionsRepo.update(id, patch)

[ELIMINAR]
SaleForm / CostForm en modo edit → botón "Eliminar"
   ↓
Alert.alert confirmation (destructive)
   ↓
transactionsRepo.remove(id)
```

---

## 6. Catálogos centrales

### 6.1 Categorías de transactions — `src/utils/transactionCategories.ts`

**Income** (6):
| value | label | icon | tint |
|---|---|---|---|
| `service_main` | Servicio principal | ✂️ | success |
| `service_extra` | Servicio adicional | ✨ | success |
| `product` | Venta de producto | 📦 | success |
| `advance` | Adelanto de cliente | 💳 | info |
| `tip` | Propina | 🎁 | success |
| `other_income` | Otro ingreso | ↗️ | success |

**Expense** (9):
| value | label | icon | tint |
|---|---|---|---|
| `supplies` | Insumos / Materia prima | 🛒 | warning |
| `labor` | Mano de obra / Sueldos | 👥 | warning |
| `rent` | Alquiler | 🏠 | warning |
| `utilities` | Servicios (luz/gas/agua) | 💡 | warning |
| `taxes` | Impuestos | 📋 | danger |
| `transport` | Transporte | 🚚 | warning |
| `marketing` | Publicidad | 📢 | warning |
| `maintenance` | Mantenimiento | 🔧 | warning |
| `other_expense` | Otro gasto | ↘️ | warning |

**Extraordinary** (2 fallback, no se ofrecen en pickers):
- `extra_income`, `extra_expense`.

**Métodos de pago** (5):
`cash`, `transfer`, `credit`, `digital`, `pending`.

**LEGACY_MAP** mapea strings F0 a values nuevos:
- "Venta de producto" → `product`
- "Venta de servicio" → `service_main`
- "Insumos / Materia prima" → `supplies`
- "Ingreso extraordinario" → `extra_income`
- etc.

**API pública**:
```ts
resolveCategory(raw: string | null) → CategoryDef | null
resolvePaymentMethod(raw: string | null) → PaymentMethodDef | null
getCategoriesForType('income' | 'expense') → CategoryDef[]
```

### 6.2 Hero metrics — `src/utils/heroMetrics.ts`

**6 métricas disponibles**:

| key | label | unit | buildHint | cuándo se elige |
|---|---|---|---|---|
| `effective_hourly_rate` | Tu hora rinde | currency_per_hour | varía por valor | Servicios donde el tiempo es input |
| `daily_revenue` | Rinde por día | currency_per_day | varía por valor | Comercios + delivery |
| `ticket_average` | Ticket promedio | currency | varía por valor | Gastronomía + estética |
| `margin_per_sale` | Margen por venta | currency | varía por valor | Comercios con stock |
| `cost_to_revenue_ratio` | Costos / Ingresos | percent | varía por valor | Industria + agro |
| `monthly_balance` | Resultado del mes | currency | varía por valor | Fallback universal |

**Resolución en cascada**: `subrubro → rubro → monthly_balance`.

**Mapa por subrubro** en `HERO_METRICS_BY_SUBRUBRO` (80+ entradas).
**Fallback por rubro** en `HERO_METRICS_BY_RUBRO` (~30 entradas).

### 6.3 Periods — `src/utils/periods.ts`

```ts
Period = 'day' | 'week' | 'month'
getPeriodRange(period, anchor=now) → PeriodRange {
  start, end,           // 'YYYY-MM-DD'
  prevStart, prevEnd,   // 'YYYY-MM-DD'
  label,                // "Hoy" | "Esta semana" | "Junio 2026"
  prevLabel,            // "Ayer" | "Semana pasada" | "Mayo 2026"
}
```

**Convenciones**:
- Semana = lunes a domingo (ISO 8601).
- Mes = primer a último día del mes calendario.
- Día = `start === end` (un solo día).
- **No usa `toISOString()`** porque convierte a UTC y puede correr el día.

### 6.4 Business profile — `src/utils/businessProfile.ts`

- `SECTORS` (4): services, commerce, industry, agro. Solo 2 visibles en onboarding (F0-11).
- `RUBROS` por sector (22 activos).
- `SUBRUBROS` por rubro (80+).
- `getDashboardConfig(business)` → flags `{ showStockKPI, showHoursKPI, showSplitRevenue }`.

---

## 7. Design System (resumen)

### 7.1 Tokens

```ts
import { color, space, radius, text, shadow } from '@/design';

color.bg.base       // #0A0E1A — fondo de pantalla
color.bg.raised     // #151B2C — card sobre fondo
color.bg.elevated   // #1E263D — sub-card

color.text.primary    // #F2F4F8
color.text.secondary  // #A6B0C2 — hints, labels
color.text.tertiary   // #6B7488 — captions
color.text.disabled   // #3F485A

color.accent.base   // #1F8579 — teal del logo (ADR #11)
color.accent.hover  // #176960
color.accent.muted  // #0E423C — backgrounds
color.accent.subtle // rgba(31,133,121,.10)

color.success.base  // #27AE60 — verde ingresos
color.danger.base   // #C0392B — rojo egresos
color.warning.base  // #E67E22 — naranja
color.info.base     // #9B59B6 — violeta

space['1' .. '20'] // 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80

radius.sm/md/lg/xl/2xl/pill   // 6, 10, 14, 20, 28, 9999

text.size.xs/sm/md/lg/xl/2xl/3xl/4xl/5xl  // 11, 13, 15, 17, 20, 24, 28, 36, 44
text.weight.regular/medium/semibold/bold  // '400'..'700'
```

### 7.2 Primitivos

```tsx
<Heading level="display"|1|2|3|4 color="primary|accent|...">

<Text variant="body|bodyStrong|caption|captionStrong|micro"
      color="primary|secondary|tertiary|...|success|danger|warning|accent">

<Stack direction="column|row" gap="0..20" align="..." justify="..." wrap flex>

<Card variant="surface|elevated|accent" padding="none|sm|md|lg|xl"
      rounded="md|lg|xl" shadow="none|subtle|raised" onPress?>

<Button variant="primary|secondary|ghost|danger" size="sm|md|lg"
        loading disabled fullWidth leftIcon rightIcon>

<Input label error helperText leftIcon rightIcon onRightIconPress />

<SegmentedControl<T> options={[{value, label}]} value onChange size="sm|md" fullWidth />

<Chip variant="neutral|accent|success|danger|warning|info" size="sm|md" onPress?>

<Divider orientation="horizontal|vertical" variant="subtle|default" spacing="0..20" />
```

### 7.3 Reglas de uso

- **Cero hex pelado** en componentes. Siempre `color.xxx`.
- **Spacing por keys**, no números: `gap="4"`, no `gap={16}`.
- **Sin `<View flexDirection gap>`** sueltos. Usar `<Stack>`.
- **Sin `<Text style={{fontSize, fontWeight}}>`**. Usar `<Heading>` o `<Text variant>`.
- **`maxWidth: 640`** ya lo maneja `<Container>`. No replicar.
- **Forms grandes** (Sale/Cost/Movement) tienen StyleSheet legacy — refactor está bajo en prioridad (deuda chica del master §7).

---

## 8. Convenciones de código

| Tema | Regla |
|---|---|
| Naming | PascalCase clases/componentes. camelCase funciones/vars. UPPER_SNAKE constantes. |
| Strings UI | Español rioplatense. Logs internos en inglés OK. |
| Formato monetario | `Intl.NumberFormat('es-AR')` siempre. Usar `<Money>` componente. |
| Async | `try/catch` siempre. `console.error('[scope] ...')` con prefijo. |
| Imports | (1) `react`, (2) `react-native`, (3) libs externas, (4) libs internas (`../...`), (5) relativos. |
| Tipos | Cero `any` no justificado. `// TODO: tipar` + tarea si aparece. |
| `null` queries | `.maybeSingle()`, no `.single()`. |
| Validación | Toda escritura financiera pasa por `safeParse` zod. |
| Estilos | `StyleSheet.create` al final del archivo. Sin librería UI externa fuera del DS. |
| Sin LINQ en hot paths | Calcular fuera de JSX. |
| `.env` | Nunca al repo. Solo `EXPO_PUBLIC_*` al bundle. |
| RLS | Activado en toda tabla nueva ANTES del primer insert. |

---

## 9. Cookbook — cómo agregar...

### 9.1 Una nueva tabla

1. **SQL en Supabase**: crear tabla con `id UUID PK`, `business_id UUID FK businesses`, `created_at TIMESTAMP DEFAULT now()`.
2. **Activar RLS**: `business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())`.
3. **Schema**: `src/schemas/<entity>.ts` con `EntitySchema = z.object(...)` + `parseEntity` + `parseEntityList`. Enums como `z.enum(...)`.
4. **Repo**: `src/repos/<entity>.ts` con `listByDateRange`, `listByMonth`, `create`, `update`, `remove` según necesidad. SIEMPRE pasar por `parse*` antes de devolver.
5. **Si afecta hero metric**: extender `analyticsRepo.getHeroMetricForPeriod` con nuevo `Promise.all` selectivo.
6. **Tests** (cuando F2): mock supabase + assert parse.

### 9.2 Una nueva hero metric

1. **Computer puro** en `analyticsRepo`: `function compute<NewName>(...): ComputeResult`. Sin acceso a DB.
2. **Spec** en `src/utils/heroMetrics.ts`: agregar a `HeroMetricKey` union + entrada en `HERO_METRICS` con `key/label/longLabel/unit/buildHint`.
3. **Mapas**: agregar subrubros relevantes en `HERO_METRICS_BY_SUBRUBRO` y opcionalmente al fallback por rubro.
4. **Dispatcher**: agregar case en `runCompute()` dentro de `analyticsRepo`.
5. **Carga selectiva**: si necesita data no estándar, agregar flag `needs<X>` en `getHeroMetricForPeriod`.
6. **Renderer**: si la `unit` no es de las soportadas (`currency|currency_per_X|percent|number`), agregar case en `ValueDisplay` de `HeroMetricCard.tsx`.

### 9.3 Una nueva pantalla

1. **Crear** `src/screens/<Nombre>Screen.tsx`. Empezar copiando WelcomeScreen como template del DS.
2. **Props** declarados explícitos: `{ onBack, onSuccess, ... }`. NO usar React Navigation hasta F1-D #8.
3. **Repos** se invocan desde la screen (no desde components).
4. **Wiring** en `App.tsx`: agregar al enum de la máquina de estados + handler.
5. **Container** envuelve el contenido si es pantalla principal (responsive web).

### 9.4 Una nueva categoría de transaction

1. Agregar `CategoryDef` a `INCOME_CATEGORIES` o `EXPENSE_CATEGORIES` en `transactionCategories.ts`.
2. Si reemplaza un label legacy, agregar al `LEGACY_MAP` el mapeo viejo → nuevo.
3. NO requiere migration de DB (la columna `category` es string libre).
4. Re-construir: SaleForm/CostForm la consumen vía `getCategoriesForType()` — sin tocar el form.

### 9.5 Una nueva variante visual al DS

1. Si es un token nuevo: agregar a `tokens.ts` siguiendo el patrón (base/hover/muted/subtle).
2. Si es un primitivo nuevo: archivo en `design/components/<Name>.tsx`. Documentar API en docblock. Export desde `design/index.ts`.
3. **Antes de inventar**, chequear si Stack + Card + Chip resuelven combinados.

---

## 10. Próximos pasos técnicos

### 10.1 Inmediatos — F1-D #8 (próximo turno)

| Sub | Qué | Archivos a tocar |
|---|---|---|
| **8.1** | StatsScreen + PerfilScreen | `src/screens/StatsScreen.tsx`, `src/screens/PerfilScreen.tsx` (nuevos) |
| **8.2** | `<BottomTabs>` custom | `src/components/BottomTabs.tsx` (nuevo) + `App.tsx` refactor del state machine |
| **8.3** | `expo-router` opcional | Nueva carpeta `app/(tabs)/`, migración de App.tsx + nuevos route files. Diferible a F2 |

### 10.2 Corto plazo — resto de F1

| # | Qué | Capa principal | Bloqueante de |
|---|---|---|---|
| F1-A | Hero KPI múltiple swicheable | `HeroMetricCard` + `analyticsRepo` (pre-cargar 2-3 specs en paralelo) + `businesses.preferred_hero_key` | F1-C parcial (usuarios pueden cambiar lente) |
| F1-B | Flujo Apps gig "Cerrar mi día" | Nueva pantalla `CloseMyDayScreen` + `dailyClose` table | — |
| F1-C | KPIs industria estándar (`food_cost_ratio`, `inventory_turnover`, `labor_cost_ratio`, `revenue_per_sqm`, `top_sellers`, `billable_ratio`) | `analyticsRepo` (6 nuevos computers) + `heroMetrics` (6 specs) | F1-A debe estar para activar toggle |
| F1-E | Sub-info contextual extra | `HeroMetricCard` ya recibe `meta`. Falta cablear más casos | — |
| F1-F | Integración INDEC + Edge Function caché 24h | Tabla `economic_indicators` + función edge en Supabase + slot en HeroMetricCard | "Línea avg" del chart |
| F1-G | Web app deploy (Vercel o Cloudflare Pages) | Build config + `app.json` web → `output: "static"` | — |
| F1-H | Onboarding < 2 min cronometrado | Validación con usuarios reales | — |

### 10.3 Mediano plazo — F2

| Tema | Capa | Decisión pendiente |
|---|---|---|
| Migrar nav a `expo-router` | Estructura raíz | Después de F1-D #8.2 estabilizado |
| Tests | Nueva carpeta `__tests__` | Vitest (unit) + Maestro o Detox (e2e) |
| Realtime | `supabase.channel(...)` en repos | Empezar por transactions (lista en vivo) |
| Sentry / PostHog | `lib/observability.ts` + `ErrorBoundary` cablea | Decidir PostHog (combina events + sessions) vs Sentry (errors) + PostHog |
| ARCA / AFIP factura electrónica | Nueva capa `fiscal/` + edge function | API ARCA monotributo |
| `react-query` (`@tanstack/react-query`) | Wrap de repos | Cuando 2+ pantallas pidan la misma data |
| Productos vinculados a ventas | `transactions.product_id` FK + UI en SaleForm | Inicio del modelo "medio" |
| Tabla `clients` mínima | `repos/clients.ts` + UI en forms | Habilita "cliente top" |

### 10.4 Largo plazo — F3+

- **F3**: plan paid (multi-negocio, export PDF, predicción cashflow, alertas push). Marketplace de contadores.
- **F4**: scoring crediticio basado en 6+ meses de historial. Partnership fintech.
- **F5**: LATAM México. Capa `economic_indicators` lista para INEGI. Localización de copies.

---

## 11. Anti-patrones a evitar (aprendidos)

| Anti-patrón | Consecuencia | Cómo se detectó |
|---|---|---|
| Match por string literal contra `category` | `kpis.serviceIncome` contaba en 0 porque DB tiene "Venta de servicio" y código chequeaba `=== 'service'` | F1-D #10 bug oculto |
| `useEffect` con state mutable en deps | Recarga full del dashboard cada vez que el usuario cambia período del SegmentedControl | F1-D #5 |
| `toISOString()` para formato `YYYY-MM-DD` | Corre el día por timezone (UTC vs local) | F1-D `periods.ts` lo evita explícitamente |
| Cancelar un limit order después que ya se filló (analogía SMCBot B-001) | Aplica acá: en cualquier flujo con confirmación async, validar ANTES, no después | Lección cruzada de otro proyecto |
| `Number(t.amount)` regado por componentes | DB devuelve DECIMAL como string a veces — `z.coerce.number()` lo arregla en un solo lugar | F0-4 |
| Limit de lista hardcoded sin justificación visible | Usuario ve "4 ventas" en hero pero solo 3 en lista → confusión | F1-D bug fix inmediato |
| Strings legacy sin map al refactorizar | Datos viejos quedan "huérfanos" en UI nueva — usar siempre `LEGACY_MAP` cuando se introducen values nuevos sobre columna string libre | F1-D #10 |

---

*Si este archivo cambia: dejar nota corta en master §11 (changelog) con fecha y motivo. Mantenerlos sincronizados — si master menciona una tabla nueva, este file debe describirla.*

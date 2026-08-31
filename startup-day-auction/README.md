# Startup Day 2026 — subastas y reservas por email

Aplicación Next.js independiente para subastar los 12 lugares reales de la pancarta principal. No cobra ni envía emails automáticamente: administra ofertas, rankings, reservas y contactos para que el equipo continúe la gestión de forma manual.

## Flujo

1. La marca elige un lugar, sube un logo PNG/JPG de hasta 5 MB, ingresa email e importe y confirma la oferta.
2. La primera oferta abre la subasta durante 72 horas y coloca el logo en el lugar elegido. Las siguientes actualizan el ranking y el logo líder.
3. Al cierre, el lugar queda `RESERVED` permanentemente para la oferta ganadora.
4. La reserva conserva logo, email, importe, lugar y fecha en SQLite. No vence.
5. El equipo consulta `/admin/reservas`, exporta los contactos o abre un borrador de email manual.

El ranking público nunca expone emails ni IDs privados. “Mis ofertas” conserva en cada navegador los UUID creados allí y muestra el email enmascarado y el estado actualizado.

## Ejecutar localmente

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configuración mínima:

```dotenv
DATABASE_PATH=./data/startup-day-auction.sqlite
PUBLIC_APP_URL=http://localhost:3000
ADMIN_ACCESS_TOKEN=un-token-largo-y-privado
```

La landing queda en `http://localhost:3000` y el panel privado en `http://localhost:3000/admin/reservas`.

## Panel de reservas

El panel requiere `ADMIN_ACCESS_TOKEN` y permite:

- consultar todos los emails recopilados;
- distinguir ofertas activas, superadas, reservadas y contactadas;
- buscar por empresa, email o lugar;
- abrir un borrador `mailto:` sin enviar automáticamente;
- marcar una reserva como contactada;
- exportar el resultado visible como CSV.

El token se envía sólo en el header `Authorization` y no se persiste en el navegador.

## Persistencia y migración

SQLite usa WAL, claves foráneas y transacciones `BEGIN IMMEDIATE`. La migración v3 convierte los anteriores estados `PAYMENT_PENDING`, `PAYMENT_EXPIRED`, `PAID` y `WON` en `RESERVED`; la v4 agrega logos PNG/JPG persistentes sin perder ofertas anteriores.

| Estado | Significado |
| --- | --- |
| `AVAILABLE` | Todavía no comenzó la subasta. |
| `ACTIVE` | Acepta ofertas hasta el cierre. |
| `RESERVED` | La subasta terminó y el lugar pertenece al email ganador para gestión manual. |

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Las pruebas cubren reloj de 72 horas, ranking, cambio de líder y de logo visible, reserva sin vencimiento, persistencia tras reabrir SQLite, almacenamiento de emails y logos, panel privado y experiencia mobile.

## Producción

```bash
npm ci
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

Montá `data/` en un volumen persistente, protegé `ADMIN_ACCESS_TOKEN` con Secret Vault y terminá TLS delante del proceso Node. Para múltiples instancias, migrá el almacenamiento a PostgreSQL.

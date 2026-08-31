# Startup Day 2026 — subastas y reservas por email

Aplicación Next.js independiente para subastar los 12 lugares reales de la pancarta principal. No cobra ni envía emails automáticamente: administra ofertas, rankings, reservas y contactos para que el equipo continúe la gestión de forma manual.

## Flujo

1. La marca elige un lugar, sube un logo PNG/JPG de hasta 5 MB, ingresa email e importe y confirma la oferta.
2. La primera oferta abre la subasta durante 72 horas y coloca el logo en el lugar elegido. Cada oferta siguiente debe superar a la líder por al menos $1.000 y actualiza el ranking y el logo visible.
3. Al cierre, el lugar queda `RESERVED` permanentemente para la oferta ganadora.
4. La reserva conserva logo, email, importe, lugar y fecha en PostgreSQL (Supabase en producción, SQLite local). No vence.
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

## Persistencia y despliegue

Sin `POSTGRES_URL`, el desarrollo local usa SQLite con WAL, claves foráneas y transacciones `BEGIN IMMEDIATE`. Con `POSTGRES_URL`, la aplicación usa PostgreSQL/Supabase y Supabase Storage para que los logos de hasta 5 MB se carguen directamente con una URL firmada, sin pasar por el cuerpo de una Function de Vercel.

La integración Supabase de Vercel configura automáticamente las variables `POSTGRES_*`, `SUPABASE_*` y `NEXT_PUBLIC_SUPABASE_*`. Para preparar una base nueva y, opcionalmente, importar la SQLite local:

```bash
vercel env run -- npm run db:migrate
vercel env run -- npm run db:import-sqlite
vercel --prod
```

`db:import-sqlite` se niega a continuar si la base remota ya contiene ofertas, para evitar duplicados.

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

## Administración en producción

Configurá `ADMIN_ACCESS_TOKEN` como secreto cifrado de Vercel para habilitar `/admin/reservas`. No uses un valor de demo ni una variable `NEXT_PUBLIC_*`: el token debe existir sólo del lado servidor.

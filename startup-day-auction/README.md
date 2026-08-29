# Startup Day 2026 — subasta real

Aplicación Next.js independiente para subastar los 12 lugares de la pancarta principal. La landing, el backend, la base persistente y el checkout viven en esta carpeta; no depende de Codex Pages.

## Camino rápido

1. Instalá dependencias con `npm ci`.
2. Copiá `.env.example` a `.env.local` y elegí la configuración local o Mercado Pago.
3. Ejecutá `npm run dev` y abrí `http://localhost:3000`.

Para recorrer el checkout local sin credenciales externas:

```dotenv
PAYMENT_PROVIDER=test
ENABLE_TEST_PAYMENT_PROVIDER=1
DATABASE_PATH=./data/startup-day-auction.sqlite
PUBLIC_APP_URL=http://localhost:3000
```

El proveedor de prueba sólo funciona cuando ambas variables están presentes. No lo habilites en un servidor público.

## Qué garantiza el dominio

| Momento | Comportamiento |
| --- | --- |
| Formulario enviado | Crea una reserva de checkout por 15 minutos; todavía no lidera. |
| Primer pago aprobado | Activa la subasta del lugar y fija el cierre a 72 horas exactas. |
| Pago superior aprobado | Cambia el líder dentro de una transacción y devuelve el pago anterior. |
| Pago tardío o insuficiente | No modifica el líder y se reembolsa automáticamente. |
| Cierre | Declara ganador al líder y bloquea el lugar. |
| Métricas | Cuenta subastas `ACTIVE` y suma únicamente pagos retenidos `LEADING` o `WON`. |

Los importes se guardan como centavos enteros. SQLite usa WAL, claves foráneas y transacciones `BEGIN IMMEDIATE` para evitar ganadores simultáneos en el servidor standalone.

## Mercado Pago sandbox y producción

La aplicación usa Checkout Pro en ARS y consulta cada pago en el backend antes de aceptar una oferta. Configurá estas variables mediante Secret Vault o el gestor de secretos del servidor:

```dotenv
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_USE_SANDBOX=1
PUBLIC_APP_URL=https://tu-dominio.example
MERCADOPAGO_WEBHOOK_URL=https://tu-dominio.example/api/webhooks/mercadopago
```

El webhook valida `x-signature` con HMAC-SHA256. Las preferencias y los reembolsos usan claves idempotentes estables. `PUBLIC_APP_URL` debe ser HTTPS y accesible por Mercado Pago para verificar el webhook real.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

`npm test` cubre el reloj de 72 horas, mínimos, carreras entre pagos, liderazgo, cierre, reembolsos, preferencias ARS y firma del webhook. `npm run test:e2e` construye la aplicación y recorre en Chromium dos pagos, la devolución del primer líder, las métricas en vivo, el bloqueo al cierre y el panel flotante móvil. Sólo en ese E2E la duración se reduce a 8 segundos detrás del flag de prueba.

## Ejecutar fuera de Codex Pages

```bash
npm ci
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

Montá `data/` en un volumen persistente y terminá TLS delante del proceso Node. Para más de una instancia de aplicación, migrá el repositorio de subastas a PostgreSQL antes de escalar horizontalmente; SQLite está configurado para un único servidor standalone.

## Checklist de salida

- [ ] Access Token sandbox guardado como secreto, no en `.env` versionado.
- [ ] Comprador y vendedor de prueba pertenecen a Argentina y son cuentas distintas.
- [ ] Webhook HTTPS configurado y entrega firmada comprobada.
- [ ] Compra aprobada y reembolso sandbox verificados en Mercado Pago.
- [ ] `DATABASE_PATH` apunta a un volumen con backup.
- [ ] Proveedor de prueba deshabilitado en el entorno público.

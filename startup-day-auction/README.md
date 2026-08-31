# Startup Day 2026 — subasta con pago diferido

Aplicación Next.js independiente para subastar los 12 lugares reales de la pancarta principal. La oferta no inicia un cobro: Mercado Pago aparece únicamente para quien gana.

## Flujo completo

1. Una marca elige una zona en el mapa y oferta sin pagar.
2. La primera oferta abre una ronda de 72 horas. Las siguientes sólo reemplazan al líder.
3. Al cierre, el ganador recibe por email su link privado de Mercado Pago.
4. El link vence 24 horas después. Un pago correcto bloquea el lugar y suma la recaudación.
5. Si no se acredita a tiempo, esa oferta vence y el lugar vuelve automáticamente a subasta.

La landing muestra un ranking público por lugar con marca, importe, posición y estado. No publica emails ni IDs privados. Cada navegador conserva los UUID de las ofertas creadas allí y presenta “Mis ofertas” con el email enmascarado, posición, cuenta regresiva y acceso al checkout cuando corresponde.

Los reintentos de email conservan el mismo checkout y usan una clave idempotente. Un pago tardío o con monto/moneda incorrectos nunca adjudica el lugar y entra en la cola de reembolso.

## Ejecutar localmente

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abrí `http://localhost:3000`. Para probar todo el ciclo sin credenciales externas:

```dotenv
DATABASE_PATH=./data/startup-day-auction.sqlite
PUBLIC_APP_URL=http://localhost:3000
PAYMENT_PROVIDER=test
EMAIL_PROVIDER=test
ENABLE_TEST_PAYMENT_PROVIDER=1
AUCTION_DURATION_SECONDS=8
PAYMENT_WINDOW_SECONDS=20
AUCTION_SCHEDULER_INTERVAL_MS=500
```

Estas reducciones de tiempo y los proveedores simulados sólo se aceptan detrás de `ENABLE_TEST_PAYMENT_PROVIDER=1`. No habilites ese flag en un servidor público.

## Mercado Pago y email reales

Guardá estos valores en Secret Vault o en el gestor de secretos del servidor; nunca los versiones:

```dotenv
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_USE_SANDBOX=1
PUBLIC_APP_URL=https://tu-dominio.example
MERCADOPAGO_WEBHOOK_URL=https://tu-dominio.example/api/webhooks/mercadopago

EMAIL_PROVIDER=resend
RESEND_API_KEY=
AUCTION_FROM_EMAIL=Startup Day <subastas@tu-dominio-verificado.example>
```

`PUBLIC_APP_URL` debe ser HTTPS y accesible por Mercado Pago. El remitente de `AUCTION_FROM_EMAIL` debe pertenecer a un dominio verificado en Resend. El webhook valida `x-signature`; preferencias, emails y reembolsos usan claves idempotentes estables.

Si el proceso no puede recibir el token directamente, `MERCADOPAGO_API_BASE_URL` puede apuntar a un proxy privado. Si se omite, las solicitudes van a `https://api.mercadopago.com`.

## Estados y métricas

| Estado del lugar | Significado |
| --- | --- |
| `AVAILABLE` | Sin ronda activa; acepta la oferta inicial. |
| `ACTIVE` | Ronda abierta; acepta ofertas superiores hasta el cierre. |
| `AWAITING_PAYMENT` | Ganador definido; checkout enviado y plazo de 24 horas activo. |
| `LOCKED` | Pago aprobado; espacio adjudicado. |

“Recaudado confirmado” suma sólo ofertas `PAID`. SQLite usa WAL, claves foráneas y transacciones `BEGIN IMMEDIATE` para evitar dos líderes simultáneos en este servidor standalone. La migración del flujo anterior conserva como adjudicados los lugares que ya tenían un pago aprobado, evitando un segundo cobro.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Las pruebas cubren las 72 horas, el plazo de 24 horas, cambios de líder sin pago, reapertura, pago tardío y reembolso, checkout del ganador, email idempotente, webhook y el mapa/preview en desktop y mobile.

## Producción

```bash
npm ci
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

Montá `data/` en un volumen persistente y terminá TLS delante del proceso Node. Antes de usar más de una instancia, migrá las subastas a PostgreSQL; SQLite está configurado para un único servidor.

Checklist mínimo:

- Access Token y webhook sandbox verificados con comprador y vendedor argentinos distintos.
- Dominio remitente verificado y email real recibido por el ganador.
- Pago aprobado, vencimiento y reembolso tardío comprobados.
- Volumen de `DATABASE_PATH` con backup.
- Proveedores de prueba deshabilitados públicamente.

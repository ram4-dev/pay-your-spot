export const DEFAULT_AUCTION_DURATION_MS = 72 * 60 * 60 * 1000;

export function getAuctionDurationMs() {
  const configuredSeconds = Number(process.env.AUCTION_DURATION_SECONDS);

  if (
    process.env.ENABLE_TEST_PAYMENT_PROVIDER === "1" &&
    Number.isFinite(configuredSeconds) &&
    configuredSeconds > 0
  ) {
    return configuredSeconds * 1000;
  }

  return DEFAULT_AUCTION_DURATION_MS;
}


export type SpotSeed = {
  id: string;
  placement: string;
  description: string;
  sizeLabel: string;
  tier: "Premium" | "Estándar" | "Compacto";
  tone: string;
  startingAmountCents: number;
  incrementAmountCents: number;
};

const ars = (amount: number) => amount * 100;

export const SPOT_SEEDS: SpotSeed[] = [
  {
    id: "top-band",
    placement: "Franja superior",
    description: "Máxima visibilidad sobre el acceso principal.",
    sizeLabel: "2,4 m × 0,6 m",
    tier: "Premium",
    tone: "charcoal",
    startingAmountCents: ars(680_000),
    incrementAmountCents: ars(10_000),
  },
  {
    id: "side-a",
    placement: "Bloque lateral A",
    description: "Plano completo a la izquierda del centro visual.",
    sizeLabel: "1,2 m × 1,2 m",
    tier: "Estándar",
    tone: "indigo",
    startingAmountCents: ars(540_000),
    incrementAmountCents: ars(10_000),
  },
  {
    id: "access",
    placement: "Marco de acceso",
    description: "Contacto directo con cada persona que entra al stand.",
    sizeLabel: "1,2 m × 0,6 m",
    tier: "Estándar",
    tone: "brick",
    startingAmountCents: ars(480_000),
    incrementAmountCents: ars(10_000),
  },
  {
    id: "right-band",
    placement: "Franja derecha",
    description: "Presencia lateral junto al flujo principal.",
    sizeLabel: "1,2 m × 0,6 m",
    tier: "Estándar",
    tone: "rose",
    startingAmountCents: ars(390_000),
    incrementAmountCents: ars(10_000),
  },
  {
    id: "center-a",
    placement: "Centro A",
    description: "Ubicación compacta dentro del foco central.",
    sizeLabel: "0,8 m × 0,8 m",
    tier: "Compacto",
    tone: "blue",
    startingAmountCents: ars(280_000),
    incrementAmountCents: ars(5_000),
  },
  {
    id: "center-b",
    placement: "Centro B",
    description: "Ubicación compacta junto al foco central.",
    sizeLabel: "0,8 m × 0,8 m",
    tier: "Compacto",
    tone: "violet",
    startingAmountCents: ars(260_000),
    incrementAmountCents: ars(5_000),
  },
  {
    id: "lower-a",
    placement: "Franja inferior A",
    description: "Formato horizontal en la base del cartel.",
    sizeLabel: "0,8 m × 0,6 m",
    tier: "Compacto",
    tone: "green",
    startingAmountCents: ars(240_000),
    incrementAmountCents: ars(5_000),
  },
  {
    id: "lower-b",
    placement: "Franja inferior B",
    description: "Formato horizontal en la base del cartel.",
    sizeLabel: "0,8 m × 0,6 m",
    tier: "Compacto",
    tone: "yellow",
    startingAmountCents: ars(220_000),
    incrementAmountCents: ars(5_000),
  },
  {
    id: "side-b",
    placement: "Bloque lateral B",
    description: "Bloque cuadrado sobre el lateral derecho.",
    sizeLabel: "0,8 m × 0,8 m",
    tier: "Compacto",
    tone: "sand",
    startingAmountCents: ars(200_000),
    incrementAmountCents: ars(5_000),
  },
  {
    id: "corner-a",
    placement: "Esquina superior",
    description: "Presencia compacta en el recorrido superior.",
    sizeLabel: "0,6 m × 0,6 m",
    tier: "Compacto",
    tone: "slate",
    startingAmountCents: ars(180_000),
    incrementAmountCents: ars(5_000),
  },
  {
    id: "corner-b",
    placement: "Esquina inferior",
    description: "Presencia compacta en el recorrido inferior.",
    sizeLabel: "0,6 m × 0,6 m",
    tier: "Compacto",
    tone: "orange",
    startingAmountCents: ars(160_000),
    incrementAmountCents: ars(5_000),
  },
  {
    id: "new-spot",
    placement: "Módulo emergente",
    description: "El punto de entrada para una marca nueva.",
    sizeLabel: "0,6 m × 0,6 m",
    tier: "Compacto",
    tone: "open",
    startingAmountCents: ars(150_000),
    incrementAmountCents: ars(5_000),
  },
];

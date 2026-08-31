export const DEFAULT_AUCTION_DURATION_MS = 72 * 60 * 60 * 1000;

export function getAuctionDurationMs() {
  const configuredSeconds = Number(process.env.AUCTION_DURATION_SECONDS);

  if (
    process.env.ENABLE_TEST_TIME_OVERRIDES === "1" &&
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
const STARTING_AMOUNT_CENTS = ars(5_000);

export const SPOT_SEEDS: SpotSeed[] = [
  {
    id: "top-band",
    placement: "Franja superior",
    description: "Máxima visibilidad sobre el acceso principal.",
    sizeLabel: "2,4 m × 0,6 m",
    tier: "Premium",
    tone: "charcoal",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(10_000),
  },
  {
    id: "side-a",
    placement: "Bloque lateral A",
    description: "Plano completo a la izquierda del centro visual.",
    sizeLabel: "1,2 m × 1,2 m",
    tier: "Estándar",
    tone: "indigo",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(10_000),
  },
  {
    id: "access",
    placement: "Marco de acceso",
    description: "Contacto directo con cada persona que entra al stand.",
    sizeLabel: "1,2 m × 0,6 m",
    tier: "Estándar",
    tone: "brick",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(10_000),
  },
  {
    id: "right-band",
    placement: "Franja derecha",
    description: "Presencia lateral junto al flujo principal.",
    sizeLabel: "1,2 m × 0,6 m",
    tier: "Estándar",
    tone: "rose",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(10_000),
  },
  {
    id: "center-a",
    placement: "Centro A",
    description: "Ubicación compacta dentro del foco central.",
    sizeLabel: "0,8 m × 0,8 m",
    tier: "Compacto",
    tone: "blue",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
  {
    id: "center-b",
    placement: "Centro B",
    description: "Ubicación compacta junto al foco central.",
    sizeLabel: "0,8 m × 0,8 m",
    tier: "Compacto",
    tone: "violet",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
  {
    id: "lower-a",
    placement: "Franja inferior A",
    description: "Formato horizontal en la base del cartel.",
    sizeLabel: "0,8 m × 0,6 m",
    tier: "Compacto",
    tone: "green",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
  {
    id: "lower-b",
    placement: "Franja inferior B",
    description: "Formato horizontal en la base del cartel.",
    sizeLabel: "0,8 m × 0,6 m",
    tier: "Compacto",
    tone: "yellow",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
  {
    id: "side-b",
    placement: "Bloque lateral B",
    description: "Bloque cuadrado sobre el lateral derecho.",
    sizeLabel: "0,8 m × 0,8 m",
    tier: "Compacto",
    tone: "sand",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
  {
    id: "corner-a",
    placement: "Esquina superior",
    description: "Presencia compacta en el recorrido superior.",
    sizeLabel: "0,6 m × 0,6 m",
    tier: "Compacto",
    tone: "slate",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
  {
    id: "corner-b",
    placement: "Esquina inferior",
    description: "Presencia compacta en el recorrido inferior.",
    sizeLabel: "0,6 m × 0,6 m",
    tier: "Compacto",
    tone: "orange",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
  {
    id: "new-spot",
    placement: "Módulo emergente",
    description: "El punto de entrada para una marca nueva.",
    sizeLabel: "0,6 m × 0,6 m",
    tier: "Compacto",
    tone: "open",
    startingAmountCents: STARTING_AMOUNT_CENTS,
    incrementAmountCents: ars(5_000),
  },
];

// Fórmula de scoring del enfrentamiento (ver CLAUDE.md):
//   calidad_normalizada  = (suma(ai_score) / puntaje_maximo_evento) * 100
//   velocidad_normalizada = f(diferencia_tiempo_vs_rival) escalada a 0-100
//   resultado_final = 0.70 * calidad_normalizada + 0.30 * velocidad_normalizada
//
// El 70/30 es fijo. La velocidad nunca debe poder revertir una diferencia
// grande de calidad: con este peso, la velocidad como mucho mueve 30 puntos
// (100 vs 0 de velocidad → ±30), así que una brecha de calidad ponderada
// mayor a 30 puntos (calidad diff > 30/0.7 ≈ 42.86) es matemáticamente
// imposible de revertir sin importar la velocidad — ver tests.

const QUALITY_WEIGHT = 0.7;
const VELOCITY_WEIGHT = 0.3;

export function computeQuality(scoreSum: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clamp((scoreSum / denominator) * 100, 0, 100);
}

// elapsedSecondsA/B: tiempo que tardó cada jugador en responder (o el
// timeLimit completo, si no respondió esa pregunta — "usó todo el tiempo",
// ni premia ni castiga extra más allá de lo que ya penaliza la calidad).
// maxPossibleDiffSeconds: techo teórico de la diferencia (suma de los
// timeLimit de todas las preguntas del match) — así el ratio siempre cae en
// [-1, 1] sin importar cuántas preguntas tenga el match.
export function computeVelocity(
  elapsedSecondsA: number,
  elapsedSecondsB: number,
  maxPossibleDiffSeconds: number,
): { velocityA: number; velocityB: number } {
  if (maxPossibleDiffSeconds <= 0) {
    return { velocityA: 50, velocityB: 50 };
  }
  const diff = elapsedSecondsA - elapsedSecondsB; // positivo = A más lento
  const ratio = clamp(diff / maxPossibleDiffSeconds, -1, 1);
  const velocityA = clamp(50 - ratio * 50, 0, 100);
  const velocityB = 100 - velocityA;
  return { velocityA, velocityB };
}

export function computeResult(quality: number, velocity: number): number {
  return round2(QUALITY_WEIGHT * quality + VELOCITY_WEIGHT * velocity);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

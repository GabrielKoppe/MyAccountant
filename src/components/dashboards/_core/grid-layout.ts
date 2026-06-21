import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { WidgetSizeVariant } from "./widget-registry";

// ─────────────────────────────────────────────────────────────────────────────
// Spec 36 — Geometria pura da grade 2D (sem React/DOM).
// Reutilizada pelo editor (DashboardGridCanvas) e por ações de layout (fase 6).
// ─────────────────────────────────────────────────────────────────────────────

export type GridCell = { x: number; y: number };

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Mantém `anchor` na posição declarada e empurra os demais widgets para baixo
// até remover qualquer sobreposição (linha por linha). Retorna a lista completa
// (anchor + demais reposicionados) ou `null` se algum widget ultrapassar maxRows.
function packWithAnchor(
  anchor: StoredWidget,
  others: StoredWidget[],
  maxRows: number,
): StoredWidget[] | null {
  const placed: StoredWidget[] = [anchor];
  const queue = [...others].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const w of queue) {
    let cur = { ...w };
    let guard = 0;
    while (placed.some((p) => rectsOverlap(cur, p)) && guard < 500) {
      const lowestBottom = Math.max(
        ...placed.filter((p) => rectsOverlap(cur, p)).map((p) => p.y + p.h),
      );
      cur = { ...cur, y: lowestBottom };
      guard++;
    }
    placed.push(cur);
  }

  if (placed.some((w) => w.y + w.h > maxRows)) return null;
  return placed;
}

// Move `movedId` para (tx, ty) e empurra os sobrepostos para baixo.
// Retorna null se o push ultrapassar maxRows (drop deve ser cancelado).
export function applyMoveWithPush(
  widgets: StoredWidget[],
  movedId: string,
  tx: number,
  ty: number,
  maxRows: number,
): StoredWidget[] | null {
  const moved = widgets.find((w) => w.instanceId === movedId);
  if (!moved) return null;
  const anchor = { ...moved, x: tx, y: ty };
  const others = widgets.filter((w) => w.instanceId !== movedId);
  return packWithAnchor(anchor, others, maxRows);
}

// Insere um novo widget na sua posição (x, y), empurrando os existentes para baixo.
// Retorna null se não couber dentro de maxRows.
export function insertWithPush(
  widgets: StoredWidget[],
  newWidget: StoredWidget,
  maxRows: number,
): StoredWidget[] | null {
  return packWithAnchor(newWidget, widgets, maxRows);
}

// Redimensiona/troca a variante de um widget e empurra os sobrepostos para baixo.
// O próprio widget é deslocado (esquerda/cima) o necessário para caber dentro de
// cols × maxRows antes do push — assim "crescer" perto da borda funciona em vez
// de falhar. Retorna null se, mesmo assim, o push não couber em maxRows.
export function applyResizeWithPush(
  widgets: StoredWidget[],
  resizedId: string,
  w: number,
  h: number,
  sizeVariantId: string,
  cols: number,
  maxRows: number,
): StoredWidget[] | null {
  const target = widgets.find((it) => it.instanceId === resizedId);
  if (!target) return null;
  const x = Math.max(0, Math.min(target.x, cols - w));
  const y = Math.max(0, Math.min(target.y, Math.max(0, maxRows - h)));
  const anchor = { ...target, x, y, w, h, sizeVariantId };
  const others = widgets.filter((it) => it.instanceId !== resizedId);
  return packWithAnchor(anchor, others, maxRows);
}

function buildOccupancy(items: StoredWidget[]): Set<string> {
  const occ = new Set<string>();
  for (const it of items) {
    for (let dy = 0; dy < it.h; dy++) {
      for (let dx = 0; dx < it.w; dx++) {
        occ.add(`${it.x + dx},${it.y + dy}`);
      }
    }
  }
  return occ;
}

function fitsAt(occ: Set<string>, x: number, y: number, w: number, h: number): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (occ.has(`${x + dx},${y + dy}`)) return false;
    }
  }
  return true;
}

// Primeira célula livre (canto superior esquerdo) onde cabe w×h dentro de
// cols × maxRows, varrendo linha por linha, esquerda para direita. null se cheio.
export function findFreeCell(
  widgets: StoredWidget[],
  w: number,
  h: number,
  cols: number,
  maxRows: number,
): GridCell | null {
  const safeW = Math.min(w, cols);
  const occ = buildOccupancy(widgets);
  for (let y = 0; y + h <= maxRows; y++) {
    for (let x = 0; x + safeW <= cols; x++) {
      if (fitsAt(occ, x, y, safeW, h)) return { x, y };
    }
  }
  return null;
}

// Variante cujo (w, h) minimiza a distância de Manhattan até (w, h) arrastado.
// Empate → a variante declarada primeiro (sizeVariants[0] é a default).
export function snapToNearestVariant(
  w: number,
  h: number,
  variants: WidgetSizeVariant[],
): WidgetSizeVariant {
  let best = variants[0];
  let bestDist = Infinity;
  for (const v of variants) {
    const dist = Math.abs(w - v.w) + Math.abs(h - v.h);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}

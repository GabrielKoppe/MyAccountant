/**
 * Tipos do "guia de página" — conteúdo informativo, paginado, exibido em um
 * dialog reutilizável (ver `src/components/ui/PageInfoDialog.tsx`).
 *
 * Somente tipos (sem runtime): o vocabulário de blocos é fixo, e cada página
 * agrupa uma sequência de blocos sob um título.
 */

/** Um bloco de conteúdo dentro de uma página do guia. */
export type GuideBlock =
  /** Parágrafo de texto corrido. */
  | { kind: "text"; text: string }
  /** Lista não ordenada (bullets). */
  | { kind: "list"; items: string[] }
  /** Lista de passos ordenados (numerada). */
  | { kind: "steps"; items: string[] }
  /** Destaque com tom semântico (info/aviso/sucesso), opcionalmente titulado. */
  | { kind: "tip"; tone: "info" | "warning" | "success"; text: string; title?: string }
  /** Caixa de exemplo com rótulo. */
  | { kind: "example"; title: string; text: string };

/** Uma página do guia: um título e seus blocos. */
export type GuidePage = { heading: string; blocks: GuideBlock[] };

/** Guia completo de uma página da aplicação, dividido em páginas navegáveis. */
export type PageGuide = { title: string; pages: GuidePage[] };

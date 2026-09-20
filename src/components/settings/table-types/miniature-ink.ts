/**
 * Tinta das miniaturas dos cards de escolha (Spec 69 §2.1, frames 05/05b).
 *
 * Duas tintas, porque as miniaturas desta página têm DOIS papéis diferentes — e
 * o papel é o que decide quanto contraste cada uma precisa.
 *
 * ── Por que a ilustrativa pode ficar ABAIXO de 3:1 ───────────────────────────
 * A WCAG 1.4.11 exige 3:1 de elemento gráfico **necessário para entender o
 * conteúdo**. As barras do "A · Colunas fixas" e as pílulas do "B · Pílulas" não
 * são: quem carrega o significado é o rótulo do card, e a pré-visualização ao
 * vivo, logo abaixo na mesma aba, mostra o layout com conteúdo real. A miniatura
 * é um pictograma de apoio. Por isso ela desce, DE PROPÓSITO, para a faixa de
 * ~1,8–2,5:1 — leve o bastante para não competir com o rótulo, e ainda assim
 * visível nos quatro estados (não selecionado / selecionado × claro / escuro).
 *
 * O que continua proibido é o par ORIGINAL do frame (`background.muted` sobre
 * `accent.primarySubtle`): 1,02:1 no tema claro, ou seja, o card selecionado
 * ficava literalmente vazio. "Mais leve" não é "invisível".
 *
 * Uma tinta só, e não duas camadas: no frame as duas tintas do card A diferiam
 * 1,03:1 entre si — a hierarquia era decorativa, não legível. Uma segunda camada
 * de verdade teria de sair de `border.default`, que mede 1,28:1 sobre o card
 * selecionado no claro: de volta ao bug.
 *
 * ── Por que a estrutural fica em 3:1+ ────────────────────────────────────────
 * Nos cards de densidade a miniatura É a informação: são duas linhas reais, e o
 * filete entre elas é o que torna visível a diferença de altura (28 × 36 × 44px)
 * que o card existe para comparar. Aí vale a régua cheia da 1.4.11, e o texto
 * das linhas ainda é texto.
 *
 * Os pisos estão travados em `miniature-ink.test.ts`, um por uso.
 */
export const MINIATURE_INK = {
  /**
   * Pictograma de apoio — barras e pílulas do bloco "Organização da linha".
   * `border.strong`: 2,14:1 (claro/normal) · 1,83:1 (claro/selecionado) ·
   * 2,29:1 (escuro/normal) · 2,01:1 (escuro/selecionado).
   */
  illustrative: "border.strong",
  /**
   * Miniatura que carrega o dado — as linhas dos cards de densidade.
   * `strong` no card marcado (pior caso 7,73:1), `soft` no resto e no filete
   * (pior caso 3,99:1). Nenhum token de borda chega a 3:1 sobre o card
   * selecionado, por isso a tinta aqui é de TEXTO.
   */
  structural: {
    strong: "text.secondary",
    soft: "text.tertiary",
  },
} as const;

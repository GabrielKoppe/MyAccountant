"use client";

import Box from "@mui/material/Box";
import type { CSSProperties } from "react";

import { DENSITY_VAR, densityCssVars, type Density } from "@/lib/table-density";

import { MINIATURE_INK } from "./miniature-ink";
import { PREVIEW_SAMPLE_DESCRIPTIONS } from "./preview-samples";

export type DensityPreviewRowsProps = {
  density: Density;
  /** Card marcado — o texto sai em `text.secondary` em vez de `text.tertiary`. */
  selected?: boolean;
};

/**
 * A miniatura do card de densidade (frame 05): DUAS LINHAS REAIS, não um desenho.
 *
 * A diferença entre Compacta e Confortável são 16px de altura e 0.08rem de fonte —
 * um pictograma abstrato não comunica isso. Por isso a miniatura é feita das
 * mesmas variáveis CSS que a tabela do mês consome: `densityCssVars(density)` é
 * aplicado AQUI, no contêiner da miniatura, e cada linha lê `var(--row-h)` /
 * `var(--row-fs)`. O card mostra a medida que o tipo vai valer, não uma
 * aproximação escrita à mão.
 */
export function DensityPreviewRows({ density, selected = false }: DensityPreviewRowsProps) {
  return (
    // `style` e não `sx`: mesma razão do `LivePreviewRow` — custom property é
    // valor, e pelo `sx` cada densidade viraria uma classe Emotion nova.
    <Box aria-hidden style={densityCssVars(density) as CSSProperties}>
      {PREVIEW_SAMPLE_DESCRIPTIONS.map((description, index) => (
        <Box
          key={description}
          sx={{
            display: "flex",
            alignItems: "center",
            height: DENSITY_VAR.rowHeight,
            fontSize: DENSITY_VAR.fontSize,
            color: selected ? MINIATURE_INK.structural.strong : MINIATURE_INK.structural.soft,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            borderBottomWidth: index === PREVIEW_SAMPLE_DESCRIPTIONS.length - 1 ? 0 : "1px",
            borderBottomStyle: "solid",
            // O filete é o que faz a ALTURA da linha ser visível — é ele, e não o
            // texto, que comunica a diferença entre 36px e 52px. Em `border.subtle`
            // media 1,08:1 sobre o card selecionado no tema claro: a régua sumia e
            // sobravam duas frases soltas. Por isso a tinta aqui é a ESTRUTURAL, e
            // não a ilustrativa mais leve dos cards de layout: nestes cards a
            // miniatura é o dado, não um pictograma de apoio.
            borderBottomColor: MINIATURE_INK.structural.soft,
          }}
        >
          {description}
        </Box>
      ))}
    </Box>
  );
}

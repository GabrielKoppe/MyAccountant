"use client";

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  ButtonBase,
  keyframes,
  Stack,
  Typography,
} from "@mui/material";
import { type ReactElement, useState } from "react";

import { layout, motion, radius } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { GuideBlock, PageGuide } from "@/lib/page-guide";

import { DialogShell } from "./DialogShell";

export interface PageInfoDialogProps {
  /** Estado de abertura. */
  open: boolean;
  /** Callback ao fechar (X, backdrop, ESC, botão "Entendi"). */
  onClose: () => void;
  /** Conteúdo do guia, paginado. */
  guide: PageGuide;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

/** Renderiza um único bloco de conteúdo do guia. */
function GuideBlockView({ block }: { block: GuideBlock }): ReactElement {
  switch (block.kind) {
    case "text":
      return (
        <Typography variant="body2" color="text.secondary">
          {block.text}
        </Typography>
      );

    case "list":
      return (
        <Stack component="ul" spacing={layout.inline} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {block.items.map((item, i) => (
            <Stack
              key={i}
              component="li"
              direction="row"
              spacing={layout.inline}
              alignItems="flex-start"
            >
              <Box
                aria-hidden
                sx={{
                  flexShrink: 0,
                  width: 6,
                  height: 6,
                  mt: "7px",
                  borderRadius: `${radius.full}px`,
                  bgcolor: "accent.primary",
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {item}
              </Typography>
            </Stack>
          ))}
        </Stack>
      );

    case "steps":
      return (
        <Stack component="ol" spacing={layout.stack} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {block.items.map((item, i) => (
            <Stack
              key={i}
              component="li"
              direction="row"
              spacing={layout.inline}
              alignItems="flex-start"
            >
              <Box
                aria-hidden
                sx={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: `${radius.full}px`,
                  bgcolor: "accent.primarySubtle",
                  color: "accent.primary",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography variant="caption" component="span" sx={{ color: "inherit" }}>
                  {i + 1}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: "2px" }}>
                {item}
              </Typography>
            </Stack>
          ))}
        </Stack>
      );

    case "tip":
      return (
        <Alert severity={block.tone}>
          {block.title !== undefined && <AlertTitle>{block.title}</AlertTitle>}
          {block.text}
        </Alert>
      );

    case "example":
      return (
        <Box
          sx={{
            border: 1,
            borderColor: "border.subtle",
            bgcolor: "background.subtle",
            borderRadius: `${radius.md}px`,
            p: layout.stack,
          }}
        >
          <Typography
            variant="overline"
            component="div"
            color="text.tertiary"
            sx={{ mb: layout.micro }}
          >
            {block.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {block.text}
          </Typography>
        </Box>
      );

    default: {
      // Exaustividade: se um novo `kind` for adicionado a `GuideBlock` sem um
      // `case` aqui, o TS acusa erro nesta atribuição (block deixa de ser never).
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

/**
 * Dialog informativo, paginado, que apresenta um guia sobre a página atual.
 *
 * - Índice do passo reinicia em 0 sempre que o dialog é reaberto.
 * - Indicador de progresso no topo (título do passo + "dots" navegáveis).
 * - Renderiza blocos de um vocabulário fixo com tokens semânticos.
 *
 * Use via `PageInfoButton` (não instancie diretamente na UI de página).
 */
export function PageInfoDialog({ open, onClose, guide }: PageInfoDialogProps) {
  const [step, setStep] = useState(0);
  const total = guide.pages.length;

  // Reseta para o primeiro passo sempre que o dialog abre (false -> true).
  // Padrão de "ajuste de estado durante o render" (evita setState em efeito).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setStep(0);
  }

  const safeStep = Math.min(step, Math.max(total - 1, 0));
  const current = guide.pages[safeStep];
  const isFirst = safeStep === 0;
  const isLast = safeStep >= total - 1;

  if (!current) return null;

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={guide.title}
      maxWidth="sm"
      actions={
        <>
          <Button variant="outlined" disabled={isFirst} onClick={() => setStep((s) => s - 1)}>
            {m.common.pageInfo.prev}
          </Button>
          <Button
            variant="contained"
            onClick={isLast ? onClose : () => setStep((s) => s + 1)}
          >
            {isLast ? m.common.pageInfo.done : m.common.pageInfo.next}
          </Button>
        </>
      }
    >
      <Stack spacing={layout.stack} sx={{ pb: layout.inline }}>
        {/* Indicador de progresso (stepper) */}
        {total > 1 && (
          <Stack direction="row" spacing={layout.inline} alignItems="center">
            {guide.pages.map((_, i) => {
              const active = i === safeStep;
              return (
                <ButtonBase
                  key={i}
                  aria-label={`${i + 1} / ${total}`}
                  aria-current={active ? "step" : undefined}
                  onClick={() => setStep(i)}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    // Alvo de toque acessível (>= 24x24, WCAG 2.5.8) sem alterar
                    // o visual do dot em si.
                    minWidth: 24,
                    minHeight: 24,
                    borderRadius: `${radius.full}px`,
                    "&:focus-visible": {
                      outline: 2,
                      outlineColor: "border.focus",
                      outlineOffset: 1,
                    },
                  }}
                >
                  <Box
                    sx={{
                      // Largura fixa: o estado inativo é obtido via transform
                      // (scaleX), nunca animando `width` (evita reflow — ver
                      // skill mui-motion).
                      width: 20,
                      height: 8,
                      borderRadius: `${radius.full}px`,
                      bgcolor: active ? "accent.primary" : "border.default",
                      transform: active ? "scaleX(1)" : "scaleX(0.4)",
                      transformOrigin: "left center",
                      transition: `background-color ${motion.duration.fast}ms ${motion.easing.standard}, transform ${motion.duration.fast}ms ${motion.easing.standard}`,
                      "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                      "*:hover > &": {
                        bgcolor: active ? "accent.primary" : "border.strong",
                      },
                    }}
                  />
                </ButtonBase>
              );
            })}
          </Stack>
        )}

        {/* Conteúdo do passo — região aria-live estável para que AT anuncie a
            troca de passo (heading + blocos). O remount via `key` fica dentro
            da região, que permanece montada. */}
        <Box aria-live="polite" aria-atomic="true">
          <Stack
            key={safeStep}
            spacing={layout.stack}
            sx={{
              animation: `${fadeIn} ${motion.duration.normal}ms ${motion.easing.entrance}`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            <Typography variant="subtitle1" color="text.primary">
              {current.heading}
            </Typography>
            {current.blocks.map((block, i) => (
              <GuideBlockView key={i} block={block} />
            ))}
          </Stack>
        </Box>
      </Stack>
    </DialogShell>
  );
}

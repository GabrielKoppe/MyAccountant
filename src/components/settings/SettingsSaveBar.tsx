"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { SETTINGS_GUTTER } from "@/components/settings/settings-layout";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

/** Ponto de cor do estado sujo: o sinal cromático fora do texto (ver comentário abaixo). */
const DIRTY_DOT_SIZE = "8px";

/**
 * sr-only: o texto estável da live region fica no DOM para o leitor de tela sem
 * ocupar espaço na barra. (`width: 1` no `sx` significaria 100%, não 1px.)
 */
const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

type Props = {
  /** 0 = "Nenhuma alteração" com os dois botões desabilitados; >0 = "N alterações não salvas" */
  dirtyCount: number;
  /** rótulo da primária; default m.settings.shell.save (Spec 69 usa "Salvar tipo", "Publicar layout") */
  saveLabel?: string;
  onSave: () => void;
  onDiscard: () => void;
  /** durante o salvamento: primária mostra progresso e ambos ficam desabilitados */
  saving?: boolean;
};

/**
 * Barra de salvar fixa no rodapé do painel de Configurações (Spec 67 §2.2 regra 7, §4 SET-03, D7).
 *
 * Existe só nos arquétipos de formulário (C e D) — listas A/B salvam inline e não recebem barra.
 * Quem decide se a barra aparece é o `SettingsPageShell` (`dirtyCount === undefined` ⇒ sem barra);
 * aqui `dirtyCount` já chega como número, e `0` significa "barra visível, porém inerte".
 */
export function SettingsSaveBar({
  dirtyCount,
  saveLabel = m.settings.shell.save,
  onSave,
  onDiscard,
  saving = false,
}: Props) {
  const isDirty = dirtyCount > 0;
  // Sem alterações não há o que salvar nem o que descartar; durante o salvamento,
  // travar os dois evita duplo submit e um descarte no meio da requisição.
  const disabled = !isDirty || saving;

  return (
    <Paper
      // `square` de propósito: a barra é o rodapé colado à borda do painel — cantos
      // arredondados brigariam com a borda superior que a separa do conteúdo.
      square
      sx={{
        position: "sticky",
        bottom: 0,
        zIndex: 1,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.surface",
        // Mesma goteira das demais faixas da moldura (ver `settings-layout.ts`);
        // `py` curto para a barra não ficar mais alta que o cabeçalho.
        px: SETTINGS_GUTTER,
        py: layout.inline,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={layout.inline}
      >
        {/*
          A troca "Nenhuma alteração" ⇄ "há alterações" é a única pista de que o
          formulário ficou sujo — precisa ser anunciada. Mas o CONTADOR não pode
          estar no texto anunciado: ele muda a cada tecla e o leitor enfileiraria
          uma frase por dígito. Então a região viva carrega texto estável e a
          contagem visível fica `aria-hidden`.
        */}
        <Stack
          direction="row"
          alignItems="center"
          role="status"
          aria-live="polite"
          sx={{ gap: layout.inline }}
        >
          {isDirty ? (
            <>
              {/*
                O ponto mostarda mantém a cor como SINAL, sem ser o veículo do texto:
                `warning.main` sobre `background.surface` só alcança 3,2:1 no light,
                abaixo do mínimo AA de 4,5:1 para 14px. O texto vai em `text.primary`.
              */}
              <Box
                aria-hidden
                sx={{
                  flexShrink: 0,
                  width: DIRTY_DOT_SIZE,
                  height: DIRTY_DOT_SIZE,
                  borderRadius: "50%",
                  bgcolor: "warning.main",
                }}
              />
              <Typography
                aria-hidden
                variant="body2"
                sx={{ color: "text.primary", fontWeight: 500 }}
              >
                {m.settings.shell.unsavedChanges(dirtyCount)}
              </Typography>
              <Box sx={SR_ONLY}>{m.settings.shell.unsavedChangesLive}</Box>
            </>
          ) : (
            // Sem contador, o texto do estado limpo já é estável: ele mesmo é o
            // conteúdo anunciado, sem nó duplicado.
            <Typography variant="body2" sx={{ color: "text.tertiary" }}>
              {m.settings.shell.noChanges}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={layout.inline}>
          <Button variant="outlined" size="small" onClick={onDiscard} disabled={disabled}>
            {m.settings.shell.discard}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={onSave}
            disabled={disabled}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saveLabel}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

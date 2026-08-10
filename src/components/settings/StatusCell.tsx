"use client";

import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatLastUsedLabel, type SettingsGender } from "@/lib/settings-status";

type Props = {
  /**
   * Já normalizado — venha de `resolveActive` de `@/lib/settings-status`.
   * Este componente NUNCA lê `isActive`, `archivedAt` ou `status` (Spec 67 §4 SET-07 / D2):
   * `archivedAt: null` significa ATIVO e `isActive: false` significa INATIVO — deixar essa
   * inversão espalhada pelas listas é exatamente o bug que o adapter existe para evitar.
   */
  active: boolean;
  lastUsedAt: Date | string | null;
  /** Concordância do rótulo "nunca usada" / "nunca usado". */
  gender?: SettingsGender;
  /** Nome do objeto — compõe o aria-label do Switch. */
  name: string;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
};

/**
 * Coluna "Status" das listas de configuração (Spec 67 §2.4 e §4 SET-07).
 *
 * Substitui a antiga coluna "Uso": em vez de contar transações a cada render
 * (custo que cresce com a conta), mostra o toggle ativo/inativo mais o rótulo de
 * `lastUsedAt`, que é gravado na escrita. Leitura de custo zero.
 *
 * ESCOPO: este componente pinta apenas a célula. A **atenuação da linha inteira**
 * quando o objeto está inativo (SET-07: "a linha DEVE ser renderizada com opacidade
 * reduzida") é responsabilidade de quem renderiza a linha — a página sabe onde a
 * `<TableRow>` começa e termina, o `StatusCell` não. Não tente aplicar opacidade aqui.
 */
export function StatusCell({ active, lastUsedAt, gender, name, disabled, onToggle }: Props) {
  const label = formatLastUsedLabel({ active, lastUsedAt, gender });

  return (
    <Stack direction="row" alignItems="center" spacing={layout.micro}>
      <Switch
        size="small"
        checked={active}
        disabled={disabled}
        onChange={(_event, checked) => onToggle(checked)}
        // O aria-label vai no input, não na raiz: é o input que carrega o role de checkbox.
        // Nomear o objeto é obrigatório — numa lista há dezenas de "Ativo" idênticos.
        inputProps={{ "aria-label": `${m.settings.shell.status.toggleLabel}: ${name}` }}
      />
      <Typography
        variant="caption"
        sx={{
          // `text.tertiary` nos dois estados: este rótulo existe justamente para a cor
          // não ser a única informação, então precisa passar no AA (`text.disabled` dá
          // 2,1:1 em 12px) — ainda mais numa linha inativa, que já leva opacidade
          // reduzida por cima. Quem sinaliza "fora de uso" é o texto e o toggle.
          color: "text.tertiary",
          // Rótulo curto de referência: quebrar linha numa coluna estreita atrapalha mais
          // do que truncar visualmente contra a coluna seguinte.
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

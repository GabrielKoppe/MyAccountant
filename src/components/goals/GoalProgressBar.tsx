import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";

type Props = {
  progressCents: string;
  targetCents: string;
  /** Percentual REAL (pode passar de 100 em over-aporte, DD-05) — a barra satura, o texto não. */
  percent: number;
  /** Densidade compacta — uso em listas menores (ex: seção "Arquivadas"). */
  compact?: boolean;
};

/**
 * Barra de progresso de METAS (spec 47 §5.7/DD-05). Semântica OPOSTA à de
 * `BudgetProgressBar` (`src/components/budgets/BudgetProgressBar.tsx`): lá,
 * encher a barra é ruim (limite de gasto sendo estourado — vermelho/amarelo por
 * limiar). Aqui, encher é o objetivo (poupança acumulada) — a barra preenche
 * sempre em `success`, nunca vira alerta por estar "cheia". Espelha a
 * ESTRUTURA do componente irmão (variante compact/default, mesma tipografia
 * mono tabular-nums), não a lógica de cor por limiar.
 *
 * Satura visualmente em 100% (GOAL-02, §7); em over-aporte, o percentual real
 * e o excedente (`m.goals.overTarget`) ficam explícitos abaixo da barra.
 */
export function GoalProgressBar({ progressCents, targetCents, percent, compact = false }: Props) {
  const progress = BigInt(progressCents);
  const target = BigInt(targetCents);
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const overCents = progress > target ? progress - target : 0n;

  const saved = formatCentsToBrl(progress);
  const goal = formatCentsToBrl(target);
  const roundedPercent = Math.round(percent);

  if (compact) {
    return (
      <Box sx={{ width: "100%" }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: layout.micro }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
            {saved} / {goal}
          </Typography>
          {/* U8 (fix wave): variant="mono" do tema (fontFamily+tabular-nums já embutidos)
              em vez de sx manual — mesmo caminho usado no bloco default logo abaixo. */}
          <Typography
            variant="mono"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "success.main",
              whiteSpace: "nowrap",
              ml: 1,
            }}
          >
            {roundedPercent}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={clampedPercent}
          color="success"
          sx={{ height: 4, borderRadius: 2 }}
        />
        {/* C3 (fix wave): excedente também no compact (§5.7), versão curta — antes
            só a variante default mostrava "R$ X acima do alvo" em over-aporte. */}
        {overCents > 0n && (
          <Typography
            variant="caption"
            sx={{ color: "success.main", display: "block", mt: layout.micro, fontSize: "0.7rem" }}
          >
            {m.goals.overTarget(formatCentsToBrl(overCents))}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <LinearProgress
        variant="determinate"
        value={clampedPercent}
        color="success"
        sx={{ height: 6, borderRadius: 3, mb: layout.micro }}
      />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        {/* U8 (fix wave): variant="mono" do tema — fontSize.sm já bate com body2,
            então nenhum override de tamanho é necessário aqui. */}
        <Typography variant="mono" sx={{ color: "text.primary", fontSize: "0.875rem" }} noWrap>
          {saved} / {goal}
        </Typography>
        <Typography
          variant="mono"
          sx={{ fontWeight: 600, color: "success.main", fontSize: "0.875rem" }}
        >
          {roundedPercent}%
        </Typography>
      </Stack>
      {overCents > 0n && (
        <Typography
          variant="caption"
          sx={{ color: "success.main", display: "block", mt: layout.micro, fontSize: "0.875rem" }}
        >
          {m.goals.overTarget(formatCentsToBrl(overCents))}
        </Typography>
      )}
    </Box>
  );
}

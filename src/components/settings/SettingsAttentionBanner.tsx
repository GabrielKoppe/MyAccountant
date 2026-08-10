import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { AppLink } from "@/components/ui/AppLink";
import { layout, radius } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { AttentionSignal } from "@/server/queries/settings-attention";

type Props = {
  /** Produzido por `getSettingsAttention` — a ordem do array é significativa. */
  signals: AttentionSignal[];
  accountId: string;
};

/**
 * Id literal (e não `useId`): este é um Server Component, onde hooks não rodam.
 * É seguro fixar porque o bloco é único na página do hub — se um dia houver dois,
 * o id precisa passar a ser gerado por quem monta a página.
 */
const TITLE_ID = "settings-attention-title";

/**
 * Bloco "N itens pedem atenção" do topo do hub de Configurações
 * (Spec 67 §2.1 e §4 · SET-02).
 *
 * Duas regras do critério de aceitação moram aqui:
 *
 *  1. Sem nenhum sinalizador o bloco NÃO é renderizado — nem um placeholder
 *     vazio, nem uma moldura sem conteúdo. Nada.
 *  2. O "Revisar" leva ao destino do PRIMEIRO sinalizador, na ordem em que
 *     vierem da query (que é a ordem da tabela da spec). A ordenação é
 *     responsabilidade de quem produz a lista, não deste componente.
 *
 * O título conta ITENS, não sinalizadores: dois apelidos incompletos + um
 * template quebrado são "3 itens pedem atenção", não "2".
 */
export function SettingsAttentionBanner({ signals, accountId }: Props) {
  // Regra 1: sem sinal, sem bloco (SET-02, §4).
  if (signals.length === 0) return null;

  const total = signals.reduce((sum, signal) => sum + signal.count, 0);
  const [firstSignal] = signals;
  const reviewHref = `/${accountId}/settings/${firstSignal.href}`;

  return (
    <Paper
      variant="outlined"
      // `region` e não `status`: o bloco é conteúdo estático do primeiro paint, e
      // uma live region só anuncia o que muda DEPOIS de ela ser registrada — como
      // `status` ele não anunciava nada e ainda competia com anúncios reais.
      // Rotulado pelo próprio título, vira um marco navegável.
      role="region"
      aria-labelledby={TITLE_ID}
      sx={{
        bgcolor: "accent.primarySubtle",
        // Mesmo tom do fundo: `accent.primary` na borda satura o bloco e o faz
        // pesar mais que os cards que ele encima.
        borderColor: "accent.primarySubtle",
        borderRadius: `${radius.lg}px`,
        py: layout.inline,
        px: layout.stack,
      }}
    >
      <Stack
        // Em tela estreita o botão vai para baixo do texto em vez de ser
        // espremido contra a borda direita.
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={layout.inline}
      >
        <LightbulbOutlinedIcon fontSize="small" sx={{ color: "accent.primary" }} />

        {/* `minWidth: 0` deixa a lista de labels truncar em vez de empurrar o botão. */}
        <Stack spacing={layout.micro} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography id={TITLE_ID} variant="body2" sx={{ fontWeight: 600 }}>
            {m.settings.hub.attention(total)}
          </Typography>
          {/* `text.secondary`: o terciário do `caption` cai para ~4,0:1 sobre o
              fundo `accent.primarySubtle`, abaixo do mínimo AA. */}
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {signals.map((signal) => signal.label).join(" · ")}
          </Typography>
        </Stack>

        <Button variant="outlined" size="small" component={AppLink} href={reviewHref}>
          {m.settings.hub.review}
        </Button>
      </Stack>
    </Paper>
  );
}

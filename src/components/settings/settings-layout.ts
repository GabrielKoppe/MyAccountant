// Spec 67 §2.2 / §0 — a goteira horizontal única da moldura de Configurações.
//
// POR QUE ISTO EXISTE: no frame v2 as quatro faixas do painel (cabeçalho,
// toolbar, conteúdo e rodapé de salvar) compartilham a MESMA goteira de 18px.
// É isso que alinha o título, o campo de busca e a primeira célula da tabela
// no mesmo eixo vertical — e é justamente o que o SET-03 promete ao dizer
// "uma moldura só". Com cada faixa escolhendo o próprio padding, a busca
// "sai" alguns pixels para fora do título e a promessa se desfaz.
//
// Valor em unidades de spacing do MUI (theme.spacing(1) = 4px):
// 4 = 16px no mobile, 6 = 24px a partir de `md`.

export const SETTINGS_GUTTER = { xs: 4, md: 6 } as const;

# SKILL — Motion & Animação (MUI)

## Quando usar

Sempre que adicionar movimento: transições de componente (Fade/Grow/Collapse/Slide), entrada de cards/painéis, reveal de gráficos, feedback de estado (loading, sucesso, erro), hover/press. O objetivo é movimento **intencional e calmo** ("Warm Calm"), nunca decorativo — e **sempre** respeitando `prefers-reduced-motion`.

> Camada de **decisão de motion**. Para *quando* o movimento serve à interface (vs. ruído "cara de IA"), ver [`frontend-design`](../frontend-design/SKILL.md). Para reveal de gráficos, ver [`dashboards-charts`](../dashboards-charts/SKILL.md).

---

## 1. Tokens reais (nunca números mágicos)

O tema já expõe tokens de motion em `src/lib/design-tokens.ts` — use-os, nunca `300ms`/`cubic-bezier(...)` solto.

```ts
import { motion } from "@/lib/design-tokens";

motion.duration; // { fast: 120, normal: 200, slow: 320 }  (ms)
motion.easing;   // { standard, entrance, exit }
//   standard: "cubic-bezier(0.2, 0, 0, 1)"  → mudança on-screen
//   entrance: "cubic-bezier(0, 0, 0, 1)"    → algo entrando (ease-out)
//   exit:     "cubic-bezier(0.4, 0, 1, 1)"  → algo saindo (ease-in)
```

Esses mesmos valores já alimentam `theme.transitions.duration.*`. Em `sx`, construa transições com a API do tema (não hardcode):

```tsx
sx={{
  transition: (theme) =>
    theme.transitions.create(["opacity", "transform"], {
      duration: theme.transitions.duration.standard, // = motion.duration.normal
      easing: motion.easing.standard,
    }),
}}
```

---

## 2. Princípios (curtos)

- **Entrada usa `entrance` (ease-out); saída usa `exit` (ease-in); on-screen usa `standard`.**
- **Saída ≈ 75% da duração da entrada** (sair é mais rápido que entrar).
- **Só anime `transform` e `opacity`.** Nunca `width`, `height`, `top`, `left`, `margin` (causam layout/reflow). Para tamanho, use `scale`; para entrada de altura use `<Collapse>` do MUI.
- **Sweet spot 120–320ms** (os 3 tokens). UI acima de ~400ms parece lenta.
- **Restraint (Warm Calm):** uma assinatura de movimento (o `standard` easing), nada de bounce/overshoot exagerado. Movimento extra = sensação de "gerado por IA".

---

## 3. Componentes MUI

Use os transition components do MUI com `timeout` vindo dos tokens:

```tsx
import { motion } from "@/lib/design-tokens";

<Fade in={open} timeout={motion.duration.normal}><Box>…</Box></Fade>
<Grow in={open} timeout={motion.duration.normal}>…</Grow>
<Collapse in={open} timeout={motion.duration.normal}>…</Collapse> {/* altura, sem animar height na mão */}
```

**Stagger** (lista/grid de cards entrando) — atraso incremental pequeno, total < ~400ms:

```tsx
{items.map((it, i) => (
  <Grow key={it.id} in timeout={motion.duration.normal} style={{ transitionDelay: `${i * 40}ms` }}>
    <Card>…</Card>
  </Grow>
))}
```

---

## 4. Gráficos (recharts / @nivo)

```tsx
// recharts: duração via token, não default
<Bar isAnimationActive={!reduceMotion} animationDuration={motion.duration.slow} animationEasing="ease-out" … />

// @nivo: motionConfig calmo
<ResponsiveSankey motion={!reduceMotion} motionConfig="gentle" … />
```

> Reveal de chart no mount é um bom uso de motion; re-animar a cada hover/tooltip não é. Ver `dashboards-charts`.

---

## 5. `prefers-reduced-motion` (obrigatório)

Toda animação precisa de fallback. Padrão no projeto:

```tsx
import { useMediaQuery } from "@mui/material";
const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

<Grow in={open} timeout={reduceMotion ? 0 : motion.duration.normal}>…</Grow>
// charts: isAnimationActive={!reduceMotion}
```

Em CSS/`sx` puro, envelopar a transição: `@media (prefers-reduced-motion: reduce) { transition: none; }`.

---

## 6. Anti-padrões

❌ `cubic-bezier(...)` ou `300ms` hardcoded — usar `motion.easing.*` / `motion.duration.*`.
❌ Animar `width`/`height`/`top`/`margin` — só `transform`/`opacity` (ou `<Collapse>`).
❌ `linear` (exceto spinner contínuo).
❌ Duração > 400ms em interação de UI.
❌ Animação sem checar `prefers-reduced-motion`.
❌ Bounce/overshoot forte — não combina com "Warm Calm".
❌ Re-animar gráfico a cada interação (só no mount/troca de dado).

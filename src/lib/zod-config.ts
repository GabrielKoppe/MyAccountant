import { z } from "zod";

z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "Campo obrigatório" };
      }
      if (issue.expected === "string") return { message: "Campo obrigatório" };
      if (issue.expected === "number") return { message: "Deve ser um número" };
      if (issue.expected === "date") return { message: "Data inválida" };
      break;
    case "too_small":
      if (issue.type === "string" && issue.minimum === 1) {
        return { message: "Campo obrigatório" };
      }
      if (issue.type === "string") {
        return { message: `Mínimo de ${issue.minimum} caracteres` };
      }
      if (issue.type === "number") {
        return { message: `Valor mínimo: ${issue.minimum}` };
      }
      break;
    case "too_big":
      if (issue.type === "string") {
        return { message: `Máximo de ${issue.maximum} caracteres` };
      }
      break;
    case "invalid_string":
      if (issue.validation === "email") return { message: "Email inválido" };
      if (issue.validation === "url") return { message: "URL inválida" };
      break;
  }
  return { message: ctx.defaultError };
});

export {};

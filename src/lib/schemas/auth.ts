import { z } from "zod";

import { emailSchema } from "./shared";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha é obrigatória"),
});

export const signupSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[a-zA-Z]/, "Deve conter ao menos uma letra")
    .regex(/[0-9]/, "Deve conter ao menos um número"),
});

export const signupFormSchema = signupSchema
  .extend({ confirmPassword: z.string().min(1, "Confirme a senha") })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const passwordRule = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .regex(/[a-zA-Z]/, "Deve conter ao menos uma letra")
  .regex(/[0-9]/, "Deve conter ao menos um número");

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token obrigatório"),
  password: passwordRule,
});

export const resetPasswordFormSchema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SignupFormValues = z.infer<typeof signupFormSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

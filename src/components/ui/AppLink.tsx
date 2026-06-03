"use client";

import NextLink from "next/link";
import MuiLink, { type LinkProps as MuiLinkProps } from "@mui/material/Link";

type AppLinkProps = MuiLinkProps & { href: string };

export function AppLink({ href, children, ...props }: AppLinkProps) {
  return (
    <MuiLink component={NextLink} href={href} {...props}>
      {children}
    </MuiLink>
  );
}

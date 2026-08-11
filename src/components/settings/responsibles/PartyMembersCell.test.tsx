import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { PartyMembersCell, type AvailableMember, type LinkedMember } from "./PartyMembersCell";

const st = m.settings.structure.responsibles;

const GABRIEL: LinkedMember = {
  userId: "u-gabriel",
  label: "Gabriel",
  color: null,
  imageUrl: null,
};
const MARINA: LinkedMember = {
  userId: "u-marina",
  label: "Marina",
  color: "green",
  imageUrl: null,
};
const LUCAS: AvailableMember = { userId: "u-lucas", label: "Lucas" };

function renderCell(props: Partial<Parameters<typeof PartyMembersCell>[0]> = {}) {
  return render(
    <PartyMembersCell
      partyName="Compartilhado"
      members={[]}
      availableMembers={[]}
      onLink={vi.fn()}
      {...props}
    />,
  );
}

describe("PartyMembersCell (Spec 68 §2.4)", () => {
  describe("0 membros — vale para QUALQUER kind (D4)", () => {
    it("mostra 'nenhum — só rótulo' em vez de AvatarGroup vazio", () => {
      const { container } = renderCell({ members: [] });

      expect(screen.getByText(st.noMembers)).toBeInTheDocument();
      expect(container.querySelector(".MuiAvatarGroup-root")).toBeNull();
      expect(container.querySelector(".MuiAvatar-root")).toBeNull();
    });
  });

  describe("1 membro", () => {
    it("renderiza um avatar e o nome", () => {
      const { container } = renderCell({ members: [GABRIEL] });

      expect(screen.queryByText(st.noMembers)).toBeNull();
      expect(container.querySelectorAll(".MuiAvatar-root")).toHaveLength(1);
      expect(screen.getByText("Gabriel")).toBeInTheDocument();
    });
  });

  describe("N membros", () => {
    it("renderiza um avatar por membro e os nomes concatenados", () => {
      const { container } = renderCell({ members: [GABRIEL, MARINA] });

      expect(container.querySelectorAll(".MuiAvatar-root")).toHaveLength(2);
      expect(screen.getByText("Gabriel, Marina")).toBeInTheDocument();
    });
  });

  describe("botão '+' — só oferece quem ainda não está vinculado", () => {
    it("abre o menu listando apenas `availableMembers`, nunca quem já está em `members`", async () => {
      renderCell({ members: [GABRIEL], availableMembers: [LUCAS] });

      const trigger = screen.getByRole("button", { name: st.linkMemberFor("Compartilhado") });
      await userEvent.click(trigger);

      const items = screen.getAllByRole("menuitem");
      expect(items.map((item) => item.textContent)).toEqual(["Lucas"]);
      expect(screen.queryByRole("menuitem", { name: "Gabriel" })).toBeNull();
    });

    it("clicar num item chama onLink com o userId e fecha o menu", async () => {
      const onLink = vi.fn();
      renderCell({ members: [GABRIEL], availableMembers: [LUCAS], onLink });

      await userEvent.click(
        screen.getByRole("button", { name: st.linkMemberFor("Compartilhado") }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "Lucas" }));

      expect(onLink).toHaveBeenCalledOnce();
      expect(onLink).toHaveBeenCalledWith("u-lucas");
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("sem ninguém disponível, o botão fica desabilitado (allMembersLinked)", () => {
      renderCell({ members: [GABRIEL, MARINA], availableMembers: [] });

      const trigger = screen.getByRole("button", { name: st.linkMemberFor("Compartilhado") });
      expect(trigger).toBeDisabled();
    });

    it("o aria-label nomeia o responsável (há vários '+' na mesma tabela)", () => {
      renderCell({ partyName: "Casal", members: [], availableMembers: [LUCAS] });

      expect(screen.getByRole("button", { name: st.linkMemberFor("Casal") })).toBeInTheDocument();
    });
  });

  // "Tudo é responsável": `personal` é o único kind com vínculo fixo — a célula
  // troca o "+" por um indicativo discreto, sem virar uma segunda coluna.
  describe("locked (kind: personal) — vínculo fixo, sem '+'", () => {
    it("não renderiza o botão de vincular nem o menu", () => {
      renderCell({ members: [GABRIEL], availableMembers: [LUCAS], locked: true });

      expect(screen.queryByRole("button", { name: st.linkMemberFor("Compartilhado") })).toBeNull();
    });

    it("continua mostrando o avatar e o nome do membro fixo", () => {
      renderCell({ members: [GABRIEL], locked: true });

      expect(screen.getByText("Gabriel")).toBeInTheDocument();
    });

    it("0 membros continua mostrando 'nenhum — só rótulo' mesmo locked", () => {
      renderCell({ members: [], locked: true });

      expect(screen.getByText(st.noMembers)).toBeInTheDocument();
    });
  });
});

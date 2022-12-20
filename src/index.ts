import { Injector, elementUtils, webpack } from "replugged";
import "./main.css";

const inject = new Injector();

type TypingElementModule = Record<string, unknown> & {
  render: (this: {
    props: {
      guildId: string;
      typingUsers: Record<string, number>;
    };
  }) => React.ReactElement;
  forceUpdate: () => void;
};

type TypingSelf = Record<string, unknown> & {
  props: {
    typingUsers: Record<string, number>;
    guildId: string;
  };
};

type GetMember = Record<string, unknown> & {
  getTrueMember: (
    guildId: string,
    userId: string,
  ) => Record<string, unknown> & {
    colorString: string | null;
  };
};

let getTrueMember: GetMember["getTrueMember"];

export async function start(): Promise<void> {
  const rawMod = await webpack.waitForModule(webpack.filters.byProps("getTrueMember", "getMember"));
  const mod = webpack.getExportsForProps<"getTrueMember", GetMember>(rawMod, ["getTrueMember"])!;
  getTrueMember = mod.getTrueMember;

  void injectTyping();
}

export async function injectTyping(): Promise<void> {
  const typingModule = elementUtils.getOwnerInstance<TypingElementModule>(
    await elementUtils.waitFor(".typing-2J1mQU"),
  );

  inject.after(typingModule, "render", (_args, res, origSelf) => {
    const typingChildren = res?.props?.children?.[0]?.props?.children?.[1];
    if (!typingChildren) return res;

    const self = origSelf as unknown as TypingSelf;

    // todo filter blocked
    const users = Object.keys(self.props.typingUsers);
    const { guildId } = self.props;
    if (!guildId) return res;

    users.forEach((user, i) => {
      const member = getTrueMember(guildId, user);
      if (!member || !member.colorString) return;
      const el = res.props.children[0].props.children[1].props.children[i * 2];
      if (!el || !el.props) return;
      el.props.className = "role-color-colored";
      el.props.style = { "--color": member.colorString };
    });

    return res;
  });

  typingModule.forceUpdate();
}

export function stop(): void {
  inject.uninjectAll();
}

import { Injector, common, types, util, webpack } from "replugged";
const { React } = common;
import "./main.css";
import { hexToRgba } from "./util";

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

interface State {
  prevCapture: RegExpExecArray | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Rule<T = any> {
  order: number;
  match: (source: string, state: State) => RegExpExecArray | null;
  parse: (match: RegExpExecArray) => T;
  react: (props: T) => React.ReactElement;
}

interface Parser {
  parse: (args: unknown) => React.ReactElement;
  reactParserFor(rules: Record<string, Rule>): (args: unknown) => React.ReactElement;
  defaultRules: Record<string, Rule>;
}

let getTrueMember: GetMember["getTrueMember"];

export async function start(): Promise<void> {
  const rawMod = await webpack.waitForModule(webpack.filters.byProps("getTrueMember", "getMember"));
  const mod = webpack.getExportsForProps<"getTrueMember", GetMember>(rawMod, ["getTrueMember"])!;
  getTrueMember = mod.getTrueMember;

  void injectTyping();
  void injectUserMentions();
}

async function injectTyping(): Promise<void> {
  const typingModule = util.getOwnerInstance<TypingElementModule>(
    await util.waitFor(".typing-2J1mQU"),
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

async function injectUserMentions(): Promise<void> {
  const parser = await webpack.waitForModule<types.ModuleExports & Parser>(
    webpack.filters.byProps("parse", "parseTopic"),
  );

  inject.after(parser.defaultRules.mention, "react", ([{ userId, guildId }], res) => {
    if (!guildId) return res;
    const member = getTrueMember(guildId, userId);
    if (!member || !member.colorString) return res;
    if (!res || !res.props) return res;
    res = React.createElement(
      "span",
      {
        style: {
          "--color": member.colorString,
          "--hovered-color": member.colorString,
          "--background-color": hexToRgba(member.colorString, 0.1),
          "--hover-background-color": hexToRgba(member.colorString, 0.2),
        },
        className: "role-color-colored",
      },
      res,
    );
    return res;
  });
}

export function stop(): void {
  inject.uninjectAll();
}

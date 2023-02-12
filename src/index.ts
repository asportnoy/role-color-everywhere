import { Injector, common, types, util, webpack } from "replugged";
const { waitForProps } = webpack;
const {
  React,
  users: { getUser, getCurrentUser, getTrueMember },
} = common;
import "./main.css";
import { hexToRgba } from "./util";

const inject = new Injector();

type TypingElementModule = Record<string, unknown> & {
  render: (this: {
    props: {
      guildId: string;
      typingUsers: Record<string, number>;
    };
  }) => React.ReactElement & {
    classList?: string;
  };
  forceUpdate: () => void;
};

type TypingSelf = Record<string, unknown> & {
  props: {
    typingUsers: Record<string, number>;
    guildId: string;
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

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type BlockedStore = {
  isBlocked: (userId: string) => boolean;
  isFriend: (userId: string) => boolean;
};

let isBlocked: BlockedStore["isBlocked"];

let stopped = false;

export async function start(): Promise<void> {
  const blockedStore = await waitForProps<keyof BlockedStore, BlockedStore>(
    "isBlocked",
    "isFriend",
  );
  isBlocked = blockedStore.isBlocked;

  void injectTyping();
  void injectUserMentions();
}

async function injectTyping(): Promise<void> {
  const el = await util.waitFor(".typing-2J1mQU:not(.role-color-injected)");
  if (stopped) return;
  el.classList.add("role-color-injected");
  try {
    gotTypingElement(el);
  } catch {}
  await injectTyping();
}

let typingMod: TypingElementModule;
let typingInjections: Array<() => void> = [];

function gotTypingElement(element: Element): void {
  const typingModule = util.getOwnerInstance(element) as TypingElementModule;
  if (!typingModule) return;
  if (typingMod === typingModule) return;
  typingInjections.forEach((x) => x());
  typingMod = typingModule;

  const uninject = inject.after(typingModule, "render", (_args, res, origSelf) => {
    if (!res.classList) res.classList = "";
    if (!res.classList.includes("role-color-injected")) res.classList += ` role-color-injected`;

    const typingChildren = res?.props?.children?.[0]?.props?.children?.[1];
    if (!typingChildren) return res;

    const self = origSelf as unknown as TypingSelf;

    const currentUserId = getCurrentUser().id;

    const users = Object.keys(self.props.typingUsers).filter(
      (x) => x !== currentUserId && !isBlocked(x),
    );

    const { guildId } = self.props;
    if (!guildId) return res;

    users.forEach((user, i) => {
      const el = res.props.children[0].props.children[1].props.children[i * 2];
      if (!el || !el.props) return;
      const member = getTrueMember(guildId, user);
      if (!member || !member.colorString) return;
      el.props.className = "role-color-colored";
      el.props.style = { "--color": member.colorString };
    });

    return res;
  });

  typingInjections.push(uninject);
  typingModule.forceUpdate();
}

async function injectUserMentions(): Promise<void> {
  const parser = await webpack.waitForModule<types.ModuleExports & Parser>(
    webpack.filters.byProps("parse", "parseTopic"),
  );

  inject.after(parser.defaultRules.mention, "react", ([{ userId, guildId }], res) => {
    if (!guildId) return res;
    const member = getTrueMember(guildId, userId);
    if (!member) {
      const user = getUser(userId);
      if (!user) return res;

      return React.createElement(
        "span",
        {
          className: "role-color-missing",
        },
        res,
      );
    }
    if (!member.colorString) return res;
    if (!res || !res.props) return res;
    return React.createElement(
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
  });
}

export function stop(): void {
  stopped = true;
  inject.uninjectAll();
}

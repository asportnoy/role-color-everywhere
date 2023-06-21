import { Injector, Logger, common, settings, util, webpack } from "replugged";
const { filters, waitForModule, waitForProps } = webpack;
const {
  React,
  parser,
  users: { getUser, getCurrentUser, getTrueMember },
} = common;
import "./main.css";
import { hexToRgba } from "./util";
import { User } from "discord-types/general";

interface Settings {
  typingUser?: boolean;
  userMentions?: boolean;
  voiceUsers?: boolean;
}

const defaultSettings = {
  typingUser: true,
  userMentions: true,
  voiceUsers: true,
} satisfies Settings;

export const cfg = await settings.init<Settings, keyof typeof defaultSettings>(
  "dev.albertp.RoleColorEverywhere",
  defaultSettings,
);

const logger = Logger.plugin("RoleColorEverywhere");

export { Settings } from "./Settings";

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

type BlockedStore = {
  isBlocked: (userId: string) => boolean;
  isFriend: (userId: string) => boolean;
};

let isBlocked: BlockedStore["isBlocked"];

let stopped = false;

export async function start(): Promise<void> {
  const blockedStore = await waitForProps<BlockedStore>("isBlocked", "isFriend");
  isBlocked = blockedStore.isBlocked;

  void injectTyping();
  void injectUserMentions();
  void injectVoiceUsers();
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
    if (!cfg.get("typingUser")) return res;

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
      if (!el?.props) return;
      const member = getTrueMember(guildId, user);
      if (!member?.colorString) return;
      el.props.className = "role-color-colored";
      el.props.style = { "--color": member.colorString };
    });

    return res;
  });

  typingInjections.push(uninject);
  typingModule.forceUpdate();
}

function injectUserMentions(): void {
  inject.after(parser.defaultRules.mention, "react", (args, res) => {
    if (!cfg.get("userMentions")) return res;
    const [{ userId, guildId }] = args as [{ userId: string; guildId?: string }];
    if (!guildId) return res;
    const member = getTrueMember(guildId, userId);
    if (!member) {
      const user = getUser(userId);
      if (!user) return res;

      return <span className="role-color-missing">{res}</span>;
    }
    if (!member.colorString) return res;
    if (!res?.props) return res;
    return (
      <span
        style={
          {
            "--color": member.colorString,
            "--hovered-color": member.colorString,
            "--background-color": hexToRgba(member.colorString, 0.1),
            "--hover-background-color": hexToRgba(member.colorString, 0.2),
          } as React.CSSProperties
        }
        className="role-color-colored">
        {res}
      </span>
    );
  });
}

async function injectVoiceUsers(): Promise<void> {
  const voiceUserMod = await waitForModule<Record<string, Function>>(
    filters.bySource(".userNameClassName"),
  );
  const voiceUserModExport = Object.values(voiceUserMod).find(
    (x) =>
      "defaultProps" in x &&
      x.defaultProps &&
      typeof x.defaultProps === "object" &&
      "userNameClassName" in x.defaultProps,
  );
  if (!voiceUserModExport) {
    logger.error("Failed to find voice user module");
    return;
  }

  inject.after(voiceUserModExport.prototype, "renderName", (_args, res) => {
    if (!cfg.get("voiceUsers")) return res;
    const { guildId, user }: { guildId: string; user: User } = res._owner.pendingProps;
    const member = getTrueMember(guildId, user.id);
    if (!member) return res;
    if (!member.colorString) return res;
    res.props.style = { "--color": member.colorString };
    res.props.className += " role-color-colored";
    return res;
  });
}

export function stop(): void {
  stopped = true;
  inject.uninjectAll();
}

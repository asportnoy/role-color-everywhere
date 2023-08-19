import { Injector, Logger, common, settings, webpack } from "replugged";
const { filters, waitForModule, waitForProps } = webpack;
const {
  React,
  parser,
  users: { getUser, getCurrentUser, getTrueMember },
} = common;
import "./main.css";
import { hexToRgba } from "./util";
import type { User } from "discord-types/general";
import type { HTMLAttributes } from "react";
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

type BlockedStore = {
  isBlocked: (userId: string) => boolean;
  isFriend: (userId: string) => boolean;
};

let isBlocked: BlockedStore["isBlocked"];

let stopped = false;

export async function start(): Promise<void> {
  const blockedStore = await waitForProps<BlockedStore>("isBlocked", "isFriend");
  isBlocked = blockedStore.isBlocked;

  void injectUserMentions();
  void injectVoiceUsers();
}

export function injectTyping(
  typingUsers: Record<string, number>,
  guildId: string | undefined,
  res: React.ReactElement,
): React.ReactElement | undefined {
  if (stopped) return undefined;
  if (!cfg.get("typingUser")) return undefined;
  if (!guildId) return undefined;
  if (!res || !Array.isArray(res) || res.length === 0) return res;

  const currentUserId = getCurrentUser().id;
  const users = Object.keys(typingUsers)
    .map((x) => getTrueMember(guildId, x))
    .filter((x) => x && x.userId !== currentUserId && !isBlocked(x.userId));

  const objectChildren = res.filter((x) => typeof x === "object") as Array<React.ReactElement>;
  for (const [i, element] of objectChildren.entries()) {
    const user = users[i];
    if (!user) {
      logger.error("user is undefined", { users, i });
      continue;
    }
    if (!user.colorString) continue;
    element.props.style = { "--color": user.colorString };
    element.props.className += " role-color-colored";
  }

  return res;
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
        className="role-color-colored role-color-child-colored">
        {res}
      </span>
    );
  });
}

export function injectSlateMention(id: string, guildId?: string): HTMLAttributes<HTMLDivElement> {
  if (stopped) return {};
  if (!cfg.get("userMentions")) return {};
  if (!guildId) return {};
  const member = getTrueMember(guildId, id);
  if (!member) {
    const user = getUser(id);
    if (!user) return {};

    return { className: "role-color-missing" };
  }
  if (!member.colorString) return {};
  return {
    style: {
      "--color": member.colorString,
      "--hovered-color": member.colorString,
      "--background-color": hexToRgba(member.colorString, 0.1),
      "--hover-background-color": hexToRgba(member.colorString, 0.2),
    } as React.CSSProperties,
    className: "role-color-colored role-color-child-colored",
  };
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
    if (!res) return res;
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

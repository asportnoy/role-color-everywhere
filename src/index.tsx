import { Injector, Logger, settings } from "replugged";
import { filters, waitForModule, waitForProps } from "replugged/webpack";
import { lodash as _, parser, users } from "replugged/common";

const { getUser, getCurrentUser, getTrueMember } = users;

import "./main.css";
import { hexToRgba } from "./util";
import type { Channel, User } from "discord-types/general";
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

export function start(): void {
  void injectUserMentions();
  void injectSlateMention();
  void injectVoiceUsers();
  void injectTypingUsers();
}

async function injectTypingUsers(): Promise<void> {
  const { isBlocked } = await waitForProps<BlockedStore>("isBlocked", "isFriend");

  const typingComponent = await waitForModule<{
    exports: {
      default: (props: unknown) =>
        | (Omit<React.ReactElement, "type"> & {
            props: {
              channel: Channel;
              typingUsers: Record<string, number>;
            };
            type: {
              prototype: {
                render: () => {
                  props: unknown; // Nested too deep to deal with
                } | null;
              };
            };
          })
        | null;
    };
  }>(filters.bySource(/getCooldownTextStyle\(\)/), { raw: true });

  inject.after(typingComponent.exports, "default", (_args, res) => {
    if (!cfg.get("typingUser")) return;
    if (!res) return;

    const {
      channel: { guild_id: guildId },
      typingUsers,
    } = res.props;

    if (!guildId) return;

    const uninject = inject.after(res.type.prototype, "render", (_args, res) => {
      uninject();

      const children = _.get(res?.props, "children[0].props.children[1].props.children");
      if (!Array.isArray(children)) return;

      const currentUserId = getCurrentUser().id;
      const users = Object.keys(typingUsers)
        .map((x) => getTrueMember(guildId, x))
        .filter((x) => x && x.userId !== currentUserId && !isBlocked(x.userId));
      if (!users.length) return;

      const objectChildren = children.filter(
        (x) => typeof x === "object",
      ) as Array<React.ReactElement>;
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
    });
  });
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

export async function injectSlateMention(): Promise<void> {
  const slateMod = await waitForProps<{
    UserMention: (props: { id: string; guildId?: string; channelId?: string }) => JSX.Element;
    ChannelMention: unknown;
  }>("UserMention", "ChannelMention");

  inject.after(slateMod, "UserMention", (args, res) => {
    if (!cfg.get("userMentions")) return res;

    const [{ id, guildId }] = args;
    if (!guildId) return res;
    const member = getTrueMember(guildId, id);

    let classNames = "";
    let style: React.CSSProperties = {};

    if (!member) {
      const user = getUser(id);
      if (!user) return res;

      classNames = "role-color-missing";
    } else if (member.colorString) {
      style = {
        "--color": member.colorString,
        "--hovered-color": member.colorString,
        "--background-color": hexToRgba(member.colorString, 0.1),
        "--hover-background-color": hexToRgba(member.colorString, 0.2),
      } as React.CSSProperties;
      classNames = "role-color-colored role-color-child-colored";
    }

    const removeChildInject = inject.after(res.props, "children", (_args, res) => {
      removeChildInject();

      res.props.className ??= "";
      res.props.className += classNames;
      res.props.style ??= {};
      Object.assign(res.props.style, style);
    });

    return res;
  });
}

async function injectVoiceUsers(): Promise<void> {
  const voiceUserMod = await waitForProps<{
    VoiceUserList: unknown;
    default: {
      prototype: {
        renderName: (args: unknown) => React.ReactElement & {
          _owner: {
            pendingProps: {
              guildId: string;
              user: User;
            };
          };
        };
      };
    };
  }>("VoiceUserList", "default");

  inject.after(voiceUserMod.default.prototype, "renderName", (_args, res) => {
    if (!cfg.get("voiceUsers")) return res;
    if (!res) return res;
    const { guildId, user } = res._owner.pendingProps;
    const member = getTrueMember(guildId, user.id);
    if (!member) return res;
    if (!member.colorString) return res;
    res.props.style = { "--color": member.colorString };
    res.props.className += " role-color-colored";
    return res;
  });
}

export function stop(): void {
  inject.uninjectAll();
}

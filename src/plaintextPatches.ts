import { PlaintextPatch } from "replugged/dist/types";

const pluginExports = `window.replugged.plugins.getExports('dev.albertp.RoleColorEverywhere')`;

const patches: PlaintextPatch[] = [
  {
    find: /slate-toolbar/g,
    replacements: [
      {
        match:
          /(var (\w+)=\w+\.id,(\w+)=\w+\.guildId,\w+=\w+\.channelId[\s\S]{500,750}?[\s]*?"aria-label":\w+\.\w+\.getUserTag\(\w+,{[^}]+}\),children:.{50,100}?{)(children:\w+}\)\)})/g,
        replace: (_, prefix, id, guildId, suffix) =>
          `${prefix}...(${pluginExports}?.injectSlateMention(${id}, ${guildId}) ?? {}),${suffix}`,
      },
    ],
  },
  {
    find: /Messages\.SEVERAL_USERS_TYPING/g,
    replacements: [
      {
        match:
          /((\w+)=\w+\.guildId.{0,100}?(\w+)=\w+\.typingUsers[\s\S]{1600,1700}?SEVERAL_USERS_TYPING;[\s\S]{250,300}?{className:\w+\(\)\.text,"aria-live":"polite","aria-atomic":!0,children:)(\w+)(})/g,
        replace: (_, prefix, guild, typingUsers, res, suffix) =>
          `${prefix}(${pluginExports}?.injectTyping(${typingUsers}, ${guild}, ${res}) ?? res)${suffix}`,
      },
    ],
  },
];

export default patches;

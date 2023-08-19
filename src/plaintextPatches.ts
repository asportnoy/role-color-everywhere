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
          `${prefix}...${pluginExports}.injectSlateMention(${id}, ${guildId}),${suffix}`,
      },
    ],
  },
];

export default patches;

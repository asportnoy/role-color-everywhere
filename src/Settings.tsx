import { cfg } from ".";
import { components, util } from "replugged";
const { SwitchItem } = components;

export function Settings(): React.ReactElement {
  return (
    <div>
      <SwitchItem {...util.useSetting(cfg, "typingUser")}>Color Typing Indicators</SwitchItem>
      <SwitchItem {...util.useSetting(cfg, "userMentions")}>Color User Mentions</SwitchItem>
      <SwitchItem {...util.useSetting(cfg, "voiceUsers")}>Color Voice Channel Users</SwitchItem>
    </div>
  );
}

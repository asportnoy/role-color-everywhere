import { cfg } from ".";
import { util } from "replugged";
import { SwitchItem } from "replugged/components";

// TODO: remove this when replugged is fixed
const FixedSwitchItem = SwitchItem as unknown as React.ComponentClass;

export function Settings(): React.ReactElement {
  return (
    <div>
      <FixedSwitchItem {...util.useSetting(cfg, "typingUser")}>
        Color Typing Indicators
      </FixedSwitchItem>
      <FixedSwitchItem {...util.useSetting(cfg, "userMentions")}>
        Color User Mentions
      </FixedSwitchItem>
      <FixedSwitchItem {...util.useSetting(cfg, "voiceUsers")}>
        Color Voice Channel Users
      </FixedSwitchItem>
    </div>
  );
}

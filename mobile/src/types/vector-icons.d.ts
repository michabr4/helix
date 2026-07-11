declare module "react-native-vector-icons/MaterialCommunityIcons" {
  import type { ComponentType } from "react";
  import type { TextProps } from "react-native";
  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }
  const Icon: ComponentType<IconProps>;
  export default Icon;
}

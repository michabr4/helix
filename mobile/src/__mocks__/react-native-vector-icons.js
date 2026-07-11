// Stub for react-native-vector-icons — returns a simple View for any icon
const React = require("react");
const { View } = require("react-native");
const Icon = () => React.createElement(View, null);
Icon.Button = () => React.createElement(View, null);
Icon.getImageSource = () => Promise.resolve({});
Icon.getRawGlyphMap = () => ({});
module.exports = Icon;

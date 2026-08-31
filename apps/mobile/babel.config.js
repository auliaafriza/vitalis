module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last: react-native-worklets rewrites worklet functions and
    // relies on running after every other transform. reanimated 4 (a peer
    // dependency of expo-router) does not work without it.
    plugins: ['react-native-worklets/plugin'],
  };
};

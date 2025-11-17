export type EnvInfo = {
  userAgent: string;
  platform: string;
};

export const getModCombo = (env: EnvInfo, key: string): string => {
  const isMac =
    env.platform?.toLowerCase().includes('mac') ||
    env.userAgent?.toLowerCase().includes('mac');
  const modifier = isMac ? 'Meta' : 'Control';
  return `${modifier}+${key}`;
};

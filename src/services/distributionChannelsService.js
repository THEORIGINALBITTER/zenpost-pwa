export const DISTRIBUTION_CHANNELS = [
  { id: 'blog', label: 'Blog', color: '#8a6b3f' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0077B5' },
  { id: 'twitter', label: 'X', color: '#111111' },
  { id: 'reddit', label: 'Reddit', color: '#FF4500' },
  { id: 'github', label: 'GitHub', color: '#181717' },
  { id: 'devto', label: 'Dev.to', color: '#0A0A0A' },
  { id: 'medium', label: 'Medium', color: '#00AB6C' },
  { id: 'hashnode', label: 'Hashnode', color: '#2962FF' },
];

export function getDistributionChannels() {
  return DISTRIBUTION_CHANNELS;
}

export function getChannelLabel(channelId) {
  const hit = DISTRIBUTION_CHANNELS.find((item) => item.id === channelId);
  return hit?.label || 'Blog';
}

export function getChannelInfo(channelId) {
  return DISTRIBUTION_CHANNELS.find((item) => item.id === channelId) || DISTRIBUTION_CHANNELS[0];
}

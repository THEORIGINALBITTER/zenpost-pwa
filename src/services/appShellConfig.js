export const DEFAULT_FOOTER_ACTION = Object.freeze({
  plusLabel: 'Neu erstellen',
  plusSymbol: '+',
  onPlus: null,
});

export function resolveFooterAction(customAction) {
  if (!customAction) return DEFAULT_FOOTER_ACTION;
  return {
    plusLabel: customAction.plusLabel || DEFAULT_FOOTER_ACTION.plusLabel,
    plusSymbol: customAction.plusSymbol || DEFAULT_FOOTER_ACTION.plusSymbol,
    onPlus: typeof customAction.onPlus === 'function' ? customAction.onPlus : null,
  };
}

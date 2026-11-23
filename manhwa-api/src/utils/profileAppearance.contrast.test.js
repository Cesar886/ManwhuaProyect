const PRESETS = [
  ['amanecer', '#FFE5D4', '#FFC4D6', '#1A1A2E', '#5A3A3F', '#6B3A50'],
  ['sakura', '#FFD6E8', '#E4D4FF', '#1A1A2E', '#5C3A55', '#3F3566'],
  ['cielo', '#D6F1FF', '#F4FBFF', '#1A1A2E', '#1F3A4D', '#16283A'],
  ['menta', '#D4F5E9', '#A8E6CF', '#1A1A2E', '#1F4D40', '#1A3A33'],
  ['oro-imperial', '#FFF1C1', '#E8B94A', '#1A1A2E', '#5E4A14', '#3F3010'],
  ['lavanda', '#E6DEFF', '#B9A7F5', '#1A1A2E', '#3F3566', '#2C2550'],
  ['atardecer', '#FFB88C', '#B57BEE', '#1A1A2E', '#7A4A38', '#4A2F73'],
  ['oceano', '#3E7C9A', '#1F4E6E', '#FFFFFF', '#3E7C9A', '#1F4E6E'],
  ['bosque', '#3F7D58', '#234B35', '#FFFFFF', '#3F7D58', '#234B35'],
  ['rubi', '#C73A5E', '#8E1B3A', '#FFFFFF', '#C73A5E', '#8E1B3A'],
  ['medianoche', '#2B3A67', '#1A1A3E', '#FFFFFF', '#2B3A67', '#1A1A3E'],
  ['neon-sistema', '#3A0CA3', '#1A6FCB', '#FFFFFF', '#3A0CA3', '#1A6FCB'],
];

function luminance(hex) {
  const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(text, background) {
  const a = luminance(text);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('profile preset text contrast', () => {
  test.each(PRESETS)('%s meets AA 4.5:1 in light and dark modes', (
    key, lightFrom, lightTo, lightText, darkFrom, darkTo,
  ) => {
    expect(Math.min(contrast(lightText, lightFrom), contrast(lightText, lightTo))).toBeGreaterThanOrEqual(4.5);
    expect(Math.min(
      contrast('#FFFFFF', darkFrom),
      contrast('#FFFFFF', darkTo),
    )).toBeGreaterThanOrEqual(4.5);
  });
});

const ACCENT_PRESETS = [
  ['amanecer', '#C35E78', '#451A27'],
  ['sakura', '#D96BA0', '#57233F'],
  ['cielo', '#3798CD', '#0F3852'],
  ['menta', '#29A379', '#0D3E2E'],
  ['oro-imperial', '#B88A17', '#483409'],
  ['lavanda', '#8E74E8', '#322562'],
  ['atardecer', '#D9683F', '#4F2313'],
  ['oceano', '#3E8DB5', '#113142'],
  ['bosque', '#3F9467', '#153323'],
  ['rubi', '#D0456B', '#3D101D'],
  ['medianoche', '#5B6EE0', '#181F48'],
  ['neon-sistema', '#5B7CFA', '#1C2964'],
];

function mixHex(hex, other, ratio) {
  const parse = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const channels = parse(hex);
  const otherChannels = parse(other);
  return '#' + channels.map((value, index) =>
    Math.round(value * (1 - ratio) + otherChannels[index] * ratio)
      .toString(16).padStart(2, '0'),
  ).join('');
}

describe('profile accent contrast', () => {
  test.each(ACCENT_PRESETS)('%s meets accent contrast in light mode', (key, accent, accentText) => {
    const soft = mixHex(accent, '#FFFFFF', 0.14);
    expect(contrast(accent, '#F8FAFC')).toBeGreaterThanOrEqual(3);
    expect(contrast(accentText, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accentText, soft)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(ACCENT_PRESETS)('%s meets accent contrast in dark mode', (key, accent) => {
    const darkAccent = mixHex(accent, '#FFFFFF', 0.15);
    const darkAccentText = '#FFFFFF';
    const darkSoft = mixHex(darkAccent, '#141414', 0.80);
    expect(contrast(darkAccent, '#141414')).toBeGreaterThanOrEqual(3);
    expect(contrast(darkAccentText, '#141414')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkAccentText, darkSoft)).toBeGreaterThanOrEqual(4.5);
  });
});

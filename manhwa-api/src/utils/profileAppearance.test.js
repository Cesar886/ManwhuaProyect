const { validateProfileAppearance, ALLOWED_PROFILE_BACKGROUNDS, ALLOWED_PROFILE_TEXTURES } = require('./profileAppearance');

describe('profile appearance validation', () => {
  test.each([
    ['profileBackground', 'sakura', ALLOWED_PROFILE_BACKGROUNDS],
    ['profileTexture', 'puntos', ALLOWED_PROFILE_TEXTURES],
  ])('accepts a valid %s', (field, value, allowed) => {
    expect(validateProfileAppearance(field, value, allowed)).toBeNull();
  });

  test.each([
    ['profileBackground', 'no-existe', ALLOWED_PROFILE_BACKGROUNDS],
    ['profileTexture', 'no-existe', ALLOWED_PROFILE_TEXTURES],
  ])('rejects an invalid %s', (field, value, allowed) => {
    expect(validateProfileAppearance(field, value, allowed)).toEqual({
      field,
      message: expect.stringContaining(field),
    });
  });

  test('accepts null', () => {
    expect(validateProfileAppearance('profileBackground', null, ALLOWED_PROFILE_BACKGROUNDS)).toBeNull();
    expect(validateProfileAppearance('profileTexture', null, ALLOWED_PROFILE_TEXTURES)).toBeNull();
  });

  test('treats an absent field as unchanged', () => {
    expect(validateProfileAppearance('profileBackground', undefined, ALLOWED_PROFILE_BACKGROUNDS)).toBeNull();
    expect(validateProfileAppearance('profileTexture', undefined, ALLOWED_PROFILE_TEXTURES)).toBeNull();
  });
});

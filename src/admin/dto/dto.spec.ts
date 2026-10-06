import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ValidationFailedException } from '../../common/validation/validation-failed.exception';
import { LoginDto } from '../../auth/dto/login.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import { MoveDto, ReorderDto } from './common.dto';
import { CreateItemDto, UpdateItemDto } from './item.dto';
import { UpdateBrandingDto } from './branding.dto';
import { PriceChangeDto } from './bulk.dto';

const pipe = createValidationPipe();

async function run<T>(metatype: new () => T, body: Record<string, unknown>) {
  try {
    return { value: (await pipe.transform(body, { type: 'body', metatype })) as T };
  } catch (error) {
    if (error instanceof ValidationFailedException) return { error };
    throw error;
  }
}

describe('admin DTOs through the global pipe', () => {
  it('accepts a normal category and ignores nothing it was sent', async () => {
    const { value, error } = await run(CreateCategoryDto, {
      nameAr: 'مشروبات',
      nameEn: 'Drinks',
      csrf_token: 'x',
    });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ nameEn: 'Drinks' });
  });

  it('rejects a field the form never sends', async () => {
    const { error } = await run(CreateCategoryDto, { nameAr: 'a', nameEn: 'b', isAdmin: 'true' });
    expect(error?.fieldErrors).toHaveProperty('isAdmin');
  });

  it('rejects names over 120 characters with a message key', async () => {
    const { error } = await run(CreateCategoryDto, { nameEn: 'x'.repeat(121) });
    expect(error?.fieldErrors.nameEn).toEqual(['tooLong']);
  });

  it.each(['09:30', '23:59', ''])('accepts category time %p', async (time) => {
    const { error } = await run(UpdateCategoryDto, { availableFrom: time });
    expect(error).toBeUndefined();
  });

  it.each(['24:00', '9:30', 'noon'])('rejects category time %p', async (time) => {
    const { error } = await run(UpdateCategoryDto, { availableTo: time });
    expect(error?.fieldErrors.availableTo).toEqual(['invalidTime']);
  });

  it.each(['12', '12.50', '0', ''])('accepts item price %p', async (price) => {
    const { error } = await run(CreateItemDto, { price });
    expect(error).toBeUndefined();
  });

  it.each(['abc', '1,5', '12.', '1e3'])('rejects item price %p', async (price) => {
    const { error } = await run(CreateItemDto, { price });
    expect(error?.fieldErrors.price).toEqual(['invalidNumber']);
  });

  it('turns a single tag into an array and rejects unknown tags', async () => {
    const ok = await run(UpdateItemDto, { tags: 'SPICY' });
    expect(ok.value?.tags).toEqual(['SPICY']);
    const bad = await run(UpdateItemDto, { tags: ['SPICY', 'FREE_FOOD'] });
    expect(bad.error?.fieldErrors).toHaveProperty('tags');
  });

  it('passes indexed variant rows through for parseOptions', async () => {
    const { value } = await run(UpdateItemDto, {
      variants: { '0': { nameAr: 'a', nameEn: 'b', price: '1' } },
    });
    expect(value?.variants).toEqual({ '0': { nameAr: 'a', nameEn: 'b', price: '1' } });
  });

  it('only accepts up or down for a move', async () => {
    expect((await run(MoveDto, { direction: 'up' })).error).toBeUndefined();
    expect((await run(MoveDto, { direction: 'sideways' })).error?.fieldErrors.direction).toEqual([
      'invalidOption',
    ]);
    expect((await run(MoveDto, {})).error).toBeDefined();
  });

  it('normalises a single reorder id to an array', async () => {
    expect((await run(ReorderDto, { ids: 'abc' })).value?.ids).toEqual(['abc']);
    expect((await run(ReorderDto, { ids: ['a', 'b'] })).value?.ids).toEqual(['a', 'b']);
  });

  it('rejects branding text over its limit and unknown fields', async () => {
    expect(
      (await run(UpdateBrandingDto, { nameEn: 'x'.repeat(121) })).error?.fieldErrors.nameEn,
    ).toEqual(['tooLong']);
    expect((await run(UpdateBrandingDto, { logoPath: '/x' })).error?.fieldErrors).toHaveProperty(
      'logoPath',
    );
  });

  it('validates a bulk percent', async () => {
    expect((await run(PriceChangeDto, { percent: '-10' })).error).toBeUndefined();
    expect((await run(PriceChangeDto, { percent: 'ten' })).error?.fieldErrors.percent).toEqual([
      'invalidNumber',
    ]);
  });

  it('never echoes a password back in the failed values', async () => {
    const { error } = await run(LoginDto, { email: 'x'.repeat(300), password: 'secret' });
    expect(error?.fieldErrors.email).toEqual(['tooLong']);
    expect(error?.values).not.toHaveProperty('password');
    expect(error?.values.email).toBe('x'.repeat(300));
  });
});

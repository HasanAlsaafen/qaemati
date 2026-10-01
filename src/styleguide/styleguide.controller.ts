import { Controller, Get, Render } from '@nestjs/common';

@Controller('styleguide')
export class StyleguideController {
  @Get()
  @Render('pages/styleguide')
  index() {
    const sampleItem = {
      id: 'sample-1',
      name: 'Manakeesh Zaatar',
      description: 'Fresh-baked flatbread topped with zaatar, olive oil, and sesame.',
      price: '18',
      currency: 'ILS',
      imageUrl:
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" fill="%23E7EEDF"/%3E%3C/svg%3E',
      tags: [
        { label: 'Vegetarian', variant: 'primary' },
        { label: 'Popular', variant: 'popular' },
      ],
      available: true,
    };
    const unavailableItem = {
      ...sampleItem,
      id: 'sample-2',
      name: 'Knafeh Nabulsieh',
      description: 'Warm, cheesy, syrup-soaked semolina pastry.',
      tags: [{ label: 'New', variant: 'secondary' }],
      available: false,
    };

    return {
      sampleItem,
      unavailableItem,
      selectOptions: [
        { value: 'ils', label: 'ILS' },
        { value: 'jod', label: 'JOD' },
        { value: 'usd', label: 'USD' },
      ],
    };
  }
}

export type SeedTag = 'SPICY' | 'VEGETARIAN' | 'NEW' | 'POPULAR';

export interface SeedItem {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
  tags?: SeedTag[];
  available?: boolean;
  isTodaysSpecial?: boolean;
}

export interface SeedCategory {
  nameAr: string;
  nameEn: string;
  /** A3: optional daily window, "HH:MM" 24h. Both set or both omitted. */
  availableFrom?: string;
  availableTo?: string;
  /** Key of one of the restaurant's menus. Omitted means the first menu. */
  menu?: string;
  items: SeedItem[];
}

export interface SeedMenu {
  key: string;
  nameAr: string;
  nameEn: string;
  /** "HH:MM" 24h. Both set or both omitted. */
  availableFrom?: string;
  availableTo?: string;
}

export interface SeedContact {
  taglineAr: string;
  taglineEn: string;
  phone: string;
  facebookUrl: string;
  addressAr: string;
  addressEn: string;
  mapUrl: string;
}

export interface SeedRestaurant {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  currency: string;
  whatsapp: string;
  instagramHandle: string;
  workingHoursAr: string;
  workingHoursEn: string;
  contact?: SeedContact;
  /** Omitted means a single menu called Main menu. */
  menus?: SeedMenu[];
  /** A3: structured daily hours, "HH:MM" 24h, Asia/Hebron -- see the
   *  schema comment on Restaurant.openTime for why this is separate from
   *  the free-text workingHoursAr/En above. */
  openTime?: string;
  closeTime?: string;
  /** A4: hex color overriding the default Zaytoun palette for this
   *  restaurant's own public menu. Omitted means "use the default." */
  primaryColor?: string;
  adminEmail: string;
  adminName: string;
  categories: SeedCategory[];
}

export const seedRestaurants: SeedRestaurant[] = [
  {
    slug: 'bayt-al-zaytoun',
    nameAr: 'بيت الزيتون',
    nameEn: 'Bayt Al-Zaytoun',
    descriptionAr: 'مقهى دافئ لمحبي القهوة المختصة والمناقيش الطازجة في قلب المدينة.',
    descriptionEn: 'A warm neighborhood cafe for specialty coffee and fresh manakeesh.',
    currency: 'ILS',
    whatsapp: '+970599000111',
    instagramHandle: '@baytalzaytoun',
    workingHoursAr: 'يوميًا من 7 صباحًا حتى 11 مساءً',
    workingHoursEn: 'Daily, 7:00 AM - 11:00 PM',
    menus: [
      {
        key: 'breakfast',
        nameAr: 'الفطور',
        nameEn: 'Breakfast',
        availableFrom: '07:00',
        availableTo: '12:00',
      },
      { key: 'allday', nameAr: 'طوال اليوم', nameEn: 'All day' },
    ],
    contact: {
      taglineAr: 'قهوة على مهلها، ومناقيش طازجة',
      taglineEn: 'Slow coffee and fresh manakeesh',
      phone: '+970 2 000 0111',
      facebookUrl: 'baytalzaytoun',
      addressAr: 'وسط البلد، الخليل',
      addressEn: 'Downtown, Hebron',
      mapUrl: 'https://www.openstreetmap.org/search?query=Hebron',
    },
    openTime: '07:00',
    closeTime: '23:00',
    adminEmail: 'admin@baytalzaytoun.example.com',
    adminName: 'Lina Qasem',
    categories: [
      {
        nameAr: 'مشروبات ساخنة',
        nameEn: 'Hot Drinks',
        menu: 'allday',
        items: [
          {
            nameAr: 'قهوة عربية',
            nameEn: 'Arabic Coffee',
            descriptionAr: 'قهوة عربية أصيلة محمصة بالهيل، تقدم في دلة نحاسية.',
            descriptionEn: 'Traditional cardamom-spiced Arabic coffee, served in a brass dallah.',
            price: 12,
            tags: ['POPULAR'],
          },
          {
            nameAr: 'قهوة تركية',
            nameEn: 'Turkish Coffee',
            descriptionAr: 'قهوة تركية مطحونة ناعمًا ومطبوخة ببطء على نار هادئة.',
            descriptionEn: 'Finely ground coffee, slow-brewed the traditional way.',
            price: 11,
          },
          {
            nameAr: 'كابتشينو',
            nameEn: 'Cappuccino',
            descriptionAr: 'إسبريسو مع حليب مبخر ورغوة كثيفة.',
            descriptionEn: 'Espresso with steamed milk and a thick layer of foam.',
            price: 16,
          },
          {
            nameAr: 'لاتيه إسباني',
            nameEn: 'Spanish Latte',
            descriptionAr: 'إسبريسو مع حليب مكثف محلى وحليب مبخر.',
            descriptionEn: 'Espresso with sweetened condensed milk and steamed milk.',
            price: 18,
            tags: ['NEW'],
          },
          {
            nameAr: 'شوكولاتة ساخنة',
            nameEn: 'Hot Chocolate',
            descriptionAr: 'شوكولاتة بلجيكية غنية مع كريمة مخفوقة.',
            descriptionEn: 'Rich Belgian chocolate topped with whipped cream.',
            price: 17,
          },
        ],
      },
      {
        nameAr: 'مشروبات باردة',
        nameEn: 'Cold Drinks',
        menu: 'allday',
        items: [
          {
            nameAr: 'آيس لاتيه',
            nameEn: 'Iced Latte',
            descriptionAr: 'إسبريسو مثلج مع حليب بارد.',
            descriptionEn: 'Chilled espresso over cold milk and ice.',
            price: 18,
          },
          {
            nameAr: 'ليمون بالنعناع',
            nameEn: 'Mint Lemonade',
            descriptionAr: 'ليمون طازج مع نعناع مطحون ومثلجات.',
            descriptionEn: 'Fresh lemon juice blended with mint and ice.',
            price: 14,
            tags: ['POPULAR', 'VEGETARIAN'],
          },
          {
            nameAr: 'عصير برتقال طازج',
            nameEn: 'Fresh Orange Juice',
            descriptionAr: 'عصير برتقال طبيعي معصور يوميًا.',
            descriptionEn: 'Naturally squeezed orange juice, fresh daily.',
            price: 15,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'آيس ماتشا',
            nameEn: 'Iced Matcha',
            descriptionAr: 'ماتشا يابانية مع حليب بارد وقليل من السكر.',
            descriptionEn: 'Japanese matcha whisked with cold milk, lightly sweetened.',
            price: 19,
            tags: ['NEW'],
          },
          {
            nameAr: 'سموذي التوت',
            nameEn: 'Berry Smoothie',
            descriptionAr: 'مزيج من التوت الطازج والزبادي.',
            descriptionEn: 'A blend of fresh berries and yogurt.',
            price: 20,
            available: false,
          },
        ],
      },
      {
        nameAr: 'فطور',
        nameEn: 'Breakfast',
        menu: 'breakfast',
        availableFrom: '07:00',
        availableTo: '11:00',
        items: [
          {
            nameAr: 'شكشوكة',
            nameEn: 'Shakshuka',
            descriptionAr: 'بيض مطهو في صلصة طماطم وفلفل حار مع خبز طازج.',
            descriptionEn: 'Eggs poached in a spiced tomato and pepper sauce, served with bread.',
            price: 28,
            tags: ['SPICY', 'VEGETARIAN', 'POPULAR'],
            isTodaysSpecial: true,
          },
          {
            nameAr: 'بانكيك بالعسل',
            nameEn: 'Pancakes with Honey',
            descriptionAr: 'بانكيك طري مع عسل طبيعي وقطع فواكه.',
            descriptionEn: 'Fluffy pancakes with natural honey and fruit.',
            price: 24,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'فول مدمس',
            nameEn: 'Foul Medammes',
            descriptionAr: 'فول مطهو مع زيت زيتون وليمون وثوم.',
            descriptionEn: 'Slow-cooked fava beans with olive oil, lemon, and garlic.',
            price: 20,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'طبق لبنة وزعتر',
            nameEn: 'Labneh & Zaatar Plate',
            descriptionAr: 'لبنة كريمية مع زيت زيتون وزعتر بلدي وخبز طازج.',
            descriptionEn: 'Creamy labneh with olive oil, wild zaatar, and fresh bread.',
            price: 22,
            tags: ['VEGETARIAN'],
          },
        ],
      },
      {
        nameAr: 'مناقيش ومعجنات',
        nameEn: 'Manakeesh & Savory Pastries',
        menu: 'breakfast',
        items: [
          {
            nameAr: 'مناقيش زعتر',
            nameEn: 'Manakeesh Zaatar',
            descriptionAr: 'عجينة طازجة مغطاة بالزعتر البلدي وزيت الزيتون.',
            descriptionEn: 'Fresh-baked flatbread topped with wild zaatar and olive oil.',
            price: 15,
            tags: ['VEGETARIAN', 'POPULAR'],
          },
          {
            nameAr: 'مناقيش جبنة',
            nameEn: 'Manakeesh Cheese',
            descriptionAr: 'عجينة طازجة مغطاة بالجبنة البلدية.',
            descriptionEn: 'Fresh-baked flatbread topped with melted local cheese.',
            price: 18,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'مناقيش حلوم وزعتر',
            nameEn: 'Manakeesh Halloumi & Zaatar',
            descriptionAr: 'مزيج من الحلوم المشوي والزعتر البلدي.',
            descriptionEn: 'Grilled halloumi and wild zaatar on fresh-baked dough.',
            price: 20,
            tags: ['VEGETARIAN', 'NEW'],
          },
          {
            nameAr: 'سمبوسك جبنة',
            nameEn: 'Cheese Sambousek',
            descriptionAr: 'عجينة مقرمشة محشوة بالجبنة.',
            descriptionEn: 'Crisp pastry filled with cheese.',
            price: 16,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'فطاير سبانخ',
            nameEn: 'Spinach Fatayer',
            descriptionAr: 'فطاير محشوة بالسبانخ والبصل والسماق.',
            descriptionEn: 'Pastry triangles filled with spinach, onion, and sumac.',
            price: 16,
            tags: ['VEGETARIAN'],
          },
        ],
      },
      {
        nameAr: 'ساندويشات',
        nameEn: 'Sandwiches',
        menu: 'allday',
        items: [
          {
            nameAr: 'ساندويش حلوم',
            nameEn: 'Halloumi Sandwich',
            descriptionAr: 'حلوم مشوي مع خضار طازجة في خبز فرنسي.',
            descriptionEn: 'Grilled halloumi with fresh vegetables in French bread.',
            price: 22,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'ساندويش فلافل',
            nameEn: 'Falafel Sandwich',
            descriptionAr: 'فلافل مقرمشة مع طحينة وخضار في خبز عربي.',
            descriptionEn: 'Crispy falafel with tahini and vegetables in Arabic bread.',
            price: 16,
            tags: ['VEGETARIAN', 'POPULAR'],
          },
          {
            nameAr: 'ساندويش خضار مشوية',
            nameEn: 'Grilled Vegetable Sandwich',
            descriptionAr: 'خضار موسمية مشوية مع صلصة الثوم.',
            descriptionEn: 'Seasonal grilled vegetables with garlic sauce.',
            price: 18,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'ساندويش شاورما دجاج',
            nameEn: 'Chicken Shawarma Sandwich',
            descriptionAr: 'شاورما دجاج متبلة مع صلصة الثوم والمخللات.',
            descriptionEn: 'Marinated chicken shawarma with garlic sauce and pickles.',
            price: 24,
            tags: ['SPICY'],
          },
        ],
      },
      {
        nameAr: 'حلويات',
        nameEn: 'Sweets & Desserts',
        menu: 'allday',
        items: [
          {
            nameAr: 'كنافة نابلسية',
            nameEn: 'Knafeh Nabulsieh',
            descriptionAr: 'كنافة دافئة بالجبنة مغطاة بالقطر.',
            descriptionEn: 'Warm, cheesy, syrup-soaked semolina pastry.',
            price: 22,
            tags: ['POPULAR'],
          },
          {
            nameAr: 'تشكيلة بقلاوة',
            nameEn: 'Baklava Assortment',
            descriptionAr: 'تشكيلة من البقلاوة بالفستق واللوز.',
            descriptionEn: 'An assortment of pistachio and almond baklava.',
            price: 24,
          },
          {
            nameAr: 'معمول',
            nameEn: 'Maamoul',
            descriptionAr: 'كعك محشو بالتمر والجوز، مرشوش بالسكر الناعم.',
            descriptionEn: 'Date and walnut-filled shortbread, dusted with powdered sugar.',
            price: 18,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'كيك الشوكولاتة الذائبة',
            nameEn: 'Chocolate Lava Cake',
            descriptionAr: 'كيك شوكولاتة دافئ بقلب سائل.',
            descriptionEn: 'Warm chocolate cake with a molten center.',
            price: 26,
            tags: ['VEGETARIAN', 'NEW'],
          },
          {
            nameAr: 'بسبوسة',
            nameEn: 'Basbousa',
            descriptionAr: 'كيك السميد التقليدي المنقوع بالقطر.',
            descriptionEn: 'Traditional semolina cake soaked in syrup.',
            price: 15,
            tags: ['VEGETARIAN'],
          },
        ],
      },
      {
        nameAr: 'وجبات خفيفة',
        nameEn: 'Light Bites',
        menu: 'allday',
        items: [
          {
            nameAr: 'حمص مع خبز',
            nameEn: 'Hummus with Pita',
            descriptionAr: 'حمص كريمي مع زيت الزيتون وخبز طازج.',
            descriptionEn: 'Creamy hummus with olive oil and fresh pita.',
            price: 17,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'طبق زيتون وجبنة',
            nameEn: 'Olive & Cheese Plate',
            descriptionAr: 'تشكيلة زيتون بلدي مع أجبان محلية.',
            descriptionEn: 'A selection of local olives with local cheeses.',
            price: 20,
            tags: ['VEGETARIAN'],
          },
        ],
      },
    ],
  },
  {
    slug: 'al-sanabel',
    nameAr: 'السنابل',
    nameEn: 'Al-Sanabel',
    descriptionAr: 'مطعم عائلي يقدم أطباقًا شامية أصيلة من المشاوي والأرز والمقبلات.',
    descriptionEn:
      'A family restaurant serving authentic Levantine grills, rice dishes, and mezze.',
    currency: 'JOD',
    whatsapp: '+962799000222',
    instagramHandle: '@alsanabel.restaurant',
    workingHoursAr: 'يوميًا من 12 ظهرًا حتى 12 منتصف الليل',
    workingHoursEn: 'Daily, 12:00 PM - 12:00 AM',
    contact: {
      taglineAr: 'مشاوي على الفحم وأرز بيتي',
      taglineEn: 'Charcoal grills and home style rice',
      phone: '+962 6 000 0222',
      facebookUrl: 'alsanabel.restaurant',
      addressAr: 'الجبيهة، عمّان',
      addressEn: 'Jubeiha, Amman',
      mapUrl: 'https://www.openstreetmap.org/search?query=Amman',
    },
    openTime: '12:00',
    closeTime: '00:00',
    primaryColor: '#1E5F74',
    adminEmail: 'admin@alsanabel.example.com',
    adminName: 'Omar Haddad',
    categories: [
      {
        nameAr: 'مقبلات',
        nameEn: 'Appetizers',
        items: [
          {
            nameAr: 'حمص',
            nameEn: 'Hummus',
            descriptionAr: 'حمص مهروس مع طحينة وزيت زيتون.',
            descriptionEn: 'Blended chickpeas with tahini and olive oil.',
            price: 3.5,
            tags: ['VEGETARIAN', 'POPULAR'],
          },
          {
            nameAr: 'متبل',
            nameEn: 'Moutabal',
            descriptionAr: 'باذنجان مشوي مهروس مع طحينة.',
            descriptionEn: 'Smoky grilled eggplant blended with tahini.',
            price: 3.5,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'ورق عنب',
            nameEn: 'Warak Enab',
            descriptionAr: 'ورق عنب محشي بالأرز والخضار.',
            descriptionEn: 'Grape leaves stuffed with rice and vegetables.',
            price: 5,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'كبة مقلية',
            nameEn: 'Fried Kibbeh',
            descriptionAr: 'كبة برغل محشية باللحم المفروم والصنوبر.',
            descriptionEn: 'Bulgur shells filled with minced meat and pine nuts.',
            price: 6,
            tags: ['POPULAR'],
            isTodaysSpecial: true,
          },
        ],
      },
      {
        nameAr: 'شوربات وسلطات',
        nameEn: 'Soups & Salads',
        items: [
          {
            nameAr: 'شوربة عدس',
            nameEn: 'Lentil Soup',
            descriptionAr: 'شوربة عدس دافئة مع كمون وليمون.',
            descriptionEn: 'Warm lentil soup with cumin and lemon.',
            price: 3,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'فتوش',
            nameEn: 'Fattoush',
            descriptionAr: 'سلطة خضار مقرمشة مع خبز محمص ودبس الرمان.',
            descriptionEn: 'Crisp vegetable salad with toasted bread and pomegranate molasses.',
            price: 4.5,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'تبولة',
            nameEn: 'Tabbouleh',
            descriptionAr: 'سلطة بقدونس وبرغل وطماطم وليمون.',
            descriptionEn: 'Parsley and bulgur salad with tomato and lemon.',
            price: 4.5,
            tags: ['VEGETARIAN'],
          },
        ],
      },
      {
        nameAr: 'مشاوي',
        nameEn: 'Grills',
        items: [
          {
            nameAr: 'مشاوي مشكلة',
            nameEn: 'Mixed Grill',
            descriptionAr: 'تشكيلة من اللحوم المشوية على الفحم.',
            descriptionEn: 'An assortment of charcoal-grilled meats.',
            price: 14,
            tags: ['POPULAR'],
          },
          {
            nameAr: 'شيش طاووق',
            nameEn: 'Chicken Shish Tawook',
            descriptionAr: 'قطع دجاج متبلة ومشوية على الفحم.',
            descriptionEn: 'Marinated chicken skewers grilled over charcoal.',
            price: 10,
          },
          {
            nameAr: 'كفتة لحم',
            nameEn: 'Lamb Kofta',
            descriptionAr: 'كفتة لحم مشوية متبلة بالبهارات.',
            descriptionEn: 'Spiced grilled lamb kofta.',
            price: 11,
            tags: ['SPICY'],
          },
          {
            nameAr: 'ريش لحم',
            nameEn: 'Lamb Chops',
            descriptionAr: 'ريش لحم ضأن مشوية مع أعشاب.',
            descriptionEn: 'Grilled lamb chops with herbs.',
            price: 16,
          },
          {
            nameAr: 'فيليه سمك مشوي',
            nameEn: 'Grilled Fish Fillet',
            descriptionAr: 'فيليه سمك طازج مشوي مع الليمون.',
            descriptionEn: 'Fresh grilled fish fillet with lemon.',
            price: 13,
            available: false,
          },
        ],
      },
      {
        nameAr: 'أرز ويخنات',
        nameEn: 'Rice & Stews',
        items: [
          {
            nameAr: 'مقلوبة',
            nameEn: 'Maqluba',
            descriptionAr: 'طبق أرز مقلوب مع الباذنجان والدجاج.',
            descriptionEn: 'Upside-down rice dish with eggplant and chicken.',
            price: 9,
            tags: ['POPULAR'],
          },
          {
            nameAr: 'منسف',
            nameEn: 'Mansaf',
            descriptionAr: 'أرز مع لحم ضأن وصلصة اللبن الجميد التقليدية.',
            descriptionEn: 'Rice with lamb in traditional fermented yogurt sauce.',
            price: 12,
            tags: ['POPULAR'],
          },
          {
            nameAr: 'فريكة بالدجاج',
            nameEn: 'Freekeh with Chicken',
            descriptionAr: 'فريكة مدخنة مع قطع الدجاج واللوز.',
            descriptionEn: 'Smoky freekeh with chicken pieces and almonds.',
            price: 10,
          },
          {
            nameAr: 'يخنة بامية',
            nameEn: 'Okra Stew',
            descriptionAr: 'يخنة بامية بالطماطم تقدم مع الأرز.',
            descriptionEn: 'Tomato-based okra stew, served with rice.',
            price: 8,
            tags: ['VEGETARIAN'],
          },
        ],
      },
      {
        nameAr: 'أطباق نباتية',
        nameEn: 'Vegetarian Mains',
        items: [
          {
            nameAr: 'ملوخية',
            nameEn: 'Molokhia',
            descriptionAr: 'ملوخية خضراء تقدم مع الأرز.',
            descriptionEn: 'Green jute leaf stew, served with rice.',
            price: 8,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'كوسا محشي',
            nameEn: 'Stuffed Zucchini',
            descriptionAr: 'كوسا محشية بالأرز والخضار.',
            descriptionEn: 'Zucchini stuffed with rice and vegetables.',
            price: 9,
            tags: ['VEGETARIAN'],
          },
        ],
      },
      {
        nameAr: 'حلى',
        nameEn: 'Desserts',
        items: [
          {
            nameAr: 'أم علي',
            nameEn: 'Um Ali',
            descriptionAr: 'حلى دافئ من العجين والحليب والمكسرات.',
            descriptionEn: 'Warm bread pudding with milk and nuts.',
            price: 5,
            tags: ['POPULAR'],
          },
          {
            nameAr: 'أرز بحليب',
            nameEn: 'Rice Pudding',
            descriptionAr: 'أرز بحليب بارد مع رشة قرفة.',
            descriptionEn: 'Chilled rice pudding with a dusting of cinnamon.',
            price: 4,
            tags: ['VEGETARIAN'],
          },
          {
            nameAr: 'بقلاوة',
            nameEn: 'Baklava',
            descriptionAr: 'طبقات عجين رقيقة محشوة بالفستق.',
            descriptionEn: 'Thin pastry layers filled with pistachio.',
            price: 5,
            tags: ['VEGETARIAN'],
          },
        ],
      },
    ],
  },
];

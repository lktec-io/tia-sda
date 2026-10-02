// Editable public-website content.
// Update times, links and descriptions here — the Home page and footer read from this file.

export const album = {
  title: 'Ameshinda',
  year: 2026,
  artist: 'TUCASA TIA Mbeya Choir',
  tagline: '2026 Official Album',
  // Served from /public/assets/choir.mp4
  videoSrc: '/assets/choir.mp4'
};

// Hero slideshow: every slide is ONE photo locked to ONE scripture phrase and ONE
// introduction line, so image and words always change together (same array index).
// Photos are served from /public/assets/ and may repeat; to add a slide, add all
// fields together here.
export const heroSlides = [
  {
    image: '/assets/tucasa1.jpg',
    en: 'The Lord Is My Shepherd',
    sw: 'Bwana Ndiye Mchungaji Wangu',
    ref: 'Zaburi 23:1',
    intro: 'A home for worship, fellowship and service at the Tanzania Institute of Accountancy, Mbeya.'
  },
  {
    image: '/assets/tucasa2.jpg',
    en: 'Praise the Lord',
    sw: 'Msifuni Bwana',
    ref: 'Zaburi 150:1',
    intro: 'Lift your voice with the TUCASA choir and a student family that sings with purpose.'
  },
  {
    image: '/assets/tucasa3.jpg',
    en: 'Give Thanks to the Lord',
    sw: 'Mshukuruni Bwana',
    ref: 'Zaburi 136:1',
    intro: 'Grow in faith through Sabbath worship, Bible study and prayer with fellow students.'
  },
  {
    image: '/assets/tucasa1.jpg',
    en: 'Remember the Sabbath Day',
    sw: 'Ikumbuke Siku ya Sabato',
    ref: 'Kutoka 20:8',
    intro: 'Keep the Sabbath holy with a welcoming church family right here on campus.'
  },
  {
    image: '/assets/tucasa2.jpg',
    en: 'God Is Love',
    sw: 'Mungu ni Upendo',
    ref: '1 Yohana 4:8',
    intro: 'Serve one another in love through welfare, visitation and outreach programs.'
  },
  {
    image: '/assets/tucasa3.jpg',
    en: 'Jesus Is Coming Again',
    sw: 'Yesu Anakuja Tena',
    ref: 'Yohana 14:3',
    intro: 'Share the blessed hope of His return with every student at TIA Mbeya.'
  }
];
export const HERO_SLIDE_INTERVAL_MS = 3500;

// Confirm these times with church leadership before going live.
// `sw` = Swahili sub-label shown in italics under the English title.
export const sabbathSchedule = [
  { time: 'Friday · Sunset', title: 'Vespers', sw: 'Ibada ya Jioni', detail: 'Welcoming the Sabbath with praise and prayer.' },
  { time: 'Saturday · 9:00 AM', title: 'Sabbath School', sw: 'Shule ya Sabato', detail: 'Lesson study in small groups.' },
  { time: 'Saturday · 11:00 AM', title: 'Divine Service', sw: 'Ibada Kuu', detail: 'Main worship service and sermon.' },
  { time: 'Saturday · 3:30 PM', title: 'Adventist Youth (AY)', sw: 'Vijana wa Kiadventista', detail: 'Youth programs and fellowship.' }
];

// Badge on public announcements published within the last 48 hours.
export const latestUpdateLabel = 'LATEST UPDATE • TAARIFA MPYA';

// Swahili names for announcement categories (shown in the announcement modal).
export const categorySwahili = {
  'Sabbath Service': 'Ibada ya Sabato',
  Choir: 'Kwaya',
  Welfare: 'Ustawi wa Jamii',
  Evangelism: 'Uinjilisti',
  Fellowship: 'Ushirika',
  General: 'Taarifa za Jumla'
};

// Swahili sub-labels for the landing page's main headings.
export const swahiliLabels = {
  sabbathGlance: 'Muhtasari wa Sabato',
  announcements: 'Matangazo ya Kanisa',
  ministries: 'Kwaya na Huduma za Kanisa',
  sabbathGuidelines: 'Miongozo ya Ibada ya Sabato',
  fellowship: 'Habari za Ushirika wa Wanafunzi',
  welfare: 'Huduma za Ustawi',
  join: 'Jiunge na Familia ya TUCASA'
};

export const sabbathGuidelines = [
  'Arrive early and prepare your heart before service begins.',
  'Dress modestly and neatly, in keeping with the reverence of worship.',
  'Bring your Bible, hymnal and Sabbath School lesson quarterly.',
  'Silence phones and keep conversations reverent inside the sanctuary.'
];

export const fellowshipUpdates = [
  {
    title: 'Mid-week Prayer Meeting',
    detail: 'Join fellow students for prayer, testimonies and Bible study every Wednesday evening.'
  },
  {
    title: 'Hostel Bible Study Groups',
    detail: 'Small groups meet in residential areas around Mafiati, Iyunga and Sisimba.'
  },
  {
    title: 'Campus Evangelism',
    detail: 'Outreach and literature ministry to share the gospel on and around campus.'
  }
];

export const welfarePrograms = [
  {
    title: 'Student Support Fund',
    detail: 'Assistance for members facing hardship with fees, meals or emergencies.'
  },
  {
    title: 'Visitation Ministry',
    detail: 'Visiting sick and struggling students in hostels and hospitals.'
  },
  {
    title: 'New Student Welcome',
    detail: 'Helping first-years settle into campus life and find a church family.'
  }
];

// Official social channels — the ONLY platforms linked anywhere on the site.
// `platform` picks the icon (instagram | youtube).
export const socialChannels = [
  {
    group: 'TMC Choir',
    links: [
      { id: 'choir-instagram', platform: 'instagram', label: 'Instagram', handle: 'TMC Choir', url: 'https://instagram.com' },
      { id: 'choir-youtube', platform: 'youtube', label: 'YouTube', handle: 'TMC Choir', url: 'https://youtube.com' }
    ]
  },
  {
    group: 'TUCASA TIA Mbeya',
    links: [
      { id: 'tucasa-youtube', platform: 'youtube', label: 'YouTube', handle: 'TUCASA TIA Mbeya', url: 'https://youtube.com' }
    ]
  }
];

export const choirChannels = socialChannels.find((g) => g.group === 'TMC Choir')?.links ?? [];

// Optional Shopify storefront (album & merchandise). Set VITE_SHOPIFY_STORE_URL in .env.local;
// the "Shop" buttons only appear when it is a valid https:// URL.
const rawStoreUrl = import.meta.env.VITE_SHOPIFY_STORE_URL?.trim() || '';
export const shopifyStoreUrl = /^https:\/\/\S+$/.test(rawStoreUrl) ? rawStoreUrl : '';

export const location = {
  campus: 'Tanzania Institute of Accountancy (TIA), Mbeya Campus',
  directions: [
    'From Mbeya city centre, follow the Old Airport / Zambia (TANZAM) highway.',
    'Turn off at Mafiati junction towards the TIA Mbeya campus.',
    'Ask for the TUCASA fellowship — members will direct you to the worship venue.'
  ],
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tanzania+Institute+of+Accountancy+Mbeya'
};

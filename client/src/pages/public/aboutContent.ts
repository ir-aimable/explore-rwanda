import type { IconName } from '../../components/Icon';

/** About page copy. Each language is a complete, separate version; the page renders the active one. */
export interface Item { icon: IconName; title: string; text: string }
export interface AboutContent {
  nav: { id: string; label: string }[];
  hero: { kicker: string; title: string; sub: string };
  who: { title: string; paras: string[]; lead: string; goal: string; goalLabel: string };
  story: { title: string; paras: string[]; quote: string; devLabel: string; devRole: string };
  vision: { title: string; text: string };
  mission: { title: string; text: string };
  problem: { title: string; intro: string; items: Item[]; responseLabel: string; response: string };
  offer: { title: string; intro: string; items: Item[] };
  how: { title: string; intro: string; steps: Item[] };
  audience: { title: string; intro: string; items: Item[] };
  tech: { title: string; paras: string[]; listIntro: string; list: string[]; outro: string; aiNote: string };
  trust: { title: string; intro: string[]; items: Item[]; outro: string };
  values: { title: string; items: Item[] };
  contribution: { title: string; intro: string; items: Item[]; outro: string };
  promise: { title: string; big: string; text: string; tagline: string };
  join: { title: string; travellers: { title: string; text: string }; organizers: { title: string; text: string }; ctaDest: string; ctaTrips: string; ctaOrg: string };
}

const en: AboutContent = {
  nav: [
    { id: 'who', label: 'Who we are' }, { id: 'story', label: 'Our story' }, { id: 'vision', label: 'Vision & mission' },
    { id: 'offer', label: 'What we offer' }, { id: 'how', label: 'How it works' }, { id: 'audience', label: 'Who it’s for' },
    { id: 'trust', label: 'Trust & safety' }, { id: 'values', label: 'Values' }, { id: 'join', label: 'Join us' },
  ],
  hero: {
    kicker: 'Explore more. Go together.',
    title: 'About Explore Rwanda',
    sub: 'A digital tourism discovery and trip-organizing platform that connects people with destinations, experiences, travel opportunities and fellow explorers across Rwanda.',
  },
  who: {
    title: 'Who we are',
    lead: 'We believe that exploring Rwanda should be easier than waiting for someone to announce a trip, searching through scattered social media posts or struggling to find people to travel with.',
    paras: [
      'Rwanda is blessed with extraordinary natural landscapes, beautiful lakes, mountains, national parks, cultural heritage, historical attractions and unique local experiences. Yet, discovering these opportunities, finding reliable information and organizing a trip can sometimes be challenging.',
      'Explore Rwanda exists to bridge that gap. We bring destinations, verified trip organizers, travel experiences and people together in one accessible digital platform.',
      'Whether someone wants to hike a mountain, relax by Lake Kivu, discover Rwanda’s cultural heritage, explore a national park or simply enjoy a weekend with new people, Explore Rwanda makes it easier to find an experience worth joining.',
    ],
    goalLabel: 'Our goal is simple',
    goal: 'Help more people discover Rwanda, experience its beauty and connect through meaningful journeys.',
  },
  story: {
    title: 'Our story',
    paras: [
      'Every memorable journey starts with an opportunity to discover something new. However, many people do not necessarily travel because they lack interest in exploring. Sometimes, they simply do not know where to go, what activities are available, how much a trip might cost or who they can travel with.',
      'For many potential travellers, discovering a trip depends on someone sharing an announcement, a friend inviting them or an organizer posting information on social media. This creates a gap between the desire to explore and the opportunity to actually participate.',
      'Explore Rwanda was conceived to address this gap. We envisioned a platform where discovering a destination would naturally lead to discovering available experiences, understanding their costs, finding an organizer and connecting with other people interested in the same journey.',
      'Instead of allowing exciting travel opportunities to remain scattered across different channels, we aim to make them easier to discover, understand and join.',
    ],
    quote: 'We are transforming travel discovery from a passive experience into an active opportunity.',
    devLabel: 'Meet the developer', devRole: 'Platform developer',
  },
  vision: { title: 'Our vision', text: 'To become a trusted digital gateway for discovering Rwanda, connecting travellers and making meaningful travel experiences accessible to more people.' },
  mission: { title: 'Our mission', text: 'To simplify tourism discovery and trip organization by providing accessible destination information, connecting travellers with verified organizers, promoting local experiences and using technology to make travel planning more informed and convenient.' },
  problem: {
    title: 'The problem we are solving',
    intro: 'Explore Rwanda addresses several challenges in the local tourism discovery experience.',
    items: [
      { icon: 'layers', title: 'Scattered travel information', text: 'Travel opportunities and destination information are often spread across different social media pages, websites and personal networks.' },
      { icon: 'users', title: 'Difficulty finding travel companions', text: 'People may want to explore but lack friends or groups interested in the same experience.' },
      { icon: 'wallet', title: 'Unclear travel costs', text: 'Travellers may struggle to understand the total expected cost, what is included and what requires additional payment.' },
      { icon: 'bell', title: 'Limited awareness of opportunities', text: 'Some travellers discover activities too late or only when someone personally shares an announcement.' },
      { icon: 'clipboard', title: 'Complex trip planning', text: 'Organizing transportation, accommodation, activities, food and timing can require considerable effort.' },
    ],
    responseLabel: 'Our response',
    response: 'Bring discovery, information, people and trip organization into one connected experience.',
  },
  offer: {
    title: 'What we offer',
    intro: 'Explore Rwanda is built around six interconnected services.',
    items: [
      { icon: 'map', title: 'Destination discovery', text: 'Discover Rwanda’s destinations through detailed descriptions, photographs, geographical locations, available activities, interesting facts and visitor information.' },
      { icon: 'compass', title: 'Trip discovery', text: 'Explore organized trips, upcoming experiences, dates, duration, available spaces, prices and participation requirements.' },
      { icon: 'users', title: 'Travel community', text: 'Connect people with shared interests, discover group opportunities and find experiences that are more enjoyable together.' },
      { icon: 'sparkles', title: 'Smart trip planning', text: 'Support informed decisions with trip recommendations, budget considerations, transportation options, weather information and activity suggestions.' },
      { icon: 'link', title: 'Organizer connection', text: 'Help travellers discover verified organizers, tour operators and local experience providers offering organized travel opportunities.' },
      { icon: 'megaphone', title: 'Local tourism promotion', text: 'Give visibility to local destinations, cultural experiences, community activities and tourism businesses.' },
    ],
  },
  how: {
    title: 'How Explore Rwanda works',
    intro: 'We want the visitor journey to be simple, transparent and convenient.',
    steps: [
      { icon: 'search', title: 'Discover', text: 'Browse destinations and explore available activities, attractions and travel experiences.' },
      { icon: 'compass', title: 'Explore', text: 'Find trips that match your interests, preferred dates, budget and starting location.' },
      { icon: 'scale', title: 'Compare', text: 'Review prices, transport arrangements, inclusions, exclusions, organizers and available spaces.' },
      { icon: 'users', title: 'Connect', text: 'Find other interested participants and discover opportunities to travel together.' },
      { icon: 'checkCircle', title: 'Join', text: 'Register for your preferred trip and follow the organizer’s confirmation process.' },
      { icon: 'star', title: 'Experience & share', text: 'Enjoy your journey, share your experience and help other travellers discover new opportunities through feedback and reviews.' },
    ],
  },
  audience: {
    title: 'Who is Explore Rwanda for?',
    intro: 'Explore Rwanda is designed for different people and organizations who contribute to the tourism ecosystem.',
    items: [
      { icon: 'user', title: 'Individual travellers', text: 'People looking for places to visit, activities to enjoy and opportunities to join organized trips.' },
      { icon: 'graduation', title: 'Students & young explorers', text: 'People interested in affordable adventures, social experiences, learning and discovering their country.' },
      { icon: 'heart', title: 'Families & friends', text: 'Groups looking for enjoyable, organized and memorable experiences.' },
      { icon: 'flag', title: 'Tour organizers & agencies', text: 'Approved organizers seeking visibility, participants and a better way to manage their trips.' },
      { icon: 'store', title: 'Local tourism businesses', text: 'Accommodation providers, activity operators, local guides and other tourism-related businesses.' },
    ],
  },
  tech: {
    title: 'Technology & innovation',
    paras: [
      'We believe technology should make travel easier, not more complicated.',
      'Explore Rwanda uses a digital-first approach to connect destination information, trip opportunities, organizers and travellers.',
    ],
    listIntro: 'We envision using artificial intelligence to support smarter trip planning by helping users:',
    list: [
      'Discover destinations based on their interests.',
      'Identify activities suitable for their preferences.',
      'Estimate trip budgets and understand potential expenses.',
      'Compare available transportation options.',
      'Consider weather conditions for selected destinations and travel dates.',
      'Organize activities into practical travel itineraries.',
      'Discover alternative experiences based on their budget and available time.',
    ],
    outro: 'Our approach is to combine useful technology with reliable information and human-organized experiences.',
    aiNote: 'Artificial intelligence supports decision-making; it does not replace professional guides, authorized operators or the traveller’s own judgment.',
  },
  trust: {
    title: 'Trust, transparency & safety',
    intro: [
      'We believe a great travel experience begins with trust.',
      'That is why Explore Rwanda aims to create an environment where travellers can make informed decisions before joining a trip.',
    ],
    items: [
      { icon: 'shield', title: 'Organizer verification', text: 'Organizers must undergo an approval process before receiving permission to publish and manage trips.' },
      { icon: 'tag', title: 'Transparent pricing', text: 'Trip pages should clearly explain prices and what is included or excluded.' },
      { icon: 'checkCircle', title: 'Accurate information', text: 'Destination and activity information should be reviewed and updated.' },
      { icon: 'clipboard', title: 'Clear registration', text: 'Participants should understand registration requirements and confirmation procedures.' },
      { icon: 'leaf', title: 'Responsible travel', text: 'Travellers and organizers should respect local communities, natural environments and applicable regulations.' },
      { icon: 'message', title: 'Feedback & accountability', text: 'Reviews and reports can help improve service quality and build confidence.' },
    ],
    outro: 'We understand that trust is earned through consistent actions, not simply promises.',
  },
  values: {
    title: 'Our core values',
    items: [
      { icon: 'compass', title: 'Discovery', text: 'Encouraging curiosity and exploration.' },
      { icon: 'link', title: 'Connection', text: 'Bringing people and experiences together.' },
      { icon: 'shield', title: 'Trust', text: 'Promoting transparency and accountability.' },
      { icon: 'lightbulb', title: 'Innovation', text: 'Using technology to improve experiences.' },
      { icon: 'leaf', title: 'Sustainability', text: 'Respecting nature and local communities.' },
      { icon: 'globe', title: 'Inclusivity', text: 'Making exploration accessible to more people.' },
    ],
  },
  contribution: {
    title: 'Our contribution to Rwanda',
    intro: 'Explore Rwanda aims to contribute to the growth of Rwanda’s tourism ecosystem through several areas:',
    items: [
      { icon: 'home', title: 'Promoting domestic tourism', text: 'Encouraging residents to discover and appreciate destinations within their own country.' },
      { icon: 'store', title: 'Supporting local businesses', text: 'Creating visibility and opportunities for tourism operators, guides and local service providers.' },
      { icon: 'users', title: 'Encouraging community participation', text: 'Connecting travellers with locally organized experiences.' },
      { icon: 'search', title: 'Improving tourism information access', text: 'Making destination and trip information easier to find and understand.' },
      { icon: 'chart', title: 'Supporting informed travel decisions', text: 'Providing tools that help people plan according to their interests, time and budget.' },
      { icon: 'leaf', title: 'Promoting responsible exploration', text: 'Encouraging environmental conservation and respect for local cultures.' },
    ],
    outro: 'Our ambition is to help transform Rwanda’s tourism opportunities into experiences that more people can discover and participate in.',
  },
  promise: {
    title: 'Our promise',
    big: 'Rwanda is waiting to be discovered.',
    text: 'We are here to make discovering it easier, connecting people through experiences and helping every journey begin with an opportunity.',
    tagline: 'Explore more. Go together.',
  },
  join: {
    title: 'Join the Explore Rwanda community',
    travellers: { title: 'For travellers', text: 'Your next experience might be closer than you think. Discover destinations, explore available trips and find people who share your passion for exploration.' },
    organizers: { title: 'For organizers', text: 'Are you a tour organizer, travel agency or local experience provider? Join our growing network and make your experiences more visible to potential travellers.' },
    ctaDest: 'Discover destinations', ctaTrips: 'Explore trips', ctaOrg: 'Become an organizer',
  },
};

const rw: AboutContent = {
  nav: [
    { id: 'who', label: 'Abo turi bo' }, { id: 'story', label: 'Impamvu twashyizweho' }, { id: 'vision', label: 'Icyerekezo n’inshingano' },
    { id: 'offer', label: 'Ibyo dutanga' }, { id: 'how', label: 'Uko ikora' }, { id: 'audience', label: 'Abo tugenewe' },
    { id: 'trust', label: 'Icyizere n’umutekano' }, { id: 'values', label: 'Indangagaciro' }, { id: 'join', label: 'Injira' },
  ],
  hero: {
    kicker: 'Vumbura byinshi. Mutemberane.',
    title: 'Abo turi bo',
    sub: 'Explore Rwanda ni urubuga rw’ikoranabuhanga rugamije gufasha abantu kumenya ahantu nyaburanga, kuvumbura ibikorwa byo kwidagadura no gutegura ingendo, ndetse no guhuza abantu bashaka gutembera mu Rwanda.',
  },
  who: {
    title: 'Abo turi bo',
    lead: 'Twemera ko kumenya no gusura ubwiza bw’u Rwanda bitagombera gutegereza ko hari umuntu utangaza urugendo, gushakisha amakuru mu mbuga nkoranyambaga zitandukanye cyangwa kubura abo bajyana.',
    paras: [
      'U Rwanda rufite ibyiza byinshi birimo ibiyaga, imisozi, pariki z’igihugu, amashyamba, amateka, umuco n’ahantu nyaburanga hatandukanye. Nyamara, kumenya ayo mahirwe, kubona amakuru yizewe no gutegura urugendo bishobora kugorana.',
      'Explore Rwanda yashyizweho kugira ngo ikemure icyo kibazo. Duhuriza hamwe amakuru y’ahantu nyaburanga, abategura ingendo bemewe, ibikorwa bitandukanye n’abantu bifuza gutembera, byose bikaboneka ku rubuga rumwe.',
      'Waba ushaka kuzamuka umusozi, kuruhukira ku Kiyaga cya Kivu, gusura ahantu ndangamateka, kureba inyamaswa muri pariki cyangwa kumara impera z’icyumweru uri kumwe n’inshuti nshya, Explore Rwanda igufasha kubona urugendo rukubereye.',
    ],
    goalLabel: 'Intego yacu ni imwe',
    goal: 'Gufasha abantu benshi kumenya u Rwanda, kwishimira ubwiza bwarwo no guhurira mu ngendo zibasigira ubunararibonye bwiza.',
  },
  story: {
    title: 'Impamvu twashyizweho',
    paras: [
      'Buri rugendo rwiza rutangirira ku mahirwe yo kuvumbura ikintu gishya. Ariko abantu benshi ntibabura gutembera kubera ko batabishaka. Hari igihe baba batazi aho bajya, ibikorwa bahasanga, amafaranga bisaba cyangwa abantu bajyana na bo.',
      'Ku bantu benshi, kumenya urugendo bishingira ku muntu warumenyesheje, inshuti yabatumyeho cyangwa ubutumwa bwashyizwe ku mbuga nkoranyambaga. Ibi bituma habaho intera hagati yo kuba umuntu yifuza gutembera no kubona amahirwe yo kubikora.',
      'Explore Rwanda yatekerejweho kugira ngo ikemure icyo kibazo. Twifuje kubaka urubuga aho umuntu ashobora kumenya ahantu nyaburanga, kubona ingendo zihateganyijwe, kumenya ibiciro, kubona abategura izo ngendo no guhura n’abandi bifuza kuzitabira.',
      'Aho kugira ngo amakuru y’ingendo akomeze gutatana mu mbuga zitandukanye, turifuza kuyahuza ahantu hamwe, ku buryo kuyabona no kwitabira ingendo byoroha.',
    ],
    quote: 'Turifuza guhindura kumenya ingendo gusa bikavamo kubona amahirwe yo kuzitabira.',
    devLabel: 'Menya uwubatse urubuga', devRole: 'Uwubatse urubuga',
  },
  vision: { title: 'Icyerekezo cyacu', text: 'Kuba urubuga rwizewe kandi rwifashishwa mu kumenya ubwiza bw’u Rwanda, guhuza abantu bakunda gutembera no korohereza benshi kubona amahirwe yo gusura ahantu nyaburanga.' },
  mission: { title: 'Inshingano zacu', text: 'Koroshya kumenya ahantu nyaburanga no gutegura ingendo binyuze mu gutanga amakuru aboneka kandi yumvikana, guhuza abagenzi n’abategura ingendo bemewe, kumenyekanisha ibikorwa byo mu Rwanda no gukoresha ikoranabuhanga kugira ngo gutegura ingendo birusheho koroha.' },
  problem: {
    title: 'Ikibazo dushaka gukemura',
    intro: 'Explore Rwanda ikemura imbogamizi zitandukanye zigaragara mu kumenya no gusura ahantu nyaburanga mu gihugu.',
    items: [
      { icon: 'layers', title: 'Amakuru atatanye', text: 'Amakuru y’ingendo n’ahantu nyaburanga akenshi atandukanye kandi akwirakwizwa mu mbuga nyinshi.' },
      { icon: 'users', title: 'Kubura abo mujyana', text: 'Abantu bashobora kuba bifuza gutembera ariko bakabura abo bajyana cyangwa amatsinda ahuje inyungu.' },
      { icon: 'wallet', title: 'Ibiciro bidasobanutse', text: 'Birashobora kugorana kumenya amafaranga yose urugendo rusaba n’ibiba biri mu giciro.' },
      { icon: 'bell', title: 'Kutamenya amahirwe ahari', text: 'Hari abamenya ingendo amahirwe yo kuzitabira yarenze cyangwa bayamenye binyuze ku bo baziranye gusa.' },
      { icon: 'clipboard', title: 'Gutegura urugendo biragoye', text: 'Gutegura imodoka, aho kurara, ibikorwa, amafunguro n’ibihe bishobora gusaba umwanya n’imbaraga.' },
    ],
    responseLabel: 'Igisubizo cyacu',
    response: 'Guhuriza hamwe kumenya ahantu, amakuru, abantu no gutegura ingendo mu buryo bumwe buhuriweho.',
  },
  offer: {
    title: 'Ibyo dutanga',
    intro: 'Explore Rwanda yubakiye kuri serivisi esheshatu zuzuzanya.',
    items: [
      { icon: 'map', title: 'Kumenya ahantu nyaburanga', text: 'Menya ahantu nyaburanga binyuze ku mafoto, ibisobanuro, ibikorwa bihabera n’amakuru y’ingenzi.' },
      { icon: 'compass', title: 'Kuvumbura ingendo', text: 'Menya ingendo ziteguye, amatariki, igihe zimara, ibiciro n’imyanya isigaye.' },
      { icon: 'users', title: 'Umuryango w’abakunda gutembera', text: 'Huza abantu bakunda ibikorwa bimwe, ubafashe kubona amahirwe yo gutembera bari kumwe.' },
      { icon: 'sparkles', title: 'Gutegura ingendo mu buryo bw’ubwenge', text: 'Fasha abantu gutegura ingendo bakurikije ingengo y’imari, uburyo bwo kugenda, ikirere n’ibikorwa bihari.' },
      { icon: 'link', title: 'Guhuza abagenzi n’abategura ingendo', text: 'Huza abagenzi n’abategura ingendo bemewe ndetse n’abatanga serivisi z’ubukerarugendo.' },
      { icon: 'megaphone', title: 'Guteza imbere ubukerarugendo nyarwanda', text: 'Kumenyekanisha ahantu nyaburanga, umuco, ibikorwa by’abaturage n’abakora mu bukerarugendo.' },
    ],
  },
  how: {
    title: 'Uko Explore Rwanda ikora',
    intro: 'Twifuza ko urugendo rwawe ku rubuga ruba rworoshye, rusobanutse kandi runogeye.',
    steps: [
      { icon: 'search', title: 'Menya', text: 'Reba ahantu nyaburanga n’ibikorwa bitandukanye ushobora kwitabira.' },
      { icon: 'compass', title: 'Vumbura', text: 'Shaka urugendo ruhuje n’ibyo ukunda, itariki, ingengo y’imari n’aho uhera.' },
      { icon: 'scale', title: 'Gereranya', text: 'Gereranya ibiciro, serivisi zirimo, izitari zirimo n’abategura ingendo.' },
      { icon: 'users', title: 'Huza', text: 'Menya abandi bantu bifuza kwitabira urugendo rumwe.' },
      { icon: 'checkCircle', title: 'Iyandikishe', text: 'Iyandikishe mu rugendo wahisemo kandi ukurikize amabwiriza yo kwemezwa.' },
      { icon: 'star', title: 'Ishimire kandi usangize abandi', text: 'Ishimire urugendo, sangiza abandi ubunararibonye bwawe kandi utange igitekerezo.' },
    ],
  },
  audience: {
    title: 'Ni bande tugenewe?',
    intro: 'Explore Rwanda yagenewe abantu n’ibigo bitandukanye bigira uruhare mu bukerarugendo.',
    items: [
      { icon: 'user', title: 'Abagenzi ku giti cyabo', text: 'Abantu bashaka ahantu ho gusura, ibikorwa byo kwishimisha n’amahirwe yo kwitabira ingendo ziteguye.' },
      { icon: 'graduation', title: 'Abanyeshuri n’urubyiruko', text: 'Abakunda ingendo zihendutse, guhura n’abandi, kwiga no kumenya igihugu cyabo.' },
      { icon: 'heart', title: 'Imiryango n’inshuti', text: 'Amatsinda ashaka ingendo zishimishije, ziteguye neza kandi zitazibagirana.' },
      { icon: 'flag', title: 'Abategura ingendo n’ibigo by’ubukerarugendo', text: 'Abategura ingendo bemewe bashaka kumenyekana, kubona abitabira no gucunga ingendo zabo neza.' },
      { icon: 'store', title: 'Abatanga serivisi z’ubukerarugendo', text: 'Abatanga aho kurara, abategura ibikorwa, abayobora ba mukerarugendo n’abandi bakora mu bukerarugendo.' },
    ],
  },
  tech: {
    title: 'Ikoranabuhanga n’udushya',
    paras: [
      'Twemera ko ikoranabuhanga rikwiye korohereza abantu gutembera aho kubongerera ingorane.',
      'Explore Rwanda ikoresha uburyo bw’ikoranabuhanga mu guhuza amakuru y’ahantu nyaburanga, ingendo, abategura ingendo n’abagenzi.',
    ],
    listIntro: 'Turifuza gukoresha ubwenge buhangano (Artificial Intelligence) mu gufasha abantu:',
    list: [
      'Kumenya ahantu hakwiranye n’ibyo bakunda.',
      'Kubona ibikorwa bashobora kwitabira.',
      'Kugereranya ingengo y’imari n’amafaranga bashobora gukoresha.',
      'Kugereranya uburyo butandukanye bwo kugenda.',
      'Kureba amakuru y’ikirere ku hantu no ku matariki bahisemo.',
      'Gutegura ingendo zifite gahunda yumvikana.',
      'Kubona ubundi buryo bw’ingendo bujyanye n’amafaranga n’igihe bafite.',
    ],
    outro: 'Intego ni uguhuza ikoranabuhanga n’amakuru yizewe ndetse n’ubunararibonye bw’ababigize umwuga.',
    aiNote: 'Ubwenge buhangano buzafasha mu gufata ibyemezo ariko ntibusimbure abayobora ba mukerarugendo, abatanga serivisi babifitiye uburenganzira cyangwa ubushishozi bw’umugenzi.',
  },
  trust: {
    title: 'Icyizere, gukorera mu mucyo n’umutekano',
    intro: [
      'Twemera ko urugendo rwiza rutangirira ku cyizere.',
      'Ni yo mpamvu Explore Rwanda igamije gushyiraho uburyo bufasha abagenzi gufata ibyemezo bazi neza amakuru y’urugendo mbere yo kurwitabira.',
    ],
    items: [
      { icon: 'shield', title: 'Kugenzura abategura ingendo', text: 'Abategura ingendo bazabanza gusuzumwa no kwemererwa mbere yo gutangaza no gucunga ingendo.' },
      { icon: 'tag', title: 'Kugaragaza ibiciro mu mucyo', text: 'Urugendo ruzajya rugaragaza igiciro n’ibikubiyemo cyangwa ibitakubiyemo.' },
      { icon: 'checkCircle', title: 'Amakuru yizewe', text: 'Amakuru ajyanye n’ahantu nyaburanga n’ibikorwa azajya agenzurwa kandi avugururwa.' },
      { icon: 'clipboard', title: 'Kwiyandikisha bisobanutse', text: 'Abagenzi bazajya basobanurirwa ibisabwa kugira ngo bitabire urugendo.' },
      { icon: 'leaf', title: 'Ubukerarugendo burambye', text: 'Abagenzi n’abategura ingendo bazajya bubaha abaturage, ibidukikije n’amategeko abigenga.' },
      { icon: 'message', title: 'Ibitekerezo n’uburyozwe', text: 'Ibitekerezo by’abakiliya bizafasha kunoza serivisi no kongera icyizere.' },
    ],
    outro: 'Twemera ko icyizere cyubakwa n’ibikorwa bihoraho, atari amagambo gusa.',
  },
  values: {
    title: 'Indangagaciro zacu',
    items: [
      { icon: 'compass', title: 'Kuvumbura', text: 'Gushishikariza abantu kuvumbura no kumenya ibishya.' },
      { icon: 'link', title: 'Guhuza', text: 'Guhuza abantu n’ubunararibonye.' },
      { icon: 'shield', title: 'Icyizere', text: 'Gukorera mu mucyo no kubazwa inshingano.' },
      { icon: 'lightbulb', title: 'Guhanga udushya', text: 'Gukoresha ikoranabuhanga mu kunoza ubunararibonye.' },
      { icon: 'leaf', title: 'Kuramba', text: 'Kubungabunga ibidukikije no kubaha abaturage.' },
      { icon: 'globe', title: 'Kudaheza', text: 'Gufasha abantu benshi kubona amahirwe yo gutembera.' },
    ],
  },
  contribution: {
    title: 'Umusanzu wacu ku Rwanda',
    intro: 'Explore Rwanda igamije gutanga umusanzu mu iterambere ry’ubukerarugendo mu Rwanda binyuze mu:',
    items: [
      { icon: 'home', title: 'Guteza imbere ubukerarugendo bwo mu gihugu', text: 'Gushishikariza Abanyarwanda gusura no kumenya ibyiza by’igihugu cyabo.' },
      { icon: 'store', title: 'Gushyigikira abakora mu bukerarugendo', text: 'Guha amahirwe n’uburyo bwo kumenyekana abategura ingendo n’abatanga serivisi.' },
      { icon: 'users', title: 'Guteza imbere uruhare rw’abaturage', text: 'Guhuza abagenzi n’ibikorwa bitegurwa n’abaturage bo mu duce batuyemo.' },
      { icon: 'search', title: 'Koroshya kubona amakuru', text: 'Gutuma amakuru ajyanye n’ubukerarugendo aboneka kandi yumvikana.' },
      { icon: 'chart', title: 'Gufasha gufata ibyemezo bishingiye ku makuru', text: 'Gutanga ibikoresho bifasha gutegura ingendo hakurikijwe ibyo umuntu akunda, igihe n’ingengo y’imari.' },
      { icon: 'leaf', title: 'Guteza imbere ubukerarugendo burambye', text: 'Gushishikariza abantu kubungabunga ibidukikije no kubaha umuco w’aho basuye.' },
    ],
    outro: 'Intego yacu ni ugufasha abantu benshi kubona no kwitabira amahirwe y’ubukerarugendo aboneka mu Rwanda.',
  },
  promise: {
    title: 'Icyo twiyemeje',
    big: 'U Rwanda ruragutegereje kugira ngo uruvumbure.',
    text: 'Turi hano kugira ngo koroshya kumenya ubwiza bwarwo, guhuza abantu binyuze mu bikorwa bitandukanye no gufasha buri rugendo gutangirira ku mahirwe.',
    tagline: 'Vumbura byinshi. Mutemberane.',
  },
  join: {
    title: 'Injira mu muryango wa Explore Rwanda',
    travellers: { title: 'Ku bagenzi', text: 'Urugendo rukurikira ushobora kurukora rutari kure nk’uko ubyibwira. Menya ahantu nyaburanga, ingendo zihari n’abandi bantu mukunda ibintu bimwe.' },
    organizers: { title: 'Ku bategura ingendo', text: 'Waba utegura ingendo, ufite ikigo cy’ubukerarugendo cyangwa utanga serivisi zijyanye n’ubukerarugendo? Injira mu muryango wacu kugira ngo ibikorwa byawe birusheho kumenyekana.' },
    ctaDest: 'Menya ahantu nyaburanga', ctaTrips: 'Shaka ingendo', ctaOrg: 'Iyandikishe nk’utegura ingendo',
  },
};

export const DEVELOPER = { name: 'Mariette Ikuzwe', photo: '/images/about.jpg' };

export const ABOUT: Record<'en' | 'rw', AboutContent> = { en, rw };

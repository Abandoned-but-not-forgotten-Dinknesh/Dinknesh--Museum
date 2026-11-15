export type BodyId = 'moon' | 'mars';

export type TelemetryItem = { label: string; value: string };
export type Site = { label: string; lat: number; lon: number };

export type Hardware = {
  id: string;
  name: string;
  year: number;
  url: string;
  modelRotation: [number, number, number]; // default [0,0,0], for fixing orientation
  modelScale: number; // default 1, a multiplier after auto-fit
  sites: Site[];
  placard: {
    title: string;
    telemetry: TelemetryItem[];
    story: string;
  };
  hotspots: [];
  timeline: []; // empty for now
};

export type BodyAtmosphere = {
  color: string;
  opacity: number;
  scale: number;
};

export type BodyTerrainPalette = {
  innerColor: string;
  outerColor: string;
  hazeColor?: string;
};

export type Body = {
  id: 'moon' | 'mars';
  name: string;
  url: string;
  tagline: string;
  stat: string;
  preview: { name: string; year: number }[];
  keyLightColor: string;
  hubRotationSpeed: number;
  landingRotationSpeed: number;
  floatFrequency: number;
  floatPhaseOffset: number;
  lonOffset: number;
  latOffset: number;
  terrain: BodyTerrainPalette;
  atmosphere?: BodyAtmosphere;
  hardware: Hardware[];
};

export const BODIES: readonly Body[] = [
  {
    id: 'moon',
    name: 'The Moon',
    url: 'https://raw.githubusercontent.com/Abandoned-but-not-forgotten-Dinknesh/Dinknesh/main/moon_small-v2.glb',
    tagline: 'Two landers. Two descent stages. Left behind.',
    stat: '2 MACHINES ABANDONED',
    preview: [
      { name: 'Apollo 11 Descent Stage', year: 1969 },
      { name: 'Apollo 15 Lunar Module', year: 1971 },
    ],
    keyLightColor: '#FFF4E0',
    hubRotationSpeed: 0.055,
    landingRotationSpeed: 0.035,
    floatFrequency: 0.65,
    floatPhaseOffset: 0,
    lonOffset: 0,
    latOffset: 0,
    terrain: {
      innerColor: '#8A8D93',
      outerColor: '#5A5D63',
    },
    hardware: [
      {
        id: 'apollo-11',
        name: 'Apollo 11 Descent Stage',
        year: 1969,
        url: 'https://raw.githubusercontent.com/Abandoned-but-not-forgotten-Dinknesh/Dinknesh/main/apollo_11_lunar_module-v1.glb',
        modelRotation: [0, 0, 0],
        modelScale: 1,
        sites: [{ label: 'Tranquility Base', lat: 0.67, lon: 23.47 }],
        placard: {
          title: 'Apollo 11 Lunar Module Eagle: Descent Stage',
          telemetry: [
            { label: 'MISSION', value: 'APOLLO 11' },
            { label: 'LANDED', value: '20 JUL 1969' },
            { label: 'SITE', value: 'SEA OF TRANQUILITY' },
            { label: 'STATUS', value: 'LEFT ON SURFACE' },
          ],
          story:
            'On July 20, 1969, the lunar module Eagle set down in the Sea of Tranquility, and its descent stage served as the launch platform when Armstrong and Aldrin lifted off the next day. It stayed behind on the surface, still carrying a plaque that records that the crew came in peace for all mankind.',
        },
        hotspots: [],
        timeline: [],
      },
      {
        id: 'apollo-15',
        name: 'Apollo 15 Lunar Module',
        year: 1971,
        url: 'https://raw.githubusercontent.com/Abandoned-but-not-forgotten-Dinknesh/Dinknesh/main/Apollo-Lunar-Module-v1.glb',
        modelRotation: [0, 0, 0],
        modelScale: 1,
        sites: [{ label: 'Hadley-Apennine', lat: 26.13, lon: 3.63 }],
        placard: {
          title: 'Apollo 15 Lunar Module Falcon: Descent Stage',
          telemetry: [
            { label: 'MISSION', value: 'APOLLO 15' },
            { label: 'LANDED', value: '30 JUL 1971' },
            { label: 'SITE', value: 'HADLEY-APENNINE' },
            { label: 'STATUS', value: 'LEFT ON SURFACE' },
          ],
          story:
            'Falcon landed beside the Hadley Rille and the Apennine Mountains in July 1971, on the first mission to carry a Lunar Roving Vehicle that the astronauts drove across the surface. When the crew lifted off, they left the descent stage and the rover behind.',
        },
        hotspots: [],
        timeline: [],
      },
    ],
  },
  {
    id: 'mars',
    name: 'Mars',
    url: 'https://raw.githubusercontent.com/Abandoned-but-not-forgotten-Dinknesh/Dinknesh/main/mars-v1.glb',
    tagline: 'Explorers that outlived their missions, resting on the red plains.',
    stat: '3 MACHINES ABANDONED',
    preview: [
      { name: 'Sojourner Rover', year: 1997 },
      { name: 'Spirit & Opportunity Rovers', year: 2004 },
      { name: 'Ingenuity Helicopter', year: 2021 },
    ],
    keyLightColor: '#FFE2C4',
    hubRotationSpeed: 0.095,
    landingRotationSpeed: 0.055,
    floatFrequency: 0.8,
    floatPhaseOffset: 1.8,
    lonOffset: 0,
    latOffset: 0,
    terrain: {
      innerColor: '#8C5A3C',
      outerColor: '#5E3B27',
      hazeColor: '#8C5A3C',
    },
    atmosphere: {
      color: '#D97B48',
      opacity: 0.07,
      scale: 1.045,
    },
    hardware: [
      {
        id: 'sojourner',
        name: 'Sojourner Rover',
        year: 1997,
        url: 'https://raw.githubusercontent.com/Abandoned-but-not-forgotten-Dinknesh/Dinknesh/main/mars_sojourner_rover_model-v1.glb',
        modelRotation: [0, 0, 0],
        modelScale: 1,
        sites: [{ label: 'Ares Vallis', lat: 19.1, lon: -33.2 }],
        placard: {
          title: 'Sojourner: The First Rover on Mars',
          telemetry: [
            { label: 'MISSION', value: 'MARS PATHFINDER' },
            { label: 'LANDED', value: '4 JUL 1997' },
            { label: 'DESIGNED', value: '7 SOLS' },
            { label: 'STATUS', value: 'SILENT SINCE SEP 1997' },
          ],
          story:
            'Sojourner rolled off the Pathfinder lander in July 1997 and worked far longer than the week it was designed for. Contact with the Pathfinder lander was lost in September 1997, and the small rover has rested near it ever since.',
        },
        hotspots: [],
        timeline: [],
      },
      {
        id: 'spirit-opportunity',
        name: 'Spirit & Opportunity',
        year: 2004,
        url: 'https://raw.githubusercontent.com/Abandoned-but-not-forgotten-Dinknesh/Dinknesh/main/Spirit-and-Opportunity-rovers-v1.glb',
        modelRotation: [0, 0, 0],
        modelScale: 1,
        sites: [
          { label: 'Spirit: Gusev Crater', lat: -14.57, lon: 175.47 },
          { label: 'Opportunity: Meridiani Planum', lat: -1.95, lon: -5.53 },
        ],
        placard: {
          title: 'NASA Mars Exploration Rovers: Spirit & Opportunity',
          telemetry: [
            { label: 'DESTINATION', value: 'MARS' },
            { label: 'LANDED', value: 'JAN 2004' },
            { label: 'DESIGNED', value: '90 SOLS' },
            { label: 'ACTIVE', value: '6 YRS (SPIRIT) / 14+ YRS (OPPORTUNITY)' },
            { label: 'STATUS', value: 'DISCARDED ON SURFACE' },
          ],
          story:
            'Spirit and Opportunity landed in January 2004 for missions planned to last 90 sols, and their discoveries of mineral evidence for past water changed how we understand ancient Mars. Spirit fell silent in 2010 after becoming stuck in soft sand, and Opportunity went quiet during a global dust storm in 2018.',
        },
        hotspots: [],
        timeline: [],
      },
      {
        id: 'ingenuity',
        name: 'Ingenuity Helicopter',
        year: 2021,
        url: 'https://raw.githubusercontent.com/Abandoned-but-not-forgotten-Dinknesh/Dinknesh/main/Ingenuity-v1.glb',
        modelRotation: [0, 0, 0],
        modelScale: 1,
        sites: [{ label: 'Jezero Crater', lat: 18.44, lon: 77.45 }],
        placard: {
          title: 'Ingenuity: The First Flight on Another World',
          telemetry: [
            { label: 'MISSION', value: 'MARS 2020' },
            { label: 'FIRST FLIGHT', value: '19 APR 2021' },
            { label: 'FLIGHTS', value: '72 (PLANNED 5)' },
            { label: 'STATUS', value: 'GROUNDED, MISSION ENDED JAN 2024' },
          ],
          story:
            'Ingenuity made the first powered, controlled flight on another planet in April 2021, then flew 72 times after being planned for just five. In January 2024 a rough landing damaged its rotor blades, and NASA ended the mission, leaving it standing in Jezero Crater.',
        },
        hotspots: [],
        timeline: [],
      },
    ],
  },
] as const;

export const BODY_BY_ID: Record<BodyId, Body> = {
  moon: BODIES[0],
  mars: BODIES[1],
};

export function findHardware(bodyId: BodyId | null, hardwareId: string | null): Hardware | null {
  if (!bodyId || !hardwareId) return null;
  const body = BODY_BY_ID[bodyId];
  return body.hardware.find((h) => h.id === hardwareId) ?? null;
}

export const MUSEUM_COPY = {
  titleEthiopic: 'ድንቅነሽ',
  titleLatin: '(LUCY) SPACE MUSEUM',
  badge: 'EXHIBITION // ABANDONED BUT NOT FORGOTTEN',
  subtitle: "Storytelling about NASA's Discarded Equipment on the Moon and Mars",
  aboutButton: 'About',
  aboutCloseAria: 'Close About panel',
  aboutParagraph:
    'Across half a century of planetary exploration, robotic scouts and crewed landers carried humanity’s instruments to the Moon and Mars. When their missions ended, these machines remained where they came to rest—silent monuments to scientific curiosity preserved in lunar dust and Martian plains.',
  captionTitle: 'ABANDONED BUT NOT FORGOTTEN',
  captionSubtitle: 'Choose a world to explore',
  loadingText: 'INITIALIZING NASA ARTIFACT TELEMETRY...',
  exploreLabel: 'EXPLORE',
  previewHeading: 'RECORDED HARDWARE',
  backToHall: 'Back to the hall',
  backToWorldPrefix: 'Back to',
  resetView: 'Reset View',
  cameraOverview: 'Overview',
  cameraCloseup: 'Close-up',
  orbitLabel: 'ORBIT',
  orbitAuto: 'AUTO',
  orbitManual: 'MANUAL',
  hideHud: 'HIDE HUD',
  showHud: 'SHOW HUD',
  expandPlacard: 'Expand',
  collapsePlacard: 'Collapse',
  previousChapter: 'Prev',
  nextChapter: 'Next',
  editHoverHint: 'Component hotspots coming next',
  calibrateHeading: 'PIN CALIBRATION',
  calibrateLon: 'LON OFFSET',
  calibrateLat: 'LAT OFFSET',
  calibrateCopy: 'Copy values',
  calibrateCopied: 'Copied',
  worldSelectSiteHint: 'Select a landing site pin or step through chapters below.',
  retryButton: 'Retry',
  signalLostPrefix: 'ARTIFACT SIGNAL LOST: Unable to load',
  getExploreAriaLabel: (name: string): string =>
    name.toLowerCase().startsWith('the ') ? 'Explore the Moon' : `Explore ${name}`,
  getMachinesAbandonedLabel: (count: number): string =>
    `${count} ${count === 1 ? 'MACHINE' : 'MACHINES'} ABANDONED`,
  getBeginWithLabel: (firstMachineName: string): string => `Begin with ${firstMachineName} →`,
  getChapterLabel: (currentIndex: number, total: number): string =>
    currentIndex >= 0
      ? `CHAPTER ${currentIndex + 1} OF ${total}`
      : `SURFACE SITES · ${total} CHAPTERS`,
} as const;

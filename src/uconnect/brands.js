// -----------------------------------------------------------------------------
// Brand and region configurations of the Uconnect cloud.
//
// Each brand/market of the official apps has its own Gigya (SAP Customer Data
// Cloud) login site and API key, while the vehicle API is shared per region:
// EMEA and APAC use the European gateway, North America and LATAM the North
// American one. The values are the public keys of the official web portals and
// apps, as reverse-engineered by the py-uconnect / hass-uconnect projects.
//
// The keys of BRANDS are stored in the user configuration (`brand` field of
// the manifest): never rename one.
// -----------------------------------------------------------------------------

const REGION_EU = 'eu-west-1';
const REGION_US = 'us-east-1';

const LOCALE_EU = 'de_de';
const LOCALE_US = 'en_us';
const LOCALE_LATAM = 'pt_br';

const TOKEN_URL_EU = 'https://authz.sdpr-01.fcagcv.com/v2/cognito/identity/token';
const TOKEN_URL_US = 'https://authz.sdpr-02.fcagcv.com/v2/cognito/identity/token';
const TOKEN_URL_US_PREP = 'https://authz.sdpr-02.prep.fcagcv.com/v2/cognito/identity/token';

const API_EU = {
  url: 'https://channels.sdpr-01.fcagcv.com',
  key: 'qLYupk65UU1tw2Ih1cJhs4izijgRDbir2UFHA3Je',
};
const API_US = {
  url: 'https://channels.sdpr-02.fcagcv.com',
  key: 'OgNqp2eAv84oZvMrXPIzP8mR8a6d9bVm1aaH9LqU',
};
const MFA_EU = {
  url: 'https://mfa.fcl-01.fcagcv.com',
  key: 'JWRYW7IYhW9v0RqDghQSx4UcRYRILNmc8zAuh5ys',
};
const MFA_US = {
  url: 'https://mfa.fcl-02.fcagcv.com',
  key: 'fNQO6NjR1N6W0E5A6sTzR3YY4JGbuPv48Nj9aZci',
};
const MFA_US_PREP = {
  url: 'https://mfa.fcl-02.prep.fcagcv.com',
  key: 'lHBEtsqT1Y5oKvzhvA9KW6rkirU3ZtGf44jTIiQV',
};

const EU = {
  region: REGION_EU,
  tokenUrl: TOKEN_URL_EU,
  api: API_EU,
  mfa: MFA_EU,
  locale: LOCALE_EU,
};
const US = {
  region: REGION_US,
  tokenUrl: TOKEN_URL_US,
  api: API_US,
  mfa: MFA_US,
  locale: LOCALE_US,
};

const LATAM = {
  ...US,
  loginApiKey: '3_wY5XajJbqLyuwU33MQI7R6hMa4TuUk5jSZBweZH38Z15u_e16bqSEbi2nRt1tOY1',
  loginUrl: 'https://accounts.us1.gigya.com',
  locale: LOCALE_LATAM,
  brandCode: 'ALL',
};

/**
 * Every supported brand/market, keyed by the value stored in the config.
 * `label` is what the brand select of the manifest shows (kept in sync by
 * test/manifest.test.js).
 */
export const BRANDS = {
  fiat_eu: {
    ...EU,
    label: 'Fiat / Abarth (Europe)',
    loginApiKey: '3_mOx_J2dRgjXYCdyhchv3b5lhi54eBcdCTX4BI8MORqmZCoQWhA0mV2PTlptLGUQI',
    loginUrl: 'https://loginmyuconnect.fiat.com',
    brandCode: 'FIAT',
  },
  fiat_us: {
    ...US,
    label: 'Fiat (USA)',
    loginApiKey: '3_WfFvlZJwcSdOD0LFQCngUV3W390R4Yshpuq3RsZvnV4VG0c9Q6R0RtDwcXc8dTrI',
    loginUrl: 'https://login-us.fiat.com',
    brandCode: 'ALL',
  },
  fiat_canada: {
    ...US,
    label: 'Fiat (Canada)',
    loginApiKey: '3_Ii2kSgQm4ljy19LIZeLwa76OlmWbpSa8w3aSP5VJdx19tub3oWxsFR-HEusDnUEh',
    loginUrl: 'https://login-stage-us.fiat.com',
    tokenUrl: TOKEN_URL_US_PREP,
    mfa: MFA_US_PREP,
    brandCode: 'ALL',
  },
  fiat_asia: {
    ...EU,
    label: 'Fiat (Asia)',
    loginApiKey: '4_YAQNaPqdPEUbbzhvhunKAA',
    loginUrl: 'https://login-iap.fiat.com',
    brandCode: 'FIAT',
  },
  fiat_latam: { ...LATAM, label: 'Fiat (Brazil / LATAM)' },
  jeep_eu: {
    ...EU,
    label: 'Jeep (Europe)',
    loginApiKey: '3_ZvJpoiZQ4jT5ACwouBG5D1seGEntHGhlL0JYlZNtj95yERzqpH4fFyIewVMmmK7j',
    loginUrl: 'https://login.jeep.com',
    brandCode: 'REST',
  },
  jeep_us: {
    ...US,
    label: 'Jeep (USA / Canada)',
    loginApiKey: '3_5qxvrevRPG7--nEXe6huWdVvF5kV7bmmJcyLdaTJ8A45XUYpaR398QNeHkd7EB1X',
    loginUrl: 'https://login-us.jeep.com',
    brandCode: 'ALL',
  },
  jeep_asia: {
    ...EU,
    label: 'Jeep (Asia)',
    loginApiKey: '4_zqGYHC7rM8RCHHl4YFDebA',
    loginUrl: 'https://login-iap.jeep.com',
    brandCode: 'REST',
  },
  jeep_latam: { ...LATAM, label: 'Jeep (Brazil / LATAM)' },
  alfa_romeo_eu: {
    ...EU,
    label: 'Alfa Romeo (Europe)',
    loginApiKey: '3_h8sj2VQI-KYXiunPq9a1QuAA4yWkY0r5AD1u8A8B1RPn_Cvl54xcoc2-InH5onJ1',
    loginUrl: 'https://login.alfaromeo.com',
    brandCode: 'ALFAROMEO',
  },
  alfa_romeo_us_canada: {
    ...US,
    label: 'Alfa Romeo (USA / Canada)',
    loginApiKey: '3_FSxGyaktviayTDRcgp9r9o2KjuFSrHT13wWNN9zPrvAGUCoXPDqoIPOwlBUhck4A',
    loginUrl: 'https://login-us.alfaromeo.com',
    brandCode: 'ALL',
  },
  alfa_romeo_asia: {
    ...EU,
    label: 'Alfa Romeo (Asia)',
    loginApiKey: '4_PSQeADnQ4p5XOaDgT0B5pA',
    loginUrl: 'https://login-iap.alfaromeo.com',
    brandCode: 'ALFAROMEO',
  },
  lancia_eu: {
    // Lancia shares the European Fiat login site (same Uconnect app family).
    ...EU,
    label: 'Lancia (Europe)',
    loginApiKey: '3_mOx_J2dRgjXYCdyhchv3b5lhi54eBcdCTX4BI8MORqmZCoQWhA0mV2PTlptLGUQI',
    loginUrl: 'https://loginmyuconnect.fiat.com',
    brandCode: 'FIAT',
  },
  maserati_eu: {
    ...EU,
    label: 'Maserati (Europe)',
    loginApiKey: '3_rNbVuhn2gIt3BnLjlGsJcMo26Lft3avDne_FLRT34Dy_9OxHtCVOnplwY436lGZa',
    loginUrl: 'https://login.maserati.com',
    brandCode: 'MASERATI',
  },
  maserati_us_canada: {
    ...US,
    label: 'Maserati (USA / Canada)',
    loginApiKey: '3_nShL4-O7IL0OGqroO8AzwiRU0-ZHcBZ4TLBrh5MORusMo5XYxhCLXPYfjI4OOLOy',
    loginUrl: 'https://login-us.maserati.com',
    brandCode: 'ALL',
  },
  maserati_asia: {
    ...EU,
    label: 'Maserati (Asia)',
    loginApiKey: '4_uwF-in6KF-aMbEkPAb-fOg',
    loginUrl: 'https://accounts.au1.gigya.com',
    brandCode: 'MASERATI',
  },
  chrysler_us: {
    ...US,
    label: 'Chrysler (USA)',
    loginApiKey: '3_cv4AzHkJh48-cqwaf_Ahcg1HnsmQqz1lm0sOdVdHW5FjT3m6SyywywOBaskBQqwn',
    loginUrl: 'https://login-us.chrysler.com',
    brandCode: 'ALL',
  },
  chrysler_canada: {
    ...US,
    label: 'Chrysler (Canada)',
    loginApiKey: '3_gdhu-ur4jc2hEryDMnF4YPELkjzSi-invZTjop4isZu4ReHodVcuL44u93cOUqMC',
    loginUrl: 'https://login-stage-us.chrysler.com',
    brandCode: 'ALL',
  },
  dodge_us: {
    ...US,
    label: 'Dodge (USA)',
    loginApiKey: '4_dSRvo6ZIpp8_St7BF9VHGA',
    loginUrl: 'https://login-us.dodge.com',
    brandCode: 'ALL',
  },
  ram_us: {
    ...US,
    label: 'Ram (USA)',
    loginApiKey: '3_7YjzjoSb7dYtCP5-D6FhPsCciggJFvM14hNPvXN9OsIiV1ujDqa4fNltDJYnHawO',
    loginUrl: 'https://login-us.ramtrucks.com',
    brandCode: 'ALL',
  },
  ram_latam: { ...LATAM, label: 'Ram (Brazil / LATAM)' },
};

export const DEFAULT_BRAND = 'fiat_eu';

/**
 * The brand configuration of a config key, falling back to the default one.
 * @param {string} key - Brand key, e.g. `jeep_eu`.
 */
export function getBrand(key) {
  return BRANDS[key] ?? BRANDS[DEFAULT_BRAND];
}

/** Whether a brand belongs to a North American market (miles, Fahrenheit...). */
export function isUsMarket(brand) {
  return brand.region === REGION_US && brand.locale === LOCALE_US;
}

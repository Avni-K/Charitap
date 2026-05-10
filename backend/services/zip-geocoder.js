/**
 * ZIP geocoder abstraction.
 *
 * The default local provider keeps development deterministic and covers the
 * Sacramento/Yolo examples used by Charitap demos. Production can replace this
 * service behind the same interface with a licensed geocoder.
 */
class ZipGeocoder {
  constructor() {
    this.provider = process.env.ZIP_GEOCODER_PROVIDER || 'local';
    this.localZipMap = {
      // Sacramento metro
      '94203': [-121.4944, 38.5816],
      '94204': [-121.4944, 38.5816],
      '94205': [-121.4944, 38.5816],
      '95616': [-121.7405, 38.5449],
      '95618': [-121.6920, 38.5550],
      '95691': [-121.5427, 38.5805],
      '95776': [-121.7733, 38.6785],
      '95811': [-121.4897, 38.5841],
      '95814': [-121.4944, 38.5816],
      '95816': [-121.4670, 38.5735],
      '95817': [-121.4573, 38.5527],
      '95818': [-121.4961, 38.5569],
      '95820': [-121.4447, 38.5339],
      '95822': [-121.4933, 38.5121],
      '95823': [-121.4433, 38.4747],
      '95824': [-121.4411, 38.5173],
      '95825': [-121.4078, 38.5891],
      '95826': [-121.3789, 38.5449],
      '95828': [-121.3997, 38.4882],
      '95831': [-121.5297, 38.4920],
      '95833': [-121.4958, 38.6174],
      '95834': [-121.5257, 38.6386],
      '95835': [-121.5366, 38.6757],
      '95838': [-121.4447, 38.6416],
      '95841': [-121.3544, 38.6612],
      '95864': [-121.3769, 38.5866],
      // Bay Area / San Francisco
      '94102': [-122.4194, 37.7749],
      '94103': [-122.4087, 37.7749],
      '94104': [-122.4000, 37.7925],
      '94105': [-122.3892, 37.7878],
      '94107': [-122.3965, 37.7595],
      '94110': [-122.4153, 37.7481],
      '94111': [-122.4002, 37.7990],
      '94112': [-122.4386, 37.7205],
      '94115': [-122.4382, 37.7853],
      '94117': [-122.4477, 37.7699],
      '94118': [-122.4630, 37.7820],
      '94122': [-122.4847, 37.7635],
      '94134': [-122.4095, 37.7154],
      // Oakland / East Bay
      '94601': [-122.2257, 37.7652],
      '94602': [-122.2180, 37.7844],
      '94606': [-122.2388, 37.7734],
      '94609': [-122.2659, 37.8301],
      '94612': [-122.2731, 37.8074],
      '94619': [-122.1901, 37.7899],
      // San Jose
      '95101': [-121.8863, 37.3382],
      '95110': [-121.8993, 37.3337],
      '95112': [-121.8725, 37.3518],
      '95126': [-121.9236, 37.3270],
      '95128': [-121.9421, 37.3244],
    };
  }

  normalizeZip(zipCode) {
    if (!zipCode) return null;
    const match = String(zipCode).trim().match(/^\d{5}/);
    return match ? match[0] : null;
  }

  async geocodeZip(zipCode) {
    const zip = this.normalizeZip(zipCode);
    if (!zip) return null;

    if (this.provider !== 'local') {
      console.warn(`[ZipGeocoder] Provider "${this.provider}" is not implemented; using local fallback`);
    }

    const coordinates = this.localZipMap[zip];
    if (!coordinates) return null;

    return this.pointFromCoordinates(coordinates[1], coordinates[0]);
  }

  pointFromCoordinates(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      type: 'Point',
      coordinates: [lng, lat]
    };
  }

  distanceMiles(fromPoint, toPoint) {
    if (!fromPoint?.coordinates || !toPoint?.coordinates) return null;
    const [fromLng, fromLat] = fromPoint.coordinates.map(Number);
    const [toLng, toLat] = toPoint.coordinates.map(Number);
    if (![fromLng, fromLat, toLng, toLat].every(Number.isFinite)) return null;

    const radiusMiles = 3958.8;
    const toRadians = degrees => degrees * Math.PI / 180;
    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(fromLat)) *
        Math.cos(toRadians(toLat)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * radiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

module.exports = new ZipGeocoder();

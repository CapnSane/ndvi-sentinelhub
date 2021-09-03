const axios = require("axios");
const qs = require("querystring");
const fs = require("fs");

function getNDVI(client_data, polygon, width, dateStart, dateEnd, maxCloudCoverage=10) {
  const instance = axios.create({
    baseURL: "https://services.sentinel-hub.com",
  });
  const configToken = {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  };
  const body = qs.stringify({
    client_id: client_data.client_id,
    client_secret: client_data.client_secret,
    grant_type: "client_credentials",
  });
  return instance.post("/oauth/token", body, configToken).then((resp) => {
    const _polygon = [...polygon];
    if (
      polygon[0].lat != polygon[polygon.length - 1].lat ||
      polygon[0].lng != polygon[polygon.length - 1].lng
    )
      _polygon.push(_polygon[0]);

    const { minLng, maxLng, minLat, maxLat } = _polygon.reduce(
      (acc, cur) => {
        return {
          minLng: cur.lng < acc.minLng ? cur.lng : acc.minLng,
          maxLng: cur.lng > acc.maxLng ? cur.lng : acc.maxLng,
          minLat: cur.lat < acc.minLat ? cur.lat : acc.minLat,
          maxLat: cur.lat > acc.maxLat ? cur.lat : acc.maxLat,
        };
      },
      { minLng: 180, maxLng: -180, minLat: 90, maxLat: -90 }
    );
    const height = Math.round((width * (maxLat - minLat)) / (maxLng - minLng));

    const request = {
      input: {
        bounds: {
          properties: {
            crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
          },
          geometry: {
            type: "Polygon",
            coordinates: [_polygon.map((p) => [p.lng, p.lat])],
          },
        },
        data: [
          {
            type: "sentinel-2-l1c",
            dataFilter: {
              timeRange: {
                from: new Date(dateStart).toISOString(),
                to: new Date(dateEnd).toISOString(),
              },
              mosaickingOrder: "mostRecent",
              maxCloudCoverage: maxCloudCoverage,
            },
          },
        ],
      },
      output: {
        width: width,
        height: height,
        responses: [
          {
            identifier: "default",
            format: {
              type: "image/png",
            },
          },
        ],
      },
      evalscript: fs.readFileSync("evalscript.js").toString(),
    };
    const configImage = {
      headers: {
        Accept: "image/png",
        "Content-Type": "application/json",
        Authorization: `Bearer ${resp.data.access_token}`,
      },
      responseType: "stream",
    };
    const body = JSON.stringify(request);
    return instance.post("/api/v1/process", body, configImage);
  });
}

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const polygon = [
  {
    id: "OTyjcMeO039jfg3illSc",
    lat: 27.888807653809973,
    lng: -80.62262288406416,
  },
  {
    id: "cLewtvXoyXS0MKaLY3xj",
    lat: 27.866105444225745,
    lng: -80.62282725565235,
  },
  {
    id: "0lKEThC69R1QdAU7dkFk",
    lat: 27.866415627190747,
    lng: -80.67262206251358,
  },
  // {
  //   id: "XtxciaPwwaDvspCx0Z7W",
  //   lat: 27.889321367722737,
  //   lng: -80.67230056069523,
  // },
];
const path = "hello.png";
const writer = fs.createWriteStream(path);
getNDVI(
  { client_id, client_secret },
  polygon,
  (width = 500),
  (dateStart = 1607753600000),
  (dateEnd = 1610518400000)
).then((resp) => {
  resp.data.pipe(writer);
  console.log(`Parabéns! Sua imagem está em ${path}`);
});

var async       = require('async');
var fs          = require('fs');
var geocode     = require('google-geocode');
var readline    = require('readline');
var WikiScraper = require('wikiscraper');

geocode.setApiKey(process.env.GOOGLE_DEVELOPER_API_KEY);

// Usage: node scripts/gen.js sports/basketball/usa/dream_team.txt sports/basketball/usa/dream_team.geojson
var inFile  = process.argv[2];
var outFile = process.argv[3];

function initFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: []
  };
}

function initFeature(name) {
  return {
    type: 'Feature',
    properties: {
      name: name,
      born: ''
    },
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    }
  };
}

function getFeature(name, cb) {
  var wikiscraper = new WikiScraper([name]);

  console.log('Scraping Wikipedia page of %s', name);
  wikiscraper.scrape(function(err, element) {
    if (err) {
      cb(err);
    }
    else {
      var feature = initFeature(name);

      var summary = element.infobox.summary;
      var born_elems = element.infobox.fields.Born.split('\n');
      var born = born_elems[born_elems.length - 1];

      var feature = initFeature(summary);
      feature.properties.born = born;

      console.log('Geocoding %s birthplace in %s', name, born);
      geocode.getGeocode(born,
        function (geocode) {
          var location = JSON.parse(geocode).results[0].geometry.location;
          feature.geometry.coordinates = [location.lng, location.lat];
          cb(null, feature);
        },
        function (err) {
          cb(err)
        });
    }
  });

}
function getFeatures(names, cb) {
  var tasks = [];
  names.forEach(function (name) {
    var task = function (cb) {
      getFeature(name, cb);
    };
    tasks.push(task);
  });
  async.parallel(tasks, cb);
}

var names = [];

console.log('Reading input file %s', inFile);
var rl = readline.createInterface({
  input: fs.createReadStream(inFile)
});
rl.on('line', function (name) {
  names.push(name);
});
rl.on('close', function () {
  var data = initFeatureCollection();
  getFeatures(names, function (err, features) {
    if (err) {
      console.error(err);
    } else {
      data.features = features;
      console.log('Writing output file %s', outFile);
      fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
    }
  });
});

const SummaryStream = require('./SummaryStream');
const path = require('path');
const chokidar = require('chokidar');
const async = require('async');
const fs = require('fs');
const N3 = require('n3');
const fetch = require('node-fetch');
const argv = require('minimist')(process.argv.slice(2));

if (argv.h || argv._.length < 1)
  return console.log('npm run sender <LDF server dir> [LDF server config file] [-s <summary subdir>] [-h <host url>] [-i <destination inbox>]'), process.exit(1);

const port = 3001;
const ldfDir =  path.join(__dirname, argv._[0])
const ldfConfig = path.join(ldfDir, argv._[1] || 'config.json');
const summaryDir = path.join(ldfDir, argv.s || 'summaries/');

const host = argv.h || `http://localhost:${port}/`;
const dest = argv.i || 'http://example.org/inbox';

// If summaryDir does not exist, create it
if (!fs.existsSync(summaryDir)) {
  fs.mkdirSync(summaryDir);
}

// Initialize empty watcher.
const watcher = chokidar.watch([], {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  alwaysStat: true
});

//TODO: Change this to watching HDT's of a specific config
const datasources = require(ldfConfig).datasources;
const fileMap = {};
for (const datasource in datasources) {
  const config = datasources[datasource];
  if (config.type === 'HdtDatasource') {
    const file = path.join(ldfDir, config.settings.file);
    console.log(`Added ${file} for ${datasource}`);
    watcher.add(file);
    fileMap[file] = datasource;
  }
}

// Initialize task
const q = async.queue(function(file, done) {
  console.log(`Running summarizer for ${file}`);

  const summaryFile = fileMap[file] + '.ttl';
  const summaryStream = new SummaryStream(file);
  const outputStream = fs.createWriteStream(summaryDir + summaryFile);
  const streamWriter = new N3.StreamWriter(summaryStream.prefixes);
  

  summaryStream.pipe(streamWriter);
  streamWriter.pipe(outputStream);

  outputStream.on('close', () => {
    console.log('Summary created. Notifying register.');
    notify(host + fileMap[file], host + 'summaries/' + fileMap[file], dest).then(done);
  });

  // This is here in case any errors occur
  outputStream.on('error', function(err) {
    console.log(err);
  });
}, 1);

watcher
.on('add', path => q.push(path))
.on('change', path => q.push(path));


function notify(self, summary, destination) {
  const body = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    '@id': '',
    '@type': 'Add',
    actor: self,
    object: summary,
    target: destination,
    updated: new Date().toISOString()
  };

  return fetch(destination, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/ld+json' }
  }).then(res => {
    return res.ok;
  });
}

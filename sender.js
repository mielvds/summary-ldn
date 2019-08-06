const SummaryStream = require('./SummaryStream');
const path = require('path');
const chokidar = require('chokidar');
const async = require('async');
const fs = require('fs');
const N3 = require('n3');
const fetch = require('node-fetch');
const argv = require('minimist')(process.argv.slice(2));

if (argv._.length < 1 && argv._.length > 2)
  return console.log('npm run sender <host url> <destination inbox>'), process.exit(1);

const host = argv._[0] || 'http://localhost/';
const dest = argv._[1] || 'http://example.org/inbox';

const datasetsDir =  path.join(__dirname, argv.d || 'datasets/');
const summaryDir =  path.join(__dirname, argv.s || 'summaries/');
const summaryBaseURL = argv.b || (host + 'summaries/');

// If summaryDir does not exist, create it
if (!fs.existsSync(summaryDir)) {
  fs.mkdirSync(summaryDir);
}

// Initialize watcher.
const watcher = chokidar.watch(datasetsDir + '*.hdt', {
  ignored: /(^|[\/\\])\../,
  persistent: true
});

// Initialize task
const q = async.queue(function(file, done) {
  console.log(`Running summarizer for ${file}`);

  const summaryFile = path.basename(file) + '-summary.ttl';
  const summaryStream = new SummaryStream(file);
  const outputStream = fs.createWriteStream(summaryDir + summaryFile);
  const streamWriter = new N3.StreamWriter(summaryStream.prefixes);
  

  summaryStream.pipe(streamWriter);
  streamWriter.pipe(outputStream);

  outputStream.on('close', () => {
    console.log('done!');
    notify(host, summaryBaseURL + summaryFile, dest).then(done);
  });

  // This is here in case any errors occur
  outputStream.on('error', function(err) {
    console.log(err);
  });
}, 1);

watcher.on('change', path => {
  console.log('found this hdt');
  q.push(path);
});

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
  }).then(res => res.json());
}

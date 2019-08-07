const mayktso = require('mayktso');
const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
const fetch = require('node-fetch');
const argv = require('minimist')(process.argv.slice(2));

// if (argv._.length < 1 && argv._.length > 2)
//   return console.log('npm run receiver <host url> <destination inbox>'), process.exit(1);

const config = mayktso.config();
mayktso.init({ config });

console.log(config)

// set dirs
const inboxDir = path.join(config.rootPath, config.inboxPath);
const summaryDir =  path.join(config.rootPath, argv.s || 'received-summaries/');

// Clear inbox
const files = fs.readdirSync(inboxDir);
files.forEach(file => fs.unlinkSync(path.join(inboxDir, file)));

// Initialize watcher.
const watcher = chokidar.watch(inboxDir, {
  ignored: /(^|[\/\\])\../,
  persistent: true
});

watcher
  .on('ready', () => console.log('Initial scan complete. Ready for changes'))
  .on('add', receive);

function receive(filePath) {
  const ldn = JSON.parse(fs.readFileSync(filePath, { encoding: 'UTF-8' }));

  console.log(`Received LDN (${ldn['@type']})`)

  if (ldn['@type'] === 'Add') {
    //download summary
    console.log(`Downloading summary ${ldn.object}!`)
    fetch(ldn.object).then(res => {
      if (res.ok) {
        console.log(`Writing summary ${ldn.actor}!`)
        // write to summary dir
        const dest = fs.createWriteStream(summaryDir + encodeURIComponent(ldn.actor));
        res.body.pipe(dest);
      }
    });
  }
}


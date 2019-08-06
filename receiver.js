const mayktso = require('mayktso');
const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

// if (argv._.length < 1 && argv._.length > 2)
//   return console.log('npm run receiver <host url> <destination inbox>'), process.exit(1);

const config = mayktso.config();
mayktso.init({ config });

// set dirs
const inboxDir = path.join(config.rootPath, config.inboxPath);
const summaryDir =  path.join(config.rootPath, argv.s || 'summaries/');

// Initialize watcher.
const watcher = chokidar.watch(inboxDir, {
  ignored: /(^|[\/\\])\../,
  persistent: true
});

watcher
  .on('ready', () => console.log('Initial scan complete. Ready for changes'))
  .on('add', receive);

function receive(filePath) {
  const ldn = fs.readFileSync(filePath, { encoding: 'UTF-8' });
  console.log(JSON.parse(ldn));

  if (ldn['@type'] === 'Add') {
    //download summary
    fetch(ldn.object).then(res => {
      // write to summary dir
      const dest = fs.createWriteStream(summaryDir + ldn.actor);
      res.body.pipe(dest);
    });
  }
}


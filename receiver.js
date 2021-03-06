const mayktso = require('mayktso');
const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
const fetch = require('node-fetch');
const argv = require('minimist')(process.argv.slice(2));

// if (argv._.length < 1 && argv._.length > 2)
//   return console.log('npm run receiver <host url> <destination inbox>'), process.exit(1);

const config = mayktso.config();
config.port = argv.p | 3001;
config.authority = argv.h || `http://localhost:${config.port}/`
mayktso.init({ config })
.on('notification', receive);

// set dirs
const inboxDir = path.join(config.rootPath, config.inboxPath);
const summaryDir = (argv.s && path.isAbsolute(argv.s)) ? argv.s : path.join(config.rootPath, argv.s || 'received-summaries/');
console.log('DIR: ', summaryDir)

// If summaryDir does not exist, create it
if (!fs.existsSync(summaryDir)) {
  try {
  fs.mkdirSync(summaryDir, { recursive: true });
  } catch (e) {
    console.log(e);
  }
}

// Clear inbox
const files = fs.readdirSync(inboxDir);
files.forEach(file => fs.unlinkSync(path.join(inboxDir, file)));

function receive(data, type, encoding) {
  const ldn = JSON.parse(data);

  console.log(`Received LDN (${ldn['@type']}): ${ldn.object}`)

  if (ldn['@type'] === 'Add') {
    //download summary
    console.log(`Downloading summary ${ldn.object}!`)

    fetch(ldn.object).then(res => {
      if (res.ok) {
        console.log(`Writing summary ${ldn.actor} to ${summaryDir}!`)
        // write to summary dir
        const dest = fs.createWriteStream(path.join(summaryDir, encodeURIComponent(ldn.actor)));
        res.body.pipe(dest);
      } else {
        console.log(`Can't get summary ${ldn.object}: ${res.statusText}!`)
      }
    }).catch(err => console.log('Error during summary download: ' + err));
  }
}


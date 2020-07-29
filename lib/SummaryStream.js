const { Readable } = require("stream");
const hdt = require("hdt");
const RdfString = require("rdf-string");
const { DataFactory, Util } = require("n3");
const { namedNode, literal, quad, blankNode } = DataFactory;
const _ = require("lodash");
const { Bloem } = require("bloem");
const _cliProgress = require("cli-progress");

const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  xsd = "http://www.w3.org/2001/XMLSchema#",
  amf = "http://semweb.mmlab.be/ns/membership#",
  ds = "http://semweb.mmlab.be/ns/summaries#";

const PAGE_SIZE = 20000;
const K = 5;

class SummaryStream extends Readable {
  constructor(file) {
    super({ objectMode: true });

    hdt.fromFile(file).then(async doc => {
      const terms = await doc.searchTerms({ position: "predicate" });

      const bar1 = new _cliProgress.Bar(
        { stopOnComplete: true },
        _cliProgress.Presets.shades_classic
      );
      bar1.start(terms.length, 0);

      console.log(`-- Initializing summary for ${terms.length} predicates`);
      for (const term of terms) {
        console.log(`-- Processing summary for ${term.id}`);

        const subjects = new Set();
        const objects = new Set();

        let i = 0;
        while (true) {
          const limits = {
            offset: i * PAGE_SIZE,
            limit: i * PAGE_SIZE + PAGE_SIZE
          };

          console.log(`-- Searching triples ${limits.offset} to ${limits.limit}`);

          const { triples } = await doc.searchTriples(null, term, null, limits);

          console.log(`-- Found ${triples.length} triples`);
          if (triples.length === 0) break;

          for (const triple of triples) {

            if (Util.isNamedNode(triple.subject)) {
              const authority = this._getDomain(triple.subject.id);
              subjects.add(authority);
            }
              

            if (Util.isNamedNode(triple.object)) {
              if (term === rdf + "type") {
                objects.add(triple.object);
              } else {
                const authority = this._getDomain(triple.object.id);
                objects.add(authority);
              }
            }
          }
          i++;
        }
        //const result = [];

        // Write to stream
        const capability = blankNode();
        const set = blankNode();

        // console.log(
        //   `-- Writing capability for ${subjects.size} subjects and ${
        //     objects.size
        //   } objects.`
        // );

        this.push(quad(set, namedNode(ds + "capability"), capability));

        this.push(
          quad(capability, namedNode(ds + "predicate"), term)
        );

        // add authorities
        subjects.forEach(s =>
          this.push(
            quad(capability, namedNode(ds + "sbjAuthority"), s)
          )
        );

        objects.forEach(o =>
          this.push(
            quad(capability, namedNode(ds + "objAuthority"), o)
          )
        );

        const termObjects = await doc.searchTerms({
          predicate: term,
          position: "object"
        });

        const f = this._constructFilter(termObjects);

        //console.log(`-- Creating and writing filter`);
        const bf = blankNode();

        this.push(quad(capability, namedNode(ds + "objFilter"), bf));
        this.push(quad(bf, namedNode(rdf + "type"), namedNode(f.type)));
        this.push(
          quad(
            bf,
            namedNode(amf + "filter"),
            literal(f.filter, namedNode(xsd + "base64Binary"))
          )
        );
        this.push(
          quad(bf, namedNode(amf + "variable"), namedNode(rdf + "object"))
        );
        this.push(
          quad(
            bf,
            namedNode(amf + "hashes"),
            literal(f.k, namedNode(xsd + "integer"))
          )
        );
        this.push(
          quad(
            bf,
            namedNode(amf + "bits"),
            literal(f.m, namedNode(xsd + "integer"))
          )
        );

        bar1.increment();
      }
      doc.close();
      this.push(null);
    });
  }

  get prefixes() {
    ds,
    rdf,
    amf,
    xsd
  };

  _read(n) {}

  _getDomain(url) {
    const match = url.match(
      /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/\n]+)/
    );

    return namedNode(match[0]);
  }

  _constructFilter(objects) {
    const uris = _.filter(objects, o =>
      Util.isNamedNode(RdfString.stringToTerm(o))
    );

    // estimate k,m. Create bloom
    const probability = 0.01;
    const totalCount = uris.length;

    var m = Math.ceil(
        (-totalCount * Math.log(probability)) / (Math.LN2 * Math.LN2)
      ),
      k = Math.round((m / totalCount) * Math.LN2);

    const filter = new Bloem(m, k);

    uris.forEach(uri => filter.add(Buffer.from(uri)));

    return {
      type: amf + "BloomFilter",
      filter: filter.bitfield.buffer.toString("base64"),
      m: m,
      k: k
    };
  }
}

module.exports = SummaryStream;

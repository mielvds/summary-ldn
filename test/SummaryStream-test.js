require("should");
const { Writable } = require("stream");
const SummaryStream = require("../lib/SummaryStream");

describe("SummaryStream", function () {
  describe("The SummaryStream module", function () {
    it("should be a function", function () {
      SummaryStream.should.be.an.Function();
    });

    it("should be a SummaryStream constructor", function () {
      new SummaryStream("./test/test.hdt").should.be.instanceof(SummaryStream);
    });
  });

  describe("summarizing an HDT document", function () {

    it("should summarize when drained", function (done) {
        var quads = [],
        summaryStream = new SummaryStream("./test/test.hdt");
        outputStream = new ArrayWriter(quads);
        
        summaryStream.pipe(outputStream);

        outputStream.on('error', done);
        outputStream.on('end', function () {
            quads.should.have.length(5);
          done();
        });
    });
  });
});

function ArrayWriter(items) {
    var writer = new Writable({ objectMode: true });
    writer._write = function (chunk, encoding, done) { items.push(chunk); done(); };
    return writer;
  }
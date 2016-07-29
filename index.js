var smpp = require('smpp');
var Rx = require('rx');
var Yaml = require('yamljs');

var settings = Yaml.load('conf/settings.yml');

var sms = settings.sms;
sms.data_coding = 0;
var bind = settings.bind;
var server = settings.smsc;
var config = settings.test;

var session = smpp.connect(server.address, server.port);

session.bind_transceiver(bind, function(pdu) {
  if (pdu.command_status == 0) {
    console.log('Successfully bound');
    Rx.Observable
      .interval(1000)
      .flatMap(() => Rx.Observable.range(0, config.sms_per_second))
      .map((val, i) => createSms(i))
      .take(config.sms_total)
      .subscribe(sms => submit(sms),
        err => console.log('Error: ' + err), () => console.log('Completed'));
  } else {
    console.log("Error -> ", pdu);
  }
});

session.on('deliver_sm', function(pdu) {
  console.log('deliver ->' + pdu);
  session.send(pdu.response());
});

function createSms(i) {
  var a = i;
  var b = i;
  if (config.increment_source_addr_variation > 1 && i >= config.increment_source_addr_variation) {
    a = (i + 1) % config.increment_source_addr_variation;
  }
  if (config.increment_destination_addr_variation > 1 && i >= config.increment_destination_addr_variation) {
    b = (i + 1) % config.increment_destination_addr_variation;
  }
  return {
    source_addr: String(config.increment_source_addr ? sms.source_addr + a : sms.source_addr),
    destination_addr: String(config.increment_destination_addr ? sms.destination_addr + b : sms.destination_addr),
    short_message: sms.short_message + ' ' + i,
    data_coding: sms.data_coding
  }
}

function submit(sm) {
  console.log('sending ->', sm);
  var start = process.hrtime();
  session.submit_sm(sm, function(pdu) {
    if (pdu.command_status == 0) {
      console.info('submit received -> %s %s %s', JSON.stringify(sm), JSON.stringify(pdu), process.hrtime(start));
    } else {
      console.log('error -> %s %s %s ', JSON.stringify(sm), JSON.stringify(pdu), process.hrtime(start));
    }
  });
}

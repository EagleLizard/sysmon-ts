
import dns from 'dns';

export class NetService {
  static dnsLookup(url: string) {
    let dnsPromise: Promise<string>;
    console.log(url);
    dnsPromise = new Promise((resolve, reject) => {
      let dnsOpts: dns.LookupOneOptions;
      dnsOpts = {
        family: 4,
      };
      dns.lookup(url, dnsOpts, (err, address, family) => {
        if(err) {
          return reject(err);
        }
        resolve(address);
      });
    });
    return dnsPromise;
  }
}

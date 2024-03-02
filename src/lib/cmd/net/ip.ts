
import { config } from '../../../config';
import { spawnProc } from '../proc';

export async function ipProc(): Promise<string> {
  switch(config.platform) {
    case 'darwin':
      return ipProcMac();
    case 'linux':
      return ipProcLinux();
    default:
      throw new Error(`ip proc: unhandled platform: ${config.platform}`);
  }
}

async function ipProcMac(): Promise<string> {

  let iface: string;

  let ipCmd: string;
  let ipProcArgs: string[];

  let ipResStr: string;
  let ipAddr: string | undefined;

  iface = await getDefaultMacIface();

  ipCmd = 'ifconfig';
  ipProcArgs = [ iface ];

  let procRes = spawnProc(ipCmd, ipProcArgs);
  ipResStr = await procRes.promise;

  ipResStr.split('\n').some((line) => {
    ipAddr = /inet ([0-9.]+) /.exec(line)?.[1];
    return ipAddr !== undefined;
  });
  if(ipAddr === undefined) {
    throw new Error(`unexpected '${ipCmd} ${ipProcArgs.join(' ')}' command result:\n${ipResStr}`);
  }

  return ipAddr;
}

async function getDefaultMacIface() {
  let routeCmd: string;
  let routeArgs: string[];
  let routeResStr: string;

  let iface: string | undefined;

  routeCmd = 'route';
  routeArgs = [
    'get',
    '1.1.1.1',
  ];

  let procRes = spawnProc(routeCmd, routeArgs);
  routeResStr = await procRes.promise;

  routeResStr.split('\n').some((line) => {
    if(!line.includes('interface: ')) {
      return false;
    }
    iface = /interface: ([a-z0-9]+)/.exec(line)?.[1];
    return iface !== undefined;
  });
  if(iface === undefined) {
    throw new Error(`unexpected '${routeCmd}' command result:\n${routeResStr}`);
  }
  return iface;
}

async function ipProcLinux() {
  let iface: string;

  let ipCmd: string;
  let ipProcArgs: string[];

  let ipResStr: string;
  let ipAddr: string | undefined;

  iface = await getDefaultLinuxIface();

  ipCmd = 'ip';
  ipProcArgs = [
    'a',
    'show',
    iface,
  ];

  let procRes = spawnProc(ipCmd, ipProcArgs);
  ipResStr = await procRes.promise;

  ipResStr.split('\n').some((line) => {
    ipAddr = /inet ([0-9.]+)/.exec(line)?.[1];
    return ipAddr !== undefined;
  });
  if(ipAddr === undefined) {
    throw new Error(`unexpected '${ipCmd} ${ipProcArgs.join(' ')}' command result:\n${ipResStr}`);
  }
  return ipAddr;
}

async function getDefaultLinuxIface(): Promise<string> {
  let routeCmd: string;
  let routeAddr: string;
  let routeArgs: string[];
  let routeResStr: string;

  let iface: string | undefined;

  routeCmd = 'ip';

  routeAddr = '1.1.1.1';
  routeArgs = [
    'route',
    'get',
    routeAddr,
  ];

  let procRes = spawnProc(routeCmd, routeArgs);
  routeResStr = await procRes.promise;
  console.log({
    routeResStr
  });

  routeResStr.split('\n').some((line) => {
    if(!line.trim().startsWith(routeAddr)) {
      return false;
    }
    iface = /([a-z0-9]+) {1,2}src [0-9.]+/.exec(line)?.[1];
    return iface !== undefined;
  });
  if(iface === undefined) {
    throw new Error(`unexpected '${routeCmd} ${routeArgs.join(' ')}' command result:\n${routeResStr}`);
  }
  return iface;
}

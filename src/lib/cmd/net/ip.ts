
import child_process, { ChildProcess } from 'child_process';
import { config } from '../../../config';

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
  let ipProc: ChildProcess;
  let ipProcPromise: Promise<void>;
  let ipProcArgs: string[];

  let ipResStr: string;
  let ipResLines: string[];
  let ipAddrLine: string | undefined;
  let ipAddr: string | undefined;

  iface = await getDefaultMacIface();

  ipCmd = 'ifconfig';
  ipProcArgs = [ iface ];
  ipProc = child_process.spawn(ipCmd, ipProcArgs);
  ipProcPromise = new Promise((resolve, reject) => {
    ipProc.on('close', () => {
      resolve();
    });
    ipProc.on('error', err => {
      console.error(err);
      reject(err);
    });
  });

  ipResStr = '';

  ipProc.stdout?.on('data', (data) => {
    ipResStr += data;
  });
  ipProc.stderr?.on('data', (data) => {
    console.error(`${data}`);
  });
  await ipProcPromise;
  ipResLines = ipResStr.split('\n');
  ipAddrLine = ipResLines.find(line => {
    return line.trim().startsWith('inet ');
  });
  if(ipAddrLine === undefined) {
    throw new Error(`unexpected '${ipCmd} ${ipProcArgs.join(' ')}' command result:\n${ipResStr}`);
  }
  ipAddr = /inet ([0-9.]+) /.exec(ipAddrLine)?.[1];
  if(ipAddr === undefined) {
    throw new Error(`unexpected '${ipCmd} ${ipProcArgs.join(' ')}' command result:\n${ipResStr}`);
  }

  return ipAddr;
}

async function getDefaultMacIface() {
  let routeCmd: string;
  let routeProc: ChildProcess;
  let routePromise: Promise<void>;
  let routeArgs: string[];
  let routeResStr: string;
  let routeResLines: string[];

  let ifaceLine: string | undefined;
  let iface: string | undefined;

  routeCmd = 'route';
  routeArgs = [
    'get',
    '1.1.1.1',
  ];

  routeProc = child_process.spawn(routeCmd, routeArgs);

  routePromise = new Promise((resolve, reject) => {
    routeProc.on('close', () => {
      resolve();
    });
    routeProc.on('error', (err) => {
      console.error(err);
      reject(err);
    });
  });

  routeResStr = '';

  routeProc.stdout?.on('data', (data) => {
    routeResStr += data;
  });
  routeProc.stderr?.on('data', (data) => {
    console.error(`${data}`);
  });
  await routePromise;

  routeResLines = routeResStr.split('\n');

  ifaceLine = routeResLines.find(line => {
    return line.includes('interface: ');
  });

  if(ifaceLine === undefined) {
    throw new Error(`unexpected '${routeCmd}' command result:\n${routeResStr}`);
  }
  iface = /interface: ([a-z0-9]+)/.exec(ifaceLine)?.[1];
  if(iface === undefined) {
    throw new Error(`unexpected '${routeCmd}' command result:\n${routeResStr}`);
  }
  return iface;
}

async function ipProcLinux() {
  let iface: string;

  let ipCmd: string;
  let ipProc: ChildProcess;
  let ipProcPromise: Promise<void>;
  let ipProcArgs: string[];

  let ipResStr: string;
  let ipResLines: string[];
  let ipAddrLine: string | undefined;
  let ipAddr: string | undefined;

  iface = await getDefaultLinuxIface();

  ipCmd = 'ip';
  ipProcArgs = [
    'a',
    'show',
    iface,
  ];
  ipProc = child_process.spawn(ipCmd, ipProcArgs);
  ipProcPromise = new Promise((resolve, reject) => {
    ipProc.on('close', () => {
      resolve();
    });
    ipProc.on('error', (err) => {
      reject(err);
    });
  });

  ipResStr = '';

  ipProc.stdout?.on('data', (data) => {
    ipResStr += data;
  });
  ipProc.stderr?.on('error', (data) => {
    console.error(`${data}`);
  });
  await ipProcPromise;

  ipResLines = ipResStr.split('\n');
  ipAddrLine = ipResLines.find(line => {
    return line.trim().startsWith('inet ');
  });
  if(ipAddrLine === undefined) {
    throw new Error(`unexpected '${ipCmd} ${ipProcArgs.join(' ')}' command result:\n${ipResStr}`);
  }
  ipAddr = /inet ([0-9.]+)/.exec(ipAddrLine)?.[1];
  if(ipAddr === undefined) {
    throw new Error(`unexpected '${ipCmd} ${ipProcArgs.join(' ')}' command result:\n${ipResStr}`);
  }
  return ipAddr;
}

async function getDefaultLinuxIface(): Promise<string> {
  let routeCmd: string;
  let routeProc: ChildProcess;
  let routePromise: Promise<void>;
  let routeAddr: string;
  let routeArgs: string[];
  let routeResStr: string;
  let routeResLines: string[];

  let ifaceLine: string | undefined;
  let iface: string | undefined;

  routeCmd = 'ip';

  routeAddr = '1.1.1.1';
  routeArgs = [
    'route',
    'get',
    routeAddr,
  ];
  routeProc = child_process.spawn(routeCmd, routeArgs);
  routePromise = new Promise((resolve, reject) => {
    routeProc.on('close', () => {
      resolve();
    });
    routeProc.on('error', (err) => {
      reject(err);
    });
  });

  routeResStr = '';

  routeProc.stdout?.on('data', (data) => {
    routeResStr += data;
  });
  routeProc.stderr?.on('error', (data) => {
    console.error(`${data}`);
  });
  await routePromise;
  routeResLines = routeResStr.split('\n');
  ifaceLine = routeResLines.find(line => {
    return line.trim().startsWith(routeAddr);
  });
  if(ifaceLine === undefined) {
    throw new Error(`unexpected '${routeCmd} ${routeArgs.join(' ')}' command result:\n${routeResStr}`);
  }
  iface = /([a-z0-9]+) {2}src [0-9.]+/.exec(ifaceLine)?.[1];
  if(iface === undefined) {
    throw new Error(`unexpected '${routeCmd} ${routeArgs.join(' ')}' command result:\n${routeResStr}`);
  }
  return iface;
}

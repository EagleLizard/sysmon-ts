
import fs from 'fs';

import { Bit, HuffHeader, HuffTree } from '../../models/encode/huff-tree';
import { HuffStr, getHuffStr } from './huff';
import path from 'path';
import { joinPath, mkdirIfNotExist } from '../../util/files';
import { ENCODE_OUT_DATA_DIR_PATH } from '../../../constants';
import { EncodeOpts, getEncodeArgs, getEncodeOpts } from '../parse-sysmon-args';
import { ParsedArgv2 } from '../parse-argv';

/*
  huffman encoding
*/
export async function encodeMain(parsedArgv: ParsedArgv2) {
  let args: string;
  let opts: EncodeOpts;

  let filePath: string | undefined;
  let decodeOpt: boolean;

  args = getEncodeArgs(parsedArgv.args);
  opts = getEncodeOpts(parsedArgv.opts);

  mkdirIfNotExist(ENCODE_OUT_DATA_DIR_PATH);

  filePath = args;
  decodeOpt = opts.decode ?? false;

  if(decodeOpt) {
    decodeFile(filePath);
  } else {
    encodeFile(filePath);
  }
}

function decodeFile(filePath: string) {
  let fileData: Buffer;
  let fileDataStr: string;
  let huffTree: HuffTree;
  let huffHeader: HuffHeader;
  let decodedHuffStr: HuffStr;
  fileData = fs.readFileSync(filePath);
  fileDataStr = fileData.toString();
  huffHeader = HuffTree.parseHeader(fileDataStr);
  huffTree = HuffTree.fromHeader(huffHeader.header);
  decodedHuffStr = huffTree.decodeHuffStr(fileDataStr.substring(huffHeader.pos));
  let decodedOutFileName = `decoded_${path.basename(filePath)}`;
  let decodedOutFilePath = joinPath([
    ENCODE_OUT_DATA_DIR_PATH,
    decodedOutFileName,
  ]);
  fs.writeFileSync(decodedOutFilePath, decodedHuffStr);
}

function encodeFile(filePath: string) {
  let fileData: Buffer;
  let fileDataStr: string;
  let huffTree: HuffTree;
  let codeLookupMap: Map<string, Bit[]>;
  let encodedFileHuffStr: HuffStr;

  fileData = fs.readFileSync(filePath);
  fileDataStr = fileData.toString();

  huffTree = HuffTree.init(fileDataStr);

  codeLookupMap = huffTree.getLookupMap();

  encodedFileHuffStr = getHuffStr(fileDataStr, codeLookupMap);

  console.log(`fileDataStr.length: ${fileDataStr.length.toLocaleString()}`);
  console.log(`encodedFileData.length: ${encodedFileHuffStr.length.toLocaleString()}`);
  let encodedFileDataStr = huffTree.encode(fileDataStr);
  let encodedOutFileName = `encoded_${path.basename(filePath)}`;
  let encodedOutFilePath = joinPath([
    ENCODE_OUT_DATA_DIR_PATH,
    encodedOutFileName,
  ]);
  fs.writeFileSync(encodedOutFilePath, encodedFileDataStr);
}


import fs from 'fs';
import { SysmonCommand } from '../sysmon-args';
import { HuffTree } from '../../models/encode/huff-tree';
import { HuffStr, decodeHuffStr, getHuffStr } from './huff';
import path from 'path';
import { joinPath, mkdirIfNotExist } from '../../util/files';
import { ENCODE_OUT_DATA_DIR_PATH } from '../../../constants';

/*
  huffman encoding
*/
export async function encodeMain(cmd: SysmonCommand) {
  let decodedHuffStr: string;
  let huffTree: HuffTree;
  let codeLookupMap: Map<string, (0 | 1)[]>;
  let filePath: string | undefined;
  let fileData: Buffer;
  let fileDataStr: string;
  let encodedFileHuffStr: HuffStr;

  mkdirIfNotExist(ENCODE_OUT_DATA_DIR_PATH);

  if(cmd.args?.[0] === undefined) {
    throw new Error('encode expects at least 1 argument');
  }
  filePath = cmd.args[0];

  fileData = fs.readFileSync(filePath);
  fileDataStr = fileData.toString();

  huffTree = HuffTree.init(fileDataStr);

  codeLookupMap = huffTree.getLookupMap();

  encodedFileHuffStr = getHuffStr(fileDataStr, codeLookupMap);
  decodedHuffStr = decodeHuffStr(encodedFileHuffStr, huffTree);

  console.log(`fileDataStr.length: ${fileDataStr.length.toLocaleString()}`);
  console.log(`encodedFileData.length: ${encodedFileHuffStr.length.toLocaleString()}`);
  console.log(`decoded string len: ${decodedHuffStr.length.toLocaleString()}`);
  let encodedFileDataStr = huffTree.encode(fileDataStr);
  let encodedOutFileName = `encoded_${path.basename(filePath)}`;
  let encodedOutFilePath = joinPath([
    ENCODE_OUT_DATA_DIR_PATH,
    encodedOutFileName,
  ]);
  fs.writeFileSync(encodedOutFilePath, encodedFileDataStr);
  let decodedOutFileName = `decoded_${path.basename(filePath)}`;
  let decodedOutFilePath = joinPath([
    ENCODE_OUT_DATA_DIR_PATH,
    decodedOutFileName,
  ]);
  fs.writeFileSync(decodedOutFilePath, decodedHuffStr);

}


import fs from 'fs';
import { isString } from '../../util/validate-primitives';
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
  const testStr = 'A llama likely lolls lazily about.';
  let huffTree: HuffTree;
  let codeLookupMap: Map<string, (0 | 1)[]>;

  mkdirIfNotExist(ENCODE_OUT_DATA_DIR_PATH);

  huffTree = HuffTree.init(testStr);
  codeLookupMap = huffTree.getLookupMap();

  let huffStr = getHuffStr(testStr, codeLookupMap);
  let decodedHuffStr = decodeHuffStr(huffStr, huffTree);
  console.log(`input string len: ${testStr.length}`);
  console.log(`encoded string len: ${huffStr.length}`);
  console.log(`decoded string len: ${decodedHuffStr.length}`);
  console.log(testStr);
  console.log(decodedHuffStr);

  let filePath: string | undefined;
  filePath = cmd.args?.[0];
  if(isString(filePath)) {
    let fileData: Buffer;
    let fileDataStr: string;
    let encodedFileHuffStr: HuffStr;

    fileData = fs.readFileSync(filePath);
    fileDataStr = fileData.toString();

    huffTree = HuffTree.init(fileDataStr);

    codeLookupMap = huffTree.getLookupMap();

    encodedFileHuffStr = getHuffStr(fileDataStr, codeLookupMap);
    decodedHuffStr = decodeHuffStr(encodedFileHuffStr, huffTree);
    let huffTreeStr: string;
    let huffTreeHeader: string;
    huffTreeStr = huffTree.getTreeStr();
    huffTreeHeader = `${huffTreeStr.length}:${huffTreeStr}`;
    console.log('huffTreeHeader:');
    console.log(huffTreeHeader);

    console.log(`fileDataStr.length: ${fileDataStr.length.toLocaleString()}`);
    console.log(`encodedFileData.length: ${encodedFileHuffStr.length.toLocaleString()}`);
    console.log(`decoded string len: ${decodedHuffStr.length.toLocaleString()}`);
    let outFileName = `decoded_${path.basename(filePath)}`;
    let outFilePath = joinPath([
      ENCODE_OUT_DATA_DIR_PATH,
      outFileName,
    ]);
    fs.writeFileSync(outFilePath, decodedHuffStr);
  }

}

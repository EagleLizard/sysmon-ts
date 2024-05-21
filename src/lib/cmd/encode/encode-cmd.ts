
import fs from 'fs';
import { isString } from '../../util/validate-primitives';
import { SysmonCommand } from '../sysmon-args';
import { HuffTree } from '../../models/encode/huff-tree';
import { HuffStr, getHuffStr } from './huff';

/*
  huffman encoding
*/
export async function encodeMain(cmd: SysmonCommand) {
  const testStr = 'A llama likely lolls lazily about.';
  let huffTree: HuffTree;
  let codeLookupMap: Map<string, (0 | 1)[]>;

  huffTree = HuffTree.init(testStr);
  codeLookupMap = huffTree.getLookupMap();

  let huffStr = getHuffStr(testStr, codeLookupMap);
  let decodedHuffStr = huffTree.decodeHuffStr(huffStr);
  console.log(`input string len: ${testStr.length}`);
  console.log(`encoded string len: ${huffStr.val.length}`);
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
    let huffTreeStr: string;
    let huffTreeHeader: string;
    huffTreeStr = huffTree.getTreeStr();
    huffTreeHeader = `${huffTreeStr.length}:${huffTreeStr}`;
    console.log('huffTreeHeader:');
    console.log(huffTreeHeader);

    console.log(`fileData.length: ${fileData.length.toLocaleString()}`);
    console.log(`encodedFileData.length: ${encodedFileHuffStr.val.length.toLocaleString()}`);
  }

}

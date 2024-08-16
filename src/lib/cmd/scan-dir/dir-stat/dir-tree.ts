
import path from 'path';

export type FileCbParams = {
  filePath: string;
  size: number;
};

export class DirTreeNode {
  val: string;
  isDir: boolean;
  size: number;
  parent: DirTreeNode | undefined;
  children: DirTreeNode[];
  constructor(val: string, isDir: boolean, size: number) {
    this.val = val;
    this.isDir = isDir;
    this.size = size;

    this.children = [];
    this.parent = undefined;
  }
  addChild(childNode: DirTreeNode) {
    childNode.parent = this;
    this.children.push(childNode);
  }
  fullPath(): string {
    let currNode: DirTreeNode | undefined;
    let pathParts: string[];
    currNode = this;
    pathParts = [];
    while(currNode !== undefined) {
      pathParts.push(currNode.val);
      currNode = currNode.parent;
    }
    pathParts.reverse();
    return pathParts.join(path.sep);
  }
}

export class DirTree {
  root: DirTreeNode;
  constructor() {
    this.root = new DirTreeNode('', true, 0);
  }
  insertFile(filePath: string, size: number) {
    let pathParts: string[];
    let currNode: DirTreeNode;
    pathParts = filePath.split(path.sep)
      .filter(pathPart => {
        return pathPart.length > 0;
      });
    currNode = this.root;
    for(let i = 0; i < pathParts.length; ++i) {
      let currPathPath: string;
      let nextNode: DirTreeNode | undefined;
      let isLeaf: boolean;
      let currSize: number;
      isLeaf = i === (pathParts.length - 1);
      currSize = isLeaf ? size : 0;

      currPathPath = pathParts[i];
      nextNode = currNode.children.find(currChild => {
        return currChild.val === currPathPath;
      });
      if(nextNode === undefined) {
        nextNode = new DirTreeNode(currPathPath, !isLeaf, currSize);
        currNode.addChild(nextNode);
        nextNode.parent = currNode;
      }
      currNode = nextNode;
    }
  }

  traverse(pathCb: (params: FileCbParams) => void) {
    let currNode: DirTreeNode;
    currNode = this.root;
    _traverse(currNode, [ this.root ]);
    function _traverse(dirNode: DirTreeNode, soFar: DirTreeNode[]) {
      if(dirNode.children.length === 0) {
        let filePath: string;
        filePath = soFar.map(currNode => {
          return currNode.val;
        }).join(path.sep);
        pathCb({
          filePath,
          size: dirNode.size ?? 0,
        });
        return;
      }
      for(let i = 0; i < dirNode.children.length; ++i) {
        let currChild: DirTreeNode;
        currChild = dirNode.children[i];
        soFar.push(currChild);
        _traverse(currChild, soFar);
        soFar.pop();
      }
    }
  }
}

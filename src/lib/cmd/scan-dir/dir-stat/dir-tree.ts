
import path from 'path';

export class DirTreeNode {
  val: string;
  parent: DirTreeNode | undefined;
  children: DirTreeNode[];
  constructor(val: string) {
    this.val = val;
    this.children = [];
    this.parent = undefined;
  }
  addChild(childNode: DirTreeNode) {
    childNode.parent = this;
    this.children.push(childNode);
  }
}

export class DirTree {
  root: DirTreeNode;
  constructor() {
    this.root = new DirTreeNode('');
  }
  insertFile(filePath: string) {
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
      currPathPath = pathParts[i];
      nextNode = currNode.children.find(currChild => {
        return currChild.val === currPathPath;
      });
      if(nextNode === undefined) {
        nextNode = new DirTreeNode(currPathPath);
        currNode.addChild(nextNode);
      }
      currNode = nextNode;
    }
  }
  traverse(pathCb: (filePath: string) => void) {
    let currNode: DirTreeNode;
    currNode = this.root;
    _traverse(currNode, [ this.root ]);
    function _traverse(dirNode: DirTreeNode, soFar: DirTreeNode[]) {
      if(dirNode.children.length === 0) {
        let filePath: string;
        filePath = soFar.map(currNode => {
          return currNode.val;
        }).join(path.sep);
        pathCb(filePath);
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

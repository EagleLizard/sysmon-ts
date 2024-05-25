
export type ParsedArgv2 = {
  cmd: string;
  args: string[];
  opts: Map<string, string[]>;
};

type ArgvToken = {
  kind: ArgvTokenEnum;
  val: string;
}

enum ArgvTokenEnum {
  CMD = 'CMD',
  FLAG = 'FLAG',
  ARG = 'ARG',
  END = 'END',
}

enum ArgvParserState {
  INIT = 'INIT',
  CMD = 'CMD',
  FLAG = 'FLAG',
  ARG = 'ARG',
}

export function parseArgv2(argv: string[]): ParsedArgv2 {
  let parsedArgv: ParsedArgv2;
  let cmd: string | undefined;
  let cmdArgs: string[];
  let flags: Map<string, string[]>;

  let argvParser: Generator<ArgvToken>;
  let iterRes: IteratorResult<ArgvToken>;
  let currToken: ArgvToken;
  let tokenStack: ArgvToken[];

  argv = argv.slice(2);
  cmdArgs = [];
  flags = new Map();

  argvParser = getArgvParser(argv);
  tokenStack = [];

  while(!(iterRes = argvParser.next()).done) {
    currToken = iterRes.value;
    /*
      CMD and FLAG token types are terminal. We'll consume the current token stack, and
        validate the results
    */
    switch(currToken.kind) {
      case ArgvTokenEnum.FLAG:
      case ArgvTokenEnum.CMD:
      case ArgvTokenEnum.END:
        consumeCmdOrFlag();
        tokenStack.push(currToken);
        break;
      case ArgvTokenEnum.ARG:
        tokenStack.push(currToken);
    }
  }

  if(cmd === undefined) {
    throw new Error('cmd is undefined');
  }

  parsedArgv = {
    cmd,
    args: cmdArgs,
    opts: flags,
  };

  return parsedArgv;

  function consumeCmdOrFlag() {
    if(tokenStack.length < 1) {
      return;
    }
    let token: ArgvToken | undefined;
    let argTokens: ArgvToken[];
    let argToken: ArgvToken | undefined;
    argTokens = [];
    while(
      ((token = tokenStack.pop()) !== undefined)
      && (token.kind === ArgvTokenEnum.ARG)
    ) {
      argTokens.push(token);
    }
    // last token should be set to FLAG only
    if(
      (token === undefined)
      || (
        token.kind !== ArgvTokenEnum.FLAG
        && token.kind !== ArgvTokenEnum.CMD
      )
    ) {
      throw new Error(`Unexpected Token: expected CMD or FLAG, popped: ${token?.kind}`);
    }
    if(token.kind === ArgvTokenEnum.CMD) {
      if(cmd !== undefined) {
        throw new Error(`Unexpected Token: attempt to set cmd to ${token.val}, but cmd already set to ${cmd}`);
      }
      cmd = token.val;
      while((argToken = argTokens.pop()) !== undefined) {
        cmdArgs.push(argToken.val);
      }
    } else {
      let flagOpts: string[] | undefined;
      if((flagOpts = flags.get(token.val)) !== undefined) {
        throw new Error(`Unexpected Token: Attempt to set flag '${token.val}', but flag already set.`);
      }
      flagOpts = [];
      while((argToken = argTokens.pop()) !== undefined) {
        flagOpts.push(argToken.val);
      }
      flags.set(token.val, flagOpts);
    }
  }
}

function *getArgvParser(argv: string[]): Generator<ArgvToken> {
  let pos: number;
  let parseState: ArgvParserState;
  parseState = ArgvParserState.INIT;
  pos = 0;
  while(pos < argv.length) {
    let currArg = argv[pos];
    switch(parseState) {
      case ArgvParserState.INIT:
        if(pos === 0) {
          parseState = ArgvParserState.CMD;
        } else if(isFlagArg(currArg)) {
          parseState = ArgvParserState.FLAG;
        } else {
          parseState = ArgvParserState.ARG;
        }
        break;
      case ArgvParserState.CMD:
        if(!isCmdStr(currArg)) {
          throw new Error(`Parse Error: invalid cmd: '${currArg}'`);
        }
        yield {
          kind: ArgvTokenEnum.CMD,
          val: currArg,
        };
        pos++;
        parseState = ArgvParserState.INIT;
        break;
      case ArgvParserState.FLAG:
        yield {
          kind: ArgvTokenEnum.FLAG,
          val: currArg,
        };
        pos++;
        parseState = ArgvParserState.INIT;
        break;
      case ArgvParserState.ARG:
        yield {
          kind: ArgvTokenEnum.ARG,
          val: currArg,
        };
        pos++;
        parseState = ArgvParserState.INIT;
        break;
    }
  }
  yield {
    kind: ArgvTokenEnum.END,
    val: '',
  };
}

function isFlagArg(argStr: string): boolean {
  return /^-{1,2}[a-zA-Z][a-zA-Z-]*/.test(argStr);
}

function isCmdStr(cmdStr: string): boolean {
  return /^[a-z0-9]+([a-z0-9]+|-)*[a-z0-9]+/.test(cmdStr);
}
